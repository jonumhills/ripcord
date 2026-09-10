"use client";

// Used by app/connect/page.tsx after a successful wallet connect, to hand the address back to
// the extension popup that opened this tab. Requires the extension's id — grab it from
// chrome://extensions once you've loaded the unpacked build, and set it as an env var.
const EXTENSION_ID = process.env.NEXT_PUBLIC_RIPCORD_EXTENSION_ID ?? "";

export function notifyExtensionOfConnectedWallet(address: string) {
  if (!EXTENSION_ID) {
    console.warn("[extensionBridge] NEXT_PUBLIC_RIPCORD_EXTENSION_ID not set — skipping");
    return;
  }
  const chromeRuntime = (window as any).chrome?.runtime;
  if (!chromeRuntime?.sendMessage) return; // no extension installed / not Chrome — fine, page still works standalone

  chromeRuntime.sendMessage(EXTENSION_ID, { type: "RIPCORD_WALLET_CONNECTED", address });
}
