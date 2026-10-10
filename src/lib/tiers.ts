// Visual style per Aura tier, shared by server and client components.
export const TIER_STYLE: Record<string, { ring: string; text: string; glow: string }> = {
  Dormant: { ring: "from-zinc-600 to-zinc-800", text: "text-zinc-400", glow: "rgba(161,161,170,.25)" },
  Awakened: { ring: "from-chog-soft to-chog", text: "text-chog-soft", glow: "rgba(131,110,249,.55)" },
  Known: { ring: "from-cyan-300 to-chog-cyan", text: "text-cyan-300", glow: "rgba(34,211,238,.5)" },
  Famous: { ring: "from-pink-300 to-chog-pink", text: "text-pink-300", glow: "rgba(236,72,153,.55)" },
  "Legendary Soul": { ring: "from-amber-200 to-chog-gold", text: "text-chog-gold", glow: "rgba(245,158,11,.6)" },
};
