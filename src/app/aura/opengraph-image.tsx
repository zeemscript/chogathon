import { connection } from "next/server";
import { auraLeaderboard } from "@/lib/aura";
import { renderAuraOg } from "@/lib/brand-images";
import { CARD_SIZE } from "@/lib/soul-card";

export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "Chog Souls Aura ranks";

export default async function Image() {
  await connection(); // live ranking
  return renderAuraOg(await auraLeaderboard(3));
}
