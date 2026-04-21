# H5P.FlipBook

## Project overview
H5P content type that renders an uploaded PDF as a page-by-page flipbook
(prev/next nav, progress bar, fullscreen, swipe, keyboard). xAPI:
`experienced` per page, `progressed` with completion %, `completed` on
final page. Rendering is abstracted behind `H5P.FlipBookRenderers.*` so
the engine is swappable.

## Folder structure
H5P library — folder must be named `H5P.FlipBook-{majorVersion}.{minorVersion}`
(e.g. `H5P.FlipBook-1.0`) and live inside `libraries/` of an h5p-dev workspace.

Key files:
- `library.json` — library metadata
- `semantics.json` — author form + l10n strings
- `h5p.json`, `content/content.json` — example content (used by build.sh)
- `js/flipbook.js` — main class (`H5P.FlipBook`), extends `H5P.EventDispatcher`
- `js/pdf-renderer.js` — PDF.js wrapper; defines renderer interface
- `css/flipbook.css` — all styles scoped under `.h5p-pdf-flipbook`
- `lib/pdf.min.mjs`, `lib/pdf.worker.min.mjs` — PDF.js v4.10.38 (pinned, Apache 2.0)
- `build.sh` — produces `H5P.FlipBook.h5p`
- `.github/workflows/release.yml` — CI release on `v*` tag

## Development
- `h5p server` from the parent h5p-dev workspace for live-reload dev
- No build step for dev — edit JS/CSS and refresh

## Release process
Releases are fully automated. On every `vX.Y.Z` tag push, GitHub Actions
runs `build.sh` and attaches the resulting `H5P.FlipBook.h5p` to a new
GitHub Release.

To cut a release:

1. Bump `patchVersion` (or minor/major) in `library.json`.
2. Update `minorVersion` in `h5p.json`'s `preloadedDependencies` if the
   library minor version changed.
3. Commit and push to `main`.
4. Tag and push:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
5. Wait ~15s, verify at https://github.com/tammets/H5P.FlipBook/releases.

To build a `.h5p` locally without tagging: `./build.sh`.

## PDF.js specifics
- Pinned to **v4.10.38**, modern ESM build (`.mjs`).
- **Not** in `preloadedJs` — loaded via dynamic `import()` in
  `js/pdf-renderer.js` from `H5P.getLibraryPath('H5P.FlipBook-1.0')`.
- Worker auto-detected as a module worker via `.mjs` extension.
- To upgrade: replace both files in `lib/` from cdnjs, update version in
  README and bump `patchVersion`.

## H5P conventions
- Main class extends `H5P.EventDispatcher`; `createXAPIEventTemplate` +
  `this.trigger(event)` for xAPI statements.
- `this.trigger('resize')` after any canvas size change.
- All UI strings live in the `l10n` group in `semantics.json` (common: true).
- CSS scoped under `.h5p-pdf-flipbook`.
- `getCurrentState()` returns `{currentPage, maxPageReached}` for state persistence.

## GitHub
- Repo: https://github.com/tammets/H5P.FlipBook
- Releases: https://github.com/tammets/H5P.FlipBook/releases
