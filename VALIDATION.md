# Version 1.2 actual-filing correction

The user's width-limit screenshot led to inspection of the actual SEC document through the shared browser. The captured filing contains 421 page panels: 415 US Letter portrait and six US Letter landscape, with 43 image placements (42 distinct image resources).

Root causes in versions 1.0/1.1:
- `content-visibility:auto` skipped offscreen page content during layout/printing.
- The panel aspect-ratio filter excluded landscape pages, which kept the document too wide and triggered the 80% width limit.
- Image-only panels were misclassified as flow content.
- `max-width:100%` collapsed images inside zero-width absolute-position wrappers, explaining missing illustrations even when their resources were loaded.
- Global page scaling and continuous break removal did not preserve this positioned filing's geometry.

Version 1.2 forces content rendering, detects both page orientations and positioned image panels, preserves native source geometry via named CSS page sizes in Original source pages mode, and exempts fixed-page images from percentage width constraints. Fit source pages to paper remains available for paper/margin overrides.

Verification uses the actual 13.8 MB browser-captured HTML and all 42 distinct image resources, captured at up to 150 dpi. The source image copies were JPEG encoded at quality 0.85 for the local verification fixture; production compaction selects JPEG/PNG at roughly 150 dpi with JPEG quality 0.82. The test harness alone adds tabs permission to simulate clicking the extension's toolbar action. The delivered manifest retains activeTab, debugger and downloads only.

### Automated Verification Results (Version 1.2 Final)
- Full 421-page export verified against the live Anthropic S-1 filing fixture (`actual-original.pdf`):
  - Total Pages: 421 (415 US Letter portrait at 612x792 pt, 6 US Letter landscape at 792x612 pt)
  - Image Placements: 43 / 43 verified present and rendered without zero-width collapsing
  - Empty Pages: 0
  - Text: Fully selectable and searchable across all body pages
- Compacted export verified (`actual-original-compact.pdf`):
  - Total Pages: 421
  - Image Placements: 43 / 43
  - Empty Pages: 0
  - 8 oversized illustrations compacted automatically down to target DPI
- Mixed-orientation and multi-layout regression suite verified (`regression.cjs`):
  - Normalization of screen gutters, elimination of redundant empty panels, and preservation of fixed page geometry all passing.

# Version 1.1 layout correction

Inspected the user's actual export at `/Users/subhamjain/downloads from chrome - september/anthropicpbc-sx1.pdf`: 318 pages, 4,445,958 bytes, 19 pages with no extractable text or embedded images, predominant body font 6.66 pt. Rendered samples confirmed gray outer screen gutters, source page panels split across physical pages, near-empty pages and overly small text. Browser session export metadata showed continuous pagination with image compaction disabled. The original version's simple fixture did not represent these page panels and was insufficient validation.

The correction detects repeated page-shaped containers, clears screen gutters, removes empty panels and fixed flow heights, and preserves page geometry for positioned text. Global fitting stops below 80% scale to avoid silently producing very small text. Wide content may require landscape.

New regression fixture: 1052-pixel outer screen frame, six 816 x 1056 source panels (three empty), text, financial table, and one page with absolutely positioned top/bottom text. Visible Chromium 156 exports in both original and continuous modes produced three nonblank pages. Body text measured 9.98 pt; both table edges and both positioned text markers survived extraction, and all text remained within horizontal page bounds. Original filing layout/attributes restored (ignoring harmless empty style attributes left by Chromium). Fixed-position source pagination was retained in continuous mode.

Important limit: the real SEC source still returns HTTP 403 to automated fetching. The exact Anthropic source DOM is unavailable, so version 1.1 has not yet been verified on that actual filing. The existing bad PDF has not been overwritten or presented as repaired.

## Earlier version 1.0 checks (limited)


Tested on macOS with Playwright's Chromium 156.0.8078.4. The extension loaded successfully and actual native PDF exports completed in both headless and visible browser runs.

A local synthetic SEC-style HTML response contained a fixed 960-pixel-wide financial table, selectable financial text, an explicit page break, and a 3000 x 1500 image. Automated checks confirmed:
- US Letter portrait: table fitted at 77% scale and original breaks produced two pages.
- A4 landscape with continuous flow: one page, 100% scale.
- Both left and right table markers, financial text and second-page marker survived PDF text extraction. All extracted words stayed within horizontal page bounds.
- Same-settings portrait comparison: original images 66,891 bytes; compact images 45,438 bytes (32.1% smaller). This synthetic image is not a size guarantee for real filings.
- Temporary CSS and original image attributes restored after export.
- Unsupported URL rejected before debugging began.
- No extension page JavaScript errors in the export tests.
- qpdf found no syntax or stream encoding errors in the portrait and landscape outputs.
- JavaScript syntax checks passed.

The test harness added the tabs permission only to a temporary copy of the extension, to simulate the activeTab grant normally obtained by clicking its toolbar button. The delivered manifest uses activeTab, debugger and downloads only. Chrome's toolbar installation and permission prompts still require the user.

The supplied Anthropic filing URL returned HTTP 403 to automated requests. Its exact content, image coverage and page boundaries have not been tested. Review your first exported PDF visually, especially wide tables. Tests do not establish compatibility with every SEC filing or every Chrome version.
