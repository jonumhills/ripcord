# Ripcord extension

Manifest V3, Vite + React + CRXJS. Deliberately three screens only — onboarding (add/connect wallets), risk assessment, and quote. Binding and payout live on the website, not here.

## Status

`npm install` + `npx tsc --noEmit` + `npm run build` all verified clean (2026-09-11) — this package went untouched for a while after the initial scaffold, so this was its first real build check of the session, not just written and assumed to work.

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

Generated placeholders already in `public/icons/` (`icon-16.png`, `icon-48.png`, `icon-128.png`) — a rounded square in the primary green `#33e667` with a simple ripcord-pull mark, matching the design system. The build genuinely fails without these (`ENOENT: Could not load manifest asset "icons/icon-16.png"`, confirmed live) — not just a cosmetic gap. Swap for real artwork before publishing to the Chrome Web Store; fine as-is for the hackathon demo.

## Before the demo

- Set `VITE_BACKEND_URL` to your deployed Railway URL if you're not running the backend locally.
- Confirm `externally_connectable` in `manifest.config.ts` includes your actual deployed web URL, not just `localhost`.
