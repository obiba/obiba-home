# DataSHIELD on OpenTelemetry

**Created:** 2026-09-03
**PRs:** [obiba/opal#4194](https://github.com/obiba/opal/pull/4194), [obiba/docker-opal#41](https://github.com/obiba/docker-opal/pull/41)
**Scope:** export the DataSHIELD audit trail over OTLP, plus traces and metrics for the R operations, behind a single environment variable
**Verified against:** `opentelemetry-logback-appender-1.0:2.23.0-alpha` sources, `logstash-logback-encoder:7.4`, logback 1.6.0, a live `otel/opentelemetry-collector-contrib:0.140.0`, and the built distribution
**Constraint:** the `datashield.log` line format is frozen — it is parsed by tooling outside Opal
**Target release:** Opal 6.0.0
**Status:** all six phases implemented on `feat/datashield-opentelemetry`

## 1. Where things stood

PR #4138 (Opal 5.7) added the `opentelemetry-logback-appender-1.0` dependency and an example
`conf/logback.otel.xml`. Checked against the appender's own sources, three things needed saying
before any new work was planned.

### 1.1 The appender has no `endpoint`, `resourceAttributes` or `flushInterval`

`OpenTelemetryAppender` exposes only `captureExperimentalAttributes`, `captureCodeAttributes`,
`captureMarkerAttribute`, `captureKeyValuePairAttributes`, `captureLoggerContext`,
`captureArguments`, `captureLogstashAttributes`, `captureMdcAttributes`, `captureEventName` and
`numLogsCapturedBeforeOtelInstall`. The three elements the example set do not exist. Joran ignored
them with warnings nobody was reading:

```
WARN ... Ignoring unknown property [endpoint] in [...OpenTelemetryAppender]
WARN ... Ignoring unknown property [resourceAttributes] in [...OpenTelemetryAppender]
WARN ... Ignoring unknown property [flushInterval] in [...OpenTelemetryAppender]
```

Three appenders × three phantom elements = nine warnings on every startup.

### 1.2 Nothing ever called `OpenTelemetryAppender.install()`

No Java source in the tree referenced OpenTelemetry, and the distribution shipped
`opentelemetry-api` but no SDK and no OTLP exporter. Until something is installed, the appender
parks records in an `ArrayBlockingQueue` (`numLogsCapturedBeforeOtelInstall`, default 1000) and then
drops them, complaining once to stderr. Copying `logback.otel.xml` over `logback.xml` exported
nothing at all.

### 1.3 A per-appender `service.name` is not a thing

The example set three different service names (`opal-server`, `opal-rest`, `datashield`). Resource
attributes belong to the SDK, not to an appender: one JVM is one service. The right discriminator
is the instrumentation scope, which the appender already sets to the logger name — `datashield.user`,
`datashield.admin`, and so on.

### 1.4 What was already sound

`DataShieldLog.prepare()` (`opal-datashield/.../datashield/DataShieldLog.java:93`) populates
`ds_id`, `ds_profile`, `ds_action` and `username` and merges `DataShieldContext.getContextMap()`;
the R operations add `ds_eval` and `ds_symbol`. Structured attributes already existed — they only
needed forwarding and renaming.

## 2. The constraint that shaped everything

`$OPAL_HOME/logs/datashield.log` is written by a `RollingFileAppender` with a
`net.logstash.logback.encoder.LogstashEncoder`, so every MDC key becomes a JSON field. Deployments
parse that file with external tooling, so **its field names, values and order must not change.**

Nothing inside Opal depends on those names — `SystemLogService` and `SystemLogResource` only tail
and download the file, and the Vue UI does not parse it — but that is not the half of the question
that decides it.

This rules out the obvious approach of renaming the MDC keys at the source. It also rules out the
less obvious one: `LogstashEncoder.addMdcKeyFieldName("datashield.action=ds_action")` genuinely
exists and would map renamed keys back to the original JSON field names, but it makes the file's
stability depend on a hand-maintained remap list where one omission silently changes the output, it
touches the four resource classes that set MDC directly, and because logback's MDC map is a
`HashMap` the JSON field *order* shifts even when every name is remapped back.

## 3. Plan

### 3.1 Phase 1 — make log export work

**Dependencies.** Import `opentelemetry-bom` at 1.57.0 (the version the alpha appender already
resolved to) in the root POM; add `opentelemetry-sdk` and `opentelemetry-sdk-extension-autoconfigure`
at compile scope and `opentelemetry-exporter-otlp` at runtime scope in `opal-server`.

**The OTLP sender.** The default sender is okhttp, which drags `okhttp-jvm` and `kotlin-stdlib`
(~2.5 MB, neither previously in the distribution) into every install for a feature that is off by
default. `opentelemetry-exporter-sender-jdk` uses `java.net.http` and adds nothing. It ships only
`JdkHttpSender` — no gRPC — hence the `http/protobuf` default below, and **port 4318 rather than the
gRPC 4317**.

**Bootstrap.** `OpalServer#configureOpenTelemetry`, called from the constructor before `start()`,
because the appender's replay buffer is small and Spring startup is chatty. Only in the serving JVM,
not the throwaway `--upgrade` one.

```java
private void configureOpenTelemetry() {
  if (!hasOtlpEndpoint(System::getenv)) {
    System.setProperty("otel.sdk.disabled", "true");
    // not merely quiet - inert. Without this the appenders fill their replay
    // buffer and complain to stderr on installs that never asked for telemetry.
    OpenTelemetryAppender.install(OpenTelemetry.noop());
    return;
  }
  OpenTelemetrySdk sdk = AutoConfiguredOpenTelemetrySdk.builder()
      .addPropertiesSupplier(() -> Map.of(
          "otel.service.name", "opal",              // OTEL_SERVICE_NAME still wins
          "otel.exporter.otlp.protocol", "http/protobuf",
          "otel.logs.exporter", "otlp",
          "otel.traces.exporter", "otlp",
          "otel.metrics.exporter", "otlp"))
      .setResultAsGlobal()
      .build()
      .getOpenTelemetrySdk();
  OpenTelemetryAppender.install(sdk);
  this.openTelemetrySdk = sdk;   // closed by shutdown(), after Jetty
  logAndSystemOut("OpenTelemetry export enabled.");
}
```

**Opt-in, and why.** An autoconfigured SDK defaults to OTLP on `localhost:4317`. Building one
unconditionally would make every existing installation log connection failures on upgrade. The gate
accepts every spelling of the endpoint — `OTEL_EXPORTER_OTLP_ENDPOINT` and the three signal-specific
`OTEL_EXPORTER_OTLP_{LOGS,TRACES,METRICS}_ENDPOINT`, as environment variables and as the matching
system properties. The signal-specific ones matter: each is valid OpenTelemetry configuration on its
own, and a guard that only looked at the global variable would silently refuse to start the SDK for
it. That defect was in the first cut and was caught by writing the documentation, not by any test —
which is why `hasOtlpEndpoint` takes the environment as a `UnaryOperator` and has its own unit test.
The first fix only added the logs endpoint; review caught that traces and metrics deserve the same.

**Shutdown order.** The first cut closed the SDK from a shutdown hook of its own. Hooks run
concurrently, so it raced the hook that stops Jetty — and stopping Jetty is what closes the Spring
context, whose `@PreDestroy` is what ends the open session spans (§3.4). Spans ended on a closed
processor are dropped, so a restart could lose exactly the traces it was meant to flush. The SDK is
now a field on `OpalServer` and is closed at the end of `shutdown()`, after Jetty. The `--upgrade`
JVM installs the no-op too: it loads the same `logback.xml`, and without an install its appenders
buffer the migration log and complain to stderr when the buffer fills.

Telemetry is never a reason to prevent Opal from starting: the SDK build is wrapped, and a failure
falls back to the no-op install.

### 3.2 Phase 2 — name the attributes properly, without touching the file

| MDC key (unchanged) | Exported as | Set by |
| --- | --- | --- |
| `ds_id` | `datashield.session.id` | `DataShieldLog.prepare` |
| `ds_profile` | `datashield.profile` | `DataShieldLog`, resources |
| `ds_action` | `datashield.action` | `DataShieldLog.prepare` |
| `ds_symbol` | `datashield.symbol` | symbol resource, assign op |
| `ds_eval` | `datashield.script` | `Restricted*ROperation` |
| `ds_script_in` | `datashield.script.submitted` | `AbstractRestrictedRScriptROperation` |
| `ds_script_out` | `datashield.script.generated` | `AbstractRestrictedRScriptROperation` |
| `ds_map` | `datashield.script.mapping` | `AbstractRestrictedRScriptROperation` |
| `ds_table` | `datashield.table` | symbol resource, assign from a table |
| `ds_resource` | `datashield.resource` | symbol resource, assign from a resource |
| `ds_expr` | `datashield.expression` | symbol resource, assign from a string |
| `r_duration` | `datashield.r.duration` | `RockSession`, around every R server call |
| `r_size` | `datashield.r.size` | `RockSession`, around every R server call |
| `username` | `enduser.id` | `DataShieldLog.prepare` |
| `ip` | `client.address` | preserved by `DataShieldLog.init()` |

`ds_script_in`, `ds_script_out` and `ds_map` appear only on `PARSE` records — they are set while the
submitted expression is parsed and `DataShieldLog.init()` clears them immediately after — which is
why they were missed on the first pass and only turned up during phase 4. `ds_table`, `r_duration`
and `r_size` were missed the same way, and `ds_resource` and `ds_expr` after that: each is set on
one code path only. The export test now asserts the whole exported key set of the widest record
rather than a list of forbidden names, so a new MDC key fails the build until it has been named.

**Mechanism.** The OTel appender reads MDC through exactly one call,
`ILoggingEvent#getMDCPropertyMap()`, on both the direct path (`LoggingEventMapper`) and the
pre-install replay path (`LoggingEventToReplay`). So a decorating appender that forwards a proxy
event with a rewritten map gets the renames, and the file appender sits upstream of it and never
sees them.

- `org.obiba.opal.core.logging.MdcRenamingAppender` — extends `UnsynchronizedAppenderBase` and
  implements `AppenderAttachable`; supports `<rename>from=to</rename>`, `<drop>key</drop>` and
  `<truncate>key=512</truncate>`.
- `RewrittenMdcEvent` — delegates all twenty `ILoggingEvent` methods to the original, overriding only
  `getMDCPropertyMap()` (and the deprecated `getMdc()`). Nothing is mutated in place.

`<appender-ref>` nested inside an `<appender>` is the same Joran rule `AsyncAppender` relies on, so
no custom Joran actions are needed. Implementing `AppenderAttachable` also matters for a second
reason: `OpenTelemetryAppender.install()` recurses through `AppenderAttachable` to find nested
appenders, so the SDK reaches `otelraw` through the renamer without any special handling.

**`ds_eval` is exported in full.** Disclosure attempts show up in the submitted R expression, so it
is the substance of the DataSHIELD security audit trail, not an optional extra. The consequence to
design around is that the collector becomes a processor of sensitive content and that this stream —
unlike the log file — leaves the host. `<truncate>ds_eval=512</truncate>` caps the value if payload
size ever becomes a problem, at the cost of truncating audit evidence. The cap is a hard one: a
truncated value is exactly `max` characters long, ellipsis included — the first cut appended the
ellipsis after the cut and so exported 515 characters for a limit of 512.

### 3.3 Phase 3 — tests

- **Config validation** (`LogbackConfigurationTest`): run `JoranConfigurator` over the shipped
  `logback.xml` and assert the `StatusManager` holds no `WARN` or `ERROR`. Against the 5.7 file it
  fails, naming all three phantom elements. This is the test that would have caught §1.1 at build
  time.
- **Golden output** (`DatashieldLogFormatTest`): drive a representative DataSHIELD event through the
  shipped config and assert the `datashield.log` line matches a checked-in fixture — field names in
  order, then values, with `@timestamp` and `thread_name` excluded from the value comparison but
  still checked in position. Field order proved reproducible across separate processes, so it is
  asserted rather than assumed. This is the regression guard for §2.
- **Exported attributes** (`DatashieldOtelExportTest`): `InMemoryLogRecordExporter`, assert the scope
  name is `datashield.user`, the mapped attribute names are present, the script is exported whole,
  and no raw `ds_*` key leaks.
- **The renamer** (`MdcRenamingAppenderTest`, 9 cases): rename, drop, truncate, unmapped keys pass
  through, the original event is not modified, everything else is delegated, malformed config is
  reported as an ERROR status.
- **The gate** (`OpalServerTest`, 6 cases): all four endpoint spellings, plus empty-value handling.
- **Smoke stack** (`opal-server/src/test/resources/otel/`): a collector with a debug exporter and a
  README, for looking at the real thing.

**Classpath defect found here.** `obiba-password-hasher:cli` is a shaded jar that bundles
`slf4j-nop`; at compile scope it sits on Maven's test classpath and wins the `ServiceLoader` race, so
any opal-server test that logs bound to `NOPLoggerFactory`. Maven exclusions cannot strip a class from
inside a shaded jar. Production was never affected — the assembly routes that jar to
`tools/hasher/lib` and keeps it out of `lib` — so it is excluded from the test classpath with
surefire's `classpathDependencyExcludes`. Every opal-server test now logs through logback, so a
`logback-test.xml` came with it.

### 3.4 Phase 4 — traces

Spans on scope `org.obiba.opal.datashield`: `datashield.session`, and under it
`datashield.open`, `.assign`, `.parse`, `.aggregate`, `.close`, `.ws_save`, `.ws_restore`. Failures
set status `ERROR` and record the exception. Attributes are the phase-2 names.

**The trace is the session, not the request.** The first implementation had `DataShieldContext`
capture `Context.current()` in its constructor, on the request thread, for the same reason it
captures `MDC.getCopyOfContextMap()` — `RServerSession#executeAsync` queues the operation onto the
session's consumer thread (`AbstractRServerSession.java:233`), where the request's trace context is
gone.

That was wrong, and testing it against a live Tempo is what showed it. Opal runs no HTTP server
instrumentation, so `Context.current()` on the request thread is `Context.root()`: every operation
became its own root span, and one DataSHIELD session came out as five unrelated single-span traces,
each saying no more than the log line it came from. A Java agent would not have fixed it either — it
would have produced one trace per *HTTP request*, and a session is many requests.

The unit an audit trail is read along is the session: it is what `ds_id` identifies in the log file,
and the only thing that ties a session's operations together across threads and requests. So the
session is what the trace is. `DataShieldSessionTraces` holds one `datashield.session` span open per
session id and hands it out as the parent; `DataShieldContext` looks its parent up by `rid` instead
of taking the ambient context, so the consumer thread stops mattering. The root carries
`datashield.session.id`, `datashield.profile`, `enduser.id` and `client.address` — the four things a
trace list is searched on.

**A span held open has to be closed.** An open span is never exported, so a session ending any way
other than through its CLOSE endpoint would cost the whole trace, not just its root. Sessions do end
that way: `OpalRSessionManager` expires the idle ones, and they go with their R server.
`DataShieldSessionTraceReaper` runs on the same cadence as that reaper and ends the traces of the
sessions the manager no longer holds; `@PreDestroy` ends the rest, so a restart mid-session still
produces its trace — provided the SDK outlives the Spring context, see *Shutdown order* in §3.1.
The operations themselves are exported as they end, so the trace is readable while the session is
still open — which is when a suspect session is most worth watching.

The reaper lists the open traces *before* it asks the manager which sessions are live. The manager
holds a session before its trace is bound, so a trace bound between the two snapshots is not a
candidate and cannot be mistaken for gone. The other order — which the first cut had — would end
the trace of a session opened while the reaper ran, and orphan every operation it went on to run.

**Parsing is traced too**, as its own span on the request thread rather than around the evaluation,
matching the way the audit log records it. It is the span that carries a refusal: a script the
restriction turns down never reaches R, and `datashield.parse` with status `ERROR` and the submitted
expression on it is the thing an auditor opens the trace to find.

**Logs and spans are one view.** `DataShieldLog` writes each record inside the trace of the session
it belongs to, so the exported copy carries that session's `trace_id` and Grafana can go from a span
to its audit lines and back. Nothing of this reaches `datashield.log` — the ids belong to the
exported record, not to the MDC the file encoder writes.

### 3.5 Phase 5 — metrics

| Instrument | Kind | Dimensions |
| --- | --- | --- |
| `datashield.operation.count` | Counter | action, profile, outcome |
| `datashield.operation.duration` | Histogram, seconds | action, profile, outcome |
| `datashield.session.active` | Observable gauge | profile |
| `datashield.quota.rejection` | Counter | quota.metric |

Count and duration are recorded inside the phase-4 wrapper, timed around the same interval the span
covers, so traces and metrics cannot disagree about how long an operation took.

**The session count is observed, not maintained.** A session does not only end when a user closes it —
it is evicted on timeout, and when its R server goes away. An up-down counter driven from the REST
endpoints would miss those and drift upwards forever. The gauge asks `OpalRSessionManager` at
collection time, filtered on `getExecutionContext()`, and cannot go stale.

**Duration is in seconds** (current OpenTelemetry semantic conventions for duration histograms), and
rejections are dimensioned by `datashield.quota.metric` (`EXECUTION_TIME` / `SESSION_TIME`) rather
than by profile — an `RQuota` is held against a user and a metric, not against a profile.

Seconds need buckets of their own. The SDK's default histogram boundaries — 0, 5, 10, 25 … 10000 —
are laid out for milliseconds; on a histogram in seconds every R operation under five seconds lands
in the first bucket and the histogram says nothing. The instrument carries explicit boundary advice:
the semantic conventions' list for a duration in seconds (5 ms to 10 s), extended with 30, 60 and
300 s because a large assignment can take that long. A test asserts the exported boundaries.

**Cardinality is asserted, not intended.** `datashield.session.id`, `enduser.id`,
`datashield.script` and `datashield.symbol` never become metric attributes; a symbol is named by the
user, so it is as unbounded as the rest. A test fails if any of them appears.

### 3.6 Phase 6 — packaging and configuration

**The second config file had to go.** `logback.otel.xml` was only ever a copy of `logback.xml` with
the appenders added, and enabling log export meant copying it over the first. No packaging did that,
and doing it by hand silently discards whatever the admin had put in their own file. In Docker it is
worse: `start.sh` copies `conf/` into the volume on first run, so the swap has to happen inside a
running container.

So the appenders now live in `logback.xml` and the second file is deleted. They are inert unless
something is installed into them, and phase 1's bootstrap installs `OpenTelemetry.noop()` when no
endpoint is configured. Verified both ways:

```
merged logback.xml, no endpoint, no install:   "numLogsCapturedBeforeOtelInstall ... is too small."
merged logback.xml, no endpoint, noop install: silent - 3000 records, datashield.log written normally
```

| Packaging | Where the variables go | Change needed |
| --- | --- | --- |
| tarball | `$OPAL_HOME/conf/opal-env.sh` | new file, sourced by `bin/opal`, provisioned like any other conf file |
| deb / rpm | `/etc/default/opal` | documentation only — both systemd units already read it |
| Docker | `-e` / compose `environment` | none: `gosu` preserves the environment |

The tarball was the real gap: deb and rpm have had `/etc/default/opal` all along and Docker has
`-e`, but a zip install had nowhere to put settings except a shell wrapper.

**Secrets.** `/etc/default/opal` is mode 644 — the rpm mapping sets it and the deb postinst re-sets
it — so `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer…` there is readable by every local user.
Rather than re-permission a file that has been world-readable for years, both units gain
`EnvironmentFile=-/etc/default/opal-secrets`. systemd reads env files as root *before* dropping to
`User=opal`, so that one can be `600 root:root`: the process gets the token, the service account
cannot read the file.

**Two alternatives tried and rejected.**

- *Have the start scripts swap the config in when an endpoint is set.* Silently bypasses a
  customized `logback.xml`. Guarding it by comparing against the pristine shipped copy is impossible
  on rpm and deb: they map `${dist.location}/conf` to `/etc/opal` only, so there is no
  `$OPAL_DIST/conf` to diff against.
- *Logback conditionals.* `janino` is already a dependency, but `<if>` cannot be nested inside
  `<logger>`, which is exactly where the appender must be attached, and logback 1.6's
  non-deprecated `<condition>` form requires a `class` attribute. The form that parses emits warnings
  the phase-3 config test rightly fails on.

## 4. Sequencing

| # | Phase | Modules touched | Effort | Depends on |
| --- | --- | --- | --- | --- |
| 1 | SDK bootstrap + config fix | pom, opal-server | ~2 d | — |
| 2 | Export-path renaming | opal-core, conf | ~2 d | 1 |
| 3 | Tests, smoke stack, gate test | opal-server, opal-datashield | ~1.5 d | 1, 2 |
| 4 | Traces | opal-datashield, opal-server | ~3–4 d | 1 |
| 5 | Metrics | opal-datashield | ~2 d | 1, 4 |
| 6 | Packaging and configuration | conf, bin, deb, rpm, docker-opal | ~1 d | 1–5 |

Phases 1–3 are one shippable increment and fix a feature that was advertised but inert; 4 and 5 build
on the SDK handle it creates; 6 makes the whole of it reachable from a single environment variable.

## 5. Configuration reference

Setting an OTLP endpoint enables logs, traces and metrics together. With none set, no SDK is built,
nothing is sent, and nothing is printed.

| Variable | |
| --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | the collector, e.g. `https://collector:4318`. Setting it is what enables export |
| `OTEL_SERVICE_NAME` | name reported to the backend, defaults to `opal` |
| `OTEL_RESOURCE_ATTRIBUTES` | extra attributes, e.g. to tell nodes apart in a federated study |
| `OTEL_EXPORTER_OTLP_HEADERS` | e.g. `Authorization=Bearer%20…`; belongs in `/etc/default/opal-secrets` |
| `OTEL_EXPORTER_OTLP_CERTIFICATE` | trusted CA for the collector |
| `OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE`, `..._CLIENT_KEY` | client cert and key, for mTLS |
| `OTEL_METRIC_EXPORT_INTERVAL` | metrics are exported every 60s by default |

Opal prints `OpenTelemetry export enabled.` at startup when the endpoint is picked up.

**Securing the endpoint is not optional.** The DataSHIELD stream carries the submitted R
expressions, the usernames and the client addresses. It is as sensitive as `datashield.log` but,
unlike it, leaves the host. Keep the collector inside the node's trust boundary and use `https://`;
a plaintext endpoint sends R scripts and usernames in the clear and is only defensible on localhost.

To trace the HTTP requests and JDBC calls surrounding the DataSHIELD operations, add the
OpenTelemetry Java agent to `JAVA_OPTS` (tarball) or `JAVA_ARGS` (deb/rpm). Opal needs no change:
the DataSHIELD spans hang under the agent's server spans on their own.

## 6. What does not change

- **The `datashield.log` line format — structurally guaranteed.** No MDC key is renamed at the
  source; every rename happens in an appender downstream of the file appender, and the phase-3
  golden-output test keeps it that way. OTLP is purely additive, and the file remains the local
  forensic record when a collector is unreachable.
- `SystemLogService`, `SystemLogResource` and the `/system/log/datashield.log` permission — the admin
  UI keeps working exactly as now.
- Default behaviour on upgrade: with no OTLP endpoint configured, an existing installation builds no
  SDK, opens no connection, sends nothing and prints nothing.

The one thing that *does* change: `logback.xml` is a conffile and now carries the OTel appenders, so
an admin who edited theirs gets the usual dpkg/rpm prompt. Keeping their own file means pasting the
`otelraw`/`otelds` block — deliberate, over silently bypassing it.

**And the case where that goes wrong is now audible.** `UpgradeCommand.prepareDistConfigFile()`
copies `logback.xml` only when there is none, which is right for a file the installation owns — but
it means an Opal upgraded from before the appenders existed keeps a `logback.xml` that has none, and
exports its traces and its metrics and not one log record. This happened on the first Docker stack it
was tried on, where `OPAL_HOME` was a volume older than the change. `OpalServer` now walks the logger
context after installing the SDK and, when no `OpenTelemetryAppender` is attached anywhere — directly
or nested inside `MdcRenamingAppender` — prints a warning next to "OpenTelemetry export enabled"
saying logs will not be exported and where to get the appenders from.

## 7. Verification

Automated: 44 new tests. opal-core 152, opal-datashield 48, opal-server 44, all passing; the
distribution packages with the SDK, the OTLP exporter and the JDK sender, and without okhttp or
kotlin-stdlib.

Manual, against a live `otel/opentelemetry-collector-contrib:0.140.0` with all three pipelines:

```
pipelines receiving:  logs, traces, metrics
scopes:               datashield.user            (logs)
                      org.obiba.opal.datashield  (spans and instruments)
names seen:           datashield.aggregate, datashield.assign,
                      datashield.operation.count, datashield.operation.duration,
                      datashield.quota.rejection
attributes seen:      datashield.action, .profile, .session.id, .script, .symbol,
                      .outcome, .quota.metric, enduser.id, client.address
```

`opal-server/src/test/resources/otel/` holds the compose file and README to repeat it.

Then against a real DataSHIELD session — open, assign a table, parse, aggregate, submit a script the
restriction refuses, close — on the `grafana/otel-lgtm` stack of `docker-opal`'s `local-dev` branch.
Tempo returns one trace for the session:

```
span                   parent              start_ms    dur_ms  status  script
datashield.session     -- root --               0.0    1525.1  -
datashield.open        datashield.session       0.1     105.6  -
datashield.assign      datashield.session     197.3     368.6  -       x <- opal[CNSIM.CNSIM1]
datashield.parse       datashield.session     647.4       0.2  -       colnamesDS("x")
datashield.aggregate   datashield.session     647.9     732.3  -       dsBase::colnamesDS("x")
datashield.parse       datashield.session    1452.4       0.6  ERROR   system("cat /etc/passwd")
datashield.close       datashield.session    1519.6       5.1  -
```

one span per audit line, in order, and the refused script carrying its own status. Loki returns the
six audit records of the same session, all six on `trace_id 37bfb876…`, the trace above. The keys
written to `datashield.log` over the same run are unchanged, `ds_eval` and all — no `trace_id` or
`span_id` reaches the file.

## 8. Related

- `2026-08-31-datashield-usage-quota.md` — the quota work whose `RQuota.Metric` dimensions the
  rejection counter, and whose `checkQuota()` branch it hooks.
