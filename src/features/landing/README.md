# PORTIX landing page

The `/` route owns these components and CSS Module. `AppChrome` retains the existing dashboard background and navigation on all other routes. Wallet and contract behavior is unchanged.

## Supplied assets

- `random/design-reference/landingpage/Kyki Points to the Open Book.png` → `public/assets/kyki-open-book.png` (unchanged transparent cutout, URL-safe filename).
- `random/design-reference/video-bg.mp4` → existing `public/assets/video-bg.mp4`.
- `public/assets/landing-poster.jpg` is frame zero of that video, extracted using FFmpeg. It backs initial loading, failed playback, and reduced motion.
- The three `lp-*.png` files remain references only; no flattened mockup is rendered.

Existing PORTIX, Apple, pxPrime, pxBoost, and protocol assets are reused. No fonts are bundled in the existing repository; the landing inherits its `Portix Sans, Arial, Helvetica, sans-serif` stack.

The closing cards share the dashboard benchmark hook, summary calculations, and dynamically loaded Lightweight Charts renderer. Rates and seven-day histories follow the existing feed and unavailable states, rather than hardcoded mockup numbers. TradingView attribution is retained.

Desktop reference viewport: 1672 × 941. Each section occupies one viewport there. Mobile sections grow to fit their content. Only the dialogue in the section intersecting the center band is mounted; all dialogue text is live HTML. The three native buttons support Tab and Enter/Space.
