import type { Surface } from "@/lib/useTheme";

interface ThemeToggleProps {
  surface: Surface;
  onToggle: () => void;
}

export function ThemeToggle({ surface, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Switch HUD / DOC surface"
      className="ef-btn"
    >
      {surface === "dark" ? "HUD" : "DOC"}
    </button>
  );
}
