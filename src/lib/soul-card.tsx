import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { auraLeaderboard, getAura, type Aura } from "./aura";
import { getChogRaw } from "./chogs";
import { fetchArt } from "./art";
import { SOUL_FLAME_DATA_URL } from "./logo-svg";
import { buildPersonality } from "./personality";
import { supabaseAdmin } from "./supabase/server";
import { getRelations, listPosts } from "./town";

// The Soul Card: a 1200x630 share image (X large card / Open Graph) that sells
// a Chog's life story at a glance. Rendered with next/og (Satori: flexbox only).

export const CARD_SIZE = { width: 1200, height: 630 };

const fontDir = join(process.cwd(), "src/assets/fonts");
export const cardFonts = Promise.all([
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
export async function artDataUrl(tokenId: number, px: number): Promise<string | undefined> {
  const key = `${tokenId}:${px}`;
  if (art.has(key)) return art.get(key);
  if (!getChogRaw(tokenId)) return;
  try {
    const res = await fetchArt(tokenId);
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
    supabaseAdmin()
      .from("owner_history")
      .select("id", { count: "exact", head: true })
      .eq("token_id", tokenId)
      .neq("from_address", "0x0000000000000000000000000000000000000000"), // mints aren't a new owner
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

// The Chog's own art, blown up, blurred and saturated: every card gets its
// own colours, so a feed full of Soul Cards never looks the same twice.
const bgCache = new Map<number, string>();
async function artBackdrop(tokenId: number): Promise<string | undefined> {
  if (bgCache.has(tokenId)) return bgCache.get(tokenId);
  try {
    const res = await fetchArt(tokenId);
    const jpg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(600, 315, { fit: "cover" })
      .blur(18)
      .modulate({ saturation: 1.7, brightness: 0.62 })
      .jpeg({ quality: 70 })
      .toBuffer();
    const url = `data:image/jpeg;base64,${jpg.toString("base64")}`;
    if (bgCache.size > 200) bgCache.delete(bgCache.keys().next().value!);
    bgCache.set(tokenId, url);
    return url;
  } catch {
    return;
  }
}

export async function renderSoulCard(tokenId: number): Promise<ImageResponse> {
  const d = await getCardData(tokenId);
  const [main, bg, bestie, nemesis, fontList] = await Promise.all([
    artDataUrl(tokenId, 380),
    artBackdrop(tokenId),
    d.bestie ? artDataUrl(d.bestie.tokenId, 96) : undefined,
    d.nemesis ? artDataUrl(d.nemesis.tokenId, 96) : undefined,
    cardFonts,
  ]);
  const r = RARITY[d.tierName] ?? RARITY.Common;
  // Until it earns a tier colour, a Chog glows in its rarity colour (never grey).
  const t = d.aura.tier === "Dormant" ? r : (TIER[d.aura.tier] ?? r);
  const quote = d.quote && (d.quote.length > 110 ? `${d.quote.slice(0, 107)}…` : d.quote);
  const glass = { background: "rgba(10,7,22,.55)", border: "1px solid rgba(255,255,255,.14)" };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#0e0b1a", fontFamily: "Inter", color: "#fff" }}>
        {/* the NFT itself, as the backdrop */}
        {bg && (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori
          <img src={bg} width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630 }} alt="" />
        )}
        {/* readability: darken toward the text side, plus a vignette */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(8,5,18,.15) 0%, rgba(8,5,18,.55) 42%, rgba(8,5,18,.86) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 50% 50%, transparent 55%, rgba(0,0,0,.55) 100%)" }} />

        {/* LEFT: portrait inside its Aura */}
        <div style={{ display: "flex", position: "relative", width: 500, height: "100%", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 999, background: `radial-gradient(circle, ${t.b}88 0%, ${t.b}22 45%, transparent 70%)` }} />
          {[470, 420, 372].map((size, i) => (
            <div
              key={size}
              style={{ position: "absolute", width: size, height: size, borderRadius: 999, border: `${3 - i}px solid ${t.a}`, opacity: 0.25 + i * 0.2 }}
            />
          ))}
          <div style={{ display: "flex", padding: 6, borderRadius: 40, background: `linear-gradient(135deg, ${r.a}, ${r.b})`, transform: "rotate(-3deg)", boxShadow: `0 0 70px ${t.b}cc, 0 40px 80px rgba(0,0,0,.65)` }}>
            {main ? (
              // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori
              <img src={main} width={320} height={320} style={{ borderRadius: 34 }} alt="" />
            ) : (
              <div style={{ width: 320, height: 320, borderRadius: 34, background: "#181330" }} />
            )}
          </div>
          <div style={{ ...mono, position: "absolute", top: 120, left: 78, display: "flex", padding: "8px 16px", borderRadius: 999, background: "rgba(10,7,22,.85)", border: `1px solid ${r.a}`, color: r.text, fontSize: 13, transform: "rotate(-3deg)" }}>
            {d.tierName}
          </div>
        </div>

        {/* RIGHT: the soul */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "42px 56px 36px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori */}
            <img src={SOUL_FLAME_DATA_URL} width={30} height={31} alt="" />
            <div style={{ ...mono, fontSize: 14, color: "rgba(255,255,255,.75)" }}>Chog Souls · Soul card</div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", marginTop: 10 }}>
            <div style={{ fontFamily: "Koulen", fontSize: 108, lineHeight: 0.88 }}>Chog</div>
            <div style={{ fontFamily: "Koulen", fontSize: 108, lineHeight: 0.88, marginLeft: 20, color: t.a }}>{`#${d.tokenId}`}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <div style={{ fontFamily: "Koulen", fontSize: 30, marginRight: 6 }}>{d.archetype}</div>
            {d.temperament.slice(0, 3).map((x) => (
              <div key={x} style={{ ...mono, ...glass, fontSize: 12, display: "flex", padding: "6px 12px", borderRadius: 999, color: "rgba(255,255,255,.9)" }}>
                {x}
              </div>
            ))}
          </div>

          {/* AURA: the hero stat */}
          <div style={{ ...glass, display: "flex", alignItems: "center", gap: 28, marginTop: 22, padding: "18px 26px", borderRadius: 24, boxShadow: `inset 0 0 40px ${t.b}33` }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "Koulen", fontSize: 92, lineHeight: 0.85, color: "#fff", textShadow: `0 0 30px ${t.b}` }}>{String(d.aura.score)}</div>
              <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4 }}>Aura</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ fontFamily: "Koulen", fontSize: 44, lineHeight: 1, color: t.a }}>{d.aura.tier}</div>
              <div style={{ display: "flex", marginTop: 10, height: 8, borderRadius: 8, background: "rgba(255,255,255,.14)" }}>
                <div style={{ width: `${Math.max(5, Math.round(d.aura.progress * 100))}%`, height: 8, borderRadius: 8, background: `linear-gradient(90deg, ${t.a}, ${t.b})`, boxShadow: `0 0 12px ${t.b}` }} />
              </div>
              <div style={{ ...mono, fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 10 }}>
                {`${d.rank ? `Rank #${d.rank} of 1,969` : "Unranked"} · ${d.owners} ${d.owners === 1 ? "owner" : "owners"}`}
              </div>
            </div>
          </div>

          {quote && (
            <div style={{ display: "flex", marginTop: 20, gap: 12 }}>
              <div style={{ fontFamily: "Koulen", fontSize: 64, lineHeight: 0.8, color: t.a }}>“</div>
              <div style={{ display: "flex", fontSize: 23, lineHeight: 1.35, fontWeight: 600, flex: 1 }}>{quote}</div>
            </div>
          )}

          <div style={{ display: "flex", flex: 1 }} />

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 26 }}>
              {d.bestie && <Mini src={bestie} label={`#${d.bestie.tokenId}`} sub="Bestie" color="#5ce68a" />}
              {d.nemesis && <Mini src={nemesis} label={`#${d.nemesis.tokenId}`} sub="Nemesis" color="#ff5fa8" />}
            </div>
            <div style={{ ...mono, display: "flex", fontSize: 13, color: "rgba(255,255,255,.75)" }}>{`chog-souls.vercel.app · talk to it →`}</div>
          </div>
        </div>
      </div>
    ),
    { ...CARD_SIZE, fonts: fontList },
  );
}
