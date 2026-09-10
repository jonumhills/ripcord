// chrome.storage.local persistence — an MV3 popup unmounts every time it closes, so anything
// kept only in React state disappears between clicks. This keeps the address list around.

const KEY = "ripcord.addresses";

export async function loadAddresses(): Promise<string[]> {
  const result = await chrome.storage.local.get(KEY);
  return result[KEY] ?? [];
}

export async function saveAddresses(addresses: string[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: addresses });
}
