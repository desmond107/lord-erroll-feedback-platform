import Image from "next/image";

export function Crest({ size = 96, priority = false, className = "" }: { size?: number; priority?: boolean; className?: string }) {
  // Source crest is 328×372.
  return (
    <Image
      src="/brand/crest.png"
      alt="The Lord Erroll crest"
      width={size}
      height={Math.round((size * 372) / 328)}
      priority={priority}
      className={className}
    />
  );
}

export function Fleur({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
      <path d="M32 3c-5 6-7 12-7 18 0 5 3 9 7 12 4-3 7-7 7-12 0-6-2-12-7-18Zm-2 32c-4-5-9-8-15-8-5 0-9 3-9 8 0 4 3 7 7 7 3 0 5-2 5-5-2 1-5 0-5-2 0-3 3-4 6-4 5 0 8 4 9 8h2Zm4 0c4-5 9-8 15-8 5 0 9 3 9 8 0 4-3 7-7 7-3 0-5-2-5-5 2 1 5 0 5-2 0-3-3-4-6-4-5 0-8 4-9 8h-2ZM20 38h24v4H20zm9 5h6c0 6 2 11 6 15H23c4-4 6-9 6-15Z" />
    </svg>
  );
}

export function CrownIcon({ filled, className = "h-10 w-10" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 40" className={className} aria-hidden="true">
      <path
        d="M5 14 14 22 24 6l10 16 9-8-4 20H9L5 14Z"
        fill={filled ? "url(#crownGold)" : "none"}
        stroke={filled ? "#9c7a2b" : "currentColor"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="9" y="34" width="30" height="4" rx="1" fill={filled ? "#b48a33" : "none"} stroke={filled ? "#9c7a2b" : "currentColor"} strokeWidth="2" />
      {filled && (
        <>
          <circle cx="24" cy="6" r="2.4" fill="#a32a2a" />
          <circle cx="5" cy="14" r="2" fill="#e8cf86" />
          <circle cx="43" cy="14" r="2" fill="#e8cf86" />
          <circle cx="24" cy="27" r="2" fill="#1f5e3a" />
        </>
      )}
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d78f" />
          <stop offset="1" stopColor="#c09236" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function GoldRule({ className = "" }: { className?: string }) {
  return (
    <div className={`gold-rule ${className}`} aria-hidden="true">
      <Fleur className="h-3.5 w-3.5" />
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <div className="font-serif text-[1.65rem] leading-none font-semibold tracking-wide text-ink">The Lord Erroll</div>
      <div className="mt-1 text-[0.65rem] tracking-[0.32em] text-gold-ink uppercase">Gourmet Restaurant</div>
    </div>
  );
}
