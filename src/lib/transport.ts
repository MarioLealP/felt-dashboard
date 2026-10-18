/** How the app reaches felt-core. By default its own origin: /v1/app/* with
 * the SSO cookie (appApi.ts) and the /v1/app/stream EventSource (stream.ts).
 * Inside Home Assistant's Felt panel (src/panel.tsx), HA's own websocket
 * instead: the Felt integration relays to felt-core with its token, so the
 * page holds no Felt credential either way. */

export interface Transport {
  call(path: string, method: string, body?: unknown): Promise<unknown>;
  /** live notices as (event, data) until the returned function is called */
  stream(onEvent: (event: string, data: unknown) => void): () => void;
}

let current: Transport | null = null;

export function setTransport(transport: Transport | null) {
  current = transport;
}

export function getTransport(): Transport | null {
  return current;
}
