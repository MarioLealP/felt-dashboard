import { useCallback, useEffect, useState } from "react";

/** HUD = the dark operating surface, DOC = the light document surface. */
export type Surface = "dark" | "light";

const STORAGE_KEY = "ef-theme";

function readStored(): Surface {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "dark" || value === "light") {
      return value;
    }
  } catch {
    // private window / storage disabled — fall through to the default
  }
  return "dark";
}

/**
 * Owns the HUD ⇄ DOC surface: reflects it onto `<html data-theme>` and
 * remembers the choice per browser. Endfield is dark-first, so the default
 * (and the SSR-safe `index.html` value) is `dark`.
 */
export function useTheme() {
  const [surface, setSurface] = useState<Surface>(readStored);

  useEffect(() => {
    document.documentElement.dataset.theme = surface;
    try {
      localStorage.setItem(STORAGE_KEY, surface);
    } catch {
      // best-effort persistence only
    }
  }, [surface]);

  const toggle = useCallback(() => {
    setSurface((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { surface, setSurface, toggle } as const;
}
