# DataSHIELD Usage Quota

**Created:** 2026-08-31
**Issue:** [obiba/opal#3745](https://github.com/obiba/opal/issues/3745) — "Add Datashield quota", as re-scoped by its last comment
**Scope:** the execution-time quota only; the memory/queueing half of the issue is explicitly dropped
**Verified against:** Opal `master` at `f3d7310c0`
**Target release:** Opal 6.0.0
**Revised:** 2026-08-31 — after implementing phases 0 and 1: usage endpoints moved under `/service/r/quotas`
(§4.4), `RQuotaUsageDto` lost its redundant `source` field (§4.5), `updateQuota` split from `saveQuota` (§4.2)
**Revised:** 2026-09-01 — the long window is now **weekly (7 days)**, not monthly (30): `Period.MONTHLY` became
`Period.WEEKLY` throughout (§1.3, §3.2). Code and tests follow; no data to migrate, the feature is unreleased.

## 1. What the feature is

### 1.1 The issue moved, and the plan follows the move

Issue #3745 as filed had two goals:

1. protect the R server from memory exhaustion — delay commands once the server passes a memory
   threshold (80% was suggested);
2. account for DataSHIELD usage — accumulated execution time, used both as a metric for the data
   custodian and as a limit on user activity.

@tombisho's comment argues goal 1 well: memory pressure is a property of the *multi-user execution
context*, not of a user, so a per-user memory quota either wastes the machine or does not prevent the
crash. The last comment (ymarcon) retires goal 1 on those grounds — on-demand, per-session R servers
already give a single-user container with its own cpu and memory limits, which is a stronger and more
honest containment than any quota Opal could compute — and restates the issue as:

> This issue is then restricted to the second point, which is about setting a quota on the R execution
> time across multiple R/Datashield sessions. This quota could be personal, group-based and
> profile-based.

Everything below implements that sentence and nothing else.

### 1.2 The feature in one paragraph

> Every Opal user has an allowance of DataSHIELD R execution time per rolling window. Opal knows how
> much of it they have spent, because it already records the execution time of every DataSHIELD
> session. When the allowance is spent, Opal refuses to open new DataSHIELD sessions for that user
> until enough past usage has aged out of the window. A user sees their own consumption on their
> profile page; an administrator sees any user's consumption on that user's subject profile page, and
> sets the allowances — a system-wide default, and overrides per group and per user.

### 1.3 The four decisions that shape it

| # | Question | Decision | Why, and what was rejected |
|---|---|---|---|
| 1 | What is consumed? | **R execution time** — the sum of `execution_time_millis` over the user's DataSHIELD sessions | It is already measured (§2.1), it is the thing the issue names, and an idle open session costs nothing. *Rejected:* session wall-clock time (punishes forgetting to close a session, weakly related to load), session count (says nothing about weight). |
| 2 | How hard is the cut? | **Refuse new DataSHIELD sessions only.** Sessions already open keep working normally | Gentlest on in-flight analyses: nobody loses a workspace or a running `ds.glm` because a counter ticked over. *Rejected:* also rejecting commands in open sessions, and closing over-quota sessions. Both are strictly more code and can be added later (§6). The cost of this choice is stated honestly in §3.4.3. |
| 3 | What is the period? | **Rolling window** — daily = the last 24 h, weekly = the last 7 days | No period-end cliff and no midnight stampede; a user who runs out regains capacity progressively as old usage ages out. *Rejected:* calendar-aligned periods with a hard reset. Note this reverses the wording of the original request ("reset at the end of its time period") — see §3.2 for the consequences on the UI wording. |
| 4 | Which quota applies? | **user > group > system**, first match wins; among several groups, the **most permissive** (largest allowance) | A personal quota is an explicit administrative decision about one person and must not be silently capped by a group or system value. Among groups, being added to a more generous group should help, not be neutralised by a stricter one. *Rejected:* "most restrictive wins" (makes personal exceptions impossible), "group quotas add up" (allowance becomes a function of group-membership bookkeeping). |

### 1.4 Non-goals for v1

- No queueing or delaying of commands. The HPC-style scheduler discussed in the issue thread is a
  different feature.
- No memory quota, no system-level memory threshold.
- No per-DataSHIELD-profile quota. The issue mentions "profile-based"; the data model carries the
  execution `context` but not the profile, and §7 records what adding it would cost.
- No quota on the plain R, SQL, Import, Export, Analyse or View contexts. The model is
  context-generic, so switching them on later is configuration plus one enforcement hook, not a
  redesign.
- No warning email or notification when a user approaches their quota.
- No retention policy for the activity log. It is a real and growing problem (§6) but a separate one.

## 2. What already exists, and the four gaps

### 2.1 The activity tracker records exactly the right number

The measurement chain is already in place and needs no change:

```
RockSession.execute(ROperation)                       RockSession.java:218-229
  setBusy(true)   -> startExecMillis = now            AbstractRServerSession.java:291-302
     first command only: post RServerSessionStartedEvent(id, user, context, profile, created)
  rop.doWithConnection(this)
  setBusy(false)  -> executionTimeMillis += now - startExecMillis
                     post RServerSessionUpdatedEvent(id, user, executionTimeMillis)

RActivityService                                      RActivityService.java:95-125
  onRServerSessionStarted -> insert  r_session_activities row (id = R session id)
  onRServerSessionUpdated -> update  execution_time_millis, updated = now
  onRServerSessionClosed  -> update  updated = now
```

The row it maintains:

| column | meaning |
|---|---|
| `id` | the R session's own id (primary key) |
| `user_name` | the Opal principal |
| `context` | `"DataSHIELD"` for DataSHIELD sessions — `DatashieldSessionsResourceImpl.java:50`, set on the session at `:97-98` |
| `profile` | the DataSHIELD profile name |
| `execution_time_millis` | cumulated time the R server spent executing this session's commands |
| `created` / `updated` | session creation, and the end of its most recent command |

Two behaviours worth knowing:

- **Sessions that never run a command leave no row at all.** The started event fires from
  `setBusy(true)` only when `executionTimeMillis == 0`, i.e. on the first command
  (`AbstractRServerSession.java:293-296`). For an execution-time quota this is harmless — such a
  session consumed nothing — but it means the activity log is not a session log.
- **The internal `opal/system` user is excluded** (`RActivityService.java:196-198`), so Opal's own R
  work can never be blocked by a quota.

The UI already renders this: `RActivity.vue` and `RSessionActivitiesDialog.vue`, mounted on both
`ProfilePage.vue` (self) and `AdminProfilePage.vue` (any principal), fed by
`stores/profile-activity.ts` calling `/service/r/activity/_summary?context=DataSHIELD&user=…`.

### 2.2 Gap 1 — there is no quota concept anywhere

`grep -ri quota` over the Java, Vue, TypeScript and protobuf sources returns only CSV quotation marks.
Configuration, service, REST and UI all have to be written.

### 2.3 Gap 2 — there is no hook where a session creation can be refused

`RSessionsResourceImpl.newRSession` (`:77-101`) has exactly two pre-flight checks —
`createRSessionEnabled()` (`:120`) and `checkAuthenticationMethod()` (`:132`) — and
`DatashieldSessionsResourceImpl` overrides the first to always return `true` (`:91-94`). A third,
overridable check has to be added.

### 2.4 Gap 3 — a DataSHIELD user cannot read their own activity today

This one is a pre-existing bug that blocks the feature's headline requirement.

`/service/r/activity` (`RServiceActivityResource.java:38`) carries no `@NoAuthorization`, so
`AuthorizationInterceptor.preProcess` (`:76-85`) demands `rest:/service/r/activity:GET`. Neither
`DATASHIELD_USE` nor `DATASHIELD_ALL` grants it — the full grant lists are
`DataShieldPermissionConverter.java:38-70`, and `DATASHIELD_PROFILE_USE` in
`DataShieldProfilePermissionConverter.java:39-52` does not either. Effectively the "R activity" panel
on `ProfilePage.vue` is empty for every non-administrator, which is precisely the population this
feature is for.

The fix is the pattern already used for profiles: a `_current`-scoped resource marked
`@NoAuthorization`, which serves the authenticated subject and nobody else
(`SubjectProfileCurrentResource.java:49,73`). §4.4 uses it, and Phase 0 (§5) ships it on its own.

### 2.5 Gap 4 — no index supports the usage query

`r_session_activities` has three single-column indexes (`user_name`, `context`, `profile` —
changelog lines 408-416) and `RActivityService.getActivities` filters dates in Java after loading
every row for the user (`RActivityService.java:56-63`, with its own `// TODO filter dates in the SQL
query`). The quota check runs on the session-creation path and must not load a user's whole history.

## 3. Specification

### 3.1 The metric

A user's **usage** for a context is the sum of `execution_time_millis` over their activity records in
that context, within the window. This is wall-clock time during which the R server was executing one
of their commands, summed over commands — not CPU time, and not the lifetime of the session.

Quotas are configured in **minutes** and stored in milliseconds, matching the activity log.

### 3.2 The rolling window

| period | window |
|---|---|
| `DAILY` | now − 24 h → now |
| `WEEKLY` | now − 7 days → now |

There is no reset instant. Consequences to carry into the UI copy and the documentation:

- the user-facing sentence is *"118 of 120 min used in the last 7 days"*, never *"resets on Monday"*;
- when a user is over quota, the useful thing to tell them is when capacity returns. That is
  computable and cheap: the earliest `updated` among the rows currently counted, plus the window
  length. Reported as `nextCreditDate` (§4.5), rendered as *"some capacity returns in about 6 h"*.

**Attribution rule.** A session's whole cumulated execution time is attributed to a single instant,
its `updated` timestamp (the end of its most recent command). A record counts towards the window if
`updated >= windowStart`.

This is an approximation, and it is worth being precise about which way it errs:

```
window start W                              now
      |                                      |
  ----+--------------------------------------+---->
 T0        T1                                       session A: T1 < W  -> excluded.
                                                    All of A's activity is before W. Correct.
      T0'                 T1'                       session B: T1' >= W -> counted in full,
   ^--+---- part before W                           including the part before W. Over-counts.
```

So the estimate **never under-counts**, and the over-count is bounded by the execution time a still-
active session had accumulated before the window opened. With a 7-day window and a DataSHIELD
session timeout of 240 minutes by default (`org.obiba.opal.r.sessionTimeout=240`, with
`org.obiba.opal.r.sessionTimeout.DataSHIELD` unset in
`opal-r/src/main/resources/META-INF/defaults.properties:26-27`), the bound is under 2.5% of the
window and can only make the quota stricter, never laxer. That is the right direction for a
protection mechanism, and it buys a design with no new write path — usage is a single aggregate over
the table that is already being maintained.

The query, in `RSessionActivityRepository`:

```sql
SELECT COALESCE(SUM(execution_time_millis), 0)
  FROM r_session_activities
 WHERE user_name = :user
   AND context   = :context
   AND updated  >= :windowStart
```

backed by a new composite index `idx_r_session_activities_user_context_updated (user_name, context,
updated)`. The existing single-column indexes stay; they serve the listing endpoints.

### 3.3 Which quota applies

Resolution for principal *p* in context *c*:

1. an **enabled** `USER` quota for *p* in *c* → use it;
2. otherwise, among **enabled** `GROUP` quotas in *c* whose group is one of *p*'s groups → use the one
   with the **largest** limit;
3. otherwise, the **enabled** `SYSTEM` quota for *c* → use it;
4. otherwise → **unlimited**.

Two rules that need stating because they are easy to get wrong:

- A row with `enabled = false` is invisible to resolution — the search falls through to the next
  level. It is a way to park a quota without deleting it, not a way to grant an exemption. To exempt
  one user from a system default, give them a `USER` quota with a limit high enough to be
  meaningless, or delete the system default.
- A limit of **0** is a valid, meaningful quota: it forbids DataSHIELD entirely for that subject.
  "No quota configured" and "a quota of zero" are different things, which is why absence resolves to
  unlimited rather than to zero.

Rule 4 is what makes the upgrade safe: on a server where nobody has configured anything, no quota
exists, nothing is enforced, and behaviour is identical to today.

Group membership comes from `SubjectProfile.getGroups()`, populated at login by
`AuthorizationInterceptor` (`:112-120`) via `SubjectProfileService.applyProfileGroups`. Since a quota
is only ever resolved for an authenticated subject, the groups are always current by the time they are
needed.

Worked example:

| configured | user in groups | effective |
|---|---|---|
| system 60 min/week | — | 60 min/week |
| system 60, group `analysts` 120 | `analysts` | 120 min/week |
| system 60, group `analysts` 120, group `partners` 300 | `analysts`, `partners` | 300 min/week |
| the above + user quota 90 min/week | `analysts`, `partners` | 90 min/week |
| the above, user quota disabled | `analysts`, `partners` | 300 min/week |
| nothing configured | any | unlimited |

### 3.4 Enforcement

#### 3.4.1 The single gate

`POST /datashield/sessions` — `DataShieldResource.java:40` → `datashieldSessionsResource` →
`RSessionsResourceImpl.newRSession` (`:77`). Over quota → **403 Forbidden**, with a message naming
the numbers:

```
DataSHIELD quota exceeded: 121 of 120 minutes used in the last 7 days.
Some capacity returns on 2026-09-02 14:10.
```

The same denial is written to the DataSHIELD user log via `DataShieldLog`, with a new `Action`
constant (`QUOTA`, alongside `OPEN`/`CLOSE`/… at `DataShieldLog.java:23-33`), so a data custodian
reading the audit log can see why a user was turned away without correlating HTTP logs.

#### 3.4.2 What is deliberately not gated

- Any operation inside an already-open session: `aggregate`, symbol assignment, `ls`, `rm`, workspace
  save and restore.
- `PUT /datashield/sessions/_test` (`RSessionsResource.java:63`), an administrator's profile smoke
  test.
- Plain R (`/r/sessions`), SQL, and the internal contexts.
- Administrators are **not** exempt. A quota is a statement about a principal; if an administrator
  wants to be exempt, they do not give themselves a quota. `opal/system` is out of scope structurally
  (§2.1).

#### 3.4.3 The cost of gating only session creation, stated plainly

A user who is at their limit and keeps a session open is not stopped. A DataSHIELD session survives
240 minutes of inactivity by default, and each command resets that clock
(`AbstractRServerSession.touch()` on every execute), so in principle a determined user can work
indefinitely past their quota from one session.

This is accepted for v1 on the grounds that the quota's purpose here is to bound *routine* usage and
to give the custodian a number to negotiate with, not to be tamper-proof. What makes it acceptable in
practice is that the usage figure keeps climbing and stays visible on the user's and the
administrator's profile pages: over-consumption is loud, not silent. §6 lists the two escalations
(gate the commands too; close over-quota sessions from the existing 60-second sweeper) that turn this
into a hard limit if it is ever abused.

### 3.5 What users and administrators see

**User's own profile page** (`ProfilePage.vue`), above the existing R activity table:

```
DataSHIELD quota
[████████████████████░░░░]  98 of 120 min used — last 7 days
from: group "analysts"
```

and when exhausted:

```
[████████████████████████]  121 of 120 min used — last 7 days
New DataSHIELD sessions are blocked. Some capacity returns in about 6 h.
```

**Administrator, on a subject's profile page** (`AdminProfilePage.vue`): the same block for the
principal being viewed, plus a shortcut to set a personal quota for them.

**Administrator, DataSHIELD page** (`AdminDatashieldPage.vue`): a new "Quotas" section — the system
default, and a table of group and user overrides with add / edit / delete. It goes on this page
rather than under Users & Groups because v1 is DataSHIELD-only, and the page already carries the
DataSHIELD permissions and profiles.

### 3.6 A worked scenario

`jsmith` belongs to `analysts` (120 min / 7 days). Over the past week he has run 96 minutes of
DataSHIELD execution time.

1. He opens a session, runs a heavy `ds.glm` for 22 minutes: usage 118 / 120. Nothing happens — he is
   not over yet, and even if he were, the running session is untouched.
2. He closes the session, then tries to open a new one for a second analysis: still 118 / 120, allowed.
3. Three more minutes of execution: 121 / 120. His current session keeps working.
4. He closes it and tries to open another: **403**, with the message from §3.4.1. His profile page
   shows the bar full and "some capacity returns in about 9 h" — that being 7 days after the earliest
   session still inside the window.
5. Nine hours later a 5-minute session from 7 days ago drops out of the window. Usage reads 116 / 120
   and he can open a session again.

No administrator action was needed at any point, which is the property the rolling window buys.

## 4. Design

### 4.1 Data model

New entity, in `opal-r` next to the activity classes — the model is context-generic and DataSHIELD is
only its first consumer:

`org.obiba.opal.r.service.RQuota`, table `r_quotas`:

| column | type | notes |
|---|---|---|
| `id` | BIGINT, identity | |
| `created`, `updated` | TIMESTAMP | via `AbstractTimestamped` |
| `context` | VARCHAR(255) NOT NULL | `"DataSHIELD"` in v1 |
| `subject_type` | VARCHAR(255) NOT NULL | `SYSTEM` / `GROUP` / `USER` |
| `principal` | VARCHAR(255) NOT NULL | the user name or group name; **empty string** for `SYSTEM` |
| `period` | VARCHAR(255) NOT NULL | `DAILY` / `WEEKLY` |
| `execution_time_limit_millis` | BIGINT NOT NULL | 0 means "no DataSHIELD" |
| `enabled` | BOOLEAN NOT NULL | |

unique on `(context, subject_type, principal)`.

Three things the schema has to get right, all of them conventions the config database already fixed:

- **`principal` is empty-string, not NULL, for the system row.** PostgreSQL treats NULLs in a unique
  constraint as distinct, so a nullable `principal` would let two system defaults coexist there and
  not on H2. The changelog header is explicit that the same changeset has to apply to an external
  PostgreSQL server.
- **Both enums are varchar written through an `AttributeConverter`**, subclassing
  `EnumNameConverter` (`opal-core-api/.../converter/EnumNameConverter.java`, with
  `SubjectTypeConverter` as the model), never `@Enumerated`. The converter's own javadoc explains why:
  `@Enumerated(STRING)` maps to a server-specific native enum type and turns adding a constant into a
  schema migration.
- **Liquibase owns the schema; Hibernate only validates it** (`hbm2ddl.auto=validate`). So the table,
  the constraint, and the new activity index all go into a new changeset —
  `<changeSet id="2-datashield-quotas" author="opal">` — appended to
  `opal-core/src/main/resources/db/changelog/config/db.changelog-master.xml`, which currently holds
  the single `1-config-model` changeset.

`RQuotaRepository extends JpaRepository<RQuota, Long>` with `findByContext`,
`findByContextAndSubjectTypeAndPrincipal`, and the `upsert`/`deleteByKey` defaults used by
`DataShieldProfileRepository`.

### 4.2 Service

`org.obiba.opal.r.service.RQuotaService`, in `opal-r`, `@Component`, `implements SystemService` like
its neighbours:

```java
Optional<RQuota> resolve(String context, String principal);   // §3.3 precedence
RQuotaUsage getUsage(String context, String principal);       // resolved quota + used + window
boolean isExceeded(String context, String principal);         // getUsage().isExceeded()
// CRUD for the administration endpoints
List<RQuota> getQuotas(String context);
RQuota getQuota(long id);                                     // NoSuchRQuotaException -> 404
RQuota saveQuota(RQuota quota);                               // upsert on (context, subject)
RQuota updateQuota(long id, RQuota values);                   // addressed by identifier
void deleteQuota(long id);
```

`saveQuota` and `updateQuota` are separate on purpose. Creation is an upsert on the natural key —
saving a second quota for the same subject replaces the first rather than tripping the unique
constraint. An update addresses one row by its identifier and must be able to change the subject, so
it loads that row and saves it; moving it onto a subject that already has a quota is then rejected by
the constraint instead of silently clobbering the other one, which the upsert would do.

`RQuotaUsage` is a small value object: the quota (or none), `usedExecutionTimeMillis`, `windowStart`
and `nextCreditDate`. It carries no separate "source" field — the quota it holds already says which
subject it came from, and its absence is what "unlimited" means.

`usedMillis` comes from one aggregate query (§3.2) added to `RSessionActivityRepository`:

```java
@Query("select coalesce(sum(a.executionTimeMillis), 0) from RSessionActivity a " +
       "where a.user = :user and a.context = :context and a.updated >= :from")
long sumExecutionTimeMillis(@Param("user") String user,
                            @Param("context") String context,
                            @Param("from") Date from);
```

No caching in v1. The query runs on session creation (a handful of times per user per day) and on
profile page loads; with the composite index it is an index-range scan and a sum.

### 4.3 Enforcement hook

In `RSessionsResourceImpl`, a new overridable check alongside the two that exist:

```java
   public Response newRSession(UriInfo info, String restore, String profile, boolean wait) {
     if (!createRSessionEnabled())
       throw new ForbiddenException("Plain R service endpoint is not enabled");
     checkAuthenticationMethod();
+    checkQuota();
     RServerSession rSession = opalRSessionManager.newSubjectRSession(createProfile(profile), withInitiator());

+  /**
+   * No quota is enforced on plain R sessions. DataSHIELD overrides this.
+   */
+  protected void checkQuota() throws ForbiddenException {
+  }
```

overridden in `DatashieldSessionsResourceImpl`:

```java
+  @Override
+  protected void checkQuota() {
+    RQuotaUsage usage = rQuotaService.usage(DS_CONTEXT, SecurityUtils.getSubject().getPrincipal().toString());
+    if (!usage.isExceeded()) return;
+    DataShieldLog.userLog(DataShieldLog.Action.QUOTA, "quota exceeded: {} of {} minutes", ...);
+    throw new ForbiddenException(usage.asMessage());
+  }
```

`testNewRSession` (`:104`) does not call it, which keeps the administrator's profile smoke test
working (§3.4.2).

### 4.4 REST API

| endpoint | who | purpose |
|---|---|---|
| `GET /service/r/quotas?context=DataSHIELD` | administrator | list all quotas |
| `POST /service/r/quotas` | administrator | create |
| `GET /service/r/quota/{id}` | administrator | read one |
| `PUT /service/r/quota/{id}` | administrator | update |
| `DELETE /service/r/quota/{id}` | administrator | delete |
| `GET /service/r/quotas/_usage?context=DataSHIELD&user={principal}` | administrator | any user's effective quota and usage |
| `GET /service/r/quotas/_current?context=DataSHIELD` | **`@NoAuthorization`**, any authenticated user | *own* effective quota and usage |
| `GET /service/r/activity/_current?context=DataSHIELD` | **`@NoAuthorization`**, any authenticated user | *own* session activities — closes gap 2.4 |
| `GET /service/r/activity/_current/_summary?context=DataSHIELD` | **`@NoAuthorization`**, any authenticated user | *own* activity summary — closes gap 2.4 |

The two usage endpoints hang off the collection, `/service/r/quotas/…`, rather than off
`/service/r/quota/…`. JAX-RS would resolve `_usage` against `{id}` correctly — a literal outranks a
template — but leaving the single-quota path a pure template means nobody has to know that rule to
read the routing. It also mirrors `/service/r/activity/_summary`, which is how this module already
hangs sub-resources off a collection.

The `_current` resources take the principal from `SecurityUtils.getSubject()` and ignore any `user`
parameter, so `@NoAuthorization` cannot be turned into a way to read someone else's numbers. This is
exactly how `SubjectProfileCurrentResource` (`:49,73`) is built.

The write endpoints fall under `/service/**` with an editing method, which
`OpalModularRealmAuthorizer.isTokenPermitted` (`:101-106`) already narrows to system administrators
for token-authenticated callers — no change needed there.

### 4.5 DTOs

In `opal-web-model/src/main/protobuf/OpalR.proto`, next to `RSessionActivityDto` (`:91`) and
`RActivitySummaryDto` (`:100`):

```protobuf
message RQuotaDto {
  optional int64 id = 1;
  required string context = 2;
  required string subjectType = 3;     // SYSTEM | GROUP | USER
  required string principal = 4;       // "" for SYSTEM
  required string period = 5;          // DAILY | WEEKLY
  required int64 executionTimeLimitMillis = 6;
  required bool enabled = 7;
}

message RQuotaUsageDto {
  required string context = 1;
  required string user = 2;
  optional RQuotaDto quota = 3;                  // absent: no quota applies, i.e. unlimited
  required int64 usedExecutionTimeMillis = 4;
  optional string windowStartDate = 5;           // absent when no quota applies
  required bool exceeded = 6;
  optional string nextCreditDate = 7;            // when capacity next returns
}
```

`RQuotaUsageDto` has no `source` field: the embedded `RQuotaDto` already carries the `subjectType`
and `principal` the quota was found under, so the UI reads *where a limit comes from* off the quota
itself, and reports "unlimited" when there is none.

Dates as `DateTimeType`-formatted strings, matching the activity DTOs.

### 4.6 UI

| file | change |
|---|---|
| `src/models/OpalR.d.ts` | regenerated DTO types |
| `src/stores/r-quota.ts` *(new)* | admin CRUD + `getCurrentUsage()` + `getUsage(principal)` |
| `src/stores/profile-activity.ts` | point the self case at `/service/r/activity/_current/_summary`, keep the admin case on the existing endpoint |
| `src/components/r/RQuotaUsage.vue` *(new)* | the progress-bar block of §3.5; props `principal`, `context` |
| `src/components/admin/r/RQuotas.vue` *(new)* | the admin table + `AddRQuotaDialog.vue`, modelled on `IdentityProvidersList.vue` |
| `src/pages/ProfilePage.vue` | mount `RQuotaUsage` above the R activity section |
| `src/pages/AdminProfilePage.vue` | same, for `route.params.principal` |
| `src/pages/AdminDatashieldPage.vue` | new "Quotas" section |
| `src/i18n/en/index.js`, `src/i18n/fr/index.js` | new keys |

## 5. Sequencing

Four phases. Each ends at a state that is coherent on its own and could ship.

### Phase 0 — let users see their own activity *(independent, small)*

Add `GET /service/r/activity/_current/_summary` and `/service/r/activity/_current` with
`@NoAuthorization`, and point `profile-activity.ts` at them for the self case.

Fixes a bug that exists today (§2.4) and is worth merging on its own, whatever happens to the rest.
**Demoable:** a plain DataSHIELD user opens their profile page and sees their R activity, which they
cannot today.

### Phase 1 — model, service, administration *(no enforcement)*

- `RQuota` entity, `RQuotaRepository`, `2-datashield-quotas` changeset (table + composite index).
- `sumExecutionTimeMillis` on `RSessionActivityRepository`.
- `RQuotaService`: resolution, window, usage.
- Admin REST endpoints + `_usage` + `_current`; DTOs.
- Admin UI: Quotas section on the DataSHIELD page.
- Tests: resolution precedence (all six rows of §3.3's table), window arithmetic including the
  boundary case of §3.2, and a config-persistence test following `AbstractConfigPersistenceTest` —
  which runs with `hbm2ddl.auto=validate` and therefore also proves the changeset matches the entity.

The Quotas table carries a "Used" column, populated from `_usage` for the rows that name a user — a
group or system quota is what applies to many users and has no single figure of its own. That column
is what makes this phase demonstrate itself rather than just store rows.

**Demoable:** an administrator defines quotas and reads any user's consumption against them. Nothing
is blocked.

### Phase 2 — enforcement and the user-facing display

- `checkQuota()` hook and the DataSHIELD override; `DataShieldLog.Action.QUOTA`.
- `RQuotaUsage.vue` on both profile pages.
- Tests: over-quota session creation is refused with 403 and the right message; an open session is
  unaffected; `_test` is unaffected; no quota configured means no enforcement.

**Demoable:** the whole feature as specified in §1.2.

### Phase 3 — documentation and rollout notes

Opal documentation page describing the metric, the rolling window, the resolution order, and — most
importantly for data custodians — what a user experiences when refused, and the fact that an open
session is not interrupted.

## 6. Risks and known limits

| # | Risk | Assessment |
|---|---|---|
| 1 | **An open session bypasses the quota** (§3.4.3) | Accepted for v1, by the enforcement decision. Escalation if needed: (a) call `checkQuota()` from the DataSHIELD command paths (`DataShieldSessionResourceImpl.aggregate`, `DataShieldSymbolResourceImpl.putRestrictedRScript` and friends) — bounds the overrun to one command; (b) have `OpalRSessionManager.checkRSessions`, the existing 60-second sweeper (`:275-278`), close DataSHIELD sessions of over-quota users. Both were offered and declined; neither is foreclosed. |
| 2 | **A single command can blow far past the quota** | Inherent to a time-based quota with no mid-command control: a `ds.glm` that runs for an hour is billed for an hour after the fact. Rolling windows soften it — the overrun ages out. Not fixable without killing running commands. |
| 3 | **The over-count of straddling sessions** (§3.2) | Bounded at <2.5% of a 7-day window, and always in the stricter direction. The shorter window makes this four times larger than it was at 30 days, which is still small; it would become worth fixing if the window shrank again or if sessions could live for days, and the fix is then a bucketed usage table (hourly deltas written from `RServerSessionUpdatedEvent`), not a change to the quota model. |
| 4 | **`r_session_activities` grows without bound** and is never purged | Pre-existing (the repository's own javadoc calls it out). The quota query is index-bounded by `updated`, so it does not degrade with history, but the table does. A retention policy deserves its own issue. |
| 5 | **The DataSHIELD client may not surface the 403 message** | Open question (§7). If DSOpal swallows the body, a user sees only "forbidden" and the message is invisible. Mitigated by writing the denial to the DataSHIELD user log, and by the profile page showing the numbers. |
| 6 | **A user removed from a generous group is cut off at once** | By design — resolution is evaluated at each session creation, not cached. Worth a line in the documentation. |
| 7 | **Upgrade** | Nothing to migrate: no quota exists, resolution rule 4 makes that "unlimited", behaviour is unchanged until an administrator configures something. |

## 7. Open questions

1. **Does DSOpal / DSI surface the 403 response body to the R user?** Determines whether the message
   of §3.4.1 is worth its precision, or whether the audit log and the profile page are the only real
   channels. Needs a check against the DSOpal client, not this repository.
2. **Per-profile quotas.** The issue says "personal, group-based and profile-based". Adding it means a
   nullable `profile` column, a fourth resolution level (probably between user and group, or as a
   dimension crossing all three — which is a real design question, not a column), and a UI field. Left
   out until there is a concrete request, since a per-profile quota only makes sense when profiles
   map to R servers of different cost.
3. **Should other contexts get quotas in the same release?** The model supports it for free; only the
   `checkQuota()` override and the admin UI's context selector are missing. Plain R sessions are
   administrator-facing today, which is why they were left out.
4. **Where does the administration UI belong long-term?** The DataSHIELD page is right while the
   feature is DataSHIELD-only; the moment a second context is enabled, it should move to the R
   administration page or to Users & Groups.
5. **Should a user be warned before hitting the limit?** A banner at, say, 90% costs little and would
   remove most of the surprise. Not in v1 scope, but the `RQuotaUsage` DTO already carries everything
   the UI would need.
