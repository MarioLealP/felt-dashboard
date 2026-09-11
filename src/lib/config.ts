/** Never hardcoded — set via .env (Vite's VITE_ prefix), same
 * no-hardcoding discipline as the rest of Felt. */
export const FELT_CORE_URL: string =
  (import.meta.env.VITE_FELT_CORE_URL as string | undefined) ?? "http://192.168.1.110:8420";
