## Why

The homepage composer send button had two user-visible drifts:

- Plain text entry could leave the submit button visually or functionally behind the editable content state.
- Homepage theme overrides could make the primary send action read as a neutral dark/light control instead of the canonical blue primary action.

This is small UI debt, but it sits on a high-frequency path: the first message a user sends from Workspace Home.

## 目标与边界

- Keep the composer submit button enabled as soon as plain text input is present.
- Keep the homepage composer submit button visually primary across dark, explicit light, and system-light themes.
- Preserve existing ChatInputBox API and send behavior.
- Avoid new dependencies.

## 非目标

- Do not redesign Composer.
- Do not change message submission payloads.
- Do not alter engine/model/mode readiness semantics.
- Do not rewrite homepage layout.

## What Changes

- Add focused ChatInputBox regression coverage for plain-text input enabling the send button.
- Move submit button blue/background/shadow styling behind CSS custom properties so homepage overrides can preserve the canonical primary style.
- Add homepage style regression coverage that asserts the composer submit button stays blue across theme-specific overrides.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `composer-send-readiness-ux`: Plain text input MUST immediately update the submit button readiness state.
- `workspace-home-shadcn-ux`: Homepage composer primary submit action MUST keep primary blue affordance across supported theme selectors.

## Impact

- Frontend:
  - `src/features/composer/components/ChatInputBox/ChatInputBox.submit-button.test.tsx`
  - `src/features/composer/components/ChatInputBox/styles/buttons.css`
  - `src/features/home/components/HomeChat.styles.test.ts`
  - `src/styles/home-chat.css`
- Backend:
  - None.
- Dependencies:
  - No new dependency.

## 验收标准

- Entering plain text into `ChatInputBox` MUST enable the send button immediately.
- Homepage composer submit button MUST use the canonical blue primary background in default, explicit light, and system-light theme paths.
- Existing ChatInputBox public props and send submission contract MUST remain unchanged.
- Focused Vitest style/component tests MUST pass.
- `openspec validate fix-home-composer-submit-button-state-and-theme --strict --no-interactive` MUST pass.
