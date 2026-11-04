# PORTIX landing page

The `/` route owns these components and CSS Module. `AppChrome` retains the existing dashboard background and navigation on all other routes. Wallet and contract behavior is unchanged.

## Supplied assets

- `random/design-reference/landingpage/Kyki Points to the Open Book.png` → `public/assets/kyki-open-book.png` (unchanged transparent cutout, URL-safe filename).
- `random/design-reference/video-bg.mp4` → existing `public/assets/video-bg.mp4`.
- `public/assets/landing-poster.jpg` is frame zero of that video, extracted using FFmpeg. It backs initial loading, failed playback, and reduced motion.
- The three `lp-*.png` files remain references only; no flattened mockup is rendered.

Existing PORTIX, Apple, pxPrime, pxBoost, and protocol assets are reused. No fonts are bundled in the existing repository; the landing inherits its `Portix Sans, Arial, Helvetica, sans-serif` stack.

The closing cards share the dashboard benchmark hook, summary calculations, and dynamically loaded Lightweight Charts renderer. Rates and seven-day histories follow the existing feed and unavailable states, rather than hardcoded mockup numbers. TradingView attribution is retained.

The walkthrough renders exactly one sticky viewport inside a 355svh wrapper at every breakpoint, including 1280 × 720. The wrapper's actual height minus the sticky viewport's actual height is split into three equal reading ranges (roughly 85svh each). Step 03 owns the entire final range before the scene releases. One scroll state drives the progress indicators, book contents, and dialogue in both directions. Short and narrow viewports resize the same scene; mobile uses a compact row of display-only indicators. Scroll listeners are passive and never intercept wheel, touch, or keyboard events.

Closing sits after the wrapper. Its reveals are gated on pin release and their own viewport intersection; the bubble hands off at release, followed by the cards and CTA. The pxPrime APY on the final book page uses the same benchmark summary and protocol logos as the dashboard, with an em dash when unavailable.

Walkthrough and Closing use the existing CSS animation setup. The walkthrough heading, indicators, and artwork stay stationary for the entire pin. Book overlays and dialogue use a 7px step transition. After release, IntersectionObserver reveals Closing groups once per visit with a 22px rise. Reduced motion shows the content immediately without transitions. Closing retains its `/vault` CTA and chart attribution.
