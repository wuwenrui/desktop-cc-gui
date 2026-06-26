## 1. Implementation

- [x] 1.1 Remove `HomeChat` recent conversations rendering.
- [x] 1.2 Remove homepage recent conversation CSS selectors.
- [x] 1.3 Remove newly added homepage recent conversation i18n strings.
- [x] 1.4 Keep parent props contract stable so this page-only removal does not cascade upstream.

## 2. Verification

- [x] 2.1 Update focused `HomeChat` tests to assert recent data is not rendered on the home page.
- [x] 2.2 Run `npx vitest run src/features/home/components/HomeChat.test.tsx`.
- [x] 2.3 Run `npm run typecheck`.
- [x] 2.4 Run `npm run check:large-files`.
