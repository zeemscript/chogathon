import { useId } from "react";
import { cn } from "@/lib/utils";
import { CORE, FLAME } from "./Logo";

const EMBERS = [
  { left: "30%", delay: "0s", dx: "-6px", color: "#ffe14d" },
  { left: "62%", delay: ".8s", dx: "5px", color: "#ff8a3d" },
  { left: "46%", delay: "1.6s", dx: "2px", color: "#ff3d9a" },
];

// The Soul flame without its face, burning: the Aura score sits where the face
// would be. A glow in the Chog's tier colour sits behind it.
export default function AuraFlame({
  score,
  glow,
  className,
  numberClass = "text-3xl",
}: {
  score?: number | string;
  glow: string;
  className?: string;
  numberClass?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={cn("relative shrink-0", className)}>
      <div className="absolute inset-[14%] top-[30%] rounded-full blur-xl" style={{ background: glow }} />
      {/* back flame: a softer, slower tongue of fire behind the main one */}
      <svg viewBox="12 8 96 98" className="absolute inset-0 size-full origin-bottom animate-flicker-slow blur-[2px]" aria-hidden>
        <path d={FLAME} fill="#ff3d9a" opacity=".55" />
      </svg>
      {/* main flame */}
      <svg viewBox="12 8 96 98" className="relative size-full origin-bottom animate-flicker" aria-hidden>
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff3d9a" />
            <stop offset=".33" stopColor="#ff8a3d" />
            <stop offset=".66" stopColor="#ffe14d" />
            <stop offset="1" stopColor="#7dff6b" />
          </linearGradient>
          <radialGradient id={`c${id}`} cx=".5" cy=".62" r=".6">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".55" stopColor="#fff6c4" />
            <stop offset="1" stopColor="#ffd84d" />
          </radialGradient>
        </defs>
        <path d={FLAME} fill={`url(#a${id})`} stroke="#140a24" strokeWidth="4.5" strokeLinejoin="round" />
        <path d={CORE} fill={`url(#c${id})`} />
      </svg>
      {/* embers rising */}
      {EMBERS.map((e) => (
        <span
          key={e.left}
          className="absolute bottom-[30%] size-1 animate-ember rounded-full"
          style={{ left: e.left, background: e.color, boxShadow: `0 0 6px ${e.color}`, animationDelay: e.delay, ["--dx" as string]: e.dx }}
        />
      ))}
      {/* the score: white with a dark outline and a hot glow, like a sticker */}
      <div className="absolute inset-x-0 top-[44%] bottom-[6%] flex items-center justify-center">
        <span
          className={cn("font-display leading-none text-white", numberClass)}
          style={{
            textShadow:
              "-2px -2px 0 #140a24, 2px -2px 0 #140a24, -2px 2px 0 #140a24, 2px 2px 0 #140a24, 0 2px 0 #140a24, 0 -2px 0 #140a24, 2px 0 0 #140a24, -2px 0 0 #140a24, 0 0 14px rgba(255,61,154,.9)",
          }}
        >
          {score ?? "…"}
        </span>
      </div>
    </div>
  );
}
