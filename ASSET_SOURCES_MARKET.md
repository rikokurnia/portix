# Market Asset Sources and Logo Manifest

This manifest documents the provenance, source APIs, verification steps, and local caching of company brand marks used across the PORTIX Market frontend.

## Stock Brand Marks

| Ticker | Company | Verified Domain | Provider / Source | Format | Local Asset | Visual Verification |
|:---|:---|:---|:---|:---|:---|:---|
| **AAPL** | Apple Inc. | `apple.com` | Simple Icons (`cdn.simpleicons.org/apple/white`) | Transparent SVG & 256x256 PNG | `/assets/AAPL.png`, `/assets/logos/AAPL.svg` | Verified white silhouette matching `market-dashboard.png` |
| **GOOGL** | Alphabet Inc. | `google.com` | Wikimedia Commons (`Google "G" logo.svg`) | Transparent SVG & 256x256 PNG | `/assets/GOOGL.png`, `/assets/logos/GOOGL.svg` | Verified 4-color G mark matching `market-dashboard.png` |
| **NFLX** | Netflix Inc. | `netflix.com` | Simple Icons (`cdn.simpleicons.org/netflix/E50914`) | Transparent SVG & 256x256 PNG | `/assets/NFLX.png`, `/assets/logos/NFLX.svg` | Verified red ribbon N mark matching `market-dashboard.png` |
| **MSFT** | Microsoft Corp. | `microsoft.com` | Wikimedia Commons (`Microsoft_logo_(2012).svg`) | Transparent SVG & 256x256 PNG | `/assets/MSFT.png`, `/assets/logos/MSFT.svg` | Verified 4-square geometric mark matching `market-dashboard.png` |
| **META** | Meta Platforms | `meta.com` | Simple Icons (`cdn.simpleicons.org/meta/0081FB`) | Transparent SVG & 256x256 PNG | `/assets/META.png`, `/assets/logos/META.svg` | Verified Meta blue infinity ribbon matching `market-dashboard.png` |

## Compliance Notes
- No AI-generated or hand-approximated logos.
- No ticker letter circles or generic fallback badges.
- All logos are rendered with authentic transparency suitable for dark mode (`#211D31`).
- Cached locally in `public/assets/` and `public/assets/logos/` to prevent external runtime network latency or tracking.
- No API keys or secrets embedded in client code.
