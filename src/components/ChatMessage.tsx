export interface Message {
  role: "user" | "assistant";
  text: string;
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
        <div className="mt-1 text-sm whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}
