import { connection } from "next/server";
import { parseTokenId } from "@/lib/chogs";
import { asShareJpeg } from "@/lib/og";
import { CARD_SIZE, renderSoulCard } from "@/lib/soul-card";

// Sharing a /chog/:id link on X or Discord unfurls into its Soul Card.
export const size = CARD_SIZE;
export const contentType = "image/jpeg";
export const alt = "Chog Souls soul card";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // live Aura, never prerendered
  const tokenId = parseTokenId((await params).id) ?? 1;
  return asShareJpeg(await renderSoulCard(tokenId), { maxAge: 1800 });
}
