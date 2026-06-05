## 1. Implementation

- [x] Add weighted timeline virtualization trigger for image-heavy and long-content rows.
- [x] Refactor message image lightbox handling so deferred full image resources are transient and released on close/unmount.
- [x] Preserve existing image preview, original image access, message actions, send/retry payload semantics.

## 2. Tests

- [x] Add/adjust focused tests for weighted virtualization.
- [x] Add/adjust focused tests for deferred image hydrate and cleanup.
- [x] Keep existing rich-content image behavior covered.

## 3. Verification

- [x] Run focused Vitest tests for touched message components.
- [x] Run `npm run typecheck`.
- [ ] On Windows, manually verify image-heavy conversation no longer grows WebView2 memory unbounded.
  - Not executed in this closure pass: no Windows/WebView2 environment is available. The change is archived with this manual platform caveat after focused message tests, typecheck, and strict OpenSpec validation passed.
