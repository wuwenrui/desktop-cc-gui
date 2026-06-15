# Bundle Analysis

Collected from current `dist/assets` on 2026-06-13.

## Gate Output

Command:

```bash
npm run check:bundle-chunking
```

Result:

- `app-js`: advisory, `1.08 MiB gzip`, target `927.7 KiB`, hardFail `1.05 MiB`
- `app-css`: pass, `132.2 KiB gzip`
- `total-js-mjs-css`: advisory, `5.63 MiB gzip`, hardFail `5.05 MiB`
- optional vendors remain measured as lazy-required / not-measured eagerness:
  - `vendor-mermaid`
  - `vendor-codemirror`
  - `vendor-docs`

## Largest JavaScript Assets

| File | Raw bytes | Gzip bytes |
|---|---:|---:|
| `App-yjDdYjqh.js` | 4006866 | 1132519 |
| `subset-shared.chunk-CcJQzS8u.js` | 1820851 | 741551 |
| `vendor-mermaid-CHqSzYyz.js` | 2376617 | 672883 |
| `vendor-docs-Cdz9qXJg.js` | 1343425 | 393692 |
| `percentages-BXMCSKIN-BvZNPPCP.js` | 1093527 | 353572 |
| `vendor-codemirror-BFs4KSZV.js` | 872270 | 303797 |
| `fastMarkdown.worker-DXw6_5Ns.js` | 639421 | 192685 |
| `vendor-markdown-BUXHHUYG.js` | 605061 | 181663 |
| `vendor-react-DSgDidLt.js` | 408150 | 133014 |
| `zh-DwVeQKCh.js` | 319020 | 107267 |

## Immediate Conclusion

The release blocker is still startup `App-*.js`, not CSS. Existing optional vendor chunks are already split, so the next remediation step must inspect first-viewport imports inside the app shell and move only non-startup surfaces behind established lazy boundaries.

Do not start broad large-file modularization from this evidence alone.
