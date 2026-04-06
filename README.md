# Ball In Play Logger

Static rugby analysis app for logging live activity, reviewing the current session, and editing exported sessions without a backend.

The project is designed for fast use on iPhone and iPad, stores the active session in browser `localStorage`, and exports a flat analysis-friendly dataset in CSV, JSON, or ZIP form.

## Use It Now

- Open the live app: https://motitan.github.io/ball-in-play-logger/
- No install required for normal use

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-motitan-FFDD00?logo=buymeacoffee&logoColor=000000)](https://buymeacoffee.com/motitan)

## License

This project is open-source under the [MIT License](./LICENSE).

## What The App Includes

### Logger

- live match/activity clock
- locked activity naming on start
- task creation-first workflow (`T+`)
- nested BIP logging inside tasks
- ruck logging (`R`)
- finish activity flow with confirmation
- ZIP export containing both CSV and JSON

### Review

- current-session analytics view
- work/rest/ratio/phase KPIs
- BIP duration distribution
- phase-count distribution by task
- read-only task review table
- export from the review page

### Editor

- import existing CSV, JSON, or ZIP exports
- rebuild tasks, BIPs, and rucks from flat export rows
- adjust task start and end times
- rename imported tasks
- align task start to first BIP and end to last BIP
- re-export edited sessions as CSV, JSON, or ZIP

## Repo Structure

- `index.html`: Logger page
- `review.html`: Review page
- `editor.html`: Editor page
- `styles.css`: shared styling for all pages
- `app.js`: live logger logic and export pipeline
- `review.js`: review rendering and export pipeline
- `editor.js`: import, task editing, and re-export pipeline
- `docs/export-schema.md`: export contract and column definitions

## Run Locally

From the project root:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Pages:

- Logger: `http://localhost:8000/index.html`
- Review: `http://localhost:8000/review.html`
- Editor: `http://localhost:8000/editor.html`

## Validate Locally

```bash
node --check app.js
node --check review.js
node --check editor.js
```

## Deploy

The app is configured to work as a static GitHub Pages site from the repository root. Push to `main` and GitHub Pages can serve it directly.

## Export Format

Exports are flat and analysis-oriented.

- CSV: one flat table
- JSON: metadata plus `columns` and `rows`
- ZIP: one folder containing both export files

Current shared export columns:

1. `activity_id`
2. `activity_name`
3. `entity_type`
4. `task_id`
5. `task_name`
6. `bip_id`
7. `bip_name`
8. `ruck_id`
9. `ruck_count`
10. `start_time_unix_ms`
11. `end_time_unix_ms`
12. `start_time_seconds`
13. `end_time_seconds`
14. `ruck_time_unix_ms`
15. `ruck_start_time_unix_ms`
16. `ruck_end_time_unix_ms`
17. `ruck_time_seconds`
18. `ruck_start_time_seconds`
19. `ruck_end_time_seconds`
20. `duration_seconds`
21. `pre_dead_ball_seconds`
22. `post_dead_ball_seconds`

See [docs/export-schema.md](./docs/export-schema.md) for full definitions and row-type behavior.

## Notes For iPhone And iPad

- Data stays in browser storage until reset or browser storage is cleared.
- Safari downloads exports to the normal Downloads / Files flow.
- ZIP is used instead of direct folder download because browsers do not reliably allow arbitrary folder creation from a static web app.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
