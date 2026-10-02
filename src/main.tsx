import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Latin + Latin-ext only (English, Portuguese): the full Japanese ranges
// would put ~670 KB of @font-face rules in the CSS for nothing.
import "@fontsource/zen-maru-gothic/latin-500.css";
import "@fontsource/zen-maru-gothic/latin-ext-500.css";
import "@fontsource/zen-maru-gothic/latin-700.css";
import "@fontsource/zen-maru-gothic/latin-ext-700.css";
import "@fontsource/zen-maru-gothic/latin-900.css";
import "@fontsource/zen-maru-gothic/latin-ext-900.css";
import "@fontsource/klee-one/latin-400.css";
import "@fontsource/klee-one/latin-ext-400.css";
import "@fontsource/klee-one/latin-600.css";
import "@fontsource/klee-one/latin-ext-600.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/notebook.css";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("index.html is missing #root");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
