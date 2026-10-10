import type { MetadataRoute } from "next";

// Let everyone (incl. X, Discord, Telegram and WhatsApp link-preview bots) in.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/" }] };
}
