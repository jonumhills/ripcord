import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Ripcord — Wallet Risk & Cover",
  description: "Score any wallet's drain risk, get a live quote, and get covered — submit a transaction ID, an automated adjuster decides in seconds.",
  version: "0.1.0",
  action: {
    default_popup: "index.html",
  },
  icons: {
    16: "icons/icon-16.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  permissions: ["storage"],
  // Lets the web app (e.g. ripcord.app/connect, opened via chrome.tabs.create from Onboarding.tsx)
  // message this extension directly with the connected wallet address — the standard MV3 pattern
  // for wallet-connect flows that a popup page can't do on its own (popups don't get window.ethereum
  // injected the way a normal tab does). Fill in your real deployed origin before shipping.
  externally_connectable: {
    matches: ["https://ripcord.app/*", "http://localhost:3000/*"],
  },
});
