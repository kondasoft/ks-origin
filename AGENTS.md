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
- Do not run full Theme Check after every small edit. Use targeted checks only when necessary.
- Do not commit or push after each edit.
- Treat "checkpoint", "commit", "push", or "commit and push" as an explicit checkpoint request.
- At a checkpoint:
  - Review the combined diff.
  - Preserve unrelated user changes.
  - Run the repository linter and Shopify Theme Check once.
  - Commit the approved changes directly to `main`.
  - Push to `origin/main`.

## Shopify tooling

- Prefer the Shopify plugin for supported Shopify Admin operations. Use browser automation only when the required operation is unavailable through the plugin or Shopify CLI.

## JSON templates

- Do not edit or delete existing JSON templates inside `templates/` or `sections/` unless the user explicitly asks for those JSON template changes.
- When a change includes JSON templates or section-group JSON files, edit all supporting Liquid sections and their schemas first, then edit the dependent JSON files last. Shopify's live uploader may otherwise process the JSON before the updated section schema and reject unsupported sections.

## Liquid and theme schemas

- Use consistent naming patterns for comparable theme settings.
- When creating settings for a section, keep this order: `settings`, `blocks`, `disabled_on` or `enabled_on`, then `presets`.
- Give every section preset a merchant-facing `category` property.
- Use locale translation keys for storefront-visible text rendered by Liquid or JavaScript.
- Write merchant-facing section names, setting labels, headers, info text, and editable defaults directly in the schema.
- Do not create or extend `*.schema.json` locale files unless the user explicitly requests schema translations or the existing theme already uses them.

## HTML and CSS

- Use kebab-case CSS class and ID names such as `some-css-class`, not `some__css__class` or `someCssClass`.
- Do not group unrelated CSS selectors only because they share declarations. Keep component selectors and styles separate.
- Organize CSS into clearly labeled logical groups using multiline comments in this format:
  ```css
  /*
    Group name
  */
  ```
- Leave two blank lines before each CSS group comment, except when the comment is the first content in the file.
- Let headings and body copy inherit the theme's global typography. Add component-specific font sizes, line heights, or text spacing only when explicitly requested or clearly required by the design.
- Use `px` for explicit width and height values. Keep `rem` for spacing and text sizing unless a fixed dimension is clearer.

## Responsive CSS

- Use mobile-first responsive CSS: base rules target mobile, tablet rules use `@media (min-width: 600px)`, and desktop rules use `@media (min-width: 1200px)`. Use narrow `max-width` queries only for small mobile-specific fixes.
