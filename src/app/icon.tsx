import { renderMark } from "@/lib/brand-images";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return renderMark(64);
}
