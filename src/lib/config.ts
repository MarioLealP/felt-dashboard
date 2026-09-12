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
