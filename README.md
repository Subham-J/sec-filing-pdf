# SEC Filing PDF

A dependency-free Chrome extension for exporting an open SEC filing to a compact, searchable PDF. Everything runs locally; there is no upload or conversion service.

## Install
1. In Chrome, open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select `/Users/subhamjain/Documents/SEC Filing PDF`.
4. Pin **SEC Filing PDF** from Chrome's Extensions menu if desired.

Requires Chrome 118 or newer. Installation is manual; this folder is the extension, not a Chrome Web Store package. If you change its files, click Reload on its extension card.

## Export a filing
1. Open the filing's direct HTML URL in Chrome and wait for its text and images to load. For example:
   https://www.sec.gov/Archives/edgar/data/2130357/000162828026067168/anthropicpbc-sx1.htm
2. Click the extension. Choose paper, orientation, pagination and margins, then **Export PDF**.
3. Keep the filing and export tabs open until the PDF is ready. Choose a destination in Chrome's save dialog. **Save PDF again** remains available while the export tab is open.

Use **Original source pages** for an already paginated prospectus. When all source pages use positioned layouts, their native dimensions, margins and mixed orientations are preserved; selected paper and margin settings do not override them. **Fit source pages to paper** applies the chosen paper and margins instead. Use **Continuous flow** when original page breaks leave excessive whitespace. Wide tables may require **Landscape** for readable text. Layout is measured for every export. Repeated paper panels are normalized before fitting: outer screen gutters and empty panels are removed, flow panels lose fixed heights, and positioned pages retain their geometry and pagination. There is no company-specific template. Extremely wide layouts now stop with an error instead of silently producing very small text; try landscape. Original page numbers are part of the filing and are not rewritten by continuous flow.

For Inline XBRL viewer URLs, open the underlying document first (the viewer's **Open document** link). Only HTTPS HTML filings under `sec.gov/Archives/edgar/data/` are accepted. PDF files, filing index pages and viewer pages are not converted.

## File size and fidelity
Text and tables are printed through Chrome's native PDF engine, rather than captured as screenshots. Fonts and links are retained where Chrome supports them; a scanned image remains an image. No headers, URL footer, extra accessibility tagging or PDF outline are added.

**Compact large images** resizes oversized illustrations to roughly 150 dpi at their print size, choosing between JPEG and PNG. When the original resource size is available, a replacement is used only if smaller. Text inside an illustration may soften; turn the option off for maximum image fidelity. CSS backgrounds and SVGs are preserved. File size depends on images, fonts and page count; a long illustrated filing can still be several megabytes. Lossless output cannot always match the HTML's size.

Filing text styles are retained, while screen-only page frames are normalized. Explicit page breaks are preserved unless continuous flow is selected. Fixed-position page panels retain page boundaries even in continuous mode, since reflowing them could overlap text. Extremely wide tables can shrink text; landscape helps. Unusual filing layouts, fixed-position elements, oversized rows or explicit element heights can still need review. Check the resulting PDF's tables and page boundaries before relying on it. Chrome's ordinary Print > Save as PDF remains a fallback.

## Permissions and operation
- **activeTab** identifies the filing tab after you click the extension.
- **debugger** accesses Chrome's native PDF engine and temporarily applies print emulation to that tab. Chrome shows a debugging banner and a broad debugging permission warning. Close DevTools on the filing before exporting. No network interception is used.
- **downloads** opens the local PDF save dialog.

There are no persistent content scripts, remote libraries, telemetry, broad host permissions or external requests initiated by the extension. The filing's own image/font loads may use its normal network connections. Temporary image changes and print styles are restored after export, including on most failures. If you close the export tab early, disconnect the debugger, or navigate during export, reload the filing tab to ensure its original state is restored. A safety timer also removes temporary changes after ten minutes.

## Verification
See `VALIDATION.md` for the checks performed during development. Version 1.2 was verified against a browser-captured copy of the actual Anthropic filing, including its portrait, landscape and image pages.
