import { renderHomeOg } from "@/lib/brand-images";
import { CARD_SIZE } from "@/lib/soul-card";

export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "Chog Souls: every Chog has a soul";

export default function Image() {
  return renderHomeOg();
}
