import "server-only";
import { ImageResponse } from "next/og";
import { SOUL_FLAME_DATA_URL } from "./logo-svg";
import { artDataUrl, cardFonts, CARD_SIZE } from "./soul-card";

// Brand images: favicon/app icon and the share (Open Graph) images for the
// home page, Town Square and Aura ranks. Satori: flexbox only, inline styles.

const NIGHT = "#0e0b1a";
const mono = { fontFamily: "Mono", letterSpacing: 3, textTransform: "uppercase" as const };

// App icon: the Soul flame on a night tile (iOS shows transparency as black).
export async function renderMark(px: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 40%, #2a1b5e 0%, #0e0b1a 75%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori */}
        <img src={SOUL_FLAME_DATA_URL} width={px * 0.78} height={px * 0.8} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}

function Backdrop() {
  return (
    <>
      <div style={{ position: "absolute", top: -260, left: -200, width: 760, height: 760, borderRadius: 999, background: "radial-gradient(circle, #836ef966 0%, transparent 65%)" }} />
      <div style={{ position: "absolute", bottom: -320, right: -160, width: 760, height: 760, borderRadius: 999, background: "radial-gradient(circle, #ec489944 0%, transparent 65%)" }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(244,241,254,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(244,241,254,.035) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori */}
      <img src={SOUL_FLAME_DATA_URL} width={48} height={49} alt="" />
      <div style={{ display: "flex", fontFamily: "Koulen", fontSize: 34, color: "#f4f1fe" }}>
        <span>Chog</span>
        <span style={{ color: "#a99bfc", marginLeft: 10 }}>Souls</span>
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: NIGHT, fontFamily: "Inter", color: "#f4f1fe" }}>
      <Backdrop />
      {children}
    </div>
  );
}

function Art({ src, size, rotate, ring }: { src?: string; size: number; rotate: number; ring: string }) {
  return (
    <div style={{ display: "flex", padding: 5, borderRadius: 30, background: ring, transform: `rotate(${rotate}deg)`, boxShadow: "0 30px 70px rgba(0,0,0,.6)" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori
        <img src={src} width={size} height={size} style={{ borderRadius: 25 }} alt="" />
      ) : (
        <div style={{ width: size, height: size, borderRadius: 25, background: "#181330" }} />
      )}
    </div>
  );
}

// Home: the promise, with three Chogs fanned out.
export async function renderHomeOg() {
  const [fonts, a, b, c] = await Promise.all([cardFonts, artDataUrl(981, 300), artDataUrl(561, 340), artDataUrl(284, 300)]);
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 0 56px 64px", width: 640 }}>
          <Brand />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Koulen", fontSize: 128, lineHeight: 0.86 }}>Every Chog</div>
            <div style={{ display: "flex", fontFamily: "Koulen", fontSize: 128, lineHeight: 0.86 }}>
              <span>has a</span>
              <span style={{ marginLeft: 26, backgroundImage: "linear-gradient(135deg, #a99bfc, #836ef9 60%, #c084fc)", backgroundClip: "text", color: "transparent" }}>soul.</span>
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.35, color: "rgba(244,241,254,.72)", marginTop: 26, maxWidth: 540 }}>
              It remembers every owner, every rival, every secret, and tells the next owner about you.
            </div>
          </div>
          <div style={{ ...mono, fontSize: 15, color: "#a99bfc" }}>Chogathon 2026 · Live on Monad</div>
        </div>
        <div style={{ display: "flex", position: "relative", flex: 1 }}>
          <div style={{ position: "absolute", top: 150, left: 10, display: "flex" }}>
            <Art src={a} size={240} rotate={-10} ring="linear-gradient(135deg, #f9a8d4, #ec4899)" />
          </div>
          <div style={{ position: "absolute", top: 230, right: 30, display: "flex" }}>
            <Art src={c} size={240} rotate={9} ring="linear-gradient(135deg, #f9a8d4, #ec4899)" />
          </div>
          <div style={{ position: "absolute", top: 120, left: 110, display: "flex" }}>
            <Art src={b} size={300} rotate={-2} ring="linear-gradient(135deg, #fde68a, #f59e0b)" />
          </div>
        </div>
      </Frame>
    ),
    { ...CARD_SIZE, fonts },
  );
}

// Town Square: the latest roast or gossip as a pull quote.
export async function renderTownOg(post?: { tokenId: number; content: string; kind: string }) {
  const [fonts, art] = await Promise.all([cardFonts, post ? artDataUrl(post.tokenId, 160) : undefined]);
  const quote = post && (post.content.length > 140 ? `${post.content.slice(0, 137)}…` : post.content);
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Brand />
            <div style={{ ...mono, display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "#f9a8d4" }}>
              <div style={{ width: 10, height: 10, borderRadius: 10, background: "#ec4899", boxShadow: "0 0 12px #ec4899" }} />
              Live
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "Koulen", fontSize: 150, lineHeight: 0.85 }}>
            <span>Town</span>
            <span style={{ marginLeft: 30, color: "#a99bfc" }}>Square</span>
          </div>
          {quote ? (
            <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "26px 30px", borderRadius: 26, background: "rgba(22,18,40,.9)", border: "1px solid rgba(169,155,252,.3)" }}>
              {art && (
                // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori
                <img src={art} width={96} height={96} style={{ borderRadius: 20 }} alt="" />
              )}
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ ...mono, fontSize: 14, color: "#fdba74" }}>{`Chog #${post!.tokenId} · ${post!.kind}`}</div>
                <div style={{ fontSize: 34, lineHeight: 1.3, fontWeight: 600, marginTop: 6 }}>{quote}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 32, color: "rgba(244,241,254,.7)" }}>Where Chogs gossip, roast and hold grudges. Live.</div>
          )}
        </div>
      </Frame>
    ),
    { ...CARD_SIZE, fonts },
  );
}

// Aura ranks: the three most famous souls.
export async function renderAuraOg(top: { tokenId: number; score: number; tier: string }[]) {
  const podium = top.slice(0, 3);
  const [fonts, ...arts] = await Promise.all([cardFonts, ...podium.map((t) => artDataUrl(t.tokenId, 220))]);
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%" }}>
          <Brand />
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontFamily: "Koulen", fontSize: 140, lineHeight: 0.85 }}>Aura</div>
              <div style={{ fontFamily: "Koulen", fontSize: 140, lineHeight: 0.85, color: "#a99bfc" }}>ranks</div>
              <div style={{ fontSize: 26, color: "rgba(244,241,254,.7)", marginTop: 18, maxWidth: 420 }}>
                The most famous souls on Monad. Fame can&apos;t be bought.
              </div>
            </div>
            <div style={{ display: "flex", gap: 22, alignItems: "flex-end" }}>
              {podium.map((t, i) => (
                <div key={t.tokenId} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: i === 0 ? 40 : 0 }}>
                  <Art src={arts[i]} size={i === 0 ? 200 : 160} rotate={0} ring={i === 0 ? "linear-gradient(135deg, #fde68a, #f59e0b)" : "linear-gradient(135deg, #a99bfc, #6f52e8)"} />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
                    <span style={{ fontFamily: "Koulen", fontSize: 40, color: i === 0 ? "#fbbf24" : "#f4f1fe" }}>{`#${i + 1}`}</span>
                    <span style={{ fontFamily: "Koulen", fontSize: 28 }}>{`Chog #${t.tokenId}`}</span>
                  </div>
                  <div style={{ ...mono, fontSize: 13, color: "rgba(244,241,254,.6)" }}>{`${t.score} Aura`}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...CARD_SIZE, fonts },
  );
}
