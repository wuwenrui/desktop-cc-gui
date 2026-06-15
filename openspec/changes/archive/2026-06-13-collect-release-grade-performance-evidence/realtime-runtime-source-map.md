# Realtime Runtime Source Map

This map defines the runtime milestone sources for release-grade realtime evidence.

## Content-Safety Contract

Allowed fields:

- workspace id / thread id / turn id / sequence id
- event counts
- elapsed milliseconds
- queue depth
- evidence class
- bounded status labels
- bounded fallback reasons

Forbidden fields:

- prompt text
- assistant body text
- tool output body
- terminal output text
- file content
- raw diff content

## Metrics

| Record | Runtime Source | Start | End | Current State |
|---|---|---|---|---|
| `S-RS-VL/visibleTextLagP95` | renderer visible text milestone | first assistant text ingress | first visible text growth | measured from `docs/perf/realtime-runtime-evidence.json` |
| `S-RS-RA/reducerAmplificationMedian` | reducer action / commit counters | first streaming delta for turn | provider completion for turn | measured from `docs/perf/realtime-runtime-evidence.json` |
| `S-RS-FD/batchFlushDurationP95` | app-server batch route timing | batch flush start | batch flush end / route completion | measured from `docs/perf/realtime-runtime-evidence.json` |
| `S-RS-TS/terminalSettlementP95` | runtime terminal settlement milestone | last reducer commit for turn | terminal/provider settled event | measured from `docs/perf/realtime-runtime-evidence.json` |

## Candidate Instrumentation Points

| Runtime Area | Candidate File | Probe Shape |
|---|---|---|
| App-server event route | `src/features/app/hooks/useAppServerEvents.ts` | batch route start/end timing, event count, workspace id |
| Thread item reducer | `src/features/threads/hooks/useThreadsReducer.ts` / reducer helpers | reducer flush count, action count, turn id |
| Streaming item events | `src/features/threads/hooks/useThreadItemEvents.ts` | first delta ingress, first text delta, provider completion |
| Timeline/row render | `src/features/messages/components/MessagesRows.tsx` or adjacent diagnostics | first visible text growth marker |
| Terminal settlement | terminal/runtime settlement dispatch path | final terminal/provider settled timing |

## Implementation Direction

The runtime evidence should extend the existing turn trace vocabulary rather than creating a second trace identity system. The current replay trace remains useful for regression comparison, but release mode requires runtime-produced records with `evidenceClass: "measured"` or an explicit unsupported/platform qualifier.

The first implementation pass should prefer one bounded runtime summary artifact, for example `docs/perf/realtime-runtime-evidence.json`, then teach `generate-runtime-evidence-report.mjs` to prefer measured runtime fields over replay proxy fields.
