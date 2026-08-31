# Durability and Disk Space Safeguards

**Created:** 2026-08-31
**Issue:** [obiba/opal#4186](https://github.com/obiba/opal/issues/4186) — "Improve Missing Data Safeguards"
**Scope:** points 1 (crash durability) and 2 (free disk space) of that issue
**Verified against:** H2 2.4.240 sources, Opal `master` at `4f1357536`, post-`106ad0fb9` (config DB on H2)
**Target release:** Opal 6.0.0
**Revised:** 2026-08-31 — D3 replaced after testing: absolute thresholds only, percentages dropped (§3.3, §3.3.1)

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
- **D3 (revised). Thresholds are absolute byte floors. No percentage, in either direction.**
  A level answers one question — *is there room left for Opal to do its work?* — and that question
  has an absolute answer. See §3.3.1 for why the original `max(percent, bytes)` was wrong.

| Level | Bytes | Sized to hold | Behaviour |
|---|---|---|---|
| `WARN` | 5 GiB | roughly one more ordinary import | log + admin notification, nothing blocked |
| `DEGRADED` | 2 GiB | config DB writes, logs, MVStore compaction and clean close | refuse unbounded, user-initiated, restartable writes |
| `CRITICAL` | 512 MiB | the pending pages of the open stores | additionally cancel running writers |

  Each is `org.obiba.opal.storage.disk.<level>.bytes`, and an operator whose imports are far larger
  than typical raises `warn.bytes` — that is a per-deployment fact, not something a percentage can
  infer from the volume size.

- **D4. `getUsableSpace() == 0` or `IOException` → `UNKNOWN`, which never blocks.** Log once per
  path behind an `AtomicBoolean`. A broken checker must not become an outage.

### 3.3.1 Why not percentages (revision, after testing)

The original D3 used `max(percent × total, bytes)`. Testing on a real server produced a WARN
banner reading *"27.64 GB free of 467.89 GB"* — on a volume with ample room for Opal to operate.
Working the thresholds out on those numbers shows the shape of the error:

| Level | Threshold on a 467.89 GB volume | Free space at the time |
|---|---|---|
| `WARN` | `max(15% = 70.2 GB, 5 GiB)` = **70.2 GB** | 27.64 GB — warned |
| `DEGRADED` | `max(5% = 23.4 GB, 1 GiB)` = **23.4 GB** | 27.64 GB — **4 GB from refusing every import** |
| `CRITICAL` | `max(1% = 4.7 GB, 256 MiB)` = **4.7 GB** | — |

A percentage measures how *full* a volume is. Nothing in this plan cares about that. Every
consumer of a level asks whether a specific amount of work still fits: an import needs bytes, a
clean MVStore close needs bytes, an upload needs `Content-Length × safetyFactor` bytes. None of
those requirements grows when the volume does — so a threshold that grows with the volume gets
strictly more wrong the larger the disk, and demands 70 GB of headroom from a 468 GB volume for no
reason anyone can state. Enforcement would have made this an outage rather than a banner.

`max()` was chosen to fix the *opposite* failure: 5% of a 20 GB volume is 1 GB, small enough for a
single import to cross without warning. But that argument was never an argument for percentages —
it was an argument that the absolute floor is the part carrying the meaning, with `max()` bolted on
to stop the percentage doing damage at the small end. Removing the percentage removes both
failures at once, and leaves three numbers an administrator can read off and reason about.

The keys are dropped rather than defaulted to `0`: they have never been in a release, so there is
no compatibility cost, and leaving a knob in place that is wrong whenever it is used is worse than
not having it.

**One edge remains**, and it is a configuration error rather than a policy flaw: a threshold larger
than the volume itself pins that level permanently on — `warn.bytes` = 5 GiB on a 4 GB container
volume never reads `OK`. Log it once at `start()`, naming the volume and the threshold, instead of
clamping silently. A volume too small to hold the floor is a fact worth saying out loud.

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

"Observe before enforcing" earned its place in that table: the first observation run is what
produced the D3 revision in §3.3.1, before a single job had been refused. Keep
`org.obiba.opal.storage.disk.enforce=false` until the absolute thresholds have been watched on the
same deployments.

## 5. Risks

- **The checkpointer must iterate only the populated cache** (D2). Getting this wrong turns a
  durability improvement into a resource leak.
- **`getUsableSpace()` reports host or overlay values inside containers** with overlayfs or
  quotas. Document that Kubernetes operators should still monitor volumes themselves; Opal's check
  is a safety net, not a monitoring system.
- **PR3 changes user-visible behaviour** — jobs start failing that previously ran. Consider
  shipping it behind `org.obiba.opal.storage.disk.enforce=false` for one release.
- **A false positive is not a cosmetic bug here.** A level is both a banner and, once enforcement
  is on, a refusal. The percentage thresholds of the original D3 warned at 27 GB free and would
  have refused imports at 23 GB, on a volume with nothing wrong with it (§3.3.1). Any future change
  to the thresholds should be checked against the largest volume Opal is expected to run on, not
  only the smallest.
- **Do not attempt recovery after `panic()`.** The store is closed; restart is the only path. The
  checker's job is to make that never happen.

## 6. Relationship between the two points

They share the timer from D1, and they reinforce each other: the checkpoint interval is exactly
what bounds how much is lost if the disk fills anyway and MVStore panics. Implementing one without
the other leaves half the window open. Worth doing together, in the order of §4.
