## 1. Submit Readiness

- [x] 1.1 Add focused ChatInputBox regression coverage proving plain text input enables the send button.
- [x] 1.2 Preserve existing ChatInputBox props and submission API.

## 2. Homepage Primary Button Theme

- [x] 2.1 Route shared composer submit button background/shadow through CSS custom properties.
- [x] 2.2 Override homepage composer submit button variables to canonical blue primary values.
- [x] 2.3 Keep explicit light and system-light theme selectors using the same primary button variables.

## 3. Validation

- [x] 3.1 Add focused HomeChat CSS regression coverage for the homepage submit button theme contract.
- [x] 3.2 Run focused Vitest coverage for touched frontend tests.
- [x] 3.3 Run `openspec validate fix-home-composer-submit-button-state-and-theme --strict --no-interactive`.
