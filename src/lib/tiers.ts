// Aura tiers (thresholds + looks), shared by server and client code.
export const TIERS = [
  { name: "Dormant", min: 0, social: 0 },
  { name: "Awakened", min: 25, social: 0 },
  { name: "Known", min: 100, social: 30 },
  { name: "Famous", min: 300, social: 150 },
  { name: "Legendary Soul", min: 800, social: 400 },
] as const;

export type TierName = (typeof TIERS)[number]["name"];

// Visual style per Aura tier, shared by server and client components.
export const TIER_STYLE: Record<string, { ring: string; text: string; glow: string; hex: string }> = {
  Dormant: { ring: "from-violet-300/70 to-zinc-600", text: "text-violet-200", glow: "rgba(169,155,252,.35)", hex: "#a99bfc" },
  Awakened: { ring: "from-chog-soft to-chog", text: "text-chog-soft", glow: "rgba(131,110,249,.55)", hex: "#836ef9" },
  Known: { ring: "from-cyan-300 to-chog-cyan", text: "text-cyan-300", glow: "rgba(34,211,238,.5)", hex: "#22d3ee" },
  Famous: { ring: "from-pink-300 to-chog-pink", text: "text-pink-300", glow: "rgba(236,72,153,.55)", hex: "#ec4899" },
  "Legendary Soul": { ring: "from-amber-200 to-chog-gold", text: "text-chog-gold", glow: "rgba(245,158,11,.6)", hex: "#f59e0b" },
};
