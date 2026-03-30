# Ball In Play Logger

Public static web app for logging `Play`, `Pause`, and `Ruck` events during a rugby match. The app is designed for iPhone and iPad use, keeps the current session auto-saved in the browser, and exports both CSV and JSON files to the device.

## Features

- Large live match clock with `Play`, `Pause`, and `Ruck` actions
- Editable period label such as `First Half`
- Auto-saved session state using browser `localStorage`
- Event log with event index, type, period, elapsed time, and wall-clock timestamp
- Export to:
  - `match-log-YYYYMMDD-HHMMSS.csv`
  - `match-log-YYYYMMDD-HHMMSS.json`
- Fully static build with no backend and no ESP32 requirement

## Files

- `index.html`
- `styles.css`
- `app.js`
- `.impeccable.md`

## Run locally

1. Start a local server from this folder:

```bash
python3 -m http.server 8000
```

2. Open:

```text
http://localhost:8000
```

## Deploy for free on GitHub Pages

1. Create a GitHub repository for these files.
2. Push `index.html`, `styles.css`, `app.js`, and `.impeccable.md`.
3. In GitHub, open `Settings > Pages`.
4. Set:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
5. GitHub will publish a free public URL.

## iPhone and iPad export behavior

- The app downloads files to the device's normal Downloads location in Safari / Files.
- A plain web app cannot reliably let the user choose any arbitrary folder on iPhone or iPad.
- Data stays on the device browser until you reset the session or clear browser storage.

## Session model

The browser stores:

- `sessionId`
- `createdAt`
- `currentPeriod`
- `clockState`
- `elapsedMs`
- `lastStartedAt`
- `events[]`

Each event stores:

- `index`
- `type`
- `period`
- `elapsedMs`
- `createdAt`
