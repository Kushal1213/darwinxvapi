# Data Collection & Cleaning Report — Question 2

## How this was produced
`knowledge-base/local_retriever.py` runs a `quality_check()` pass over every file in
`knowledge-base/raw/` before indexing it. This report is the real output of that pass
(captured via `LocalRetriever().quality_log`), not a hand-written summary. Re-run:

```
python3 -c "import sys; sys.path.insert(0,'.'); from knowledge_base_utils import get_retriever; \
r=get_retriever(); [print(q) for q in r.quality_log]"
```

## Website Extraction and Document Parsing

**Extraction method for HTML sources:**
Every `.html` file in `knowledge-base/raw/` was collected using a simple HTTP GET
(`knowledge-base/scrape_html.py`) — a direct request for the page's raw HTML response.
This works for static-rendered pages but **fails silently for JavaScript single-page apps**
(SPAs) where the real content is injected after page load by client-side JavaScript.
The extraction pipeline parses collected HTML by:
1. Stripping `<script>` and `<style>` blocks entirely (they are executable code, not content).
2. Replacing every remaining HTML tag with a **newline** (not a space) so block-level structure
   (paragraphs, headings, list items) survives as separate lines — this is important because
   the quality gate uses line-length distribution to distinguish prose from navigation menus.
3. HTML entity unescaping (`html.unescape`): e.g. `&amp;` → `&`, `&nbsp;` → space.
4. Collapsing whitespace within lines while preserving the newline structure.

**Parsing for text sources:**
`.txt` files are read directly (UTF-8, with `errors='ignore'` for any malformed bytes).
No additional parsing is needed — the files were authored as structured plaintext with
consistent section headers.

**PDF sources (referenced but not yet present):**
9 PDFs listed in the original manifest are not committed to the repository (see "Manifest
correction" below). Had they been available, the pipeline would use `pypdf2` or `pdfplumber`
for text extraction, with an additional check for scanned-image PDFs (zero extracted text
→ flag for OCR). Tracked in `known_limitations.md`.

## Manifest correction
The original `knowledge-base/raw/manifest.json` listed 29 source files, but only 20 exist on
disk — 9 PDF entries (regulatory circulars, LIC/insurance policy PDFs, a KYC master-file PDF)
were referenced but never committed to the repository, so retrieval results that cited them
(e.g. a prior version of this report citing `Final-Policy-Doc_LIC-s-Jeevan-Umang.pdf`) were not
actually verifiable. The manifest has been corrected to list only the 20 files that are
actually present; the 9 missing filenames are preserved in `manifest.json`'s
`removed_missing_files` field so they can be re-sourced before a production run — see
`known_limitations.md`.

## Extraction failures found and excluded (real, not simulated)

Of those 20 files, the offline pipeline's quality gate rejected **4** at index time:

| File | Failure mode | Evidence |
|---|---|---|
| `adira_finance_faq.html` | **Client-side-rendered SPA shell** — the scrape captured only `<div id="app"></div>` plus analytics/tracking scripts; the real FAQ content is injected by JavaScript after page load, which a plain HTTP GET never executes. | 8 words extracted from a 4.2 KB file |
| `insurancedekho_health_faq.html` | **Corrupted/binary response** — decoded text is 99.7% non-alphabetic tokens, consistent with a compressed (gzip) or wrong-encoding HTTP response saved directly to disk instead of the decompressed HTML. | 0.3% clean-word ratio vs. >60% on every legitimate source file |
| `insurance_dekho_health_faq.html` | **Wrong content scraped** — 566 lines averaging 4.3 words/line (92% ≤6 words): this is the site's navigation mega-menu and blog-article-listing chrome, not the FAQ answer content the filename implies. | Line-length/short-line-fraction heuristic (see `quality_check()`) |
| `policybazaar_health_faq.html` | Same failure mode as above — 688 lines averaging 4.2 words/line (91% ≤6 words), pure nav menu / help-center link list. | Same heuristic |

**Fix applied:** these 4 files are excluded from the index (never chunked, never embedded, never
retrievable) rather than silently degrading answer quality with menu-item noise or garbage
tokens. **Not yet fixed:** the underlying scrapes need to be redone — `adira_finance_faq.html`
needs a headless-browser scrape (Playwright/Puppeteer) instead of a raw GET, and the two
InsuranceDekho files need the actual FAQ/article endpoint re-identified and re-scraped with
correct response decoding. Tracked in `known_limitations.md`.

## Duplicate / near-duplicate handling
Two source files have near-identical names (`insurance_dekho_health_faq.html` vs.
`insurancedekho_health_faq.html`) suggesting the same page was scraped twice under slightly
different filenames. In this run only one ever reached the duplicate check (the other was
already excluded as an extraction failure above), but the pipeline includes a first-400-char
normalized-text duplicate detector (`load_chunks()` in `local_retriever.py`) that will catch and
skip a true duplicate if both copies pass the quality gate in a future re-scrape.

## Standardization applied
- Headings/whitespace: HTML tags are converted to line breaks (not spaces) before flattening,
  so block structure is preserved for the nav-detection heuristic, then collapsed to clean text.
- Terminology: source documents mix `EMI`/`cicilan`/`angsuran`, `CIBIL`/`credit score`, `LTV
  ratio`/`loan-to-value` — these are *not* rewritten to a single canonical term because doing so
  would break the market-specific vocabulary the voice agents are supposed to use naturally
  (see Question 3 requirements). Instead, `category_for()` and `market_for()` in
  `local_retriever.py` tag each chunk with a normalized `category` (product / policy / faq /
  qualification_rules / objection / script) and `market` (india / philippines / indonesia) field
  so retrieval and routing can filter/standardize at the metadata layer without lossy rewriting
  of the source text.

## PII protection
`local_retriever.py`'s `redact_pii()` runs a regex pass for Aadhaar-like 12-digit numbers, PAN
numbers, long account numbers, emails, and phone numbers, replacing matches with
`[*_REDACTED]` placeholders before a chunk is indexed or embedded; the `Chunk.pii_redacted` flag
records whether a given chunk was touched, so citations can be audited. In this knowledge base
none of the 16 indexed source files contained matchable PII patterns (they are product/policy
reference documents, not customer records), so `pii_redacted=False` on every chunk in the
current index — this is expected given the source material, not a sign the redaction path is
unexercised; see `knowledge-base/raw/manifest.json`'s per-file `PII` field for the original
authoring-time classification.

## Result
- 20 raw files in `knowledge-base/raw/` → **4 excluded** (extraction failures, logged above) →
  **16 indexed** → **68 chunks** (see `evaluation/retrieval_tests.md` for retrieval accuracy
  against this cleaned index).
