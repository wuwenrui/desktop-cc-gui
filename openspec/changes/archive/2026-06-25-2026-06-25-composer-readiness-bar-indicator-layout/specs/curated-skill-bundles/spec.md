# curated-skill-bundles Spec Delta

## ADDED Requirements

### Requirement: Composer Shows A Read-Only Always-On Indicator In The Readiness Bar

The desktop client MUST render a read-only **always-on indicator** in the
composer readiness bar whenever at least one curated skill is enabled. The
indicator MUST be supplied by `ChatInputBox` through the generic
`ChatInputBoxHeader.rightAccessory -> ComposerReadinessBar.rightAccessory`
prop chain and MUST render inside `.composer-readiness-right-accessory`.
`ComposerReadinessBar` MUST NOT directly import the curated-skills domain.

The indicator MUST be hidden (zero visual weight) when zero curated skills are
enabled. For each enabled skill, the indicator MUST show the skill's lucide
icon and display name in a single-line chip. Long names MUST truncate instead
of wrapping, and additional enabled skills MAY collapse into a compact `+N`
overflow chip. The indicator MUST reflect the live
`AppSettings.enabledCuratedSkillIds` set within a polling cadence of 2 seconds
so toggling a skill on or off in Settings is visible to the user in the
composer without an app restart. The indicator MUST NOT provide an on/off
affordance; Settings > Skills > Curated remains the only toggle surface.

The `.composer-readiness-right-accessory` and `.curated-indicator*` CSS MUST
ship in the ChatInputBox style bundle so cold composer startup uses the same
single-line layout as the post-Settings return path.

#### Scenario: indicator hidden when no skills are enabled

- **GIVEN** `AppSettings.enabledCuratedSkillIds` is empty
- **WHEN** the user opens the composer
- **THEN** the composer MUST NOT contain any element matching
  `.curated-indicator`.

#### Scenario: indicator visible in readiness bar accessory

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **WHEN** the user opens the composer
- **THEN** a `[data-testid="curated-indicator"]` element MUST be rendered
- **AND** the element MUST be a descendant of
  `.composer-readiness-right-accessory`
- **AND** the element MUST NOT be rendered in a
  `home-chat-curated-skill-strip` input/footer strip.

#### Scenario: indicator chip stays single-line on cold start

- **GIVEN** the user has not opened Settings in the current renderer session
- **AND** `AppSettings.enabledCuratedSkillIds` contains `lazy-senior-dev`
- **WHEN** the composer first renders the indicator
- **THEN** the chip MUST show the lucide icon and display name on one line
- **AND** long display names MUST truncate with ellipsis instead of wrapping.

#### Scenario: Settings toggle change is reflected within 2 seconds

- **GIVEN** the composer is open and the indicator is visible
- **WHEN** the user toggles a new curated skill on in `Settings > Skills`
- **THEN** within 2 seconds the indicator MUST add a chip for the newly enabled
  skill
- **AND** within 2 seconds of toggling it off, the indicator MUST remove the
  chip.

#### Scenario: readiness bar core controls remain usable

- **GIVEN** one or more curated skills are enabled
- **WHEN** the readiness bar renders the right accessory
- **THEN** mode, target, context summary, jump-to-request, and context-source
  expand controls MUST remain visible or gracefully truncated according to the
  existing readiness bar responsive rules
- **AND** the indicator MUST truncate itself before overlapping those controls.
