import "server-only";
import { CORE, FLAME } from "@/components/Logo";

// Same drawing as a standalone SVG string, for server-rendered images (Satori).
export const SOUL_FLAME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 8 96 98"><defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".33" stop-color="#ff8a3d"/><stop offset=".66" stop-color="#ffe14d"/><stop offset="1" stop-color="#7dff6b"/></linearGradient></defs><path d="${FLAME}" fill="url(#f)" stroke="#140a24" stroke-width="4.5" stroke-linejoin="round"/><path d="${CORE}" fill="#fff" opacity=".85"/><ellipse cx="49" cy="72" rx="7" ry="8" fill="#140a24"/><ellipse cx="71" cy="72" rx="7" ry="8" fill="#140a24"/><circle cx="51.5" cy="69" r="2.6" fill="#fff"/><circle cx="73.5" cy="69" r="2.6" fill="#fff"/><ellipse cx="40" cy="83" rx="5" ry="3.2" fill="#ff5fa8" opacity=".9"/><ellipse cx="80" cy="83" rx="5" ry="3.2" fill="#ff5fa8" opacity=".9"/><path d="M55 84q5 4 10 0" stroke="#140a24" stroke-width="3.2" fill="none" stroke-linecap="round"/></svg>`;

export const SOUL_FLAME_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(SOUL_FLAME_SVG).toString("base64")}`;
