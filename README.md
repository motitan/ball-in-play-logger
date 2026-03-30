# Ball In Play Logger

Public static web app for logging rugby activity blocks with nested task and BIP structure. The app is designed for iPhone and iPad use, keeps the current session auto-saved in the browser, and exports CSV and JSON files whose names start with the activity name.

## Features

- Large live match clock with `Play` and `Pause`
- Activity name, period name, and next task name inputs
- `Start Task` / `End Task` workflow
- Nested `Start BIP` / `End BIP` workflow inside the active task
- `Ruck` point events attached to the active task
- Interactive task visualization with clickable task bars, nested BIP bars, and ruck markers
- Auto-saved session state using browser `localStorage`
- Export to:
  - `activity-name-YYYYMMDD-HHMMSS.csv`
  - `activity-name-YYYYMMDD-HHMMSS.json`
- Fully static build with no backend and no ESP32 requirement

## Files

- `index.html`
- `styles.css`
- `app.js`
- `.impeccable.md`
- `.nojekyll`

## Run locally

1. Start a local server from this folder:

```bash
python3 -m http.server 8000
```

2. Open:

```text
http://localhost:8000
```

## Deploy on GitHub Pages

The app is already configured for GitHub Pages from the repository root. Push changes to `main` and Pages will serve the site.

## iPhone and iPad export behavior

- The app downloads files to the device's normal Downloads location in Safari / Files.
- A plain web app cannot reliably let the user choose any arbitrary folder on iPhone or iPad.
- Data stays on the device browser until you reset the session or clear browser storage.

## Session model

The browser stores:

- `activityName`
- `currentPeriod`
- `taskNameDraft`
- `clockState`
- `elapsedMs`
- `activeTaskId`
- `activeBipId`
- `tasks[]`
- `events[]`

Each task stores:

- `id`
- `name`
- `period`
- `startElapsedMs`
- `endElapsedMs`
- `bips[]`
- `rucks[]`
