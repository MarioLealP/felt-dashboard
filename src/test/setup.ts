import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// Vitest doesn't auto-run Testing Library's cleanup between tests the
// way Jest's environment integration does — without this, a component
// rendered in one test stays mounted into the next, which silently
// turns getByText/getByRole into "found multiple elements" failures the
// moment more than one test in a file renders the same component.
afterEach(() => {
  cleanup();
});
