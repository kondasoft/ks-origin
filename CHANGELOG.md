# Changelog

All notable changes to KS Origin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and KS Origin follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version matches `theme_version` in
`config/settings_schema.json`.

## [Unreleased]

Work planned for 1.1.0 is tracked in the
[v1.1.0 milestone](https://github.com/kondasoft/ks-origin/milestone/1).

### Added

- Theme settings → Product cards: global appearance and image defaults, with per-block overrides (#82).
- Product pages and Featured product output product structured data for search engines (#91).
- The password page shows the visitor message from Online Store preferences, with a block to control its placement (#101).
- Custom Liquid blocks can be added wherever app blocks are supported (#120).
- Articles show blog comments with pagination, a comment form and moderation messages (#122).
- Mega menu product links show the product's featured image, like collection links (#77).
- Nested cart lines respect Shopify's remove and quantity rules and show their parent (#33).
- Trust badges offer built-in icons, with a custom image option (#96).
- Gallery videos offer fit or fill in Adapt to media mode (#103).
- The browser console shows the theme name and version (#95).

### Changed

- Quick add swatches default to 28px, like the product page (#81).
- The header account icon uses Shopify's account component and is hidden when customer accounts are turned off (#114).
- Announcement bar text uses a tighter line height, so wrapped announcements take less space on mobile (#72).
- Mobile product gallery thumbnails are smaller and more compact (#89).
- File upload fields use the theme's typography, focus outline and button style (#74).
- `.container` follows the global `--container-width` variable; sections and apps no longer need the removed `container-narrow`, `container-normal`, or `container-wide` classes (#84).
- Removed leftover commented-out and empty CSS rules and aligned stylesheets with the theme's CSS conventions (#102, #107).
- Modals open with a subtle upward fade and close immediately, while drawers retain animated closing (#83).

### Fixed

- Colour-only swatches on product cards show their colour, and cards, quick add and the product page share one swatch rendering (#80).
- Card images download sizes that match the grid in all browsers (#116).
- Quick add and quantity limits reflect the current cart after adding to cart (#63).
- Inline product recommendations share one saved product-card declaration across grid and carousel layouts (#121).
- Long text logos are shortened with an ellipsis on mobile instead of pushing the header icons off the screen (#76).
- Variant pickers on the same page no longer affect each other (#108).
- Uploaded files use native product submission, and Buy it now is disabled for products with customisations or a selling plan (#109).
- Products requiring a subscription plan open the product page from cards; product prices identify subscription adjustments separately (#61).
- Liquid / HTML, Blog posts, Collection list, Featured collection and Product recommendations render added blocks and preserve card settings across layouts (#121).
- Changing language or country keeps the visitor on the current page (#115).
- Collection filters and sorting respect per-page settings on every store, ignore hash-only navigation, normalize prices, and preserve typing during updates; sorting, variant selection and predictive search work when Shopify analytics is blocked (#92).
- The search page keeps its search box and heading in sync with results, including Back and Forward (#112).
- Article cards fill their grid or carousel cell, with Read more aligned at the bottom (#104).
- Sort options inherit the body font weight (#87).
- Filters introduced by an AJAX search retain their drawer, including when returning from a search without filters.
- Cart quantity changes made during an update are applied instead of ignored (#117).
- Focus moves to a nearby control after removing a cart line (#118).
- The checkout button waits for cart updates to finish (#119).
- Autoplay videos respect reduced motion, and looping videos without controls get a pause button (#105).
- Partly visible carousel cards can be tapped, and keyboard users can reach every card (#113).
- Solid accent buttons, badges and checkbox marks choose black or white for contrast, with opaque button hover and active states (#78).
- Trust badge text inherits the theme's line height (#73).
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
