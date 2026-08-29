# OrientDB to H2 Migration with Spring Data JPA

**Created:** 2026-05-28
**Revised:** 2026-08-29 — restated against the current tree (`feat/orientdb-h2`, Opal 5.8-SNAPSHOT) and rescoped for agent-driven implementation
**Approach:** Spring Data JPA over embedded H2, PostgreSQL-ready
**Target release:** Opal 6.0.0

## 1. What changed since the original plan

The 2026-05-28 draft was written before three things landed. All of them move the ground under it.

| Original assumption | State on 2026-08-29 | Consequence |
|---|---|---|
| OrientDB 3.2.45 | **3.2.55** (`06155eea2`) | — |
| "OrientDB blocks the upgrade to Java 25" | **False now.** `06155eea2` excluded OrientDB's GraalJS artifacts, which removed the JSR-223 factory that initialised Truffle at startup and failed on JDK 24+ with `NoSuchMethodError: sun.misc.Unsafe.ensureClassInitialized`. GraalVM went 21.3.5 → 25.3.4.1, and `.github/workflows/ci.yml` now builds and tests on a `[21, 25]` matrix. | **The urgency argument is gone.** This is no longer an unblock-the-platform migration; it is a remove-a-dead-dependency migration. Sequence it accordingly (§3). |
| H2 is a new dependency to add | **H2 2.4.240 is already a managed dependency and a compile dependency of `opal-core`** (`4a64ad0b9`), registered as a first-class Magma storage datasource under `${OPAL_HOME}/data/h2/<name>` | No dependency work; the JDBC driver, the `H2DatabaseUrls` helper and `DataSourceFactory` URL expansion already exist and are tested (`H2JdbcDatasourceTest`) |
| Spring Framework 7.0.7 | **7.0.8** | — |
| Liquibase to be introduced | **Liquibase 5.0.3 + liquibase-slf4j 5.0.0 are already dependencies of `opal-core`** (pulled in for Magma's JDBC datasource; Opal itself drives no changelog and ships none) | Schema tooling is on the classpath; only a changelog and a runner are missing |
| 13 domain classes | **18 persisted classes** (§2.1) | Two extra tables' worth of work |
| ~185 service integration points | **157 `orientDbService.*` call sites in main code, 7 in tests**, concentrated in 15 `*ServiceImpl` classes + `UniqueValidator` + 3 shell commands | Smaller and far more contained than feared — see §2.2 |
| Atomikos JTA integration is a medium risk | **OrientDB never participates in JTA.** `OrientDbServiceImpl` opens its own `ODatabaseDocument` and calls `db.begin()`/`db.commit()` directly. The `JtaTransactionManager` bean in `spring/opal-core/tx.xml` exists for Magma JDBC datasources (data import/export/copy), not for config. | The "JPA vs. Atomikos conflict" risk mostly evaporates, *provided* we do not attach the config `EntityManagerFactory` to the JTA manager. See decision **D5**. |
| — | `maven.compiler.source/target` is still **21** | JDK 25 is tested, not targeted. Unchanged by this work. |

### Revised rationale

Why still do it:

1. **OrientDB is effectively unmaintained.** Patch releases only, no Spring Data support, and we are one Truffle/Unsafe-shaped surprise away from being stuck again. `06155eea2` bought time, not a future.
2. **H2 is already in the stack and already administered.** After `4a64ad0b9` Opal ships an embedded SQL engine, a driver, a URL convention and a data folder. Putting the config database on the same engine removes an entire embedded server (`OServer`, its `orientdb-server-config.xml`, its `security.json`, its `OSystem` folder dance) from the runtime.
3. **~800 lines of custom ORM go away** (`OrientDbServiceImpl` 461, `LocalOrientDbServerFactory` 197, `OrientDbUtil` 70, `SimpleOrientDbQueryBuilder` 69), plus the OrientDB-flavoured SQL strings scattered across the service layer.
4. **PostgreSQL becomes a configuration change**, which matters for the clustered/Kubernetes deployments Opal is growing into.

What is *not* a reason any more: Java 25. Do not sell this work on that.

## 2. Actual scope in the current tree

### 2.1 The 18 persisted classes

Determined by every `X.class` passed to `OrientDbService`. All but `OpalGeneralConfig` implement `HasUniqueProperties`.

| Class | Module | Unique key | Notes on mapping |
|---|---|---|---|
| `Project` | opal-core-api | `name` | `Set<String> tags`, `Set<ProjectIdentifiersMapping> identifiersMappings` |
| `Database` | opal-core-api | `name` | `SqlSettings`, `MongoDbSettings` nested beans; `usage` enum; queried on `usedForIdentifiers`, `defaultStorage`, `usage`, `sqlSettings is not null` |
| `SubjectAcl` | opal-core-api | `domain,node,principal,type,permission` (5-col composite) | flat; 4 extra non-unique indexes; highest query volume in the app |
| `SubjectCredentials` | opal-core-api | `name` | `Set<String> groups`; `byte[] certificate` is `transient` (not persisted) |
| `SubjectProfile` | opal-core-api | `principal` | `Set<Bookmark>`, `Map<String,Object> userInfo` |
| `SubjectToken` | opal-core-api | `token` | `Set<String> projects`, `Set<String> commands`, 7 booleans |
| `Group` | opal-core-api | `name` | `Set<String> subjectCredentials` |
| `ResourceReference` | opal-core-api | `name,project` | flat; carries its own `created`/`updated` rather than `AbstractTimestamped` |
| `VCFSamplesMapping` | opal-core-api | `projectName` | flat; queried with `like` on `tableReference` |
| `OpalAnalysis` | opal-core-api | `name,datasource,table` | `List<String> variables` |
| `OpalAnalysisResult` | opal-core-api | `id` | `List<OpalAnalysisResultItem> resultItems`, `AnalysisStatus` enum |
| `OpalGeneralConfig` | opal-core-api | *(singleton, no unique key)* | `List<Locale> locales`. **Only class touched through the raw document API** — `execute()` / `copyToDocument()` / `fromDocument()` in `OpalGeneralConfigServiceImpl` |
| `AppsConfig` | opal-core-api | `id` (always `"1"`, singleton) | `List<RockAppConfig>` |
| `App` | opal-core-api (`runtime`) | `id` | `List<String> tags`; queried on `type` and on `name,type,server`. Runtime registry, repopulated on restart |
| `PodSpec` | opal-core-api (`kubernetes`) | `id` | `Container`, `Map<String,String> labels`, `Map<String,String> nodeSelector`, `List<Toleration>` — the deepest object graph of the set |
| `KeyStoreState` | opal-core | `name` | `byte[] keyStore` — needs `@Lob`/BLOB |
| `DataShieldProfile` | opal-datashield | `name` | `Map<DSMethodType,List<DefaultDSMethod>> environments`, `Map<String,String> options`, both `final` fields |
| `RSessionActivity` | opal-r | `id` | extends `RActivity` (fields in the parent → `@MappedSuperclass`); 3 extra non-unique indexes on `user`, `context`, `profile`. **Highest row count of the set** — it is an activity log, not configuration |

### 2.2 Where the call sites are

157 in main code, and none of them are in REST resources — the existing `*Service` interfaces already form the seam. Only implementations change:

```
opal-core/…/service/security/SubjectAclServiceImpl          16
opal-core/…/service/AppsServiceImpl                         15
opal-core/…/service/security/SubjectCredentialsServiceImpl  15
opal-core/…/service/SubjectProfileServiceImpl               14
opal-core/…/service/DefaultDatabaseRegistry                 13
opal-r/…/service/RActivityService                           13
opal-core/…/service/SubjectTokenServiceImpl                 10
opal-core/…/service/PodsServiceImpl                          9
opal-core/…/service/VCFSamplesMappingServiceImpl             9
opal-core/…/service/OpalAnalysisServiceImpl                  8
opal-core/…/service/OpalAnalysisResultServiceImpl            6
opal-core/…/service/ResourceReferenceServiceImpl             6
opal-datashield/…/cfg/DataShieldProfileService               6
opal-core/…/service/ProjectsServiceImpl                      5
opal-core/…/service/OpalGeneralConfigServiceImpl             4
opal-core/…/service/security/AbstractKeyStoreService         3
opal-core-api/…/validator/UniqueValidator                    2
opal-shell/…/commands/{Backup,Restore,ReloadDatasource}       3  (one `findUnique(new Project(name))` each)
```

### 2.3 The query inventory

Every OrientDB SQL string in the service layer is a single-table predicate — no joins, no projections, no OrientDB-specific operators beyond `like` and `is not null`. The full shape is:

```
select from <Class> where <field> = ? [and|or <field> (=|like|is not null) ?] [order by name]
```

~25 such strings, plus `UniqueValidator`'s two dynamically-built ones. **All of them map to Spring Data derived query methods**; none needs JPQL by hand. This is the single biggest reason the original 3-4 day estimate for "update the service layer" was pessimistic.

## 3. Sequencing note

Because Java 25 is no longer blocked, this migration does **not** have to ship in one release with a hard cutover. It still should, though — running two config stores in parallel doubles the failure surface for no benefit, and the upgrade step is the same work either way. What the removed urgency buys is the freedom to land the increments in §5 as separate reviewable PRs on `feat/orientdb-h2` over several weeks, with `master` unaffected until the branch merges.

## 4. Architecture decisions

These are the calls I will implement unless told otherwise. Each is a place the original plan was silent or optimistic.

**D1 — Spring Data JPA + Hibernate 7 over embedded H2.** Confirmed from the original plan. New managed dependencies: `spring-data-jpa` 4.0.x, `hibernate-core` 7.x, `jakarta.persistence-api` 3.2. The stale `javax.persistence:persistence-api:1.0.2` managed entry (`pom.xml:612`) is removed.

**D2 — Entities live where the domain classes live: `opal-core-api`.** Annotating in place rather than introducing a parallel entity model avoids 18 mapper classes and keeps the REST layer's `Dtos` untouched. Cost: `opal-core-api` gains a `jakarta.persistence-api` dependency. That is annotations only — no Hibernate on the API module's compile path.

**D3 — Hybrid column/JSON mapping, not full normalisation.** Scalars and every field that appears in a query predicate become real columns. Nested beans, collections and maps (`Set<Bookmark>`, `Map<String,Object> userInfo`, `List<Toleration>`, `Container`, `SqlSettings`, `MongoDbSettings`, `List<OpalAnalysisResultItem>`, `environments`, …) are persisted through a single reusable `AttributeConverter` backed by the existing Gson configuration, into `varchar`/`text` columns.

*Why not `@ElementCollection`:* it would add ~15 join tables carrying no query value — nothing in §2.3 filters on a collection member — while making every read a join and every write a delete-and-reinsert. *Why not full JSON documents:* the query predicates in §2.3 need real indexed columns, and `SubjectAcl` in particular is on the hot path of every permission check. The hybrid keeps the schema readable, the indexes real, and stays portable — the JSON columns are plain text on both H2 and PostgreSQL, upgradable to `jsonb` later without touching Java code.

*Exception:* `Database.sqlSettings is not null` is queried, so that JSON column gets an explicit `IS NOT NULL` derived method — it works unchanged.

**D4 — Surrogate `Long` identity, with the current unique key as a `@Table` unique constraint.** Preserves `HasUniqueProperties` semantics exactly (including `SubjectAcl`'s 5-column composite) while giving JPA a clean primary key. `HasUniqueProperties` itself survives Phase 2 as the contract `UniqueValidator` and the save-by-template call sites rely on; it is retired in Phase 6 once every call site is on repositories.

**D5 — The config database gets its own `JpaTransactionManager`, not the JTA one.** The existing `transactionManager` (Atomikos JTA) stays `@Primary` and untouched, so the 60 `@Transactional` annotations in the Magma/search/data-copy paths keep their current behaviour. Config repositories get a qualified `configTransactionManager`.

This is the decision the original plan got backwards — it proposed integrating with Atomikos, which would enrol every config write into data-copy transactions that today it has nothing to do with. Two methods need explicit attention because they straddle the two worlds: `DefaultDatabaseRegistry.getDataSource` (`@Transactional`, line 148) and `DefaultDatabaseRegistry`/`ProjectsServiceImpl`'s `@Transactional(propagation = NEVER)` methods.

**D6 — Liquibase owns the schema; Hibernate is `validate`-only.** `hibernate.hbm2ddl.auto=validate` in every environment including tests, so a drifted entity fails the build rather than silently reshaping a user's database. The changelog lives at `opal-core/src/main/resources/db/changelog/config/db.changelog-master.xml` and is run by a Spring bean at startup, before any repository is used. Changesets stay database-agnostic (no H2-specific types) so PostgreSQL needs no second changelog.

**D7 — The migration step reads OrientDB directly, without starting `OServer`.** `plocal:` databases open through `ODatabaseDocumentTx` with no server. So the upgrade step needs `orientdb-core` only, and `LocalOrientDbServerFactory`, `orientdb-server-config.xml` and the `security.json`/`OSystem` handling can be deleted outright rather than carried. **`orientdb-core` stays a dependency of `opal-upgrade` alone**; `opal-core` and `opal-core-api` drop `orientdb-server` and `orientdb-core` entirely in Phase 6.

**D8 — Service interfaces do not change.** Only the 15 `*ServiceImpl` classes, `UniqueValidator` and 3 shell commands are rewritten. No REST resource, no DTO, no `opal-ui` code is touched by this migration. This is what makes the 157 call sites tractable.

**D9 — Backup/restore.** `OrientDbService.exportDatabase`/`importDatabase`/`dropDatabase` have no callers in the current tree — they are dead API. They are deleted rather than reimplemented. The three shell commands that inject `OrientDbService` only call `findUnique(new Project(name))` and move to `ProjectService`.

**D10 — The upgrade migrates every row. Nothing is truncated, sampled or dropped.** `RSessionActivity` is the one table that can hold hundreds of thousands of rows — it is an activity log rather than configuration — and it is the one place where a naive row-by-row migration will be slow. The answer to that is batched inserts and an honest progress report, not discarding history. An admin who wants to prune old activity can do so afterwards, deliberately; the upgrade never decides that for them.

**D11 — The upgrade step reports progress to the log as it runs.** Opal's upgrade mode is a blocking, non-interactive startup phase: an admin watching a long migration with a silent log cannot tell a slow table from a hung process, and that ambiguity is what makes people kill the JVM half way through a data migration. Concretely, `OrientDbToH2UpgradeStep` logs at INFO:

- **On start:** the source OrientDB path, the target H2 path, and the per-class row counts read from OrientDB — so the total work is known before any of it is done.
- **Per class, on start:** the class name and its row count (`Migrating SubjectAcl: 12483 records`).
- **During a class:** for any class above a batch threshold, one line per batch with rows done, total, and percentage (`SubjectAcl: 5000/12483 (40%)`). Small classes emit nothing between start and finish — a table of 3 rows does not need a progress bar.
- **Per class, on completion:** rows written, rows read, and elapsed time, with a warning if the two counts disagree.
- **On completion:** a summary table of every class with its counts and timings, total elapsed time, and an explicit line stating that the OrientDB folder has been left in place and may be removed manually once the installation is verified.
- **On failure:** which class and which record was in flight, so the failure is diagnosable without a re-run.

Progress is written through the existing SLF4J logging, so it lands in `opal.log` as well as on the console. Verification counts are logged at the same level, not just asserted — the log is the artifact an admin sends when an upgrade goes wrong.

**D12 — The config database gets a real user and a generated password, taken from the one Opal already generates and has never used.**

The original plan said nothing about this, and the only credentials it showed were a PostgreSQL example. Here is the current state and the decision.

*What exists today.* `opal-config.xml` already carries a `<databasePassword>`: `DefaultOpalConfigurationService.start()` generates 15 secure random bytes on first boot and stores them AES-encrypted under the `<secretKey>` in the same file. It was added for exactly this purpose and is **dead** — `LocalOrientDbServerFactory` still connects with hardcoded `admin`/`admin` (`USERNAME`/`PASSWORD` constants) and its use of the generated password is commented out behind a TODO pointing at an OrientDB bug from 2014. Worse, `ensureSecurityConfig()` writes a `security.json` containing `{"enabled": false}`. So today the configuration database has security switched off and a password that everyone knows.

*Decision.* The config database connects as user **`opal`** with the existing generated `databasePassword`, decrypted at startup through `CryptoService`. No new configuration key, no new file, no admin-visible credential — the field is finally wired to something. On an existing install the password is already in `opal-config.xml`; on a fresh install it is generated before the datasource is built.

*Bootstrap ordering.* The datasource cannot be constructed from a `@Value` placeholder the way the OrientDB URL was, because the password is not known until `DefaultOpalConfigurationService.start()` has read `opal-config.xml`, generated the key if absent, and written it back. The config `DataSource` bean therefore `depends-on` `opalConfigurationService` and resolves its password lazily, in both `spring/opal-core/context.xml` and `upgrade-context.xml`. Getting this wrong fails at boot, loudly, which is the good failure — but it is the most likely way increment 1 breaks.

*Setting the password on a database that already exists.* H2 fixes a user's password when the database file is created. The `opal-config` file is created by increment 1 (fresh install) or by the upgrade step (existing install), and in both cases it is created with the final credentials — so there is no rotation step, and `ALTER USER` is not part of the normal path.

*What this does and does not buy.* An H2 user password gates JDBC connections; it does **not** encrypt the file. Anyone with read access to `${OPAL_HOME}/data/h2/opal-config.mv.db` can still recover its contents with H2's own recovery tooling. That is the same exposure the OrientDB folder has today, so this is not a regression — but the plan should not claim protection it does not provide. The data at risk is the ACLs, project definitions, registered database credentials (already separately encrypted) and `KeyStoreState` blobs.

*Encryption at rest is deliberately out of scope.* H2 supports it (`;CIPHER=AES`, with the file password prefixed to the user password), and the machinery to hold the key exists. It is excluded from this migration for one reason: it converts a lost or corrupted `opal-config.xml` from "regenerate the secret key" into "the configuration database is unrecoverable", and that failure mode deserves its own design — key escrow, a documented recovery procedure, and a rotation story — rather than riding along on a storage migration. Worth a follow-up; the URL is built in one place (D6's datasource configuration) so adding the cipher later is a one-line change plus that procedure.

*Failure message.* If the file exists but the password does not match — restored `${OPAL_HOME}/data` from one host with `opal-config.xml` from another, or a hand-edited secret key — H2 reports only `Wrong user name or password`. That is unactionable, so the datasource wraps it with a message naming the config file, the secret key and the database file, and pointing at the mismatch. This is a real support scenario, not a hypothetical: the two files live in different directories and get backed up separately.

### Decisions the implementation forced

Written while building increments 1 and 2. Each of these contradicts or sharpens something above, and each was found by the code refusing to work rather than by thinking about it.

**D3a — Enumerations are converted, not `@Enumerated`.** `@Enumerated(STRING)` does not mean "a varchar holding the name". Hibernate maps it to whatever native enum type the dialect offers: an inline `enum ('EXPORT','IMPORT','STORAGE')` column on H2, a `create type ... as enum` on PostgreSQL. The `hibernate.type.prefer_native_enum_types=false` setting does not help - for `STRING` the code path checks the dialect's `ENUM` descriptor before ever consulting it. So the four enum attributes (`Database.usage`, `SubjectAcl.type`, `SubjectCredentials.authenticationType`, `OpalAnalysisResult.status`) go through an `EnumNameConverter`, the same `@Convert` mechanism as the JSON fields. The column is a varchar on every server and adding a constant is not a schema migration.

**D4a — The surrogate key is not universal, and it has no accessors.** Five classes already carry a business `id` that is their unique key and is assigned by the code that creates them (`App`, `AppsConfig`, `PodSpec`, `OpalAnalysisResult`, `RSessionActivity`). Giving those a second, generated key would have meant renaming a field the application uses. They keep their own `id` as the primary key; the other thirteen get a generated `Long id`. That field has no getter and no setter anywhere - Hibernate uses field access - so the migration adds nothing to the public surface of the domain model, and no DTO mapper or serialiser can start depending on it.

**D6a — The database is `${OPAL_HOME}/data/config`, not `${OPAL_HOME}/data/h2`.** `data/h2` now holds the H2 databases users register by name (`4a64ad0b9`), and `H2DatabaseUrls` allows the name `opal-config`. Putting the configuration database in the same folder would let a user collide with it by registering a database of that name. A separate folder removes the possibility rather than adding a reserved-name check, and `config` says what the folder holds rather than which engine happens to hold it.

**D13 — The database does not enforce constraints the document store never had.** The first draft turned every `@NotNull` into `nullable = false`, which is how a relational schema is normally written from an annotated model. That is the wrong default here: these documents have been written by several years of Opal versions, some predating fields that are mandatory today, and a NOT NULL the old store never enforced turns a legacy row into a failed migration. So NOT NULL is declared only where the previous system genuinely guaranteed a value - the columns of a unique key, the creation timestamps, and primitives that cannot be null. Bean validation still guards the application path; the database has simply stopped being a second, stricter gate that historical rows could fail. This one is worth remembering when reviewing increment 4: it is the difference between a migration that completes and one that stops half way.

**D14 — `jboss-logging` is pinned.** Hibernate 7 calls `Logger.getMessageLogger(MethodHandles.Lookup, ...)`, added in jboss-logging 3.6. RESTEasy brings 3.5.3 at a shallower point in the tree, so Maven's nearest-wins rule handed Hibernate a version without that method and the entity manager factory died at startup with `NoSuchMethodError`. The root POM now manages `jboss-logging` at 3.6.1. Worth knowing because the symptom appears in whichever module happens to pull RESTEasy - opal-core was fine, opal-datashield was not - which makes it look like a module problem rather than a version conflict.

**D15 — Deleting resolves the natural key first.** The document store's `delete` took a template and resolved its
unique properties, so a caller could delete a group by handing over `new Group("group1")`. A JPA `delete` cannot: given
an object the caller built, there is no primary key to delete by, and Spring Data's `SimpleJpaRepository` treats it as
new and **silently does nothing**. A test caught it on `delete(Group)`; the same shape was latent in the credential,
resource-reference, profile and token deletes. Every repository whose entity has a natural key therefore carries a
`deleteByKey`, which looks the row up the way the old `delete` did, and the services call that. A silent no-op delete is
the worst kind of regression to ship, since nothing fails until someone notices the row is still there.

**D16 — Two more version conflicts, both of which would have broken the server.** Neither is visible until Hibernate
actually runs, which is why they surfaced in increment 3 rather than at compile time:

- **ANTLR.** Hibernate 7's HQL parser ships grammars generated by ANTLR 4.13 and dies with
  `NoClassDefFoundError: Could not initialize class org.hibernate.grammars.hql.HqlLexer` against an older runtime. Opal
  pinned 4.7.1 for opal-sql's own grammars. Bumped to 4.13.2, which regenerates opal-sql's parser against the same
  runtime, so the two agree. Every derived query in the repository layer depends on this.
- **jboss-logging**, already recorded as D14.

The pattern is worth naming for increment 4: an embedded document store had no shared parser or logging surface, so
adding a real ORM pulls Opal's dependency graph into agreement with Hibernate's in places nothing previously touched.

**D17 — The OrientDB `TimestampedHook` had to be replaced, not just deleted.** `orientdb-server-config.xml` registered a
hook that stamped `created` and `updated` on every document written, so no service had to. Some services set `updated`
themselves, but `Project`, `Database`, `SubjectAcl`, `Group` and `KeyStoreState` never did - they relied on the hook. On
JPA that becomes `@PrePersist` / `@PreUpdate` on `AbstractTimestamped` (and on `ResourceReference`, which keeps its own
timestamps). One deliberate difference: the hook overwrote `created` on every insert, and these callbacks only set it
when it is absent. A row being migrated in increment 4 has to keep the date it was actually created on, and would
otherwise be stamped with the date of the migration.

**D18 — The step is idempotent, because the upgrade manager gives no guarantee that it runs once.**
`DefaultUpgradeManager` applies a step whenever `appliesTo` is greater than the installed version, with no upper bound
against the runtime version. The step declares `appliesTo` 6.0.0 while the branch is on 5.8-SNAPSHOT, which is the
right way round - an installation on 5.7.x upgrading to 5.8 still gets it - but it means a later upgrade can reach the
step a second time, and the manager writes the runtime version at the end regardless. Since most of these rows have a
generated key and nothing to collide on, a second run would duplicate them. So each class checks its target table
first: rows already there means the class is reported as skipped and left alone. This is also what makes a re-run after
a partial failure safe.

**D19 — Verified against a real OrientDB database, not only a fixture.** A copy of the `opal_home/data/orientdb` in the
working tree migrates completely: 986 records over 15 populated classes in under a second, every read count equal to
its written count. The spot checks are what the counts cannot show - projects keep their original creation dates
(2025-10-24, not the date of the migration, which is D17 holding on real data), tag sets survive intact, the ACL
enumerations come back as `USER` / `GROUP`, keystore blobs keep their exact byte counts, and `Database` rows keep the
distinction between SQL and MongoDB settings that lives in two separate JSON columns.

**Not covered by an automated test:** the upgrade context wiring itself. `upgrade-context.xml` now builds the
configuration database through `ConfigDatabaseConfiguration` and drops the OrientDB beans, and the step's own test
builds an equivalent context by hand rather than loading that XML, which needs an OPAL_HOME and most of the
application. A real upgrade run against a copied `OPAL_HOME` is the check that remains to be done by hand before
release.

**D20 — `HasUniqueProperties` could not be retired on its own.** The interface went, as D4 said it would, taking
`getUniqueProperties()` and `getUniqueValues()` off 18 domain classes. `UniqueValidator` is typed on it and had to go
with it, and `@Unique` with that - which is no loss, as no class in the tree carries the annotation and no
`LocalValidatorFactoryBean` was ever wired, so the validator has never run. Removing a public annotation from
opal-core-api is an API removal, which is the sort of thing the major version is for.

**D21 — OrientDB is out of the runtime but still in the distribution.** `opal-core` and `opal-core-api` no longer
resolve it at all, and `orientdb-server` is gone from the build entirely, with the GraalJS baggage `06155eea2` had to
exclude. `orientdb-core` remains, resolved only through opal-upgrade, so opal-server still packages the jar - it has to,
because the upgrade step reads the old store. Nothing in a running server touches it. It leaves when the upgrade step
does, one release cycle after 6.0.

The `download-orientdb` and `orientdb-console` targets in the Makefile were left alone. They are developer tooling
rather than shipped code, and while the upgrade step exists they are the only convenient way to look at the source
database behind a migration that went wrong.

## 5. Implementation increments

Rewritten as reviewable PRs rather than FTE-days, since I am implementing them. The "review" column is what a human has to actually read and reason about — that, not typing speed, is the real cost.

| # | Increment | Deliverable | Review load |
|---|---|---|---|
| **1** ✅ | **JPA foundation** *(done)* | Managed deps (D1); `JpaConfiguration` with `LocalContainerEntityManagerFactoryBean`, H2 `DataSource` at `${OPAL_HOME}/data/h2/opal-config` authenticated as `opal` with the generated `databasePassword` and ordered after `opalConfigurationService` (D12), `configTransactionManager` (D5); `@EnableJpaRepositories`; Liquibase runner (D6); empty master changelog. No entity yet, no behaviour change. | Medium — the Spring wiring is where a subtle mistake costs the most later |
| **2** ✅ | **Entities + schema** *(done)* | 18 classes annotated in place (D2, D3, D4); the Gson-backed `AttributeConverter`; `@MappedSuperclass` on `AbstractTimestamped` and `RActivity`; the full changelog; `hbm2ddl=validate` proving the two agree; round-trip test per entity | **High** — this is where data gets silently mis-shaped. Worth reading field by field, especially `PodSpec`, `SubjectProfile.userInfo`, `DataShieldProfile.environments` and `KeyStoreState.keyStore` |
| **3** ✅ | **Repositories + service cutover** *(done)* | 18 `JpaRepository` interfaces with derived methods covering §2.3; all 157 call sites moved; `UniqueValidator` reworked onto repositories; `OpalGeneralConfigServiceImpl` off the raw document API; shell commands onto `ProjectService`. OrientDB still present and still the source of truth for existing installs. | **High but mechanical** — large diff, low conceptual density. Best reviewed per service, and the existing service tests are the real check |
| **4** ✅ | **Upgrade step** *(done)* | `OrientDbToH2UpgradeStep` in `opal-upgrade` (`appliesTo` 6.0.0), reading `plocal` directly (D7); creating the H2 file with its final credentials (D12); per-class readers; count + spot-value verification; batched `RSessionActivity` with no truncation (D10); INFO-level progress and summary logging (D11); OrientDB folder left on disk untouched for rollback; registered in `upgrade-context.xml`, which also loses its `orientDbService`/`localOrientDbServerFactory` beans | **High** — correctness here is one-shot per install. Needs a real `opal_home/data/orientdb` to test against; one exists in the working tree |
| **5** ✅ | **Test migration** *(done)* | `AbstractOrientDbTestConfig`/`AbstractOrientdbServiceTest` replaced by an H2 test config; `OrientDbServiceImplTest` deleted; `DefaultDatabaseRegistryTest`, `SubjectProfileServiceImplTest`, `SubjectCredentialsServiceImplTest`, `ProjectsKeyStoreServiceImplTest`, `OpalGeneralConfigServiceImplTest`, `TaxonomyServiceImplTest` reworked | Low-medium |
| **6** ✅ | **Removal** *(done)* | Delete `OrientDbService(Impl)`, `OrientDbServerFactory`, `LocalOrientDbServerFactory`, `OrientDbUtil`, `SimpleOrientDbQueryBuilder`, `migrator.xml`, `orientdb-server-config.xml`; retire `HasUniqueProperties` (D4); drop OrientDB from `opal-core`/`opal-core-api` poms and the root `<properties>`, keeping `orientdb-core` in `opal-upgrade` only (D7) | Low — but the diff is the proof the migration is complete |
| **7** | **Docs** | Upgrade notes, `upgrade-notes.md` entry, PostgreSQL configuration procedure, persistence-layer notes for `AGENTS.md` | Low |

Increments 1–3 are strictly additive to `feat/orientdb-h2` and leave a working Opal at every commit. The branch is not mergeable to `master` until 4 lands, because without the upgrade step an existing install would start on an empty config database.

**Calendar:** the constraint is your review of increments 2, 3 and 4, not my throughput. Landing one increment per review cycle puts this at roughly 3–5 weeks wall-clock. Increments 1, 5, 6 and 7 can be batched into single cycles.

## 6. Risks

| Risk | Severity | Handling |
|---|---|---|
| **Silent data reshaping in Phase 2.** A nested field mapped wrong loses user data with no error. | **High** | `hbm2ddl=validate` catches schema drift but not semantic drift. Per-entity round-trip tests asserting deep equality after save/reload, and the upgrade step's spot-value verification, are the real defence. This is where review attention belongs. |
| **`SubjectAcl` query performance.** Every permission check goes through it; today it is index-backed in OrientDB. | Medium | 4 non-unique indexes carried over verbatim (D3); benchmark before/after on a realistic ACL count |
| **Migration of large `RSessionActivity` tables is slow** | Medium | D10 — batched inserts, measured before release. Every row is migrated; slowness is solved by batching, never by dropping history |
| **A long silent migration looks like a hang**, and an admin kills the JVM mid-write | Medium | D11 — per-class and per-batch INFO progress, so elapsed time is always attributable to a named table |
| **Transaction-manager ambiguity** after adding a second manager | Medium | D5 — JTA stays `@Primary`; config repositories qualified. `DefaultDatabaseRegistry`'s mixed methods reviewed individually |
| **`opal-core-api` gaining a persistence dependency** ripples into modules that only wanted the domain types | Low | D2 — annotations only; verified by checking the dependency tree of `opal-web-model` and `opal-rest-client` after increment 2 |
| **Config datasource built before `opal-config.xml` is read**, so the password is null at boot | Medium | D12 — explicit `depends-on` and lazy password resolution in both the server and upgrade contexts; fails loudly at boot rather than silently connecting with no password |
| **`opal-config.xml` and `data/h2/` restored from different backups**, leaving an unopenable config database | Medium | D12 — the `Wrong user name or password` failure is wrapped with a message naming all three files; the two directories being backed up separately is documented in the upgrade notes |
| **Config database file is readable at rest.** An H2 user password gates connections, not the file | Low (unchanged from today) | Accepted, not fixed here — same exposure as the current OrientDB folder. Encryption at rest is scoped out with a stated reason (D12) |
| **Rollback after a failed upgrade** | Low | The OrientDB folder is never deleted by the upgrade step. Rolling back is restoring the previous Opal version; the folder is still there. Removal of the folder is a documented manual step for the admin, post-verification. |
| Spring Data learning curve | — | Dropped. Not a real risk for this codebase. |

## 7. Success criteria

1. No OrientDB dependency outside `opal-upgrade`; none at all in the shipped runtime path
2. 18 classes persisted as JPA entities, schema owned by Liquibase, `hbm2ddl=validate` passing
3. All 157 call sites on repositories; no service interface changed; no REST or UI change
4. Upgrade step migrates a real `opal_home/data/orientdb` with verified counts and spot-checked values, dropping no rows, and reporting per-class progress and a final summary to the log
5. Full test suite green on the JDK 21 and JDK 25 CI legs
6. `SubjectAcl` permission checks no slower than the OrientDB baseline
7. `OServer` no longer started at boot; `${OPAL_HOME}/data/orientdb` untouched and ignored after migration
8. Config database reachable only with the generated credentials; no hardcoded password and no `{"enabled": false}` security file anywhere in the tree
9. PostgreSQL configuration documented, and the changelog verified to apply against a PostgreSQL instance
10. ~800 lines of custom ORM deleted

## 8. PostgreSQL path

Unchanged from the original plan and still the main long-term payoff. With D6 keeping the changelog database-agnostic, switching is a driver dependency plus datasource properties.

**Default (embedded H2), requiring no configuration at all:**

```properties
# defaults, written here only to show what D12 resolves to
opal.config.datasource.url=jdbc:h2:file:${OPAL_HOME}/data/h2/opal-config
opal.config.datasource.username=opal
# password is not a property: it is <databasePassword> from opal-config.xml, decrypted at startup (D12)
```

**PostgreSQL:**

```properties
opal.config.datasource.url=jdbc:postgresql://localhost:5432/opal_config
opal.config.datasource.username=opal
opal.config.datasource.password=secret
opal.config.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
```

Two notes the original plan glossed over. These are Opal-specific property names in `opal-config.properties`, not Spring Boot's `spring.datasource.*` — Opal is classic Spring, not Boot, and the original snippet implied otherwise. And an external database needs a password supplied by the admin, so `opal.config.datasource.password` overrides the generated one when set; the generated `databasePassword` is the default for the embedded case only. A plaintext password in a properties file is the same handling Opal already gives other external services, but it is a reason the embedded default should stay the default.

`postgresql` 42.7.12 is already a managed dependency. No Java code changes.

## 9. Alternatives reconsidered

**A — Do nothing.** Newly viable: `06155eea2` proved OrientDB 3.2.55 runs on JDK 25. Rejected because it leaves an unmaintained embedded database on the critical path with no exit built, and every future JDK is another coin flip. But it is worth stating plainly that the deadline is gone — this can be done carefully.

**B — Keep the document-store shape, back it with H2.** Reimplement `OrientDbService` against an H2 table per class holding `id` + unique-key columns + a JSON document. Roughly one increment of work instead of six, touches almost no call site. Rejected: it keeps the custom ORM the migration exists to delete, keeps the hand-written SQL-string query layer, and gives PostgreSQL portability without PostgreSQL-shaped data. Worth naming because it is the honest cheap option if scope has to be cut — and D3's hybrid mapping is deliberately close enough to it that a retreat is possible from increment 2.

**C — JDBC + Liquibase, no JPA.** Rejected as in the original plan.

**D — Spring Data JPA + MongoDB.** Rejected as in the original plan (YAGNI).
