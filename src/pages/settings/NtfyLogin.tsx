import { type FormEvent, useState } from "react";

import { connect, forgetLogin, savedLogin } from "@/lib/ntfy";

const FIELD =
  "font-hand text-ink focus:border-rasp min-h-10 min-w-0 border-0 border-b-[1.5px] border-[rgba(245,240,246,0.25)] bg-transparent px-0.5 text-[15px] outline-none";

/** Connect this device to ntfy once, so Systems still shows the alerts
 * when felt-core is down (WP-42.5). */
export function NtfyLogin() {
  const [login, setLogin] = useState(savedLogin);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await connect({ user: user.trim(), password });
      setLogin(savedLogin());
      setPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="ntfy" className="flex flex-col gap-1.5 pt-6 pl-[calc(var(--margin)+14px)]">
      <span className="text-[15px] font-black">Server alerts without me</span>
      <span className="font-hand text-xs text-[#9a909c]">
        connect this device to ntfy once, so Systems still shows the alerts when I'm down. it stays
        in this browser.
      </span>
      {login ? (
        <div className="font-hand flex items-center gap-4 text-sm">
          <span className="text-sage">connected as {login.user}</span>
          <button
            type="button"
            onClick={() => {
              forgetLogin();
              setLogin(null);
            }}
            className="text-pencil bg-transparent p-0 underline decoration-wavy underline-offset-4"
          >
            disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-end gap-3">
          <label className="sr-only" htmlFor="ntfy-user">
            ntfy user
          </label>
          <input
            id="ntfy-user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="ntfy user"
            autoComplete="username"
            className={`${FIELD} w-28`}
          />
          <label className="sr-only" htmlFor="ntfy-password">
            ntfy password
          </label>
          <input
            id="ntfy-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            className={`${FIELD} w-32`}
          />
          <button
            type="submit"
            disabled={busy || !user.trim() || !password}
            className="font-hand text-pencil bg-transparent p-0 text-sm underline decoration-wavy underline-offset-4 disabled:opacity-40"
          >
            {busy ? "checking…" : "connect"}
          </button>
        </form>
      )}
      {error ? <span className="font-hand text-rasp text-sm">{error}</span> : null}
    </section>
  );
}
