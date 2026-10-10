import { useId } from "react";
import { cn } from "@/lib/utils";
import { CORE, FLAME } from "./Logo";

// The Soul flame without its face: the Aura score sits where the face would be.
// The glow behind it takes the Chog's tier colour.
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
      <svg viewBox="12 8 96 98" className="relative size-full" aria-hidden>
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff3d9a" />
            <stop offset=".33" stopColor="#ff8a3d" />
            <stop offset=".66" stopColor="#ffe14d" />
            <stop offset="1" stopColor="#7dff6b" />
          </linearGradient>
        </defs>
        <path d={FLAME} fill={`url(#a${id})`} stroke="#140a24" strokeWidth="4.5" strokeLinejoin="round" />
        <path d={CORE} fill="#ffffff" opacity=".92" />
      </svg>
      {/* the number lives in the flame's core, where the face was */}
      <div className="absolute inset-x-0 top-[44%] bottom-[6%] flex flex-col items-center justify-center text-[#140a24]">
        <span className={cn("font-display leading-none", numberClass)}>{score ?? "…"}</span>
      </div>
    </div>
  );
}
