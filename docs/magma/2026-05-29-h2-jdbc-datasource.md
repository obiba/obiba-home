# Implementation Plan: H2 Support for the Magma JDBC Datasource

**Status:** implemented — all steps below are done and verified
**Branch:** `feat/h2` (based on `master`, `5.5-SNAPSHOT`)
**Implementer:** Claude Code (agent), on request of Yannick Marcon
**Last revised:** 2026-08-28 — original estimate written 2026-05-29, revised after verifying every claim against the current code base and against a live H2 2.4.240 instance.

---

## Goal

Make H2 a first-class member of the set of databases the Magma JDBC datasource is known to work
against — on the same footing as MySQL, MariaDB, PostgreSQL and SQL Server — by running the existing
`JdbcDatasourceTest` suite unchanged against H2, and fixing whatever that surfaces.

**Scope revision (2026-08-28, after the first implementation pass):** HSQLDB is not used as a
datasource anywhere, so rather than have H2 join it, **H2 replaces it outright**. HSQLDB is removed
from the build entirely. This makes H2 the single embedded engine the suite runs on, and removes the
need for the per-dialect test machinery the first pass introduced.

"Supported" here means the same thing it means for every other engine in this module:
the suite passes, a dialect visitor exists if the dialect needs one, and the driver is declared
at `test` scope. Magma does **not** ship JDBC drivers; the embedding application (Opal) supplies them.

---

## Current State — verified 2026-08-28

The 2026-05-29 estimate was written against older dependency versions. Corrected facts:

| Item | Estimate said | Actual (verified) |
|---|---|---|
| Liquibase | 4.26.0 | **5.0.3** — `liquibase/database/core/H2Database.class` present, plus `ColumnSnapshotGeneratorH2`, `InsertOrUpdateGeneratorH2`, `AddAutoIncrementGeneratorHsqlH2` |
| HSQLDB | 2.7.1 | **removed** — see the scope revision above |
| Java | 11+ | **21** (`maven.compiler.release`) |
| `JdbcDatasourceTest` | — | **744 lines, 22 `@Test` methods** (1 `@Ignore`d), bound to `/test-spring-context.xml` |
| Existing visitors | MySql, PostgreSql | unchanged — `MySqlEngineVisitor`, `PostgreSqlEngineVisitor` |
| Build | "Run `gradlew`" (stale README) | Maven; CI runs `mvn -U -B install` on every branch |

**What already works in our favour:**

- Liquibase abstracts DDL generation; `JdbcDatasource.newDatabaseInstance()` resolves the dialect
  through `DatabaseFactory.findCorrectDatabaseImplementation(jdbcCon)`, so H2 is picked up with no code change.
- All hand-written SQL in the module (`JdbcDatasource`, `JdbcValueTable`, `JdbcValueTableWriter`,
  `JdbcValueSetFetcher`, `JdbcValueTableTimestamps`) is plain ANSI — `SELECT`/`INSERT`/`UPDATE`/`DELETE`,
  `MIN`/`MAX`, `IN (:ids)`. No `LIMIT`, no `ON DUPLICATE KEY`, no engine-specific functions. Confirmed by grep.
- Identifiers are quoted via `ObjectQuotingStrategy.QUOTE_ALL_OBJECTS` and
  `database.escapeObjectName(...)`, so H2's case rules are handled by Liquibase, exactly as for HSQLDB.
- CI needs no change: `mvn install` picks up any new test class automatically.

---

## Findings from live verification against H2 2.4.240

Run against `jdbc:h2:mem:...` with the real 2.4.240 driver, not assumed:

1. **Every SQL type `SqlTypes.sqlTypeFor()` emits is accepted by H2** —
   `VARCHAR`, `VARCHAR(255)`, `BIGINT`, `DOUBLE`, `DATE`, `TIMESTAMP`, `BLOB`, `BOOLEAN`, `LONGVARCHAR`
   all create cleanly. `LONGVARCHAR` is normalised by H2 to `CHARACTER VARYING`, which reads back as
   `Types.VARCHAR` and maps to `TextType` in `SqlTypes.valueTypeFor()` — correct round trip.
2. **Quoted lower-case identifiers work** — `create table "value_tables"("datasource" varchar(255) ...)`
   succeeds, so the metadata-table scripts need no change.
3. **`DROP SCHEMA PUBLIC CASCADE` fails on H2** — `JdbcSQLSyntaxErrorException: Schema "PUBLIC" cannot be
   dropped [90090-240]`. This is the **one real blocker**: `schema-notables.sql` (used as `afterSchema`
   by most tests) is HSQLDB-specific. H2's equivalent is `DROP ALL OBJECTS;`, verified to leave
   `INFORMATION_SCHEMA.TABLES` empty for schema `PUBLIC`.
4. **No `LONGBLOB` or `OID` rewriting is needed** — the two conditions the existing visitors exist for
   (MySQL `BLOB`→`LONGBLOB`, MySQL `ENGINE=InnoDB`, PostgreSQL `OID`→`BYTEA`) have no H2 analogue.
   H2 accepts `BLOB` natively.
5. **`com.h2database:h2:2.4.240` resolves from Maven Central** (2.7 MB), and was not previously in the local `~/.m2`.

**Conclusion on the visitor question (item 2 of the old estimate):** an `H2EngineVisitor` is
**not needed**. This was the prediction before implementation and it held: the full suite went green
against H2 with no dialect rewriting at all, so no visitor was written and
`JdbcDatasource.ChangeDatabaseCallback` (`JdbcDatasource.java:665`) is unchanged.

---

## Decisions (the old "Open Questions", now resolved)

| Question | Decision | Rationale |
|---|---|---|
| H2 version | **2.4.240** | Latest stable 2.x; verified available and working. No 1.4.x back-compat requirement — H2 1.x is EOL and its file format is incompatible anyway. |
| Compatibility mode | **Regular H2 mode** — no `MODE=` in the URL | The DDL Magma generates works in native mode (verified). `MODE=MySQL` would test a fiction: it changes identifier casing and quoting semantics, so a green suite would say nothing about a real user's H2 database. |
| Test scope | **In-memory only**, `DB_CLOSE_DELAY=-1` | File-based H2 differs only in storage, not dialect; the flag is *required* because DBCP2 closes connections between tests and an in-memory H2 database is destroyed when its last connection closes. |
| Production support | **`test` scope, like every other driver** | Magma ships no JDBC drivers. Opal declares the driver it needs. Adding H2 at compile scope would put a 2.7 MB jar on every Magma consumer's classpath for no reason. |

---

## Implementation Steps

### 1. Declare the H2 driver

- `pom.xml` — add `<h2.version>2.4.240</h2.version>` to `<properties>` (alphabetical, between
  alphabetically among the other version properties), and a `com.h2database:h2` entry with
  `<scope>test</scope>` in `<dependencyManagement>`, next to the other driver entries.
- `magma-datasource-jdbc/pom.xml` — add the `com.h2database:h2` `test`-scope dependency alongside
  the other driver dependencies.

*Verify:* `mvn -pl magma-datasource-jdbc -am dependency:tree | grep h2`

### 2. Swap the test engine from HSQLDB to H2

- `magma-datasource-jdbc/src/test/resources/test-spring-context.xml` — point the `dataSource` bean at
  `org.h2.Driver` / `jdbc:h2:mem:JdbcDatasourceTest;DB_CLOSE_DELAY=-1`. Bean ids stay as they are:
  both `SchemaTestExecutionListener` and obiba-core's `DbUnitAwareTestExecutionListener` look up the
  bean named `dataSource`.
- `.../resources/org/obiba/magma/datasource/jdbc/schema-notables.sql` — replace HSQLDB's
  `DROP SCHEMA PUBLIC CASCADE;` with H2's `DROP ALL OBJECTS;`. The other schema scripts are portable
  as they stand (verified: quoted lower-case identifiers and every column type in them work on H2).

`JdbcDatasourceTest` then runs on H2 with no change to the test class itself, and no separate H2
test class or second Spring context is needed.

### 3. Remove HSQLDB from the build

- `pom.xml` — drop the `hsqldb.version` property and the `org.hsqldb:hsqldb` `dependencyManagement` entry.
- `magma-datasource-jdbc/pom.xml` — drop the `org.hsqldb:hsqldb` `test` dependency.
- `magma-js/pom.xml` — drop it there too. That module declares the driver but contains no JDBC code
  at all (no `DataSource`, no `jdbc:` URL, nothing matching `Jdbc`), so the dependency is simply dead.
- `JdbcVariableEntityProvider.java` — two comments claim the pagination SQL "works for mysql, maria,
  posgre, hsql databases"; say `h2` instead. Verified on H2 2.4.240: both the `LIMIT n OFFSET n` form
  and the SQL Server `OFFSET n ROWS FETCH NEXT n ROWS ONLY` form return the expected rows.

### 4. Do *not* add per-dialect test infrastructure

The first implementation pass, written when H2 was to sit *alongside* HSQLDB, taught
`SchemaTestExecutionListener` to prefer `<script>-<dbms>.sql` over `<script>.sql` so that the two
engines could share inherited `@TestSchema` annotations while differing on teardown. With HSQLDB
gone there is exactly one engine and that mechanism has no user, so it was reverted rather than left
in as dead code. `SchemaTestExecutionListener` is unmodified from `master`.

Likewise `JdbcDatasourceH2Test` (a subclass re-running the parent suite against a second context) and
`test-spring-context-h2.xml` were deleted: with the primary context already on H2 they are pure
duplication.

### 5. Fix what the run surfaces

Expected candidates, in likelihood order:

- **DbUnit data-type warnings.** `DbUnitAwareTestExecutionListener` builds a plain
  `DatabaseDataSourceConnection` with no `IDataTypeFactory`, so DbUnit will log
  *"the configured data type factory doesn't support the H2 database"*. Warnings only — leave them
  unless a `@Dataset`-driven assertion actually fails.
- **A dialect-specific DDL statement** Liquibase's H2 generator emits differently than expected.
  If and only if this happens, add `support/H2EngineVisitor.java` (`setApplicableDbms(ImmutableSet.of("h2"))`)
  and register it in the `ChangeDatabaseCallback(Iterable<Change>)` constructor list.
  Record the concrete statement that forced it in the class javadoc.
- **Timestamp precision.** `JdbcValueTableTimestamps` is where a fractional-seconds difference would show.

Do not pre-emptively write code for any of these. *Outcome: none of them materialised. The DbUnit
warning is not emitted, and no assertion needed adjusting.*

### 6. Documentation

- `magma-datasource-jdbc` has no README today. Add one listing the engines the suite covers —
  MySQL, MariaDB, PostgreSQL, SQL Server, **H2** — with the note that drivers are `test`
  scope and must be supplied by the embedding application, plus a short H2 URL example
  (in-memory and file-based) and a pointer on switching the suite to another engine.
- Fix the stale `Run \`gradlew\`` line in the root `README.md` to `mvn install` while there.

---

## Out of Scope

- **Opal-side registration.** Making H2 selectable as an Opal database type is a change in the
  `obiba/opal` repository (database registry, driver dependency, UI type list). It is a separate
  piece of work that depends on this one; flag it to the user when this lands, do not attempt it here.
- **File-based and server-mode H2 testing.** Same dialect, different storage.
- **Performance benchmarking.**
- **An `H2EngineVisitor` written speculatively.** See step 5.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `schema-notables.sql` teardown incompatibility | **Confirmed** | Blocks the suite | Step 2 — `DROP ALL OBJECTS` |
| Losing HSQLDB loses coverage of a second dialect | Medium | A dialect-specific regression goes unseen until it hits MySQL/PostgreSQL | Accepted: HSQLDB was never a supported datasource, so that coverage was incidental. The dialect-specific paths are the two visitors and `JdbcVariableEntityProvider`, none of which HSQLDB exercised either |
| Liquibase H2 DDL quirk | Low | Localised test failure | Step 5 — visitor, only if reproduced. *Did not occur* |
| DbUnit lacks H2 type factory | Medium | Log noise, possibly a dataset assertion | `org.dbunit.ext.h2.H2DataTypeFactory` exists in dbunit 2.5.1 if it becomes real. *Did not occur* |
| `magma-js` breaks without its HSQLDB dependency | Low | Build failure | Grepped the module for JDBC usage first (none), then ran the full reactor build |

---

## Outcome

Implemented on `feat/h2`. H2 replaces HSQLDB; no production behaviour changed.

| File | Change |
|---|---|
| `pom.xml` | `h2.version` 2.4.240 property + `test`-scope `dependencyManagement` entry; **`hsqldb.version` and the HSQLDB entry removed** |
| `magma-datasource-jdbc/pom.xml` | `com.h2database:h2` `test` dependency in; HSQLDB out |
| `magma-js/pom.xml` | HSQLDB out — the module declared the driver but has no JDBC code |
| `.../test/resources/test-spring-context.xml` | `dataSource` now `org.h2.Driver` / `jdbc:h2:mem:JdbcDatasourceTest;DB_CLOSE_DELAY=-1` |
| `.../test/resources/org/obiba/magma/datasource/jdbc/schema-notables.sql` | `DROP SCHEMA PUBLIC CASCADE` → `DROP ALL OBJECTS` |
| `.../main/java/.../JdbcVariableEntityProvider.java` | two dialect comments: `hsql` → `h2` |
| `magma-datasource-jdbc/README.md` | new — supported engines, driver policy, H2 usage, how to run against another engine |
| `README.md` | stale `Run gradlew` → `Run mvn install` |

No production code changed. No `H2EngineVisitor` was needed. `SchemaTestExecutionListener` is
unchanged from `master` — see step 4.

### Verification performed

- `mvn -pl magma-datasource-jdbc clean test` — **24 run, 0 failures, 1 skipped**
  (2 `TableUtilsTest` + 22 `JdbcDatasourceTest`, all now on H2; the skip is a pre-existing `@Ignore`).
- `mvn -U -B clean install` at the reactor root — green, including `magma-js` after losing its
  HSQLDB dependency.
- Direct checks against a live H2 2.4.240 instance, before writing any code: every SQL type
  `SqlTypes` emits, quoted lower-case identifiers, `DROP ALL OBJECTS`, and both pagination forms
  used by `JdbcVariableEntityProvider`.
- The intermediate two-engine implementation was also proven green (47 tests across HSQLDB and H2)
  before being simplified away; that is why the risk table below still lists the teardown
  incompatibility as *confirmed* — it is real, and is what `DROP ALL OBJECTS` now handles.

### Dependency cleanup (follow-on request)

With HSQLDB gone, the user asked for any other dead code or dependencies to go too. `mvn
dependency:analyze` flags ~190 candidates, but it is bytecode-based and so reports every
runtime-loaded or annotation-only dependency as unused. Each candidate was therefore checked against
actual source and resource references before removal.

**Removed — zero references, `test` scope (not transitive, no downstream effect):**

| Module | Dependency |
|---|---|
| `magma-js` | `spring-test`, `obiba-core`, `javassist`, `mysql-connector-j` — the module has no JDBC and no Spring code at all |
| `magma-datasource-jdbc` | `xstream` |
| `magma-datasource-mongodb` | `magma-test` (its tests never extend `AbstractMagmaTest`), `commons-io` (they use obiba-core's `FileUtil`) |

**Removed — compile scope, provably redundant:**

- `magma-spring` → `spring-context`. Only `org.springframework.beans.factory.*` is used, and
  `spring-beans` is already declared explicitly.

**Corrected — dependency declared on the wrong artifact:**

- `magma-datasource-mongodb` declared `httpclient5` but uses `org.apache.hc.core5.net.URIBuilder`,
  which is **httpcore5**; httpcore5 was only arriving transitively. Swapped the declaration (and the
  parent's managed entry / version property) to `httpcore5` 5.4.3. The artifact actually used stays
  on the classpath.
- `magma-filter` declared `magma-xstream` but uses only `com.thoughtworks.xstream.annotations.*`.
  Swapped to a direct `xstream` dependency.

**Also removed:** 9 unused imports across 6 files in `magma-datasource-jdbc`.

**Deliberately kept — flagged as unused but not:**

| Kept | Why |
|---|---|
| `magma-datasource-jdbc` → `dbunit`, `spring-context` | Used at runtime, not from Magma source: dbunit through obiba-core's `DbUnitAwareTestExecutionListener`, spring-context to load the XML test context |
| `magma-datasource-jdbc` → MySQL/MariaDB/PostgreSQL/SQL Server drivers | Serve the documented workflow of repointing `test-spring-context.xml` at a real server |
| `magma-api` → `spring-context` | Uses `org.springframework.cache.Cache` |
| `magma-datasource-fs` → `magma-crypt` | Uses `org.obiba.magma.datasource.crypt.DatasourceCipherFactory`. An earlier pass wrongly listed this as dead by grepping for the `org.obiba.magma.crypt` package, which is not the package magma-crypt publishes |
| `magma-js` → `unit-api`, `javolution` | Runtime dependencies of `jscience-physics`, whose POM could not be resolved locally to confirm it declares them itself |

**Reported, not removed:** `magma-security` → `shiro-extras` (`eu.flatwhite.shiro`) has no reference
anywhere in Magma, but this kind of Shiro add-on is typically wired from a consuming application's
`shiro.ini` by class name. Removing it from a compile-scope, published artifact could break Opal at
runtime with no compile-time warning, so it needs a check against Opal first.

### Follow-up for the user

Registering H2 as a selectable Opal database type is a change in `obiba/opal` and was left alone,
per the Out of Scope section.

## Appendix: JDBC Datasource Architecture

### Core files
- `JdbcDatasource.java` — datasource; dialect resolution at `newDatabaseInstance()`,
  visitor registration in `ChangeDatabaseCallback` (line ~665)
- `JdbcDatasourceFactory.java`, `JdbcDatasourceSettings.java`
- `JdbcValueTable.java`, `JdbcValueTableWriter.java`, `JdbcValueSetFetcher.java`
- `SqlTypes.java` — `ValueType` ⇄ SQL type-name mapping

### Dialect visitors
- `support/MySqlEngineVisitor.java` — `ENGINE=InnoDB` on `CREATE TABLE`, `BLOB`→`LONGBLOB`
- `support/PostgreSqlEngineVisitor.java` — ` OID`→` BYTEA`

Both are filtered per statement by `getFilteredVisitors()` against `database.getShortName()`,
so a visitor registered for `mysql` never fires for H2, even in `MODE=MySQL`.

### Test infrastructure
- `test-spring-context.xml` — H2 `dataSource` + `transactionManager` (commented-out MySQL and
  PostgreSQL beans for running the suite elsewhere)
- `org.obiba.magma.test.SchemaTestExecutionListener` + `@TestSchema` — per-class/per-method
  `beforeSchema` / `afterSchema` classpath scripts
- obiba-core `DbUnitAwareTestExecutionListener` + `@Dataset` — XML fixtures, looks up the
  `dataSource` bean by name

### Driver versions currently declared (all `test` scope)
MySQL 9.7.0 · MariaDB 3.5.9 · PostgreSQL 42.7.12 · SQL Server 13.4.0.jre11 · H2 2.4.240

### Stack
Liquibase 5.0.3 · Commons DBCP2 2.14.0 · Spring 7.0.8 (JDBC + tx) · JUnit 4.13.2 · DbUnit 2.5.1 · Java 21
