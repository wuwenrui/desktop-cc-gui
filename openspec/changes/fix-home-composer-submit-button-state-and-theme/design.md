## Context

`ChatInputBox` owns the editable input surface and submit button presentation. Workspace Home embeds that composer inside `.home-chat-composer-host`, which applies additional homepage-specific style overrides.

The bug class is not a new send algorithm. It is contract drift between:

- DOM editable input events and button disabled state.
- Shared composer button styling and homepage theme overrides.

## Decisions

### Decision 1: Test readiness at the component boundary

Use a focused jsdom test that renders `ChatInputBox`, writes plain text into `.input-editable`, fires an input event, and asserts the titled send button is enabled.

This verifies the user-facing readiness boundary without duplicating the internals of the composer view model.

### Decision 2: Keep the primary submit color as CSS variables

The shared `.submit-button` defines background, hover background, and shadow through `--composer-submit-button-*` variables. Homepage overrides set those variables to canonical blue values and keep theme selectors referencing the same variables.

This keeps the override narrow and avoids selector-specific color drift.

### Decision 3: Style regression test reads CSS contract directly

The homepage style test parses the generated CSS source and checks the key selector contracts. This is lightweight and fits existing CSS regression tests in `HomeChat.styles.test.ts`.

## Error Handling

- No runtime error surface changes.
- Disabled-state semantics continue to be owned by existing composer readiness logic.

## Testing

- Focused ChatInputBox jsdom test for plain text readiness.
- Focused HomeChat CSS test for submit button theme override contract.
- OpenSpec strict validation for the new change.

## Rollback

Revert the frontend style/test patch. This returns the homepage composer button to the previous theme-specific neutral colors and removes the plain-text readiness regression guard.
