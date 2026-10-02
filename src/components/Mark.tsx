import { useEffect, useRef } from "react";
import { annotate } from "rough-notation";

import type { Mark as MarkData } from "@/lib/appApi";
import { inkDuration, seenMarks, withSeed } from "@/lib/ink";

const COLOR: Record<MarkData["type"], string> = {
  circle: "#da4167",
  underline: "#da4167",
  box: "#da4167",
  bracket: "#da4167",
  "strike-through": "#3a3440",
};

/** The words she marked, inked with Rough Notation: seeded so the shape
 * never changes, animated only the first time it's seen. */
export function Mark({ mark, children }: { mark: MarkData; children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = !seenMarks.has(mark.id);
    const box = el.getBoundingClientRect();
    const annotation = withSeed(mark.id, () =>
      annotate(el, {
        type: mark.type,
        color: COLOR[mark.type],
        strokeWidth: mark.type === "strike-through" ? 4 : 1.8,
        padding: mark.type === "circle" ? 7 : mark.type === "box" ? 3 : 2,
        animate: first,
        animationDuration: inkDuration(box.width, box.height, mark.type),
        iterations: mark.type === "circle" ? 1 : 2,
        multiline: true,
        brackets: ["left", "right"],
      }),
    );
    const timer = setTimeout(
      () => {
        withSeed(mark.id, () => annotation.show());
        if (first) seenMarks.add(mark.id);
      },
      first ? 700 : 0,
    );
    return () => {
      clearTimeout(timer);
      annotation.remove();
    };
  }, [mark.id, mark.type]);
  return <span ref={ref}>{children}</span>;
}
