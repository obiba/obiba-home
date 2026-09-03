# DataSHIELD Usage Quota

**Created:** 2026-08-31
**Issue:** [obiba/opal#3745](https://github.com/obiba/opal/issues/3745) — "Add Datashield quota", as re-scoped by its last comment
**Scope:** usage-time quotas — R execution time and R session time; the memory/queueing half of the issue is explicitly dropped
**Verified against:** Opal `master` at `f3d7310c0`, then the feature branch at `5f817e265`
**Target release:** Opal 6.0.0
**Revised:** 2026-08-31 — after implementing phases 0 and 1: usage endpoints moved under `/service/r/quotas`
(§4.4), `RQuotaUsageDto` lost its redundant `source` field (§4.5), `updateQuota` split from `saveQuota` (§4.2)
**Revised:** 2026-09-01 — the long window is now **weekly (7 days)**, not monthly (30): `Period.MONTHLY` became
`Period.WEEKLY` throughout (§1.3, §3.2). Code and tests follow; no data to migrate, the feature is unreleased.
**Revised:** 2026-09-02 — **a quota now names what it limits.** Execution time alone bills a user for the work
the R server did for them and nothing for the R server they are holding: an idle DataSHIELD session keeps a
whole R process, and its memory, alive. So `RQuota` gains a `metric` — `EXECUTION_TIME` or `SESSION_TIME` — the
metric joins the natural key so that a subject can be given one of each (§1.3 decision 5), and the enforcement
gate refuses a new session when *either* applies and is spent. This costs a stored `session_time_millis` on the
activity record, a correction for sessions still open (§3.2.2), and one select in the quota form (§3.5). Phases
0–2 are shipped; the work described here is phase 3 (§5).
**Implemented:** 2026-09-02 — phase 3 is built as specified, with two deviations worth recording. The
config-persistence test lives in the existing `ConfigEntityRoundTripTest` in opal-server rather than in a new
one, since that is the only module with the whole configuration model on its classpath (§5). And the
open-sessions line of the user-facing copy is shown for `SESSION_TIME` only: an execution time allowance stops
moving when the user stops working, so telling them there to close their sessions would be wrong (§3.5).

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

Everything below implements that sentence, plus one thing it does not say and should: the resource a
DataSHIELD user occupies is not only the R server's cpu while a command runs, it is the R server
itself for as long as the session is open. §1.3 decision 1 explains why that needs its own metric
rather than a correction to the first one.

### 1.2 The feature in one paragraph

> Every Opal user has an allowance of DataSHIELD usage per rolling window, expressed either as R
> execution time — how long the R server spent running their commands — or as R session time — how
> long their R sessions stayed open, working or idle. Opal knows how much of each they have spent,
> because it already records both for every DataSHIELD session. When an allowance is spent, Opal
> refuses to open new DataSHIELD sessions for that user until enough past usage has aged out of the
> window. A user sees their own consumption on their profile page; an administrator sees any user's
> consumption on that user's subject profile page, and sets the allowances — a system-wide default,
> and overrides per group and per user, for either metric or both.

### 1.3 The five decisions that shape it

| # | Question | Decision | Why, and what was rejected |
|---|---|---|---|
| 1 | What is consumed? | **Two metrics, chosen per quota.** `EXECUTION_TIME` — the sum of `execution_time_millis` over the user's sessions. `SESSION_TIME` — the sum of their sessions' wall-clock lifetimes, idle time included | Execution time is what the issue names and it bills the cpu the user actually used, but it prices an open, idle session at zero, and an open DataSHIELD session is a live R process holding its memory whether or not anything is running. Session time is what bounds *that*. Neither subsumes the other: a user who runs one four-hour `ds.glm` and a user who parks eight idle sessions cost the server in different currencies, and a custodian should be able to name which one they are protecting. *Rejected:* charging idle time into a single blended figure (nobody can then read the number, and the two costs have different exchange rates on different deployments), and session count (says nothing about weight or duration). |
| 2 | How hard is the cut? | **Refuse new DataSHIELD sessions only.** Sessions already open keep working normally | Gentlest on in-flight analyses: nobody loses a workspace or a running `ds.glm` because a counter ticked over. *Rejected:* also rejecting commands in open sessions, and closing over-quota sessions. Both are strictly more code and can be added later (§6). The cost of this choice is stated honestly in §3.4.3, and it is higher for session time than for execution time. |
| 3 | What is the period? | **Rolling window** — daily = the last 24 h, weekly = the last 7 days | No period-end cliff and no midnight stampede; a user who runs out regains capacity progressively as old usage ages out. *Rejected:* calendar-aligned periods with a hard reset. Note this reverses the wording of the original request ("reset at the end of its time period") — see §3.2 for the consequences on the UI wording. |
| 4 | Which quota applies? | **user > group > system**, first match wins; among several groups, the **most permissive** (largest allowance) | A personal quota is an explicit administrative decision about one person and must not be silently capped by a group or system value. Among groups, being added to a more generous group should help, not be neutralised by a stricter one. *Rejected:* "most restrictive wins" (makes personal exceptions impossible), "group quotas add up" (allowance becomes a function of group-membership bookkeeping). |
| 5 | Is the metric a property of a quota, or a dimension of the model? | **A dimension.** The natural key is `(context, subject_type, principal, metric)`, resolution runs once per metric, and a session is refused if either resolved quota is spent | Two consequences force it. Limits of different metrics are not comparable — "the most permissive of the groups' quotas" is meaningless between 60 minutes of execution time and 600 minutes of session time, and well defined only within one metric. And a custodian who wants both bounds must be able to state both; if the metric were a property of a single quota row, choosing one would silently drop the other. *Rejected:* one quota per subject carrying a metric (cheaper by one column, but makes rule 4 ill-defined and the two bounds mutually exclusive). |

### 1.4 Non-goals for v1

- No queueing or delaying of commands. The HPC-style scheduler discussed in the issue thread is a
  different feature.
- No memory quota, and no system-level memory threshold. A session-time quota is a *proxy* for memory
  pressure, deliberately: it bounds how long a user holds an R server, not how much that server
  allocates. §6 keeps the honest statement of what it does not do.
- No per-DataSHIELD-profile quota. The issue mentions "profile-based"; the data model carries the
  execution `context` but not the profile, and §7 records what adding it would cost.
- No quota on the plain R, SQL, Import, Export, Analyse or View contexts. The model is
  context-generic, so switching them on later is configuration plus one enforcement hook, not a
  redesign.
- No warning email or notification when a user approaches their quota.
- No retention policy for the activity log. It is a real and growing problem (§6) but a separate one.

## 2. What already exists, and the gaps

### 2.1 The activity tracker records one of the two numbers, and can be made to record the other

The measurement chain is in place:

```
RockSession.execute(ROperation)                       RockSession.java:218-229
  setBusy(true)   -> startExecMillis = now            AbstractRServerSession.java:297-308
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
| `context` | `"DataSHIELD"` for DataSHIELD sessions — `DatashieldSessionsResourceImpl.java:119-121`, passed at creation so the context initiator's own R operations are already recorded under it |
| `profile` | the DataSHIELD profile name |
| `execution_time_millis` | cumulated time the R server spent executing this session's commands |
| `created` / `updated` | session creation, and the end of its most recent command or the moment it was closed |

Execution time is therefore a stored, summable column. **Session time is not**: it is
`updated − created`, which `RActivity.getTotalTimeMillis()` computes in Java and nothing persists.
That is the first of the three things §2.3 has to fix.

Two behaviours worth knowing:

- **A session that never runs a command leaves no row at all.** The started event fires from
  `setBusy(true)` only when `executionTimeMillis == 0`, i.e. on the first command
  (`AbstractRServerSession.java:301-302`). For an execution-time quota this is harmless — such a
  session consumed nothing. For a session-time quota it is fatal, because a session that runs nothing
  and stays open is precisely the case the metric exists to catch. It happens not to occur for
  DataSHIELD today, since `DatashieldSessionsResourceImpl.withInitiator()` (`:130`) always
  executes at least `options('datashield.seed' = …)` while the session is being opened — but a metric
  must not rest on a side effect of the seed option.
- **The internal `opal/system` user is excluded** (`RActivityService.java:196-198`), so Opal's own R
  work can never be blocked by a quota.

The UI already renders this: `RActivity.vue` and `RSessionActivitiesDialog.vue`, mounted on both
`ProfilePage.vue` (self) and `AdminProfilePage.vue` (any principal), fed by
`stores/profile-activity.ts`. `RSessionActivitiesDialog.vue:86` already displays a session's duration,
computed from the two dates on the client — the number exists, it is simply not one the server can sum.

### 2.2 Gaps 1 to 4, closed by phases 0 to 2

The four gaps this document opened with have been closed and are recorded here only so the sequencing
of §5 stays readable:

| # | gap | closed by |
|---|---|---|
| 1 | no quota concept anywhere | `RQuota`, `RQuotaService`, `RQuotaRepository`, REST resources, admin UI |
| 2 | no hook where a session creation can be refused | `RSessionsResourceImpl.checkQuota()` (`:149`), overridden in `DatashieldSessionsResourceImpl` (`:104`) |
| 3 | a DataSHIELD user could not read their own activity | the `@NoAuthorization` `_current` resources of §4.4 |
| 4 | no index supported the usage query | `idx_r_session_activities_user_context_updated`, changeset `2-r-quotas` |

### 2.3 Gap 5 — nothing today can answer "how long has this user held an R server?"

Three distinct problems, all of them small, and all of them on the path of the new metric.

**a. Session time is not stored, and `sum(updated − created)` is not a portable query.** Timestamp
arithmetic inside an aggregate is dialect-specific, and the quota check runs on the session-creation
path, so it has to be an indexed aggregate over a numeric column and not a walk of the user's history.
The fix is a stored `session_time_millis`, maintained by `RActivityService` on the same three events
that already maintain `execution_time_millis` (§4.1.2).

**b. A session that has never run a command has no record.** §2.1. The fix is to post
`RServerSessionStartedEvent` when the session is created rather than when it first becomes busy
(§4.1.2).

**c. An open session's record stops moving while the session idles.** `updated` advances on a command
end and on close, so a session that has been idle for three hours reports the session time it had at
its last command. A user could park a session overnight and see their session-time usage stand still,
which would defeat the metric at exactly the moment it matters. The fix is not a heartbeat writing to
the activity table every minute, but a read-time correction: the quota service asks
`OpalRSessionManager` which of the user's sessions are open in that context and adds the tail each one
has accumulated since its record was last written (§3.2.2).

## 3. Specification

### 3.1 The two metrics

A quota names one of them, and measures a user's **usage** for a context over the window:

| metric | what it sums | what it is a bound on |
|---|---|---|
| `EXECUTION_TIME` | `execution_time_millis` over the user's activity records | the R server's cpu the user actually consumed: wall-clock time during which the R server was executing one of their commands, summed over commands — not cpu time, and not the lifetime of the session |
| `SESSION_TIME` | the wall-clock lifetime of the user's R sessions, from creation to close, plus the elapsed life of the sessions still open (§3.2.2) | the R server the user is holding: an open DataSHIELD session is a live R process with its memory whether it is computing or idle |

Session time is always ≥ execution time for the same set of sessions, and the difference is the idle
time `RSessionActivity.getIdleTimeMillis()` already names. Two consequences to state once and rely on
later:

- giving a subject a session-time limit *lower* than their execution-time limit makes the latter
  unreachable. It is not an error and is not rejected — it is simply a way of saying "the session-time
  bound is the real one" — but the administration UI hints at it (§3.5).
- a user cannot lower their session time by working faster; only by closing sessions they are not
  using. That is the behaviour the metric is meant to teach, and it is why the user-facing copy names
  it (§3.5).

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
  length. Reported as `nextCreditDate` (§4.5), rendered as *"some capacity returns in about 6 h"* —
  with the caveat of §3.2.2 for a user whose usage comes from a session that is still open.

#### 3.2.1 Attribution, for both metrics

**A session's whole contribution is attributed to a single instant, its `updated` timestamp** (the end
of its most recent command, or its close). A record counts towards the window if
`updated >= windowStart`, and then it counts in full — its execution time, or its session time,
according to the metric.

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

So the estimate **never under-counts**, and the over-count is bounded by what a still-active session
had accumulated before the window opened. With a 7-day window and a DataSHIELD session timeout of 240
minutes by default (`org.obiba.opal.r.sessionTimeout=240`, with
`org.obiba.opal.r.sessionTimeout.DataSHIELD` unset in
`opal-r/src/main/resources/META-INF/defaults.properties:26-27`), the bound is under 2.5% of the window
and can only make the quota stricter, never laxer. That is the right direction for a protection
mechanism, and it buys a design with no new write path — usage is a single aggregate over the table
that is already being maintained.

Note the bound is the same for both metrics, and for the same reason: the session timeout caps how
long a single session can straddle the window edge, whether it was busy or idle.

The queries, in `RSessionActivityRepository`:

```sql
SELECT COALESCE(SUM(execution_time_millis), 0)   -- or SUM(session_time_millis)
  FROM r_session_activities
 WHERE user_name = :user
   AND context   = :context
   AND updated  >= :windowStart
```

backed by the composite index `idx_r_session_activities_user_context_updated (user_name, context,
updated)`. The existing single-column indexes stay; they serve the listing endpoints.

#### 3.2.2 The live tail: sessions that are still open

For execution time the record is complete the moment a command ends, so the aggregate above is the
whole answer. For session time it is not: `updated` stops advancing while a session idles, so a
session open since 08:00 whose last command ran at 08:05 still reports five minutes of session time at
noon. Left alone, that would let a user park sessions and watch their usage stand still — the exact
behaviour the metric exists to discourage.

So a session-time usage is the sum of two terms:

```
usedSessionTimeMillis =  SUM(session_time_millis) over records with updated >= windowStart      -- persisted
                       + Σ (now − record.updated) over the user's sessions open in the context  -- live tail
```

`OpalRSessionManager.getRSessions()` already holds every live session with its user and execution
context, and the quota check runs in the same process, so the second term costs one in-memory filter
and one `findAllById` over a handful of ids. No heartbeat, no write amplification, and the number is
exact at the instant it is read.

Three properties of this correction, stated so nobody has to rediscover them:

- **It preserves "never under-counts".** A live session whose record has already left the window
  contributes its whole tail rather than only the part inside the window; that is an over-count, in
  the same direction as §3.2.1.
- **It is per-Opal-node.** The session manager is in-process. Opal is not clustered, so today this is
  the whole truth; if it ever is, the live term is what would have to move.
- **A live session's contribution does not age out.** `nextCreditDate` is computed from the persisted
  records, and it is honest only about them: a user who is over quota *because* of a session they are
  holding gets no capacity back by waiting, only by closing it. The usage DTO therefore also reports
  how many sessions the user has open in the context (§4.5), and the UI says so in that case (§3.5).

### 3.3 Which quota applies

Resolution runs **once per metric**, and independently. For principal *p*, context *c* and metric *m*:

1. an **enabled** `USER` quota for *p* in *c* for *m* → use it;
2. otherwise, among **enabled** `GROUP` quotas in *c* for *m* whose group is one of *p*'s groups → use
   the one with the **largest** limit;
3. otherwise, the **enabled** `SYSTEM` quota for *c* for *m* → use it;
4. otherwise → **unlimited for that metric**.

Comparing limits only ever happens inside step 2, and therefore only ever between limits of the same
metric — which is the whole reason the metric is part of the key (§1.3 decision 5). A user can end up
with an execution-time quota from their group and a session-time quota from the system default; those
are two independent answers and both are enforced.

Three rules that need stating because they are easy to get wrong:

- A row with `enabled = false` is invisible to resolution — the search falls through to the next
  level *of the same metric*. It is a way to park a quota without deleting it, not a way to grant an
  exemption. To exempt one user from a system default, give them a `USER` quota with a limit high
  enough to be meaningless, or delete the system default.
- A limit of **0** is a valid, meaningful quota: it forbids DataSHIELD entirely for that subject.
  "No quota configured" and "a quota of zero" are different things, which is why absence resolves to
  unlimited rather than to zero.
- Unlimited is per metric. A user with an execution-time quota and no session-time quota is bounded on
  one axis and free on the other; nothing infers one from the other.

Rule 4 is what makes the upgrade safe: on a server where nobody has configured anything, no quota
exists, nothing is enforced, and behaviour is identical to today.

Group membership comes from `SubjectProfile.getGroups()`, populated at login by
`AuthorizationInterceptor` (`:112-120`) via `SubjectProfileService.applyProfileGroups`. Since a quota
is only ever resolved for an authenticated subject, the groups are always current by the time they are
needed.

Worked example, for one metric:

| configured | user in groups | effective |
|---|---|---|
| system 60 min/week | — | 60 min/week |
| system 60, group `analysts` 120 | `analysts` | 120 min/week |
| system 60, group `analysts` 120, group `partners` 300 | `analysts`, `partners` | 300 min/week |
| the above + user quota 90 min/week | `analysts`, `partners` | 90 min/week |
| the above, user quota disabled | `analysts`, `partners` | 300 min/week |
| nothing configured | any | unlimited |

and across metrics:

| configured | effective for `jsmith` |
|---|---|
| system: 60 min/week of execution time | execution time 60 min/week, session time unlimited |
| the above + group `analysts`: 480 min/week of session time, `jsmith` in `analysts` | execution time 60 min/week **and** session time 480 min/week |
| the above + user `jsmith`: 120 min/week of execution time | execution time 120 min/week, session time 480 min/week |

### 3.4 Enforcement

#### 3.4.1 The single gate

`POST /datashield/sessions` — `DataShieldResource.java:40` → `datashieldSessionsResource` →
`RSessionsResourceImpl.newRSession` (`:77`). The gate resolves **both** metrics and refuses if either
is spent — **403 Forbidden**, with a message naming the numbers of every metric that is over, because
a user who frees up one and is still blocked by the other has learned nothing from a message that
named only the first:

```
DataSHIELD quota exceeded: 121 of 120 minutes of execution time used in the last 7 days.
Some capacity returns on 2026-09-02 14:10.
```

```
DataSHIELD quota exceeded: 502 of 480 minutes of session time used in the last 7 days.
You have 2 DataSHIELD sessions open; they keep consuming your allowance until you close them.
```

The same denial is written to the DataSHIELD user log via `DataShieldLog`, with the `QUOTA` action
constant (alongside `OPEN`/`CLOSE`/… at `DataShieldLog.java:23-33`), so a data custodian reading the
audit log can see why a user was turned away without correlating HTTP logs.

#### 3.4.2 What is deliberately not gated

- Any operation inside an already-open session: `aggregate`, symbol assignment, `ls`, `rm`, workspace
  save and restore.
- `PUT /datashield/sessions/_test` (`RSessionsResource.java:63`), an administrator's profile smoke
  test.
- Plain R (`/r/sessions`), SQL, and the internal contexts.
- Administrators are **not** exempt. A quota is a statement about a principal; if an administrator
  wants to be exempt, they do not give themselves a quota. `opal/system` is out of scope structurally
  (§2.1).

#### 3.4.3 The cost of gating only session creation, stated plainly — and it is higher for session time

A user who is at their limit and keeps a session open is not stopped. A DataSHIELD session survives
240 minutes of inactivity by default, and each command resets that clock
(`AbstractRServerSession.touch()` on every execute), so in principle a determined user can work
indefinitely past an execution-time quota from one session.

For session time the asymmetry is sharper and cuts the other way. An execution-time overrun stops
growing when the user stops working; a session-time overrun **keeps growing while the user does
nothing at all**, because the resource is still held. So:

- being over a session-time quota is self-deepening, and the only thing that ends it is closing the
  session or the 240-minute idle timeout doing it for them. One forgotten session therefore costs at
  most four hours of allowance, which is the sense in which the existing timeout is already half of
  this feature;
- conversely, the enforcement point is well matched to the metric's purpose: what a session-time quota
  is protecting against is a user accumulating *many* sessions, and every additional one goes through
  the gate.

This is accepted for v1 on the grounds that the quota's purpose is to bound *routine* usage and to
give the custodian a number to negotiate with, not to be tamper-proof. What makes it acceptable in
practice is that the usage figure keeps climbing and stays visible on the user's and the
administrator's profile pages: over-consumption is loud, not silent. §6 lists the two escalations —
gate the commands too; close over-quota sessions from the existing 60-second sweeper — and notes that
the second is a much better fit for session time than the first.

### 3.5 What users and administrators see

**User's own profile page** (`ProfilePage.vue`), above the existing R activity table — one block per
metric that has a quota, and nothing at all when neither has one:

```
DataSHIELD quota
[████████████████████░░░░]  98 of 120 min of execution time — last 7 days
from: group "analysts"

[██████████████████░░░░░░]  360 of 480 min of session time — last 7 days
from: the system default · 1 session open, still consuming
```

and when exhausted:

```
[████████████████████████]  502 of 480 min of session time — last 7 days
New DataSHIELD sessions are blocked. You have 2 sessions open; close the ones you are not using.
```

The second sentence is the one that changes with the metric. For execution time it is *"some capacity
returns in about 6 h"*; for session time, when the user still has sessions open, waiting does not help
(§3.2.2) and the copy says what does.

**Administrator, on a subject's profile page** (`AdminProfilePage.vue`): the same blocks for the
principal being viewed, plus a shortcut to set a personal quota for them — one per metric, so the
shortcut carries the metric of the block it sits under.

**Administrator, DataSHIELD page** (`AdminDatashieldPage.vue`): the "Quotas" section gains a **Metric**
column, and the add/edit form a **Metric** select. The form's limit hint follows the selected metric —
"R execution time allowed over the window" versus "how long sessions may stay open over the window,
idle time included" — and warns when a session-time limit is set below the same subject's
execution-time limit (§3.1).

### 3.6 A worked scenario

`jsmith` belongs to `analysts`, which carries 120 min / 7 days of execution time; the system default
adds 480 min / 7 days of session time. Over the past week he has run 96 minutes of execution time
across sessions that were open for 300 minutes in total.

1. He opens a session, runs a heavy `ds.glm` for 22 minutes, then leaves it open while he reads the
   output for 40: execution time 118 / 120, session time 362 / 480. Nothing happens.
2. He closes it and opens a new one for a second analysis: both still under, allowed.
3. Three more minutes of execution: 121 / 120 of execution time. His current session keeps working.
4. He closes it and tries to open another: **403**, naming execution time. His profile page shows that
   bar full and "some capacity returns in about 9 h" — 7 days after the earliest session still inside
   the window.
5. Nine hours later a 5-minute session from 7 days ago drops out of the window. Execution time reads
   116 / 120 and he can open a session again.
6. A fortnight later he has been careful about execution time but leaves three sessions open across a
   working week. Session time reaches 482 / 480 with two of them still open, so the block is on the
   other metric, waiting does not clear it, and the message tells him to close them. When he does, the
   live tail stops growing and the persisted records age out normally.

No administrator action was needed at any point, which is the property the rolling window buys.

## 4. Design

### 4.1 Data model

#### 4.1.1 The quota

`org.obiba.opal.r.service.RQuota`, table `r_quotas` — in `opal-r` next to the activity classes, since
the model is context-generic and DataSHIELD is only its first consumer:

| column | type | notes |
|---|---|---|
| `id` | BIGINT, identity | |
| `created`, `updated` | TIMESTAMP | via `AbstractTimestamped` |
| `context` | VARCHAR(255) NOT NULL | `"DataSHIELD"` in v1 |
| `subject_type` | VARCHAR(255) NOT NULL | `SYSTEM` / `GROUP` / `USER` |
| `principal` | VARCHAR(255) NOT NULL | the user name or group name; **empty string** for `SYSTEM` |
| `metric` | VARCHAR(255) NOT NULL | **new** — `EXECUTION_TIME` / `SESSION_TIME` |
| `period` | VARCHAR(255) NOT NULL | `DAILY` / `WEEKLY` |
| `limit_millis` | BIGINT NOT NULL | **renamed** from `execution_time_limit_millis`; 0 means "no DataSHIELD" |
| `enabled` | BOOLEAN NOT NULL | |

unique on `(context, subject_type, principal, metric)`.

The rename is not cosmetic. A column called `execution_time_limit_millis` that holds a session-time
limit half the time is the kind of lie that costs a reader an hour a year from now; `metric` says what
the number means and `limit_millis` stops claiming otherwise. The same rename runs through
`RQuota.getLimitMillis()`, the DTO (§4.5) and the UI.

Four things the schema has to get right, three of them conventions the config database already fixed:

- **`principal` is empty-string, not NULL, for the system row.** PostgreSQL treats NULLs in a unique
  constraint as distinct, so a nullable `principal` would let two system defaults coexist there and
  not on H2. Now that the key has four columns the point matters more, not less.
- **All three enums are varchar written through an `AttributeConverter`**, subclassing
  `EnumNameConverter` (`opal-core-api/.../converter/EnumNameConverter.java`), never `@Enumerated`. The
  converter's own javadoc explains why: `@Enumerated(STRING)` maps to a server-specific native enum
  type and turns adding a constant into a schema migration — which, for an enum that has just gained
  its second member and may gain a third, is the whole argument.
- **Liquibase owns the schema; Hibernate only validates it** (`hbm2ddl.auto=validate`).
- **The changeset is amended, not appended.** `2-r-quotas` is unreleased, so `metric`, the renamed
  limit column, the four-column unique constraint and the new `session_time_millis` (§4.1.2) all go
  into it in place, and an upgrading server sees one coherent changeset. The cost is local: a
  developer who has already run the branch gets a Liquibase checksum error and has to drop `r_quotas`
  and the column, or re-initialise their config database. That is worth saying in the pull request and
  not worth a second changeset in the released schema.

`RQuotaRepository` keeps `findByContext` and `findByContextAndEnabledTrue` — resolution reads a
context's enabled quotas once and splits them by metric in memory, since there are a handful of rows at
most — and its lookup and `upsert` default take the metric as a fourth argument:
`findByContextAndSubjectTypeAndPrincipalAndMetric`. Without that argument the upsert would find the
execution-time quota of a subject and overwrite it with their session-time one.

#### 4.1.2 The activity record

Two changes to `r_session_activities`, both in the same amended changeset:

**a. A stored `session_time_millis`** (BIGINT NOT NULL, `defaultValueNumeric="0"`), on `RActivity`
beside `execution_time_millis`. `RActivityService` sets it on all three events, as
`updated − created`, at the moment it sets `updated`:

```java
private void touch(RSessionActivity metric) {
  metric.setUpdated(new Date());
  metric.setSessionTimeMillis(metric.getUpdated().getTime() - metric.getCreated().getTime());
}
```

`RActivity.getTotalTimeMillis()`, which computed the same thing in Java and had no caller, goes away;
`RSessionActivity.getIdleTimeMillis()` keeps working off the stored value.

Rows that predate the upgrade keep a session time of 0. There is no backfill: computing
`updated − created` in Liquibase is dialect-specific, and the error self-heals — within one window
length every record that still counts was written by the new code. Worth one line in the release note,
since a custodian who switches a session-time quota on the day of the upgrade will see usage climb
from zero over the first week.

**b. The session is recorded when it is created, not when it first runs something.**
`OpalRSessionManager.newSubjectRSession(principal, profile, executionContext, contextInitiator)`
(`:401`) posts `RServerSessionStartedEvent` right after `rSessions.addRSession(rSession)`, and
`RActivityService.onRServerSessionStarted` becomes idempotent:

```java
   public void onRServerSessionStarted(RServerSessionStartedEvent event) {
     if (isOpalSystemUser(event)) return;
+    if (findActivity(event.getId()) != null) return; // already recorded, whoever got there first
     RSessionActivity metric = new RSessionActivity();
```

The guard is what makes the ordering irrelevant, and it has to be there: the two posts race by
construction. The context initiator runs *inside* `service.newRServerSession(…)`, before the manager
has the session back, so for DataSHIELD the first command's `setBusy(true)` posts the started event
first and the manager's post is the no-op; for a session with no initiator and no command, the
manager's post is the one that creates the row. Without the guard the second post would insert a fresh
record over the first and reset `execution_time_millis` to zero.

The existing post in `AbstractRServerSession.setBusy` (`:301-302`) therefore stays exactly as it is —
it is now a redundant path rather than the only one, and removing it would lose the initiator's
execution time on the sessions where it fires first.

What this changes elsewhere: sessions that do nothing now leave a row, so `r_session_activities` grows
slightly faster (bounded by the number of sessions actually opened), and `sessionsCount` in the
activity summaries becomes a true count of sessions rather than a count of sessions that ran
something. Both are improvements; both are visible in the UI and belong in the release note.

### 4.2 Service

`org.obiba.opal.r.service.RQuotaService`, `@Component`, `implements SystemService`:

```java
Optional<RQuota> resolve(String context, String principal, RQuota.Metric metric);  // §3.3, per metric
RQuotaUsage getUsage(String context, String principal, RQuota.Metric metric);
List<RQuotaUsage> getUsages(String context, String principal);   // one entry per metric, always
boolean isExceeded(String context, String principal);            // any metric exceeded
// CRUD for the administration endpoints, unchanged in shape
List<RQuota> getQuotas(String context);
RQuota getQuota(long id);                                        // NoSuchRQuotaException -> 404
RQuota saveQuota(RQuota quota);                                  // upsert on (context, subject, metric)
RQuota updateQuota(long id, RQuota values);                      // addressed by identifier
void deleteQuota(long id);
```

`getUsages` returns one entry per metric whether or not a quota applies, so that a caller — the profile
page above all — never has to know how many metrics exist to render the answer. An entry with no quota
is the "unlimited" case and carries a used value of 0: with no limit to compare against there is
nothing worth a query, which is the same trade the service already makes.

`saveQuota` and `updateQuota` stay separate for the reason they always were. Creation is an upsert on
the natural key — which now includes the metric, so saving a session-time quota for a subject who has
an execution-time one creates a second row instead of replacing the first, and that is the point. An
update addresses one row by its identifier and can change the metric like any other key column; moving
it onto a key another quota already holds is rejected by the constraint instead of silently clobbering
it, which the upsert would do.

`RQuotaUsage` becomes a per-metric value object: the metric, the quota (or none), `usedMillis`,
`windowStart`, `nextCreditDate`, and `openSessionsCount` — how many sessions the user has open in the
context, which is what §3.2.2 needs to tell a session-time user that waiting will not help. It carries
no separate "source" field: the quota it holds already says which subject it came from, and its
absence is what "unlimited" means.

Usage is measured per metric:

```java
@Query("select coalesce(sum(a.executionTimeMillis), 0) from RSessionActivity a " +
       "where a.user = :user and a.context = :context and a.updated >= :from")
long sumExecutionTimeMillis(@Param("user") String user, @Param("context") String context, @Param("from") Date from);

@Query("select coalesce(sum(a.sessionTimeMillis), 0) from RSessionActivity a " +
       "where a.user = :user and a.context = :context and a.updated >= :from")
long sumSessionTimeMillis(@Param("user") String user, @Param("context") String context, @Param("from") Date from);
```

and for `SESSION_TIME` the service adds the live tail of §3.2.2:

```java
private long liveSessionTimeMillis(String context, String principal) {
  List<String> openIds = opalRSessionManager.getRSessions().stream()
      .filter(s -> principal.equals(s.getUser()) && context.equals(s.getExecutionContext()))
      .map(RServerSession::getId).toList();
  if (openIds.isEmpty()) return 0;
  long now = System.currentTimeMillis();
  return rSessionActivityRepository.findAllById(openIds).stream()
      .mapToLong(a -> Math.max(0, now - a.getUpdated().getTime()))
      .sum();
}
```

`RQuotaService` therefore gains a dependency on `OpalRSessionManager`. That direction is safe: the
manager knows nothing about quotas — enforcement lives in the REST resource (§4.3) — so no cycle is
introduced.

No caching in v1. The queries run on session creation (a handful of times per user per day) and on
profile page loads; with the composite index each is an index-range scan and a sum, and the live term
is bounded by the number of sessions one user has open.

### 4.3 Enforcement hook

`RSessionsResourceImpl.checkQuota()` (`:149`) and the empty default for plain R sessions are unchanged.
The DataSHIELD override widens from one metric to all of them:

```java
   @Override
   protected void checkQuota() {
     String principal = SecurityUtils.getSubject().getPrincipal().toString();
-    RQuotaUsage usage = rQuotaService.getUsage(DS_CONTEXT, principal);
-    if (!usage.isExceeded()) return;
-    String message = usage.asMessage();
+    List<RQuotaUsage> exceeded = rQuotaService.getUsages(DS_CONTEXT, principal).stream()
+        .filter(RQuotaUsage::isExceeded).toList();
+    if (exceeded.isEmpty()) return;
+    String message = exceeded.stream().map(RQuotaUsage::asMessage).collect(Collectors.joining(" "));
     DataShieldLog.userLog("", DataShieldLog.Action.QUOTA, "refused a datashield session: {}", message);
     throw new ForbiddenException(message);
   }
```

`RQuotaUsage.asMessage()` names its own metric and, for `SESSION_TIME` with open sessions, says that
they keep consuming the allowance (§3.4.1). `testNewRSession` (`:104`) still does not call the hook,
which keeps the administrator's profile smoke test working (§3.4.2).

### 4.4 REST API

Unchanged in shape; the two usage endpoints now return a **list** of usages, one per metric:

| endpoint | who | purpose |
|---|---|---|
| `GET /service/r/quotas?context=DataSHIELD` | administrator | list all quotas, both metrics |
| `POST /service/r/quotas` | administrator | create |
| `GET /service/r/quota/{id}` | administrator | read one |
| `PUT /service/r/quota/{id}` | administrator | update |
| `DELETE /service/r/quota/{id}` | administrator | delete |
| `GET /service/r/quotas/_usage?context=DataSHIELD&user={principal}` | administrator | any user's effective quotas and usage, one entry per metric |
| `GET /service/r/quotas/_current?context=DataSHIELD` | **`@NoAuthorization`**, any authenticated user | *own* effective quotas and usage |
| `GET /service/r/activity/_current?context=DataSHIELD` | **`@NoAuthorization`**, any authenticated user | *own* session activities |
| `GET /service/r/activity/_current/_summary?context=DataSHIELD` | **`@NoAuthorization`**, any authenticated user | *own* activity summary |

Returning a list rather than a single object is a breaking change to two endpoints that no released
version has ever served, and it is the shape that survives a third metric. Neither takes a `metric`
parameter: a caller that wanted one metric would still have to handle the other appearing on the page,
and the second entry costs one aggregate query.

The two usage endpoints hang off the collection, `/service/r/quotas/…`, rather than off
`/service/r/quota/…`. JAX-RS would resolve `_usage` against `{id}` correctly — a literal outranks a
template — but leaving the single-quota path a pure template means nobody has to know that rule to read
the routing. It also mirrors `/service/r/activity/_summary`.

The `_current` resources take the principal from `SecurityUtils.getSubject()` and ignore any `user`
parameter, so `@NoAuthorization` cannot be turned into a way to read someone else's numbers, exactly as
`SubjectProfileCurrentResource` (`:49,73`) does.

The write endpoints fall under `/service/**` with an editing method, which
`OpalModularRealmAuthorizer.isTokenPermitted` (`:101-106`) already narrows to system administrators for
token-authenticated callers — no change needed there.

### 4.5 DTOs

In `opal-web-model/src/main/protobuf/OpalR.proto`:

```protobuf
message RQuotaDto {
  optional int64 id = 1;
  required string context = 2;
  required string subjectType = 3;     // SYSTEM | GROUP | USER
  required string principal = 4;       // "" for SYSTEM
  required string period = 5;          // DAILY | WEEKLY
  required int64 limitMillis = 6;      // was executionTimeLimitMillis
  required bool enabled = 7;
  required string metric = 8;          // EXECUTION_TIME | SESSION_TIME
}

message RQuotaUsageDto {
  required string context = 1;
  required string user = 2;
  optional RQuotaDto quota = 3;                  // absent: no quota applies to this metric, i.e. unlimited
  required int64 usedMillis = 4;                 // was usedExecutionTimeMillis
  optional string windowStartDate = 5;           // absent when no quota applies
  required bool exceeded = 6;
  optional string nextCreditDate = 7;            // when the persisted part of the usage next ages out
  required string metric = 8;                    // the metric this entry reports on
  optional int32 openSessionsCount = 9;          // sessions still open in the context, for SESSION_TIME
}
```

`metric` is added at the end and the two renames reuse their field numbers, which is legitimate only
because nothing has ever been serialised by a released version. It is also why the renames are worth
doing now rather than living with `usedExecutionTimeMillis` holding session time.

`RActivitySummaryDto` gains `optional int64 sessionTimeMillis = 8` so the existing R activity table can
show the same number a session-time quota counts. Without it a user reads "3 h used of 8 h" in the
quota block and finds nothing in the table below it that adds up to three hours.

Dates as `DateTimeType`-formatted strings, matching the activity DTOs.

### 4.6 UI

| file | change |
|---|---|
| `src/models/OpalR.d.ts` | regenerated DTO types |
| `src/stores/r-quota.ts` | `getUsage` / `getCurrentUsage` return `RQuotaUsageDto[]` |
| `src/components/admin/r/AddRQuotaDialog.vue` | a **Metric** select above the period; the limit label and hint follow it; `limitMinutes` maps to `limitMillis` |
| `src/components/admin/r/RQuotas.vue` | a **Metric** column; row key becomes `subjectType:principal:metric`; the "Used" column reads the usage entry of the row's metric |
| `src/components/admin/profiles/RQuotaUsage.vue` | render one block per usage entry that has a quota; the "set a personal quota" shortcut carries its block's metric; the blocked message branches on metric and `openSessionsCount` |
| `src/components/admin/profiles/RActivity.vue` | a session-time column, from the summary's new field |
| `src/i18n/en/index.js`, `src/i18n/fr/index.js` | `r_quota.metric`, `metric_execution_time`, `metric_session_time`, their hints, `usage_used` reworded to name the metric, `usage_blocked_sessions`, and `limit_minutes_hint` split per metric |

`ProfilePage.vue`, `AdminProfilePage.vue` and `AdminDatashieldPage.vue` need no change: they mount the
components above, and it is the components that grow a second block or a second column.

## 5. Sequencing

Phases 0 to 2 are shipped (`f1cf501a8`, `b1f78079c`, `5f817e265`) and are recorded here as they were
built, for the execution-time metric only. Phase 3 is the work this revision describes; each phase ends
at a state that is coherent on its own and could ship.

### Phase 0 — let users see their own activity — **done**

`GET /service/r/activity/_current/_summary` and `/service/r/activity/_current` with
`@NoAuthorization`, and `profile-activity.ts` pointed at them for the self case. Fixed a bug that
existed before this feature: a plain DataSHIELD user could not read their own R activity.

### Phase 1 — model, service, administration — **done**

`RQuota`, `RQuotaRepository`, the `2-r-quotas` changeset (table + composite index),
`sumExecutionTimeMillis`, `RQuotaService` resolution and usage, the admin REST endpoints, the DTOs, and
the Quotas section on the DataSHIELD page with its "Used" column.

### Phase 2 — enforcement and the user-facing display — **done**

`checkQuota()` and the DataSHIELD override, `DataShieldLog.Action.QUOTA`, `RQuotaUsage.vue` on both
profile pages.

### Phase 3 — the session-time metric *(this revision)* — **done**

Ordered so that the measurement is trustworthy before anything is enforced on it:

1. **Record what is being measured.** `session_time_millis` on `RActivity` and in the amended
   changeset; `RActivityService` maintaining it on all three events; the started event moved to session
   creation with the idempotence guard (§4.1.2). Nothing reads it yet.
   *Tests:* an activity record exists for a session that never runs a command; a session that runs one
   still has exactly one record and keeps its execution time whichever post arrives first; session time
   equals `updated − created` after each event.
2. **Model and service.** `RQuota.Metric`, the renamed `limit_millis`, the four-column key,
   the metric-aware repository lookup and upsert, `sumSessionTimeMillis`, the live tail, `getUsages`.
   *Tests:* resolution precedence per metric, including a user resolving different subject levels for
   the two metrics; the live tail added for an open session and not for a closed one; the window
   boundary of §3.2.1 on both metrics; the config-persistence test in
   `ConfigEntityRoundTripTest`, which extends `AbstractConfigPersistenceTest` and therefore builds the
   persistence unit with `hbm2ddl.auto=validate` over a database Liquibase has just created — proving
   the amended changeset matches the entity, and that one subject can hold a quota of each metric.
3. **API and administration UI.** The DTO changes, the list-returning usage endpoints, the Metric
   column and the Metric select.
   **Demoable:** an administrator gives a group a session-time quota and watches a user's session time
   climb while that user does nothing.
4. **Enforcement and the user-facing display.** `checkQuota()` over both metrics, the per-metric
   messages, `RQuotaUsage.vue` rendering a block per metric, the activity table's session-time column.
   *Tests:* a user over a session-time quota is refused with 403 and a message naming that metric and
   their open sessions; a user over one metric but not the other is refused; an open session is
   unaffected; `_test` is unaffected; no quota configured means no enforcement.
   **Demoable:** the whole feature as specified in §1.2.

### Phase 4 — documentation and rollout notes — **done**

In `opal-doc`: a **Quotas** section in `web-user-guide/administration/datashield.rst` for the custodian
— both metrics and which worry each one answers, the rolling window, the resolution order, disabled
versus zero, the operations, and the audit trail — and, in `web-user-guide/my-profile.rst`, what the
user sees and what to do about it, which for session time is to close the sessions they are not using
rather than to wait.

The two upgrade notes belong to the release notes rather than to the user guide, since neither is
true of a server for longer than a week: session time reads zero for activity recorded before the
upgrade, and sessions that run nothing now appear in the activity log.

## 6. Risks and known limits

| # | Risk | Assessment |
|---|---|---|
| 1 | **An open session bypasses the quota** (§3.4.3) | Accepted for v1, by the enforcement decision, and it means different things per metric: an execution-time overrun stops growing on its own, a session-time overrun does not. Escalation if needed: (a) call `checkQuota()` from the DataSHIELD command paths (`DataShieldSessionResourceImpl.aggregate`, `DataShieldSymbolResourceImpl.putRestrictedRScript` and friends) — bounds an execution-time overrun to one command, and does nothing for session time, since the offending session is the one not running commands; (b) have `OpalRSessionManager.checkRSessions`, the existing 60-second sweeper (`:277-279`), close the sessions of users over a session-time quota — which is the natural remedy for that metric and does for the quota what the idle timeout already does for time. (b) is now the more valuable of the two; neither is foreclosed. |
| 2 | **A single command can blow far past an execution-time quota** | Inherent to a time-based quota with no mid-command control: a `ds.glm` that runs for an hour is billed for an hour after the fact. Rolling windows soften it — the overrun ages out. Not fixable without killing running commands. |
| 3 | **A session-time quota is a proxy for memory, not a measure of it** | Two sessions holding the same wall-clock time can differ by an order of magnitude in resident memory, and the quota cannot tell them apart. It is still the right proxy available in Opal: it bounds *how many R servers a user keeps alive and for how long*, which is the part of memory pressure a per-user rule can honestly own. The rest belongs to the per-session containers of §1.1. |
| 4 | **The over-count of straddling sessions** (§3.2.1) | Bounded by the 240-minute session timeout, under 2.5% of a 7-day window, always in the stricter direction, and the same bound for both metrics. It would become worth fixing if the window shrank or sessions could live for days; the fix is then a bucketed usage table (hourly deltas written from `RServerSessionUpdatedEvent`), not a change to the quota model. |
| 5 | **The live tail is per-Opal-node and read-time** (§3.2.2) | Correct for a single Opal, which is what exists. Two consequences to remember: a session-time usage read twice a minute apart legitimately differs, and if Opal is ever clustered the live term is the part that has to move to shared state. |
| 6 | **Session time reads zero for pre-upgrade activity** (§4.1.2) | Deliberate: no backfill, and the error clears within one window length. Visible to a custodian who enables a session-time quota on upgrade day and sees the first week's usage climb from nothing. Release-note material, not a design problem. |
| 7 | **`r_session_activities` grows without bound** and is never purged | Pre-existing (the repository's own javadoc calls it out), and marginally worse now that sessions which run nothing leave a row. The quota queries are index-bounded by `updated`, so they do not degrade with history, but the table does. A retention policy deserves its own issue. |
| 8 | **The DataSHIELD client may not surface the 403 message** | Open question (§7). If DSOpal swallows the body, a user sees only "forbidden" and the message is invisible — which matters more now, since "close your open sessions" is advice the user needs and cannot infer. Mitigated by the DataSHIELD user log and by the profile page showing the numbers. |
| 9 | **A user removed from a generous group is cut off at once** | By design — resolution is evaluated at each session creation, not cached. Worth a line in the documentation. |
| 10 | **Upgrade** | Nothing to migrate: no quota exists on any released server, resolution rule 4 makes that "unlimited", behaviour is unchanged until an administrator configures something. Within the branch, the amended `2-r-quotas` changeset means developers who ran the earlier version must re-initialise their config database (§4.1.1). |

## 7. Open questions

1. **Does DSOpal / DSI surface the 403 response body to the R user?** Determines whether the messages
   of §3.4.1 are worth their precision, or whether the audit log and the profile page are the only real
   channels. Needs a check against the DSOpal client, not this repository.
2. **Should the sweeper close sessions of users over a session-time quota?** Risk 1(b). It is the one
   escalation the new metric makes genuinely tempting, because the resource being protected is still
   being consumed while nothing happens. Left out of v1 to keep "an open session is never interrupted"
   true without exception, which is a promise worth one release.
3. **Per-profile quotas.** The issue says "personal, group-based and profile-based". Adding it means a
   nullable `profile` column, a further resolution level, and a UI field. Left out until there is a
   concrete request, since a per-profile quota only makes sense when profiles map to R servers of
   different cost — which is, admittedly, exactly the situation where session time is the metric one
   would want to price differently.
4. **Should other contexts get quotas in the same release?** The model supports it for free; only the
   `checkQuota()` override and the admin UI's context selector are missing. Plain R sessions are
   administrator-facing today, which is why they were left out.
5. **Where does the administration UI belong long-term?** The DataSHIELD page is right while the
   feature is DataSHIELD-only; the moment a second context is enabled, it should move to the R
   administration page or to Users & Groups.
6. **Should a user be warned before hitting a limit?** A banner at, say, 90% costs little and would
   remove most of the surprise. Not in v1 scope, but `RQuotaUsageDto` already carries everything the UI
   would need.
