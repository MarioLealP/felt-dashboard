export interface Message {
  role: "user" | "assistant";
  text: string;
}

// Excludes common trailing punctuation (.,!?:;)]}'") from the match so a
// URL ending a sentence ("check out https://x.com.") doesn't drag the
// period into the href (2026-09-14 review finding).
const URL_RE = /(https?:\/\/[^\s]+[^\s.,!?:;)\]}'"])/g;

// A few replies (generate_image's "Image ready: <url>") carry a real
// link Mario needs to actually click, not just read as plain text —
// this only ever splits on bare http(s) URLs, nothing fancier than
// that.
function renderWithLinks(text: string) {
  // split() with one capturing group always alternates
  // [non-match, match, non-match, match, ...] starting at index 0 — odd
  // indices are the captured URLs. (Testing each part against URL_RE
  // directly would be wrong: a global-flag regex's .test() carries
  // lastIndex state across calls, silently flipping true/false based on
  // call count rather than the part's actual content.)
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      // eslint-disable-next-line react/no-array-index-key -- static split of one fixed string, never reordered
      <a key={i} href={part} target="_blank" rel="noreferrer" className="underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function ChatMessage({ role, text }: Message) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`ef-card max-w-[75%] px-4 py-3 ${isUser ? "rail" : ""}`}
        data-active={isUser ? true : undefined}
      >
        <div className="ef-mono text-[0.6875rem] opacity-60">{isUser ? "YOU" : "FELT"}</div>
        <div className="mt-1 text-sm whitespace-pre-wrap">{renderWithLinks(text)}</div>
      </div>
    </div>
  );
}
