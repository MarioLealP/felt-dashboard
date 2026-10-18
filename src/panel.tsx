/** The Felt app as Home Assistant's "Felt" sidebar panel (felt-core's HA
 * integration, ha/custom_components/felt/panel.py): Talk and Margins in the
 * HA app, everything else is native HA. HA loads this module in an iframe of
 * its own, so the notebook keeps its own document, CSS and #hash routing, and
 * hands the element `hass` - its logged-in connection. Every call goes over
 * that websocket to the Felt integration, which relays to felt-core with its
 * own token: no Felt credential is ever in this page. */

import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

import "./styles/fonts.css";
import "./styles/notebook.css";
import { App } from "./App";
import type { PageName } from "./lib/route";
import { setTransport } from "./lib/transport";

const PAGES: readonly PageName[] = ["talk", "margins"];

/** The bit of HA's frontend object this page uses. */
interface Hass {
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  connection: {
    subscribeMessage<T>(
      callback: (message: T) => void,
      msg: Record<string, unknown>,
    ): Promise<() => Promise<void>>;
  };
}

class FeltPanel extends HTMLElement {
  #hass: Hass | null = null;
  #root: Root | null = null;
  #narrow = false;

  /** HA: phone width, its sidebar is hidden - the page needs its own menu button */
  set narrow(narrow: boolean) {
    if (narrow === this.#narrow) return;
    this.#narrow = narrow;
    this.#render();
  }

  set hass(hass: Hass) {
    // HA hands over a fresh object on every state change; the connection is the same
    const first = this.#hass === null;
    this.#hass = hass;
    if (first) this.#start();
  }

  #start() {
    setTransport({
      call: (path, method, body) => {
        if (!this.#hass) return Promise.reject(new Error("Home Assistant isn't connected."));
        return this.#hass
          .callWS<unknown>({ type: "felt/app/call", method, path, ...(body ? { body } : {}) })
          .catch(() => {
            throw new Error("Felt didn't answer. Try again in a moment.");
          });
      },
      stream: (onEvent) => {
        let unsubscribe: (() => Promise<void>) | null = null;
        let closed = false;
        void this.#hass?.connection
          .subscribeMessage<{ event: string; data: unknown }>((m) => onEvent(m.event, m.data), {
            type: "felt/app/stream",
          })
          .then((unsub) => {
            if (closed) void unsub();
            else unsubscribe = unsub;
          });
        return () => {
          closed = true;
          void unsubscribe?.();
        };
      },
    });
    // the CSS was built next to this module (vite.panel.config.ts)
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./felt-panel.css", import.meta.url).href;
    document.head.append(link);
    const container = document.createElement("div");
    container.id = "root";
    this.append(container);
    // HA's iframe catches every same-origin link click and turns it into an HA
    // route change; the notebook's flags are #hash links, so take those first
    this.addEventListener("click", (e) => {
      const href = (e.target as Element | null)?.closest?.("a")?.getAttribute("href");
      if (href?.startsWith("#")) {
        e.preventDefault();
        window.location.hash = href;
      }
    });
    this.#root = createRoot(container);
    this.#render();
  }

  #toggleMenu = () => {
    // HA's iframe forwards this one to the real sidebar
    this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
  };

  #render() {
    this.#root?.render(
      <StrictMode>
        <App pages={PAGES} onMenu={this.#narrow ? this.#toggleMenu : undefined} />
      </StrictMode>,
    );
  }

  disconnectedCallback() {
    this.#root?.unmount();
    this.#root = null;
    this.#hass = null;
    setTransport(null);
    this.replaceChildren();
  }
}

if (!customElements.get("felt-panel")) customElements.define("felt-panel", FeltPanel);
