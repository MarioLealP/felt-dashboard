import { afterEach, describe, expect, it, vi } from "vitest";

import { type Notice, subscribe } from "@/lib/stream";

class FakeSource {
  static last: FakeSource | null = null;
  handlers = new Map<string, (e: MessageEvent<string>) => void>();
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSource.last = this;
  }
  addEventListener(name: string, fn: (e: MessageEvent<string>) => void) {
    this.handlers.set(name, fn);
  }
  fire(name: string, data = "{}") {
    this.handlers.get(name)?.({ data } as MessageEvent<string>);
  }
  close() {
    this.closed = true;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("the live stream", () => {
  it("shares one connection and turns events into notices", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const a: Notice[] = [];
    const b: Notice[] = [];
    const offA = subscribe((n) => a.push(n));
    const offB = subscribe((n) => b.push(n));
    const source = FakeSource.last as FakeSource;
    expect(source.url).toBe("/v1/app/stream");
    source.fire("line", JSON.stringify({ id: 9, role: "assistant", kind: "remark" }));
    source.fire("asides");
    expect(a).toEqual([
      { type: "line", id: 9, role: "assistant", kind: "remark" },
      { type: "asides" },
    ]);
    expect(b).toEqual(a);
    offA();
    expect(source.closed).toBe(false);
    offB();
    expect(source.closed).toBe(true);
  });
});
