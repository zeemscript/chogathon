import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import sharp from "sharp";
import { auraLeaderboard, getAura, type Aura } from "./aura";
import { getChogRaw } from "./chogs";
import { fetchArt } from "./art";
import { FLAT_FLAME_DATA_URL } from "./logo-svg";
import { asShareJpeg } from "./og";
import { buildPersonality } from "./personality";
import { supabaseAdmin } from "./supabase/server";
import { getRelations, listPosts } from "./town";

// The Soul Card: a 1200x630 share image (X large card / Open Graph) in one of
// three styles from our Figma designs. Rendered with next/og (Satori: flexbox only).

export const CARD_SIZE = { width: 1200, height: 630 };

const fontDir = join(process.cwd(), "src/assets/fonts");
export const cardFonts = Promise.all([
  readFile(join(fontDir, "Koulen-400.woff")),
  readFile(join(fontDir, "Inter-400.woff")),
  readFile(join(fontDir, "Inter-600.woff")),
  readFile(join(fontDir, "JetBrainsMono-500.woff")),
  readFile(join(fontDir, "Inter-400-italic.woff")),
]).then(([koulen, inter, interSemi, mono, interItalic]) => [
  { name: "Koulen", data: koulen, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: interSemi, weight: 600 as const, style: "normal" as const },
  { name: "Mono", data: mono, weight: 500 as const, style: "normal" as const },
  { name: "Inter", data: interItalic, weight: 400 as const, style: "italic" as const },
]);

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

// The art as the Figma designs show it: cropped to the box, with a light film
// grain. JPEG, since grain doesn't compress as PNG.
const grainCache = new Map<string, string>();
// `zoom` draws the art as a larger square and cuts the box out of it at
// (left, top), like a Figma image fill that was scaled and moved.
type Zoom = { size: number; left: number; top: number };
export async function grainArt(tokenId: number, w: number, h: number, zoom?: Zoom): Promise<string | undefined> {
  const key = `${tokenId}:${w}x${h}:${zoom ? `${zoom.size},${zoom.left},${zoom.top}` : ""}`;
  if (grainCache.has(key)) return grainCache.get(key);
  if (!getChogRaw(tokenId)) return;
  try {
    const res = await fetchArt(tokenId);
    const noise = await sharp({ create: { width: w, height: h, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 22 } } })
      .png()
      .toBuffer();
    const base = zoom
      ? sharp(await sharp(Buffer.from(await res.arrayBuffer())).resize(zoom.size, zoom.size).toBuffer()).extract({ left: zoom.left, top: zoom.top, width: w, height: h })
      : sharp(Buffer.from(await res.arrayBuffer())).resize(w, h, { fit: "cover" });
    const jpg = await sharp(await base.png().toBuffer())
      .composite([{ input: noise, blend: "overlay" }])
      .jpeg({ quality: 86 })
      .toBuffer();
    const url = `data:image/jpeg;base64,${jpg.toString("base64")}`;
    if (grainCache.size > 200) grainCache.delete(grainCache.keys().next().value!);
    grainCache.set(key, url);
    return url;
  } catch {
    return;
  }
}

// Three looks, drawn 1:1 from the Figma frames (1200x800). Holders pick one;
// links carry ?card=. Every element sits at its Figma position, measured from
// the exported frames, so text is placed by its cap top, not its line box.
export const CARD_STYLES = ["night", "poster", "paper"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];
export const parseCardStyle = (s: string | null | undefined): CardStyle =>
  CARD_STYLES.includes(s as CardStyle) ? (s as CardStyle) : "night";

export const SOUL_CARD_SIZE = { width: 1200, height: 800 };

// Distance from a line box's top to the cap top, per em (lineHeight 1).
const KOULEN_CAP = 0.11; // plus 1px, see K
const MONO_CAP = 0.13;
const INTER_CAP = 0.14;
const MONO = 17;

type Pos = { x?: number; right?: number; y: number; center?: boolean };
const place = ({ x, right, center }: Pos, top: number) =>
  ({
    position: "absolute",
    display: "flex",
    top,
    ...(center ? { left: 0, width: 1200, justifyContent: "center" } : right !== undefined ? { right } : { left: x }),
  }) as const;

function K({ at, size, color, children }: { at: Pos; size: number; color: string; children: string }) {
  return <div style={{ ...place(at, at.y - KOULEN_CAP * size - 1), fontFamily: "Koulen", fontSize: size, lineHeight: 1, color }}>{children}</div>;
}
function M({ at, color, children, upper = true, size = MONO }: { at: Pos; color: string; children: string; upper?: boolean; size?: number }) {
  return (
    <div style={{ ...place(at, at.y - MONO_CAP * size), fontFamily: "Mono", fontSize: size, lineHeight: 1, color, textTransform: upper ? "uppercase" : "none" }}>
      {children}
    </div>
  );
}
function Q({ at, size, lead, width, color, italic, children }: { at: Pos; size: number; lead: number; width: number; color: string; italic?: boolean; children: string }) {
  return (
    <div
      style={{
        ...place(at, at.y - ((lead - size) / 2 + INTER_CAP * size)),
        width,
        fontFamily: "Inter",
        fontStyle: italic ? "italic" : "normal",
        fontSize: size,
        lineHeight: `${lead}px`,
        color,
      }}
    >
      {children}
    </div>
  );
}
function Rule({ x, y, w, color }: { x: number; y: number; w: number; color: string }) {
  return <div style={{ position: "absolute", left: x, top: y, width: w, height: 1, background: color }} />;
}
function Art({ src, x, y, w, h }: { src?: string; x: number; y: number; w: number; h: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori
    <img src={src} width={w} height={h} style={{ position: "absolute", left: x, top: y }} alt="" />
  ) : (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: "rgba(128,128,128,.25)" }} />
  );
}

type Look = { bg: string; ink: string; soft: string; accent: string; rule: string; foot: string };
const LOOKS: Record<CardStyle, Look> = {
  night: { bg: "#100e15", ink: "#f8f4ec", soft: "#bab2be", accent: "#b9a3f2", rule: "#2c2833", foot: "#3b3543" },
  poster: { bg: "#f6db56", ink: "#4a2089", soft: "#4a2089", accent: "#4a2089", rule: "#bba246", foot: "#bba246" },
  paper: { bg: "#f5eedc", ink: "#1c1510", soft: "#6b604d", accent: "#1c1510", rule: "#d6ccb7", foot: "#cfc4ae" },
};

type Bits = { d: CardData; quote: (n: number) => string | undefined; owners: string; rel?: string };

type FrameProps = { look: Look; tag?: string; footLeft?: string; footRight?: string; children: ReactNode };
function Frame({ look, tag = "Soul Card", footLeft, footRight = "chog-souls.vercel.app · talk to it →", children }: FrameProps) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: look.bg }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori */}
      <img src={FLAT_FLAME_DATA_URL} width={27} height={33} style={{ position: "absolute", left: 48, top: 52 }} alt="" />
      <K at={{ x: 89, y: 56 }} size={30} color={look.ink}>Chog Souls</K>
      <M at={{ right: 47, y: 61 }} color={look.soft}>{tag}</M>
      {children}
      <Rule x={48} y={711} w={1104} color={look.foot} />
      {footLeft && <M at={{ x: 49, y: 734 }} color={look.soft}>{footLeft}</M>}
      <M at={{ right: 46, y: 734 }} color={look.soft} upper={false} size={16.75}>{footRight}</M>
    </div>
  );
}

// 1 · Night
function Night({ b, art }: { b: Bits; art?: string }) {
  const L = LOOKS.night;
  const { d } = b;
  return (
    <Frame look={L} footLeft={b.rel}>
      {/* left: archetype + quote, centred on the art */}
      <div style={{ position: "absolute", left: 48, top: 103, width: 274, height: 460, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", fontFamily: "Koulen", fontSize: 37, lineHeight: 1, color: L.accent }}>{d.archetype}</div>
        {b.quote(110) && <div style={{ display: "flex", marginTop: 30, fontFamily: "Inter", fontSize: 24, lineHeight: "36px", color: L.ink }}>{b.quote(110)!}</div>}
      </div>
      <Art src={art} x={370} y={103} w={460} h={460} />
      <K at={{ center: true, y: 596 }} size={78} color={L.ink}>{`Chog #${d.tokenId}`}</K>
      <M at={{ center: true, y: 677 }} color={L.soft}>{d.temperament.slice(0, 3).join(" · ")}</M>
      {/* right: standing */}
      <K at={{ x: 877, y: 201 }} size={71} color={L.ink}>{d.rank ? `Rank #${d.rank}` : "Unranked"}</K>
      <M at={{ x: 879, y: 265 }} color={L.soft}>{d.rank ? `of 1,969 · ${b.owners}` : b.owners}</M>
      <Rule x={879} y={313} w={273} color={L.rule} />
      <M at={{ x: 879, y: 348 }} color={L.soft} size={18.5}>{`${d.aura.score} Aura`}</M>
      <M at={{ x: 879, y: 378 }} color={L.accent} size={18.5}>{d.aura.tier}</M>
      <Rule x={879} y={428} w={273} color={L.rule} />
      <M at={{ x: 879, y: 460 }} color={L.soft}>{d.tierName}</M>
    </Frame>
  );
}

// 2 · Poster
function Poster({ b, art }: { b: Bits; art?: string }) {
  const L = LOOKS.poster;
  const { d } = b;
  return (
    <Frame look={L} footLeft={b.rel}>
      <K at={{ x: 48, y: 113 }} size={148} color={L.ink}>Chog</K>
      <K at={{ x: 47, y: 255 }} size={148} color={L.ink}>{`#${d.tokenId}`}</K>
      <K at={{ x: 48, y: 399 }} size={38} color={L.ink}>{d.archetype}</K>
      {b.quote(96) && <Q at={{ x: 49, y: 501 }} size={30} lead={41} width={500} color={L.ink} italic>{b.quote(96)!}</Q>}
      <M at={{ x: 49, y: 680 }} color={L.soft}>{d.temperament.slice(0, 3).join(" · ")}</M>
      <Art src={art} x={604} y={100} w={548} h={461} />
      <K at={{ x: 604, y: 624 }} size={36} color={L.ink}>{d.rank ? `Rank #${d.rank} of 1,969 · ${b.owners}` : `Unranked · ${b.owners}`}</K>
      <M at={{ x: 605, y: 679 }} color={L.soft} size={18}>{`${d.aura.score} Aura · ${d.aura.tier}`}</M>
      <M at={{ right: 48, y: 679 }} color={L.soft}>{d.tierName}</M>
    </Frame>
  );
}

// 3 · Paper
function Paper({ b, art }: { b: Bits; art?: string }) {
  const L = LOOKS.paper;
  const { d } = b;
  return (
    <Frame look={L} footLeft={b.rel}>
      <Art src={art} x={48} y={104} w={552} h={552} />
      <M at={{ x: 49, y: 677 }} color={L.soft}>{d.tierName}</M>
      <K at={{ x: 648, y: 116 }} size={94} color={L.ink}>{`Chog #${d.tokenId}`}</K>
      <K at={{ x: 648, y: 218 }} size={37} color={L.ink}>{d.archetype}</K>
      <M at={{ x: 649, y: 271 }} color={L.soft}>{d.temperament.slice(0, 3).join(" · ")}</M>
      {/* quote, centred between the traits and the rule */}
      <div style={{ position: "absolute", left: 649, top: 300, width: 503, height: 280, display: "flex", alignItems: "center" }}>
        {b.quote(140) && <div style={{ display: "flex", fontFamily: "Inter", fontSize: 27, lineHeight: "39px", color: L.ink }}>{b.quote(140)!}</div>}
      </div>
      <Rule x={649} y={591} w={503} color={L.rule} />
      <K at={{ x: 648, y: 616 }} size={33} color={L.ink}>{d.rank ? `Rank #${d.rank} of 1,969 · ${b.owners}` : `Unranked · ${b.owners}`}</K>
      <M at={{ x: 649, y: 674 }} color={L.soft} size={19.6}>{`${d.aura.score} Aura · ${d.aura.tier}`}</M>
    </Frame>
  );
}

// Box size per style; Poster's fill is zoomed to 117.5% and shifted, as in Figma.
const ART_BOX: Record<CardStyle, [number, number, Zoom?]> = {
  night: [460, 460],
  poster: [548, 461, { size: 644, left: 52, top: 64 }],
  paper: [552, 552],
};

function bits(d: CardData): Bits {
  return {
    d,
    quote: (n) => d.quote && (d.quote.length > n ? `${d.quote.slice(0, n - 1).trimEnd()}…` : d.quote),
    owners: `${d.owners} ${d.owners === 1 ? "owner" : "owners"}`,
    rel: d.nemesis ? `Nemesis #${d.nemesis.tokenId}` : d.bestie ? `Bestie #${d.bestie.tokenId}` : undefined,
  };
}

// Renders the card for `d`; `artToken` lets the calibration mock reuse other art.
export async function renderSoulCardFor(d: CardData, style: CardStyle, artToken = d.tokenId): Promise<ImageResponse> {
  const [w, h, zoom] = ART_BOX[style];
  const [art, fonts] = await Promise.all([grainArt(artToken, w, h, zoom), cardFonts]);
  const Card = style === "poster" ? Poster : style === "paper" ? Paper : Night;
  return new ImageResponse(<Card b={bits(d)} art={art} />, { ...SOUL_CARD_SIZE, fonts });
}

export async function renderSoulCard(tokenId: number, style: CardStyle = "night"): Promise<ImageResponse> {
  return renderSoulCardFor(await getCardData(tokenId), style);
}

// Link previews must be 1200x630: fit the 3:2 card in the middle and fill the
// sides with its own background, so the design is never cropped or squashed.
export async function letterbox(img: Response, bg: string): Promise<Response> {
  const png = await sharp(Buffer.from(await img.arrayBuffer()))
    .resize(945, 630)
    .extend({ left: 127, right: 128, background: bg })
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } });
}

export async function soulCardOg(tokenId: number, style: CardStyle): Promise<Response> {
  return asShareJpeg(await letterbox(await renderSoulCard(tokenId, style), LOOKS[style].bg), { maxAge: 1800 });
}

// A Town Square post in the Poster look (the one style roasts always use): the
// author's name huge, the post as the quote, the Chog it's about as the art.
export async function renderPostCard(post: { tokenId: number; aboutId?: number | null; content: string; kind: string; archetype: string }) {
  const L = LOOKS.poster;
  const [w, h, zoom] = ART_BOX.poster;
  const [art, fonts] = await Promise.all([grainArt(post.aboutId ?? post.tokenId, w, h, zoom), cardFonts]);
  const roast = post.kind === "roast";
  const text = post.content.length > 140 ? `${post.content.slice(0, 139).trimEnd()}…` : post.content;
  const img = new ImageResponse(
    (
      <Frame look={L} tag={`Town Square · ${roast ? "Roast" : post.kind}`} footLeft="Every Chog has a soul" footRight="chog-souls.vercel.app · see the replies →">
        <K at={{ x: 48, y: 113 }} size={148} color={L.ink}>Chog</K>
        <K at={{ x: 47, y: 255 }} size={148} color={L.ink}>{`#${post.tokenId}`}</K>
        <K at={{ x: 48, y: 399 }} size={38} color={L.ink}>{post.archetype}</K>
        <Q at={{ x: 49, y: 501 }} size={30} lead={41} width={500} color={L.ink} italic>{`“${text}”`}</Q>
        <Art src={art} x={604} y={100} w={w} h={h} />
        <K at={{ x: 604, y: 624 }} size={36} color={L.ink}>{post.aboutId ? `${roast ? "Victim" : "About"}: Chog #${post.aboutId}` : `Chog #${post.tokenId}`}</K>
        <M at={{ x: 605, y: 679 }} color={L.soft} size={18}>{roast ? "Can it roast back?" : "Overheard in the Square"}</M>
      </Frame>
    ),
    { ...SOUL_CARD_SIZE, fonts },
  );
  return letterbox(img, L.bg);
}
