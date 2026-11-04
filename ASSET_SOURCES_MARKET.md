> Current integration: see [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) and [live deployment checks](docs/onchain-verification.json). The on-chain integration replaces the earlier local fixture behavior documented below.

# Market Asset Sources and Logo Manifest

This manifest documents the provenance, source APIs, verification steps, and local caching of company brand marks used across the PORTIX Market frontend.

## Stock & Index ETF Brand Marks

| Ticker | Company / Fund | Verified Domain | Provider / Source | Format | Local Asset | Visual Verification |
|:---|:---|:---|:---|:---|:---|:---|
| **AAPL** | Apple Inc. | `apple.com` | Simple Icons (`cdn.simpleicons.org/apple/white`) | Transparent SVG & 256x256 PNG | `/assets/AAPL.png`, `/assets/logos/AAPL.svg` | Verified white silhouette matching `market-dashboard.png` |
| **GOOGL** | Alphabet Inc. | `google.com` | Wikimedia Commons (`Google "G" logo.svg`) | Transparent SVG & 256x256 PNG | `/assets/GOOGL.png`, `/assets/logos/GOOGL.svg` | Verified 4-color G mark matching `market-dashboard.png` |
| **NFLX** | Netflix Inc. | `netflix.com` | Simple Icons (`cdn.simpleicons.org/netflix/E50914`) | Transparent SVG & 256x256 PNG | `/assets/NFLX.png`, `/assets/logos/NFLX.svg` | Verified red ribbon N mark matching `market-dashboard.png` |
| **MSFT** | Microsoft Corp. | `microsoft.com` | Wikimedia Commons (`Microsoft_logo_(2012).svg`) | Transparent SVG & 256x256 PNG | `/assets/MSFT.png`, `/assets/logos/MSFT.svg` | Verified 4-square geometric mark matching `market-dashboard.png` |
| **META** | Meta Platforms | `meta.com` | Simple Icons (`cdn.simpleicons.org/meta/0081FB`) | Transparent SVG & 256x256 PNG | `/assets/META.png`, `/assets/logos/META.svg` | Verified Meta blue infinity ribbon matching `market-dashboard.png` |
| **SPY** | SPDR S&P 500 ETF Trust | `ssga.com` | Wikimedia Commons (`State-street-logo-final.svg`) | Transparent SVG & 256x256 PNG | `/assets/SPY.png`, `/assets/logos/SPY.svg` | Verified State Street three-sails wave emblem on transparent dark background |
| **QQQ** | Invesco QQQ Trust | `invesco.com` | Wikimedia Commons (`Invesco_Logo.svg`) | Transparent SVG & 256x256 PNG | `/assets/QQQ.png`, `/assets/logos/QQQ.svg` | Verified Invesco mountain peak emblem on transparent dark background |
| **NVDA** | NVIDIA Corporation | `nvidia.com` | Simple Icons (`cdn.simpleicons.org/nvidia/76B900`) | Transparent SVG & 256x256 PNG | `/assets/NVDA.png`, `/assets/logos/NVDA.svg` | Verified NVIDIA green spiral mark on transparent dark background |

## Compliance Notes
- No AI-generated or hand-approximated logos.
- No ticker letter circles or generic fallback badges.
- All logos are rendered with authentic transparency suitable for dark mode (`#211D31`).
- Cached locally in `public/assets/` and `public/assets/logos/` to prevent external runtime network latency or tracking.
- No API keys or secrets embedded in client code.
