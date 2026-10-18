/** WP-42.5: the shopping list in the app. felt-core's existing
 * /v1/shopping-list routes (SSO-gated since the old phone page), same
 * origin, so the SSO cookie is all they need. Since 2026-10-18 felt-core
 * passes them through to Home Assistant's todo list, so ids are HA's uids. */

export interface Item {
  id: string;
  text: string;
  checked: boolean;
}

export function parseItems(data: unknown): Item[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((r: Record<string, unknown>) =>
    (typeof r?.id === "string" || typeof r?.id === "number") && typeof r.text === "string"
      ? [{ id: String(r.id), text: r.text, checked: r.checked === true || r.checked === 1 }]
      : [],
  );
}

async function shopping(path = "", init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/v1/shopping-list${path}`, { credentials: "same-origin", ...init });
  if (response.status === 401) throw new Error("Your SSO session ended. Reload to sign in again.");
  if (!response.ok)
    throw new Error(`Felt didn't answer (${response.status}). Try again in a moment.`);
  return response.json();
}

export async function getItems(): Promise<Item[]> {
  return parseItems(await shopping());
}

export async function addItem(text: string): Promise<void> {
  await shopping("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function setChecked(id: string, checked: boolean): Promise<void> {
  await shopping(`/${id}?checked=${checked}`, { method: "PATCH" });
}

export async function removeItem(id: string): Promise<void> {
  await shopping(`/${id}`, { method: "DELETE" });
}

export async function clearChecked(): Promise<void> {
  await shopping("/checked", { method: "DELETE" });
}
