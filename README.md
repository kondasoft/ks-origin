# KS Origin

KS Origin is a free, modern Shopify theme built from scratch by
[KondaSoft](https://www.kondasoft.com). It provides merchants with a clean, flexible storefront
and gives developers a lightweight foundation for custom Shopify theme projects.

Its mobile-first architecture combines reusable theme blocks, Shopify-native storefront events
and actions, and the latest color palette system. The theme is intentionally built with native
Liquid, CSS, and JavaScript so it remains easy to understand, extend, and maintain—whether the
work is done by a developer or with an AI coding agent.

[View the live demo](https://ks-origin-demo.kondasoft.com) ·
[View the theme page](https://www.kondasoft.com/collections/shopify-themes/products/ks-origin)

Demo password: `ks`

## Download and install

The easiest way to install KS Origin is to download the free, Shopify-ready package from
[KondaSoft](https://www.kondasoft.com/collections/shopify-themes/products/ks-origin):

1. Add KS Origin to your cart and complete the free checkout.
2. Download the theme `.zip` file from your order. Do not extract it.
3. In your Shopify admin, go to **Online Store → Themes**.
4. Choose **Import theme → Upload zip file**, then select the downloaded package.
5. Open the theme editor to customize and preview the theme before publishing it.

Developers who want the source code can clone this repository instead. Continue to
[Local development](#local-development) for setup instructions.

## Highlights

- Mobile-first, modular architecture
- Native Shopify Liquid, CSS, and JavaScript with no storefront framework dependency
- Reusable theme blocks and app block support
- Shopify storefront events and actions for app and AI shopping-agent compatibility
- Flexible color palettes and global theme settings
- Accessible, responsive storefront patterns
- AJAX-powered collection, product, and cart interactions
- Clear conventions designed for custom development and AI-assisted extension

## Built for agentic commerce

![KS Origin uses Shopify storefront events and actions to connect with AI shopping agents](https://cdn.shopify.com/s/files/1/0288/2872/9453/files/ks-origin-ai-shopping-agents.png?v=1786804270)

KS Origin uses Shopify's latest storefront standards so apps and AI shopping agents can work
naturally with your store. They can understand key shopping activity and perform actions such as
updating the cart, while customers continue to see the storefront experience you designed.

## Storefront features

KS Origin includes the essential commerce experiences needed for a modern Shopify storefront.
Each area is merchant-configurable and built around native Shopify behavior.

### Product experience

- Configurable image and video gallery
- Live variant selection, availability, pricing, and color swatches
- Quantity selector, dynamic checkout, and gift-card recipient form
- Ratings, sale badges, installment information, and trust badges
- Collapsible product information and built-in sharing
- Related and complementary product recommendations
- Native product-view and variant-selection events

### Collection experience

- Configurable collection headers, images, descriptions, and breadcrumbs
- AJAX filtering, sorting, and pagination
- Mobile filter and sort controls with accessible live result updates
- Flexible responsive product grids
- Reorderable product-card blocks with ratings, swatches, and quick add
- Native collection-view and collection-update events

### Cart experience

- Cart drawer or cart page
- AJAX add, remove, and quantity updates
- Shopify storefront actions and events for cart updates
- Live cart badges, cart notes, and discount-code management
- Shopify warning and error feedback
- Accessible focus restoration and section-based rendering

## Included sections

- Hero
- Image with text
- Featured collection
- Featured product
- Collection list
- Product recommendations
- Blog posts
- Video
- Video with text
- Image
- Columns
- Rich text
- FAQ
- Contact form
- Email signup
- Custom section
- Liquid/HTML
- Divider

## Local development

### Requirements

- A Shopify Partner account and development store
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli)
- Node.js 22.13 or newer

### Setup

1. Clone the repository and enter its directory:

   ```sh
   git clone https://github.com/kondasoft/ks-origin.git
   cd ks-origin
   ```

2. Install the development dependencies:

   ```sh
   npm ci
   ```

3. Create your local environment file:

   ```sh
   cp .env.example .env
   ```

4. Set `SHOPIFY_FLAG_STORE` in `.env` to your development store domain, then start the local
   preview:

   ```sh
   npm run dev
   ```

The Shopify CLI will prompt you to authenticate if necessary.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start a Shopify theme development session with Theme Editor sync |
| `npm run lint` | Run ESLint against JavaScript and Liquid files |
| `npm run pull` | Pull the configured remote theme into the local repository |
| `npm run push` | Push the local theme to the configured Shopify store |

> [!CAUTION]
> The pull and push commands change theme code. Confirm the target store and theme before using
> them, especially when the working tree contains local changes.

## Project goals

- Provide a complete, practical storefront without the weight of an oversized theme.
- Stay fast, accessible, maintainable, and aligned with Shopify platform standards.
- Give merchants useful customization while keeping the code predictable for developers.
- Serve as the starting point—the “origin”—for more specialized themes and custom storefronts.

## Contributing and support

Bug reports and focused contributions are welcome through
[GitHub Issues](https://github.com/kondasoft/ks-origin/issues).

For product and store-specific support, use the
[KondaSoft contact form](https://www.kondasoft.com/pages/contact).

## License

KS Origin is open-source software released under the [MIT License](LICENSE). You may use,
modify, distribute, sublicense, or sell copies of the theme, provided that the original copyright
and license notice are included.
