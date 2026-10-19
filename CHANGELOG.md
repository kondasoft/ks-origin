# Changelog

All notable changes to KS Origin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and KS Origin follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version matches `theme_version` in
`config/settings_schema.json`.

## [Unreleased]

Work planned for 1.1.0 is tracked in the
[v1.1.0 milestone](https://github.com/kondasoft/ks-origin/milestone/1).

### Changed

- File upload fields use the theme's typography, focus outline and button style (#74).
- `.container` follows the global `--container-width` variable; sections and apps no longer need the removed `container-narrow`, `container-normal`, or `container-wide` classes (#84).
- Removed leftover commented-out and empty CSS rules and aligned stylesheets with the theme's CSS conventions (#102, #107).
- Modals open with a subtle upward fade and close immediately, while drawers retain animated closing (#83).

### Fixed

- Tables without a caption keep their spacing to the following content (#97).
- Rich text ending in a list no longer leaves extra space below it (#98).
- Dropdowns match the height of text inputs and buttons (#100).
- Language and country lists follow the border opacity setting (#99).
- Policy pages have top and bottom spacing like other pages (#94).
- Columns keep image and heading positions aligned when card text lengths differ (#88).
- Dialogs preserve return focus, reopen during closing, and keep page scrolling locked while another dialog is open (#93).
- Closing dialogs restores focus without scrolling or revealing the header when the scroll position is unchanged (#124).
- Cart errors and announcements remain visible and accessible inside the active dialog (#106).
- Contact forms preserve quotes and markup characters in prefilled and submitted values without breaking the fields.

## [1.0.0] - 2026-08-15

Initial release.
