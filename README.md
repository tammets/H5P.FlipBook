# H5P.FlipBook

A minimal H5P content type that lets an author upload a PDF and presents it
as a page-by-page flipbook viewer.

- Header: title + total page count
- Large circular prev/next navigation
- Bottom progress bar with `current / total` indicator
- Fullscreen toggle
- Keyboard nav (← →, Esc to exit fullscreen)
- Swipe gestures on touch devices
- xAPI: `experienced` per page view, `progressed` with completion %, `completed` on final page
- Renderer engine is swappable behind `H5P.FlipBookRenderers.*`

Target audience: modern browsers (evergreen Chrome, Firefox, Safari, Edge).

## Structure

```
H5P.FlipBook-1.0/
├── library.json
├── semantics.json
├── icon.svg
├── js/
│   ├── pdf-renderer.js     # PDF.js wrapper (swappable renderer interface)
│   └── flipbook.js         # main class, extends H5P.EventDispatcher
├── css/
│   └── flipbook.css
└── lib/
    ├── pdf.min.mjs         # PDF.js (modern ESM, pinned)
    └── pdf.worker.min.mjs  # PDF.js worker
```

## PDF.js

Pinned to **PDF.js v4.10.38** (Apache 2.0, Mozilla). The files ship as ES
modules and are loaded via dynamic `import()` from `js/pdf-renderer.js`, so
they are *not* listed in `preloadedJs`.

### Upgrading PDF.js

1. Download the matching `pdf.min.mjs` and `pdf.worker.min.mjs` from:
   `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/<VERSION>/pdf.min.mjs`
2. Replace both files in `lib/`.
3. Update the version number in this README and bump `patchVersion` in
   `library.json`.

## Building a `.h5p` package

Install the H5P CLI once:

```bash
npm install -g h5p-cli
```

From the parent `libraries/` directory:

```bash
h5p pack H5P.FlipBook H5P.FlipBook.h5p
```

The resulting `H5P.FlipBook.h5p` is uploadable to any H5P-compatible host
(Moodle, Drupal, WordPress plugin, lumi.education, h5p.org).

## Local testing

The fastest path is [Lumi](https://lumi.education/):

1. Install Lumi Desktop.
2. Drag `H5P.FlipBook.h5p` into the app, or create a new content with
   content type "FlipBook" and upload a PDF.

Alternatively, use `h5p-cli server` to serve content types locally, or
point an H5P-enabled Moodle/Drupal instance at the packaged file.

## Swappable renderers

`js/flipbook.js` uses `H5P.FlipBookRenderers.PdfJs` by default. To add an
alternative engine (e.g. a pre-rasterized image renderer), implement the
same interface:

```js
new Renderer(libraryPath);
renderer.loadDocument(url)       // → { numPages }
renderer.renderPage(n, canvas, targetWidth)  // → { width, height }
renderer.destroy();
```

Register it under `H5P.FlipBookRenderers` and select it in `flipbook.js`.

## Known limitations

- **Text selection and PDF text layer are not rendered.** Pages are
  rasterized to a canvas. If text selection/search is needed later, add a
  text layer above the canvas using PDF.js `page.getTextContent()`.
- **Large PDFs** are re-rendered on each page turn; no pages are cached.
  A simple in-memory cache could be added if flipping feels slow.
- **Passwords and encrypted PDFs are not supported** — the content type
  assumes an open, standard PDF.
- **Print, download, and annotation** are intentionally not exposed.
- **Accessibility**: ARIA carousel roles are set and focus is moved on
  page change, but screen readers will not read PDF content. Treat this
  as visual material; provide equivalent accessible text elsewhere if
  the PDF is primary content.

## License

MIT (this library). PDF.js is Apache 2.0, copyright Mozilla Foundation.
