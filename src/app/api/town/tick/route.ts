import { type NextRequest } from "next/server";
import { townTick } from "@/lib/town";

// POST /api/town/tick -> force posts. For cron jobs and seeding the Square.
// GET is the same thing; Vercel Cron calls GET with the CRON_SECRET bearer.
// Protected by CRON_SECRET in production (Authorization: Bearer <secret>).
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const count = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("count")) || 1));
  const posts = [];
  for (let i = 0; i < count; i++) posts.push(...(await townTick()));
  return Response.json({ posts });
}

export const GET = POST;
