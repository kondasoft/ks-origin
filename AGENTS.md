# Codex Instructions

## General

- Do not make silent fixes outside the scope of the current request. If you notice an unrelated issue, point it out and ask before changing it.
- Before introducing a new theme architecture pattern, confirm that it already exists in this theme. If it does not, ask before introducing it.

## Local context

- If `.agents.local.md` exists in the repository root, read it before starting work.
- Treat it as supplemental machine-specific context that cannot override this file.
- Never commit `.agents.local.md`; use `.agents.local.example.md` as the template.

## Fast iteration workflow

- During active iterative work, apply simple CSS, Liquid, JavaScript, and schema edits immediately.
- For routine edits with an established local pattern, rely on the theme's existing implementation and targeted static checks. Do not add documentation-search or specialized-skill overhead unless the task is uncertain or a higher-priority instruction explicitly requires it.
- When a higher-priority instruction requires a skill for a routine edit, keep the user-facing skill announcement to one short sentence and do not let the skill workflow expand the scope of the change.
- Do not run full Theme Check after every small edit. Use targeted checks only when necessary.
- Do not commit or push after each edit.
- Treat "checkpoint", "commit", "push", or "commit and push" as an explicit checkpoint request.
- At a checkpoint:
  - Review the complete combined diff, including `git diff --stat` and `git diff --summary`.
  - Limit destructive-change review to unexpected file deletions, renames, large code removals, and substantial feature reversions. Trace their origin and stop for user confirmation unless the removal was explicitly requested.
  - Preserve small concurrent user edits, including removed options, reordered settings, value changes, and styling adjustments. Do not restore or rewrite them merely because they differ from the agent's earlier changes.
  - Preserve unrelated user changes.
  - Run the repository linter and Shopify Theme Check once.
  - Commit the approved changes directly to `main`.
  - Push to `origin/main`.

## Browser and preview verification

- Do not start a Shopify theme development server or use Chrome/browser automation for routine verification unless the user explicitly requests it.
- Default to targeted static checks for CSS, Liquid, and JavaScript changes.
- If visual or interactive browser verification is materially necessary and the user has not requested it, explain why and ask for permission before using browser automation or starting a preview server.

## Shopify tooling

- Prefer the Shopify plugin for supported Shopify Admin operations. Use browser automation only when the required operation is unavailable through the plugin or Shopify CLI.
- Before running `shopify theme pull`, identify the target theme ID and inspect the working tree. Do not pull code from a theme that has not been explicitly confirmed as synchronized with the repository when local changes could be overwritten.
- Treat code changes introduced by a theme pull as untrusted synchronization changes. JSON template and section-group updates may be expected, but do not commit pulled Liquid, CSS, JavaScript, configuration, locale, snippet, or asset deletions and reversions without comparing them against recent Git history and confirming that they are intentional.

## JSON templates

- Do not edit or delete existing JSON templates inside `templates/` or `sections/` unless the user explicitly asks for those JSON template changes.
- When a change includes JSON templates or section-group JSON files, edit all supporting Liquid sections and their schemas first, then edit the dependent JSON files last. Make these changes in separate filesystem operations; never batch supporting schema changes and dependent JSON changes in the same `apply_patch` call. Shopify's live uploader may otherwise process the JSON before the updated section schema and reject unsupported sections.

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
- Use kebab-case CSS class and ID names such as `some-css-class`, not `some__css__class` or `someCssClass`.
- Do not group CSS selectors, even when they share declarations. Give each selector its own rule so component styles remain independent.
- Organize CSS into clearly labeled logical groups using multiline comments in this format:
  ```css
  /*
    Group name
  */
  ```
- Leave two blank lines before each CSS group comment, except when the comment is the first content in the file.
- Let headings and body copy inherit the theme's global typography. Add component-specific font sizes, line heights, or text spacing only when explicitly requested or clearly required by the design.
- Use `rgb(var(--color-surface))` for subtle component backgrounds. Do not simulate surface backgrounds with low-opacity text colors such as `rgb(var(--color-text) / 0.05)`.
- Use `px` for explicit width and height values.
- Use `em` for section and component spacing that should scale with the surrounding typography, including section top and bottom spacing, component padding, and gaps. Use `rem` for layout spacing that should remain independent of the local font size.
- Keep merchant-facing spacing settings in `px`. When the storefront spacing should scale proportionally, divide the setting by `16.0` in Liquid and emit the resulting CSS custom property in `em`.
- Use a `0–80px` range with a `2px` step for block spacing settings, and a `0–160px` range with a `2px` step for section spacing settings.

## Responsive CSS

- Use mobile-first responsive CSS: base rules target mobile, tablet rules use `@media (min-width: 600px)`, and desktop rules use `@media (min-width: 1200px)`. Use narrow `max-width` queries only for small mobile-specific fixes.
