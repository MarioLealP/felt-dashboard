interface SlabProps {
  kicker: string;
  headline: string;
  detail?: string;
  /** faint oversized word behind the slab. */
  watermark?: string;
}

/** The big safety-yellow structural slab (`.ef-slab`) — one headline per view. */
export function Slab({ kicker, headline, detail, watermark }: SlabProps) {
  return (
    <div className="ef-slab">
      <div className="ef-mono text-[0.6875rem] font-bold">{kicker}</div>
      <div className="font-display text-4xl leading-none font-bold uppercase">{headline}</div>
      {detail ? <div className="ef-mono text-xs">{detail}</div> : null}
      {watermark ? <span className="ef-slab__wm">{watermark}</span> : null}
    </div>
  );
}
