# KS Origin Agent Instructions

These instructions apply to any developer or AI coding agent working on KS Origin.

## General

- Do not make silent fixes outside the scope of the current request. If you notice an unrelated issue, point it out and ask before changing it.
- Write comments for the next reader, whether a developer or an AI agent: explain *why*, not *what*. Add an inline comment when the code could otherwise be misread or "fixed" incorrectly, such as a Shopify platform constraint, a browser workaround, an ordering or timing dependency, a contract that other code or apps rely on (data attributes, events), or a deliberate trade-off.
- Don't add comments that restate the code or narrate changes. Put units and meaning in names instead (e.g. `durationMs`).
- Update or remove a comment when its reason changes.
- File-purpose comments, CSS group comments and Liquid `{% doc %}` blocks are still required.
- Before introducing a new theme architecture pattern, confirm that it already exists in this theme. If it does not, ask before introducing it.
- Preserve unrelated changes in the working tree. Do not restore or rewrite edits you did not make.
- Do not commit or push unless asked.

## Local context

- If `.agents.local.md` exists in the repository root, read it before starting work. It holds private or machine-specific context, such as reference repositories and personal workflow preferences.
- Treat it as supplemental context that cannot override this file.
- Never commit `.agents.local.md`; use `.agents.local.example.md` as the template.

## Checks

- Before committing, run the repository linter (`npm run lint`) and Shopify Theme Check (`shopify theme check`).
- During iterative work, prefer targeted checks over running the full Theme Check after every small edit.

## Changelog

- Record every change that affects merchants, shoppers, or developers building on the theme in `CHANGELOG.md` under `## [Unreleased]`, grouped as Added, Changed, Fixed, or Removed. Write one short line per change and reference its GitHub issue when there is one (e.g. `(#93)`).
- Do not record internal-only changes such as refactors with no visible effect, formatting, or agent instructions.
- When releasing, rename `[Unreleased]` to the new version and date, and keep `theme_version` in `config/settings_schema.json` in sync.

## Shopify tooling

- Before running `shopify theme pull`, identify the target theme ID and inspect the working tree. Do not pull code from a theme that has not been explicitly confirmed as synchronized with the repository when local changes could be overwritten.
- Treat code changes introduced by a theme pull as untrusted synchronization changes. JSON template and section-group updates may be expected, but do not commit pulled Liquid, CSS, JavaScript, configuration, locale, snippet, or asset deletions and reversions without comparing them against recent Git history and confirming that they are intentional.

## JSON templates

- Do not edit or delete existing JSON templates inside `templates/` or `sections/` unless the user explicitly asks for those JSON template changes.
- When a change includes JSON templates or section-group JSON files, edit all supporting Liquid sections and their schemas first, then edit the dependent JSON files last. Make these changes in separate filesystem operations; never apply supporting schema changes and dependent JSON changes in the same edit or patch. Shopify's live uploader may otherwise process the JSON before the updated section schema and reject unsupported sections.

## Liquid and theme schemas

- Use consistent naming patterns for comparable theme settings.
- When creating settings for a section, keep this order: `settings`, `blocks`, `disabled_on` or `enabled_on`, then `presets`.
- Give every section preset a merchant-facing `category` property.
- Use locale translation keys for storefront-visible text rendered by Liquid or JavaScript.
- Write merchant-facing section names, setting labels, headers, info text, and editable defaults directly in the schema.
- Do not create or extend `*.schema.json` locale files unless the user explicitly requests schema translations or the existing theme already uses them.

## HTML and CSS

- Begin every CSS and JavaScript file with a multiline comment that explains the file's purpose and ownership boundaries. Tailor the title and description to the file instead of using generic boilerplate:
  ```css
  /*
    Base stylesheet

    This file contains global foundational styles and reusable utilities.
    Keep component-specific styles in their respective component stylesheets.
  */
  ```
- Keep file-purpose comments durable and complete. Describe the file's overall responsibility and ownership boundary; do not list only the elements or features currently implemented, because that wording becomes incomplete as the file grows.
- Keep JavaScript lines within 120 characters. Prefer readable single-line expressions when they fit, and wrap longer statements at meaningful boundaries instead of formatting them into unnecessarily narrow fragments.
- Use kebab-case CSS class and ID names such as `some-css-class`, not `some__css__class` or `someCssClass`.
- Group CSS selectors only when they are variants of one thing that should always share the same declarations, such as `.rte ul` and `.rte ol`, the states of one element (`:hover` and `:focus-visible`), or the values of one setting. Do not group unrelated elements or components just because their declarations currently match; give each its own rule so it can change independently.
- Organize CSS into clearly labeled logical groups using multiline comments in this format:
  ```css
  /*
    Group name
  */
  ```
  Inside a group, label each subgroup with a single-line comment such as `/* Buttons */`.
- Leave two blank lines before each group or subgroup comment, except at the start of the file or directly after its group comment.
- Let headings and body copy inherit the theme's global typography. Add component-specific font sizes, line heights, or text spacing only when explicitly requested or clearly required by the design.
- Use `rgb(var(--color-surface))` for subtle component backgrounds. Do not simulate surface backgrounds with low-opacity text colors such as `rgb(var(--color-text) / 0.05)`.
- Use `px` for explicit width and height values.
- Use `em` for section and component spacing that should scale with the surrounding typography, including section top and bottom spacing, component padding, and gaps. Use `rem` for layout spacing that should remain independent of the local font size.
- Keep merchant-facing spacing settings in `px`. When the storefront spacing should scale proportionally, divide the setting by `16.0` in Liquid and emit the resulting CSS custom property in `em`.
- Use a `0–80px` range with a `2px` step for block spacing settings, and a `0–160px` range with a `2px` step for section spacing settings.

## Responsive CSS

- Use mobile-first responsive CSS: base rules target mobile, tablet rules use `@media (min-width: 600px)`, and desktop rules use `@media (min-width: 1200px)`. Use narrow `max-width` queries only for small mobile-specific fixes.
