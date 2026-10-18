import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The HA panel build (src/panel.tsx): one ES module + its CSS (fonts inlined),
// copied into felt-core's ha/custom_components/felt/panel/ and served by HA at
// /felt_panel/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src/", import.meta.url).pathname,
    },
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist-panel",
    lib: {
      entry: "src/panel.tsx",
      formats: ["es"],
      fileName: () => "felt-panel.js",
      cssFileName: "felt-panel",
    },
  },
});
