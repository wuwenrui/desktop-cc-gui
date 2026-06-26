# Proposal: fix fast Markdown annotation action

## Summary

Restore the standard "标注给 AI" entry point when Markdown file preview uses the fast sanitized HTML renderer.

## Problem

In v0.5.12, large Markdown files can default to the fast renderer. The rich renderer shows the annotation action through a `.fvp-markdown-annotatable-block` wrapper, but the fast renderer inserted the action button beside sanitized HTML blocks while reusing the rich renderer's CSS visibility contract. Because the required wrapper is absent, the button can exist in the DOM while remaining invisible or unreliably positioned.

## Goals

- Preserve "标注给 AI" as a standard Markdown preview affordance for both rich and fast renderer profiles.
- Keep fast renderer performance behavior for large Markdown documents.
- Keep annotation draft and marker rendering isolated from Markdown recompilation.
- Add a regression test for fast-rendered Markdown annotation action.

## Non-Goals

- Redesign the annotation composer.
- Change line-range semantics for rich Markdown annotation.
- Disable the fast renderer for large Markdown documents.
