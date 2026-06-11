# Split AppShell runtime boundaries

OpenSpec change: `split-app-shell-runtime-boundaries`

## Goal

Make AppShell and thread runtime safer to evolve after the client workflow runtime P0:

- AppShell action families are explicit: runtime, task/run, navigation, context.
- Thread lifecycle helpers are separated from message runtime helpers.
- Core shell typing work starts from `renderAppShell` compatibility typing before deeper section typing.

## Scope

- Frontend only.
- No UX redesign.
- No backend storage or command change.
- Do not touch unrelated local changes.

## Acceptance

- OpenSpec change remains valid.
- New boundaries have focused tests.
- Existing public hook/component facades remain compatible.
- Validation commands are documented in the OpenSpec task list.
