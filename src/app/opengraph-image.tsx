import { renderHomeOg } from "@/lib/brand-images";
import { asShareJpeg } from "@/lib/og";
import { CARD_SIZE } from "@/lib/soul-card";

export const size = CARD_SIZE;
export const contentType = "image/jpeg";
export const alt = "Chog Souls: every Chog has a soul";

export default async function Image() {
  return asShareJpeg(await renderHomeOg(), { maxAge: 86400 });
}
