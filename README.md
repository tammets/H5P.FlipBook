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

## Install

1. Download the latest `H5P.FlipBook.h5p` from
   [GitHub Releases](https://github.com/tammets/H5P.FlipBook/releases).
2. Upload it to your H5P-enabled platform (Moodle, Drupal, WordPress plugin,
   h5p.org).
3. Create a new activity, pick "FlipBook", and upload a PDF.

## Development

Prerequisite: [h5p-cli](https://h5p.org/h5p-cli-guide).

```bash
npm install -g h5p-cli
```

Clone this repo into the `libraries/` folder of an h5p-cli workspace as
`H5P.FlipBook-1.0`, then from the workspace root:

```bash
h5p server
```

Open the dev server URL, create a FlipBook content entry, upload a PDF. JS
and CSS changes are picked up on refresh.

## Building a `.h5p` package

```bash
./build.sh
```

Produces `H5P.FlipBook.h5p` in the repo root. Works on macOS and Linux (uses
`zip`). The resulting file can be uploaded to any H5P-compatible host.

## Releases

Tagging a commit with `vX.Y.Z` triggers the GitHub Actions workflow at
`.github/workflows/release.yml`, which builds the `.h5p` package and
attaches it to a new GitHub Release.

Cut a new release:

```bash
# bump patchVersion in library.json first, commit, then:
git tag v1.0.1
git push origin v1.0.1
```

## PDF.js

Pinned to **PDF.js v4.10.38** (Apache 2.0, Mozilla). The files ship as ES
modules and are loaded via dynamic `import()` from `js/pdf-renderer.js`, so
they are *not* listed in `preloadedJs`.

### Upgrading PDF.js

1. Download the matching `pdf.min.mjs` and `pdf.worker.min.mjs` from
   `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/<VERSION>/pdf.min.mjs`
2. Replace both files in `lib/`.
3. Update the version number in this README and bump `patchVersion` in
   `library.json`.

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
  rasterized to a canvas. Add a text layer via PDF.js
  `page.getTextContent()` if selection/search is needed later.
- **Large PDFs** are re-rendered on each page turn; no pages are cached.
- **Encrypted/password-protected PDFs are not supported.**
- **Print, download, and annotation** are intentionally not exposed.
- **Accessibility**: ARIA carousel roles are set and focus is moved on
  page change, but screen readers will not read PDF content. Treat this
  as visual material; provide equivalent accessible text elsewhere if
  the PDF is primary content.

## License

MIT (this library). PDF.js is Apache 2.0, copyright Mozilla Foundation.
