# Ripcord extension

Manifest V3, Vite + React + CRXJS. Deliberately three screens only — onboarding (add/connect wallets), risk assessment, and quote. Binding and payout live on the website, not here.

## Setup

```bash
npm install
cp .env.example .env   # point VITE_BACKEND_URL at your local or Railway backend
npm run dev
```

Load it in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `extension/dist` (run `npm run build` first, or use `npm run dev` with CRXJS's HMR, which writes to `dist/` live).

## Why "connect wallet" opens a new tab

A popup page (`chrome-extension://...`) never gets `window.ethereum` injected — MetaMask's content script only runs on real http(s) pages. So `openWalletConnectTab()` (`src/lib/wallet.ts`) opens the web app's `/connect` page in a normal tab, where the connect flow works exactly like any dapp, and that page messages the address back to the extension via `chrome.runtime.sendMessage` — allowed because `externally_connectable` in `manifest.config.ts` lists the web app's origin. Same pattern is used for "Get covered," which hands off to the web app's `/bind` page since binding needs an on-chain signature too.

## Icons

`manifest.config.ts` references `icons/icon-16.png`, `icon-48.png`, `icon-128.png` under `public/icons/` — add real PNGs there before loading the extension (a placeholder square in the primary green `#33e667` is enough for a demo).

## Before the demo

- Set `VITE_BACKEND_URL` to your deployed Railway URL if you're not running the backend locally.
- Confirm `externally_connectable` in `manifest.config.ts` includes your actual deployed web URL, not just `localhost`.
