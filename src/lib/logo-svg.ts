import "server-only";
import { CORE, FLAME } from "@/components/Logo";

// Same drawing as a standalone SVG string, for server-rendered images (Satori).
export const SOUL_FLAME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 8 96 98"><defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".33" stop-color="#ff8a3d"/><stop offset=".66" stop-color="#ffe14d"/><stop offset="1" stop-color="#7dff6b"/></linearGradient></defs><path d="${FLAME}" fill="url(#f)" stroke="#140a24" stroke-width="4.5" stroke-linejoin="round"/><path d="${CORE}" fill="#fff" opacity=".85"/><ellipse cx="49" cy="72" rx="7" ry="8" fill="#140a24"/><ellipse cx="71" cy="72" rx="7" ry="8" fill="#140a24"/><circle cx="51.5" cy="69" r="2.6" fill="#fff"/><circle cx="73.5" cy="69" r="2.6" fill="#fff"/><ellipse cx="40" cy="83" rx="5" ry="3.2" fill="#ff5fa8" opacity=".9"/><ellipse cx="80" cy="83" rx="5" ry="3.2" fill="#ff5fa8" opacity=".9"/><path d="M55 84q5 4 10 0" stroke="#140a24" stroke-width="3.2" fill="none" stroke-linecap="round"/></svg>`;

export const SOUL_FLAME_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(SOUL_FLAME_SVG).toString("base64")}`;

// The flame with no face: a frame for the Aura number.
export const AURA_FLAME_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 8 96 98"><defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".33" stop-color="#ff8a3d"/><stop offset=".66" stop-color="#ffe14d"/><stop offset="1" stop-color="#7dff6b"/></linearGradient></defs><path d="${FLAME}" fill="url(#f)" stroke="#140a24" stroke-width="4.5" stroke-linejoin="round"/><path d="${CORE}" fill="#fff" opacity=".92"/></svg>`,
).toString("base64")}`;

// The Soul Card header flame, as drawn in the Figma designs: one tall tongue,
// a left lobe and a small right tongue, with a left-to-right gradient.
export const FLAT_FLAME_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 33"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ea4c89"/><stop offset=".3" stop-color="#f7931e"/><stop offset=".42" stop-color="#f8a41c"/><stop offset=".62" stop-color="#ffe866"/><stop offset="1" stop-color="#bff35a"/></linearGradient></defs><path d="M13.5 33C6 33 0 28.5 0 21.5C0 15 3.5 10 6.5 7C6.3 10.5 7 13.8 8.7 15.5C8.5 9 10.5 3.5 12.8 0C15.5 4 19.5 9 20 14.7C21.5 12.5 23 10 23.7 7.7C26 11 27 16 27 21.5C27 28.5 21 33 13.5 33Z" fill="url(#f)"/></svg>`,
).toString("base64")}`;
