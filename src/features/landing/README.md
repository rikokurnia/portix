# PORTIX landing page

The `/` route owns these components and CSS Module. `AppChrome` retains the existing dashboard background and navigation on all other routes. Wallet and contract behavior is unchanged.

## Supplied assets

- `random/design-reference/landingpage/Kyki Points to the Open Book.png` → `public/assets/kyki-open-book.png` (unchanged transparent cutout, URL-safe filename).
- `random/design-reference/video-bg.mp4` → existing `public/assets/video-bg.mp4`.
- `public/assets/landing-poster.jpg` is frame zero of that video, extracted using FFmpeg. It backs initial loading, failed playback, and reduced motion.
- The three `lp-*.png` files remain references only; no flattened mockup is rendered.

Existing PORTIX, Apple, pxPrime, pxBoost, and protocol assets are reused. No fonts are bundled in the existing repository; the landing inherits its `Portix Sans, Arial, Helvetica, sans-serif` stack.

The closing cards share the dashboard benchmark hook, summary calculations, and dynamically loaded Lightweight Charts renderer. Rates and seven-day histories follow the existing feed and unavailable states, rather than hardcoded mockup numbers. TradingView attribution is retained.

Desktop reference viewport: 1672 × 941. The walkthrough pins on viewports at least 1100px wide and 760px tall. Its 355svh track provides three reading intervals of roughly 85svh before releasing into Closing. A single scroll state drives progress, book contents, and dialogue in both directions. Narrower or shorter screens use three normal-flow stages. The pxPrime APY on the final book page uses the same benchmark summary and protocol logos as the dashboard, with an em dash when unavailable.

Walkthrough and Closing use the existing CSS animation setup. IntersectionObserver reveals each mounted group once per visit with a 22px rise. Book overlays and dialogue use a separate 7px step transition; artwork stays stationary after its initial reveal. Reduced motion shows the content immediately without transitions. Closing retains its `/vault` CTA and chart attribution.
