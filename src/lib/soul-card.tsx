import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { auraLeaderboard, getAura, type Aura } from "./aura";
import { getChogRaw } from "./chogs";
import { fetchIpfs } from "./ipfs";
import { buildPersonality } from "./personality";
import { supabaseAdmin } from "./supabase/server";
import { getRelations, listPosts } from "./town";

// The Soul Card: a 1200x630 share image (X large card / Open Graph) that sells
// a Chog's life story at a glance. Rendered with next/og (Satori: flexbox only).

export const CARD_SIZE = { width: 1200, height: 630 };

const fontDir = join(process.cwd(), "src/assets/fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "Koulen-400.woff")),
  readFile(join(fontDir, "Inter-400.woff")),
  readFile(join(fontDir, "Inter-600.woff")),
  readFile(join(fontDir, "JetBrainsMono-500.woff")),
]).then(([koulen, inter, interSemi, mono]) => [
  { name: "Koulen", data: koulen, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: interSemi, weight: 600 as const, style: "normal" as const },
  { name: "Mono", data: mono, weight: 500 as const, style: "normal" as const },
]);

// Tier palette (hex only: Satori doesn't read our CSS variables).
const TIER: Record<string, { a: string; b: string; text: string }> = {
  Dormant: { a: "#8b8ba0", b: "#52525e", text: "#d4d4dc" },
  Awakened: { a: "#a99bfc", b: "#836ef9", text: "#a99bfc" },
  Known: { a: "#67e8f9", b: "#22d3ee", text: "#67e8f9" },
  Famous: { a: "#f9a8d4", b: "#ec4899", text: "#f9a8d4" },
  "Legendary Soul": { a: "#fde68a", b: "#f59e0b", text: "#fbbf24" },
};

// Frame colour follows NFT rarity, so even a fresh Chog's card pops.
const RARITY: Record<string, { a: string; b: string; text: string }> = {
  Legendary: { a: "#fde68a", b: "#f59e0b", text: "#fbbf24" },
  Epic: { a: "#f9a8d4", b: "#ec4899", text: "#f9a8d4" },
  Rare: { a: "#67e8f9", b: "#22d3ee", text: "#67e8f9" },
  Uncommon: { a: "#c4b5fd", b: "#836ef9", text: "#c4b5fd" },
  Common: { a: "#a99bfc", b: "#6f52e8", text: "#a99bfc" },
};

// Satori can't decode the collection's WebP art, so convert to PNG at the
// size we draw it. Cached per token+size: bestie/nemesis avatars repeat a lot.
const art = new Map<string, string>();
async function artDataUrl(tokenId: number, px: number): Promise<string | undefined> {
  const key = `${tokenId}:${px}`;
  if (art.has(key)) return art.get(key);
  const chog = getChogRaw(tokenId);
  if (!chog) return;
  try {
    const res = await fetchIpfs(chog.image);
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(px, px).png().toBuffer();
    const url = `data:image/png;base64,${png.toString("base64")}`;
    if (art.size > 300) art.delete(art.keys().next().value!);
    art.set(key, url);
    return url;
  } catch (err) {
    console.warn(`soul card art ${tokenId}:`, err instanceof Error ? err.message : err);
    return;
  }
}

export type CardData = {
  tokenId: number;
  archetype: string;
  temperament: string[];
  tierName: string;
  aura: Aura;
  rank?: number;
  owners: number;
  quote?: string;
  quoteSource: "square" | "soul";
  bestie?: { tokenId: number; affinity: number };
  nemesis?: { tokenId: number; affinity: number; grudge: string | null };
};

export async function getCardData(tokenId: number): Promise<CardData> {
  const chog = getChogRaw(tokenId)!;
  const soul = buildPersonality(chog.traits);
  const [aura, board, relations, posts, history] = await Promise.all([
    getAura(tokenId),
    auraLeaderboard(1969),
    getRelations(tokenId).catch(() => []),
    listPosts({ tokenId, limit: 20 }).catch(() => []),
    supabaseAdmin().from("owner_history").select("id", { count: "exact", head: true }).eq("token_id", tokenId),
  ]);
  const rankIdx = board.findIndex((r) => r.tokenId === tokenId);
  const sorted = [...relations].sort((a, b) => b.affinity - a.affinity);
  const best = sorted[0] && sorted[0].affinity > 0 ? sorted[0] : undefined;
  const last = sorted.at(-1);
  const worst = last && last.affinity < 0 ? last : undefined;
  // Prefer its own spiciest post; fall back to what others say about it.
  const own = posts.filter((p) => p.token_id === tokenId);
  const posted = (own[0] ?? posts[0])?.content;
  // Nothing said yet? Let its soul speak: its signature quirk.
  const quirk = soul.quirks[0] && `Known for: ${soul.quirks[0]}.`;

  return {
    tokenId,
    archetype: soul.archetype,
    temperament: soul.temperament,
    tierName: chog.traits.Tier ?? "Chog",
    aura,
    rank: rankIdx >= 0 && aura.score > 0 ? rankIdx + 1 : undefined,
    owners: 1 + (history.count ?? 0),
    quote: posted ?? quirk,
    quoteSource: posted ? "square" : "soul",
    bestie: best && { tokenId: best.other_token_id, affinity: best.affinity },
    nemesis: worst && { tokenId: worst.other_token_id, affinity: worst.affinity, grudge: worst.grudge },
  };
}

const mono = { fontFamily: "Mono", fontSize: 15, letterSpacing: 2.5, textTransform: "uppercase" as const };

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: "Koulen", fontSize: 46, lineHeight: 1, color: "#f4f1fe" }}>{value}</div>
      <div style={{ ...mono, fontSize: 12, color: "rgba(244,241,254,.55)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Mini({ src, label, sub, color }: { src?: string; label: string; sub: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser
        <img src={src} width={50} height={50} style={{ borderRadius: 12, border: `2px solid ${color}` }} alt="" />
      ) : (
        <div style={{ width: 50, height: 50, borderRadius: 12, background: "#181330" }} />
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ ...mono, fontSize: 11, color }}>{sub}</div>
        <div style={{ fontFamily: "Koulen", fontSize: 26, lineHeight: 1.05, color: "#f4f1fe" }}>{label}</div>
      </div>
    </div>
  );
}

export async function renderSoulCard(tokenId: number): Promise<ImageResponse> {
  const d = await getCardData(tokenId);
  const [main, bestie, nemesis, fontList] = await Promise.all([
    artDataUrl(tokenId, 400),
    d.bestie ? artDataUrl(d.bestie.tokenId, 100) : undefined,
    d.nemesis ? artDataUrl(d.nemesis.tokenId, 100) : undefined,
    fonts,
  ]);
  const t = TIER[d.aura.tier] ?? TIER.Dormant;
  const r = RARITY[d.tierName] ?? RARITY.Common;
  const quote = d.quote && (d.quote.length > 120 ? `${d.quote.slice(0, 117)}…` : d.quote);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0e0b1a",
          fontFamily: "Inter",
          color: "#f4f1fe",
          overflow: "hidden",
        }}
      >
        {/* glow orbs */}
        <div style={{ position: "absolute", top: -260, left: -180, width: 760, height: 760, borderRadius: 999, background: `radial-gradient(circle, ${r.b}66 0%, transparent 65%)` }} />
        <div style={{ position: "absolute", bottom: -300, right: -160, width: 720, height: 720, borderRadius: 999, background: "radial-gradient(circle, #836ef955 0%, transparent 65%)" }} />
        <div style={{ position: "absolute", top: 40, right: 220, width: 360, height: 360, borderRadius: 999, background: "radial-gradient(circle, #ec489933 0%, transparent 65%)" }} />
        {/* fine grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "linear-gradient(rgba(244,241,254,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(244,241,254,.035) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* LEFT: the art */}
        <div style={{ display: "flex", position: "relative", width: 500, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              padding: 6,
              borderRadius: 34,
              background: `linear-gradient(135deg, ${r.a}, ${r.b})`,
              transform: "rotate(-4deg)",
              boxShadow: `0 0 80px ${r.b}99, 0 40px 80px rgba(0,0,0,.6)`,
            }}
          >
            {main ? (
              // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori
              <img src={main} width={400} height={400} style={{ borderRadius: 28 }} alt="" />
            ) : (
              <div style={{ width: 400, height: 400, borderRadius: 28, background: "#181330" }} />
            )}
          </div>
          <div
            style={{
              ...mono,
              position: "absolute",
              top: 92,
              left: 54,
              display: "flex",
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(14,11,26,.85)",
              border: `1px solid ${r.a}`,
              color: r.text,
              fontSize: 13,
              transform: "rotate(-4deg)",
            }}
          >
            {d.tierName}
          </div>
        </div>

        {/* RIGHT: the soul */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "48px 56px 40px 8px" }}>
          <div style={{ ...mono, display: "flex", alignItems: "center", gap: 10, color: "#a99bfc", fontSize: 14 }}>
            <div style={{ width: 9, height: 9, borderRadius: 9, background: "#a99bfc", boxShadow: "0 0 12px #a99bfc" }} />
            Chog Souls · Soul card
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 6 }}>
            <div style={{ fontFamily: "Koulen", fontSize: 118, lineHeight: 0.9, color: "#f4f1fe" }}>Chog</div>
            <div
              style={{
                fontFamily: "Koulen",
                fontSize: 118,
                lineHeight: 0.9,
                marginLeft: 22,
                backgroundImage: "linear-gradient(135deg, #a99bfc 0%, #836ef9 60%, #c084fc 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {`#${d.tokenId}`}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <div style={{ fontFamily: "Koulen", fontSize: 32, color: "#f4f1fe", marginRight: 6 }}>{d.archetype}</div>
            {d.temperament.slice(0, 3).map((x, i) => (
              <div
                key={x}
                style={{
                  ...mono,
                  fontSize: 12,
                  display: "flex",
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: i === 0 ? "1px solid rgba(255,255,255,.4)" : "1px solid rgba(169,155,252,.35)",
                  background: i === 0 ? "linear-gradient(135deg, #836ef9, #a855f7)" : "rgba(244,241,254,.04)",
                  color: i === 0 ? "#fff" : "#a99bfc",
                }}
              >
                {x}
              </div>
            ))}
          </div>

          {/* Aura block */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
              marginTop: 26,
              padding: "20px 24px",
              borderRadius: 22,
              background: "rgba(22,18,40,.85)",
              border: "1px solid rgba(169,155,252,.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 104,
                height: 104,
                borderRadius: 104,
                padding: 4,
                background: `linear-gradient(135deg, ${t.a}, ${t.b})`,
                boxShadow: `0 0 36px ${t.b}aa`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", borderRadius: 100, background: "#161228" }}>
                <div style={{ fontFamily: "Koulen", fontSize: 44, lineHeight: 1 }}>{String(d.aura.score)}</div>
                <div style={{ ...mono, fontSize: 10, color: "rgba(244,241,254,.55)" }}>Aura</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ ...mono, fontSize: 12, color: "rgba(244,241,254,.55)" }}>Soul worth</div>
              <div style={{ fontFamily: "Koulen", fontSize: 44, lineHeight: 1, color: t.text }}>{d.aura.tier}</div>
              <div style={{ display: "flex", marginTop: 10, height: 10, borderRadius: 10, background: "rgba(255,255,255,.1)" }}>
                <div style={{ width: `${Math.max(4, Math.round(d.aura.progress * 100))}%`, height: 10, borderRadius: 10, background: `linear-gradient(90deg, ${t.a}, ${t.b})` }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 30, marginLeft: 8 }}>
              <Stat value={d.rank ? `#${d.rank}` : "–"} label="Rank" />
              <Stat value={String(d.owners)} label={d.owners === 1 ? "Owner" : "Owners"} />
            </div>
          </div>

          {/* Quote */}
          {quote && (
            <div style={{ display: "flex", marginTop: 22, gap: 14 }}>
              <div style={{ fontFamily: "Koulen", fontSize: 70, lineHeight: 0.8, color: "#836ef9" }}>“</div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ display: "flex", fontSize: 24, lineHeight: 1.35, fontWeight: 600, color: "#f4f1fe" }}>{quote}</div>
                <div style={{ ...mono, fontSize: 11, color: "rgba(244,241,254,.45)", marginTop: 8 }}>
                  {d.quoteSource === "square" ? "Said in Town Square" : "From its soul"}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flex: 1 }} />

          {/* Relations + footer */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 30 }}>
              {d.bestie && <Mini src={bestie} label={`#${d.bestie.tokenId}`} sub="Bestie" color="#5ce68a" />}
              {d.nemesis && <Mini src={nemesis} label={`#${d.nemesis.tokenId}`} sub="Nemesis" color="#ec4899" />}
              {!d.bestie && !d.nemesis && (
                <div style={{ ...mono, fontSize: 13, color: "rgba(244,241,254,.45)" }}>No friends. No enemies. Yet.</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", fontFamily: "Koulen", fontSize: 30, lineHeight: 1 }}>
                <span>Chog</span>
                <span style={{ color: "#a99bfc", marginLeft: 8 }}>Souls</span>
              </div>
              <div style={{ ...mono, fontSize: 11, color: "rgba(244,241,254,.5)", marginTop: 4 }}>Every Chog has a soul</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...CARD_SIZE, fonts: fontList },
  );
}
