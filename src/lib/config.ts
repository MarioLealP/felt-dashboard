/** Never hardcoded — set via .env (Vite's VITE_ prefix), same
 * no-hardcoding discipline as the rest of Felt. Fails loudly rather than
 * silently falling back to a real address (2026-09-12 finding: this used
 * to default to a real machine's actual IP, a real "no hardcoding"
 * violation the comment right above it was already warning against). */
const felt_core_url = import.meta.env.VITE_FELT_CORE_URL as string | undefined;
if (!felt_core_url) {
  throw new Error("VITE_FELT_CORE_URL is not set — copy .env.example to .env and fill it in.");
}
export const FELT_CORE_URL: string = felt_core_url;

/** WP-55: felt-core's API token (the server's FELT_API_TOKEN), sent as a
 * Bearer header on every felt-core request. Optional: unset sends none, which
 * works while felt-core has no token configured. Baked into the local build
 * only (the .env and dist/ are never committed). */
export const FELT_CORE_TOKEN: string | undefined =
  (import.meta.env.VITE_FELT_CORE_TOKEN as string | undefined) || undefined;

/** felt-animation is desktop-only and optional (2026-09-21) - unlike
 * FELT_CORE_URL this doesn't throw when unset, since chat should still
 * work without it (she just won't react/lipsync to typed messages). */
export const FELT_ANIMATION_URL: string =
  (import.meta.env.VITE_FELT_ANIMATION_URL as string | undefined) ?? "http://127.0.0.1:8421";
