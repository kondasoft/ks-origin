# Changelog

All notable changes to KS Origin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and KS Origin follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version matches `theme_version` in
`config/settings_schema.json`.

## [Unreleased]

Work planned for 1.1.0 is tracked in the
[v1.1.0 milestone](https://github.com/kondasoft/ks-origin/milestone/1).

### Changed

- `.container` follows the global `--container-width` variable; sections and apps no longer need the removed `container-narrow`, `container-normal`, or `container-wide` classes (#84).
- Removed leftover commented-out and empty CSS rules and aligned stylesheets with the theme's CSS conventions (#102, #107).
- Modals open with a subtle upward fade and close immediately, while drawers retain animated closing (#83).

### Fixed

- Dialogs preserve return focus, reopen during closing, and keep page scrolling locked while another dialog is open (#93).
- Closing dialogs restores focus without scrolling or revealing the header when the scroll position is unchanged (#124).
- Cart errors and announcements remain visible and accessible inside the active dialog (#106).

## [1.0.0] - 2026-08-15

Initial release.
