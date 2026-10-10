import { useId } from "react";

// The Soul flame: a rainbow flame with a Chog face. No background, so it sits
// on anything. Keep in sync with src/app/icon.svg and src/lib/logo-svg.ts.
export default function Logo({ className, title = "Chog Souls" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="12 8 96 98" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`f${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff3d9a" />
          <stop offset=".33" stopColor="#ff8a3d" />
          <stop offset=".66" stopColor="#ffe14d" />
          <stop offset="1" stopColor="#7dff6b" />
        </linearGradient>
      </defs>
      <path d={FLAME} fill={`url(#f${id})`} stroke="#140a24" strokeWidth="4.5" strokeLinejoin="round" />
      <path d={CORE} fill="#ffffff" opacity=".85" />
      <ellipse cx="49" cy="72" rx="7" ry="8" fill="#140a24" />
      <ellipse cx="71" cy="72" rx="7" ry="8" fill="#140a24" />
      <circle cx="51.5" cy="69" r="2.6" fill="#fff" />
      <circle cx="73.5" cy="69" r="2.6" fill="#fff" />
      <ellipse cx="40" cy="83" rx="5" ry="3.2" fill="#ff5fa8" opacity=".9" />
      <ellipse cx="80" cy="83" rx="5" ry="3.2" fill="#ff5fa8" opacity=".9" />
      <path d="M55 84q5 4 10 0" stroke="#140a24" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export const FLAME =
  "M60 15c4 11 15 14 15 27 6-5 7-12 5-18 11 7 18 20 18 35 0 22-17 39-38 39S22 81 22 59c0-13 6-23 15-30 0 6 2 11 7 14 0-13 8-21 16-28z";
export const CORE =
  "M60 46c3 7 10 9 10 17 4-3 4-7 4-10 6 5 9 12 9 19 0 13-10 22-23 22s-23-9-23-22c0-7 3-13 8-17 0 4 1 6 4 8 0-8 6-12 11-17z";
