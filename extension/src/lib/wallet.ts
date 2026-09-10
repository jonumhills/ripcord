// A Manifest V3 popup does NOT get window.ethereum injected the way a normal tab does — MetaMask's
// content script only runs on http(s) pages, not on chrome-extension:// pages. So "connect wallet"
// from the popup works by opening the web app's /connect page in a real tab (where window.ethereum
// exists normally), and that page posts the resulting address back here via
// chrome.runtime.sendMessage, which `externally_connectable` in manifest.config.ts allows.

const WEB_CONNECT_URL = import.meta.env.VITE_WEB_CONNECT_URL ?? "http://localhost:3000/connect";

export function openWalletConnectTab() {
  chrome.tabs.create({ url: WEB_CONNECT_URL });
}

/** Call once, e.g. in App.tsx's top-level effect, to receive the address once the web tab connects. */
export function onWalletConnected(callback: (address: string) => void): () => void {
  const listener = (message: { type?: string; address?: string }) => {
    if (message?.type === "RIPCORD_WALLET_CONNECTED" && message.address) {
      callback(message.address);
    }
  };
  chrome.runtime.onMessageExternal.addListener(listener);
  return () => chrome.runtime.onMessageExternal.removeListener(listener);
}
