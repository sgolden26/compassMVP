# EW Signal App (MVP)

Single-screen EW signal app for on-ground soldiers: threat level (1–10), primary threat label, direction, and compass. Built with TypeScript; runs in browser and is ATAK WebView compatible.

## Run locally

```bash
npm install
npm run build
python3 serve.py dist
```

Then open the URL printed (e.g. `http://localhost:8000`). Or one command:

```bash
npm run start
```

(Requires Python for `serve.py`.)

## Project structure

- **`src/`** – TypeScript source
  - `config.ts` – High-confidence threshold, threat level scale
  - `data-provider.ts` – `Threat`, `DeviceState` types; `DummyDataProvider`, `RestDataProvider`, `WebSocketDataProvider`
  - `app.ts` – UI, compass, render loop
- **`dist/`** – Build output (generated). Serve this folder.
- **`index.html`**, **`styles.css`**, **`sw.js`** – Copied into `dist/` on build.

## Switching to real data

In `src/app.ts`, replace `DummyDataProvider` with:

- `RestDataProvider` – pass `{ baseUrl, threatsUrl?, deviceUrl?, pollMs? }`
- `WebSocketDataProvider` – pass `{ url: 'wss://...' }`

Ensure API responses match: `threats` (array of `{ id, label, confidence, bearing }`), `device` (`{ heading, latitude?, longitude? }`).

## Config

Edit `src/config.ts`: `HIGH_CONFIDENCE_THRESHOLD` (0–1), `THREAT_LEVEL_MIN` / `THREAT_LEVEL_MAX`. Rebuild after changes.
