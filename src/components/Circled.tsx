import { useEffect, useRef, type ReactNode } from "react";
import { annotate } from "rough-notation";

import { inkDuration, seenMarks, withSeed } from "@/lib/ink";

/** Raspberry ink around something that needs him (the Systems page's one
 * real problem): seeded so the circle keeps its shape, drawn once per
 * device ("Ink should only hit once"). Not one of her marks, so nothing is
 * reported to the server. */
export function Circled({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = !seenMarks.has(id);
    const box = el.getBoundingClientRect();
    const annotation = withSeed(id, () =>
      annotate(el, {
        type: "circle",
        color: "#da4167",
        strokeWidth: 1.8,
        padding: 7,
        animate: first,
        animationDuration: inkDuration(box.width, box.height, "circle"),
        iterations: 1,
      }),
    );
    const timer = setTimeout(
      () => {
        withSeed(id, () => annotation.show());
        if (first) seenMarks.add(id);
      },
      first ? 500 : 0,
    );
    return () => {
      clearTimeout(timer);
      annotation.remove();
    };
  }, [id]);
  return <span ref={ref}>{children}</span>;
}
