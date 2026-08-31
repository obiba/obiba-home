# Durability and Disk Space Safeguards

**Created:** 2026-08-31
**Issue:** [obiba/opal#4186](https://github.com/obiba/opal/issues/4186) — "Improve Missing Data Safeguards"
**Scope:** points 1 (crash durability) and 2 (free disk space) of that issue
**Verified against:** H2 2.4.240 sources, Opal `master` at `4f1357536`, post-`106ad0fb9` (config DB on H2)
**Target release:** Opal 6.0.0

## 1. What the issue got right, and what it got wrong

Issue #4186 was filed after the OrientDB → H2 migration and raises three points. All three
concerns are real, but point 1's *proposed fix* is a no-op. Both halves need stating before the
plan makes sense.

### 1.1 `CHECKPOINT SYNC` at shutdown is already what H2 does

Both paths converge on the same `FileChannel.force(true)`:

```
CHECKPOINT SYNC
  TransactionCommand.java:61-63  → Database.sync()
  Store.java:316-319             → flush() (mvStore.commit()) + mvStore.sync()
  MVStore.java:1076-1082         → fileStore.sync()
  SingleFileStore.java:176-186   → fileChannel.force(true)

clean close
  Database.java:1301-1331 closeOpenFilesAndUnlock() → store.close(t)
  Store.java:341-354             → mvStore.close(t)
  MVStore.java:780-806 closeStore(normalShutdown=true) → commit() + fileStore.stop()
  FileStore.java:273-280 stop()  → mvStore.commit() + writeCleanShutdown()
  FileStore.java:807-818          → writeCleanShutdownMark() + sync()
  SingleFileStore.java:176-186   → fileChannel.force(true)
```

That close is reached two independent ways, both on H2 defaults Opal does not override:

| Trigger | Evidence | Applies because |
|---|---|---|
| Last connection closes | `Database.removeSession():1089-1110` closes when `userSessions` empties and `closeDelay == 0` | `DB_CLOSE_DELAY` defaults to 0; Opal never sets it. Closing the DBCP pool is enough. |
| JVM shutdown hook | `Database.java:386-387` registers `OnExitDatabaseCloser` for any persistent DB; `onShutdown():1178-1184` calls `close(true)` | `DB_CLOSE_ON_EXIT` defaults to `persistent` (`Database.java:280`), i.e. true for `jdbc:h2:file:` |

The pool close happens through Spring's inferred destroy on `configDataSource`
(`ConfigDatabaseConfiguration.java:120-135`) and through
`DefaultDatabaseRegistry.stop():92-93` → `invalidateAll()` → `DataSourceRemovalListener:440-458`
for the storage pools.

**Consequence: do not implement a shutdown checkpoint.** It would add code that does nothing.

The one degraded case is an explicit `DB_CLOSE_ON_EXIT=FALSE`, where the hook falls back to
`Database.checkpoint():2272-2277` → `store.flush()` → `commit()` with **no force**. Opal does not
set it, but nothing stops an administrator from adding it to a registered database URL. That gap
is closed in §3.1.

The issue's parenthetical — "reuse the same shutdown sequence already in place for the current
database engine" — also points at the wrong thing. That sequence is
`DefaultOpalRuntime.stop():81-105`, which removes Magma `Datasource`s (project data disposal;
`JdbcDatasource.onDispose()` in the Magma tree is empty). It never touches the configuration
database.

### 1.2 The running-state window is real

`FileStore.writeInBackground():1833-1852` calls only `mvStore.tryCommit()` — never `sync()`.
Nothing forces data to physical disk while Opal runs. `WRITE_DELAY` (`autoCommitDelay`,
`MVStore.java:309`) sets only how often that commit runs; it buys **no** durability. A periodic
`CHECKPOINT SYNC` is the only thing that shrinks the power-loss window.

This is the surviving half of point 1, and the whole of §3.2.

### 1.3 H2 does not degrade gracefully when the disk fills

This is what makes point 2 urgent rather than cosmetic. The write path catches the IO failure and
calls `mvStore.panic()` (`FileStore.java:1444,1446`), which sets `panicException`
(`MVStore.java:500-506`); the next `unlockAndCheckPanicCondition()` (`MVStore.java:491-498`) calls
`closeImmediately()` — `closeStore(normalShutdown=false)`, i.e. **close without persisting**.

A full disk does not produce a failed `INSERT` to retry. It takes the database down and drops
everything not yet written. There is no recovery path short of a restart.

**Consequence: the check must be pre-emptive.** An exception handler around writes is too late.

## 2. What has to be watched

Separate paths, frequently separate mounts. The check is per-`FileStore`, never one global number.

| Path | Source | Written by | Growth |
|---|---|---|---|
| `${OPAL_HOME}/data/config` | `ConfigDatabaseConfiguration.java:102` | configuration database | small, but its loss is the costly one |
| `${OPAL_HOME}/data/h2` | `DataSourceFactory.java:33` | registered storage databases | unbounded on import |
| VFS root | `fileSystemRoot` in `opal-config.xml`, cf. `DefaultOpalFileSystemService.java:61-77` | uploads, exports, reports, `tmp` | unbounded, user-driven |
| `${OPAL_HOME}/data/opal-search-es` | search plugin | indices | moderate |
| `${OPAL_HOME}/logs`, `java.io.tmpdir` | logging, R sessions | logs, workspaces | moderate |

## 3. Plan

### 3.0 Shared foundation

New package `org.obiba.opal.core.runtime.storage` in `opal-core`, holding both services. One
configuration block, `org.obiba.opal.storage.*`, documented in
`opal-core/src/main/resources/META-INF/defaults.properties` and
`opal-server/src/main/conf/opal-config.properties`.

`@Scheduled` is already available: `ScheduledAnnotationBeanPostProcessor` is registered at
`opal-core/src/main/resources/spring/opal-core/context.xml:23`, and the annotation is already used
by `OpalRSessionManager.java:275` and `RockServerDiscoveryService.java:48`.

**D1. Declare a dedicated `ThreadPoolTaskScheduler` (pool 2–3).** Spring's default `@Scheduled`
scheduler is single-threaded. A `CHECKPOINT SYNC` on a large store would otherwise delay
`OpalRSessionManager`'s 60-second cleanup.

### 3.1 Point 1a — close the `DB_CLOSE_ON_EXIT` hole

`H2DatabaseUrls.validateProperties` today rejects only `INIT=` (for security). Extend it to reject
`DB_CLOSE_ON_EXIT=FALSE` and `DB_CLOSE_DELAY=-1` — precisely the two settings that would silently
disable the shutdown fsync everything else in this plan assumes. Extend `H2DatabaseUrlsTest`
accordingly, and assert that the config DB URL built at `ConfigDatabaseConfiguration.java:203`
carries neither.

Twenty lines, and it protects a guarantee we otherwise get for free.

### 3.2 Point 1b — periodic `CHECKPOINT SYNC`

New `H2Checkpointer`:

- `@Scheduled(fixedDelayString = "${org.obiba.opal.storage.checkpoint.interval:300000}")`;
  `<= 0` disables.
- Targets: the `configDataSource` bean (`ConfigDatabaseConfiguration.java:120`) plus the storage
  pools **already loaded** in `DefaultDatabaseRegistry`'s `dataSourceCache` (line 79).
- **D2. Requires a new `Iterable<DataSource> getLoadedDataSources()` on `DatabaseRegistry`**,
  returning `dataSourceCache.asMap().values()`. It must *not* force-load through the
  `CacheLoader` — otherwise the checkpointer becomes a periodic "open every registered database".
- H2 only (reuse `H2DatabaseUrls.isH2`). Skip an external PostgreSQL configuration database, which
  manages its own durability.
- Short-lived `Connection` + `Statement.execute("CHECKPOINT SYNC")`. The statement requires admin
  (`TransactionCommand.java:62` → `checkAdmin()`); Opal creates these databases so it holds that
  right, but catch and log **once per datasource** rather than every tick, for the external-H2
  edge case.
- **No shutdown checkpoint** — see §1.1.

### 3.3 Point 2a — `DiskSpaceService`

`DiskSpaceService implements SystemService` (same lifecycle contract as `DefaultDatabaseRegistry`;
`SystemService` extends `InitializingBean`/`DisposableBean` with `start()`/`stop()`).

- API: `Level level()`, `DiskStatus statusOf(Path)`,
  `checkWritable(Path, long needed) throws InsufficientStorageException`.
- Watched paths resolved at `start()` from §2. De-duplicate by `Files.getFileStore(p)` so one
  mount is sampled once.
- Sampler at `${org.obiba.opal.storage.disk.interval:60000}`.
- **D3. Thresholds as `max(percent, bytes)`.** 5% of 10 TB is 500 GB; 5% of 20 GB is 1 GB. Only
  one of those is a sane floor.

| Level | Percent | Bytes | Behaviour |
|---|---|---|---|
| `WARN` | 15 | 5 GiB | log + admin notification, nothing blocked |
| `DEGRADED` | 5 | 1 GiB | refuse unbounded, user-initiated, restartable writes |
| `CRITICAL` | 1 | 256 MiB | additionally cancel running writers |

- **D4. `getUsableSpace() == 0` or `IOException` → `UNKNOWN`, which never blocks.** Log once per
  path behind an `AtomicBoolean`. A broken checker must not become an outage.

### 3.4 Point 2b — enforcement

The asymmetry that matters: **block the big writers early so the small critical ones keep
headroom.** Reads, login and configuration writes keep working at `DEGRADED`.

1. **`CommandJob.run():154-176`** — the single choke point for `ImportCommand`, `CopyCommand`,
   `BackupCommand`, `RestoreCommand`, `ExportVCFCommand` and `AnalyseCommand`. Insert the gate
   before `command.execute()` (line 164): at `DEGRADED`, set `Status.FAILED` and `printf` the
   volume and free bytes. One edit covers every long-running writer.
2. **`FilesResource` upload** (`opal-core-ws/.../web/FilesResource.java`) — pre-flight
   `Content-Length × safetyFactor` against the VFS root, reject with **HTTP 507 Insufficient
   Storage**. The sampler cannot see a single 40 GB upload coming; this is where a known size is
   available in advance.
3. **At `CRITICAL`**, flip running jobs to `Status.CANCEL_PENDING` — the mechanism already exists
   at `CommandJob.java:161`. A cancelled import is recoverable; a panicked MVStore is a restart.

Reserving a floor also matters for shutdown: compaction and `writeCleanShutdown()` need free space
*to close cleanly*. The floor is what protects the clean-close fsync.

### 3.5 Point 2c — visibility

- Add a repeated `DiskUsage { path, total, usable, level }` to `message OpalStatus`
  (`opal-web-model/src/main/protobuf/Opal.proto:304`) — additive, no wire breakage — and populate
  it in `SystemResource.getStatus()` (`opal-core-ws/.../system/SystemResource.java:151-166`).
- UI banner in opal-ui at `WARN` and above.
- Optionally one **edge-triggered** email on the `WARN → DEGRADED` transition via the existing
  `org.obiba.opal.smtp.*` configuration. Edge-triggered, not level-triggered, or a full disk means
  a mail every minute.

## 4. Sequencing

| PR | Content | Why in this position |
|---|---|---|
| 1 | `H2DatabaseUrls` guard + tests (§3.1) | Tiny; protects the fsync everything else assumes |
| 2 | `DiskSpaceService` + sampler + `/system/status` + config (§3.3, §3.5) | **Observe before enforcing** — tune thresholds against real deployments |
| 3 | Enforcement in `CommandJob` + `FilesResource` (§3.4) | Only once PR2's numbers are trusted |
| 4 | `H2Checkpointer` + `getLoadedDataSources()` (§3.2) | Independent and lowest risk |

PR2 and PR4 share the scheduler from D1; whichever lands first introduces it.

## 5. Risks

- **The checkpointer must iterate only the populated cache** (D2). Getting this wrong turns a
  durability improvement into a resource leak.
- **`getUsableSpace()` reports host or overlay values inside containers** with overlayfs or
  quotas. Document that Kubernetes operators should still monitor volumes themselves; Opal's check
  is a safety net, not a monitoring system.
- **PR3 changes user-visible behaviour** — jobs start failing that previously ran. Consider
  shipping it behind `org.obiba.opal.storage.disk.enforce=false` for one release.
- **Do not attempt recovery after `panic()`.** The store is closed; restart is the only path. The
  checker's job is to make that never happen.

## 6. Relationship between the two points

They share the timer from D1, and they reinforce each other: the checkpoint interval is exactly
what bounds how much is lost if the disk fills anyway and MVStore panics. Implementing one without
the other leaves half the window open. Worth doing together, in the order of §4.
