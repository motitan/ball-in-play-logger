# Contributing

Thanks for contributing to Ball In Play Logger.

## Project Shape

- Static app with no backend
- Main surfaces:
  - `Logger`
  - `Review`
  - `Editor`
- Core files:
  - `index.html`
  - `review.html`
  - `editor.html`
  - `styles.css`
  - `app.js`
  - `review.js`
  - `editor.js`

## Local Run

Start a static server from the repo root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Validation

Run the same checks used in CI:

```bash
node --check app.js
node --check review.js
node --check editor.js
```

## Editing Guidelines

- Keep the app static and dependency-light unless there is a strong reason not to.
- Prefer preserving export schema compatibility once a column is shipped.
- Keep Logger for live capture, Review for read-only session analysis, and Editor for imported-file editing.
- When changing exports, update `docs/export-schema.md` and `README.md` in the same change.

## Pull Requests

- Keep PRs focused.
- Explain any export schema changes clearly.
- Include manual test notes for Logger, Review, or Editor when UI behavior changes.
