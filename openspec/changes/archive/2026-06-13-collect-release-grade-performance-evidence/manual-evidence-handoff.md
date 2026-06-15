# Manual Evidence Handoff

This change does not fake release-grade runtime evidence. It wires the app and scripts so manual Tauri/WebView testing can produce measured evidence.

## Cold-Start Evidence

Runtime marker source:

- `window.__CCGUI_STARTUP_PERF__`
- renderer diagnostic label: `perf.startup.markers`

Manual flow:

1. Launch the app with perf baseline enabled.
2. Open a normal workspace until the shell and input are ready.
3. Export the diagnostics bundle from Settings -> Diagnostics bundle.
4. Generate a startup marker snapshot:

```bash
npm run perf:cold-start:startup-markers -- --input /path/to/diagnostics.json --output .artifacts/startup-markers.json
```

5. Regenerate cold-start baseline:

```bash
npm run perf:cold-start:baseline -- --skip-build --startup-markers .artifacts/startup-markers.json
npm run perf:baseline:aggregate
```

Expected upgrade:

- `S-CS-COLD/firstPaintMs` becomes `measured`
- `S-CS-COLD/firstInteractiveMs` becomes `measured`

## Realtime Runtime Evidence

Runtime diagnostic source:

- renderer diagnostic label: `realtime.turnTrace.summary`
- content safety: ids, timestamps, durations, counters, dimensions only

Manual flow:

1. Enable turn trace in the app session.
2. Run a normal streaming turn in a Tauri/WebView session.
3. Export the diagnostics bundle.
4. Generate realtime runtime evidence:

```bash
npm run perf:realtime:runtime-report -- --input /path/to/diagnostics.json --output docs/perf/realtime-runtime-evidence.json
npm run perf:baseline:aggregate
```

Expected upgrade when measured summaries exist:

- `S-RS-VL/visibleTextLagP95` becomes `measured`
- `S-RS-RA/reducerAmplificationMedian` becomes `measured`
- `S-RS-FD/batchFlushDurationP95` becomes `measured`
- `S-RS-TS/terminalSettlementP95` becomes `measured`

## Readiness Check

```bash
npm run perf:archive-readiness -- --json
npm run perf:archive-readiness -- --release --json
```

Current expected state before manual evidence:

- Archive readiness has no hard failures in normal mode.
- Release mode still blocks on unsupported cold-start timing.
- Realtime runtime metrics remain visible as residual debt until measured diagnostics are provided.
