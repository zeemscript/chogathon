import { getOwner } from "@/lib/owners";
import { resolveSpeaker, type AuthPayload } from "@/lib/speaker";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createPost, getPost } from "@/lib/town";

// POST /api/roast/comeback { postId, auth } -> the roasted Chog's owner fires
// back once, for free. Keeps paid roasts fun instead of bullying.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { postId?: number; auth?: AuthPayload } | null;
  const post = body?.postId ? await getPost(Number(body.postId)) : undefined;
  if (!post || !post.commissioned_by || !post.about_token_id) {
    return Response.json({ error: "Only paid roasts can be answered" }, { status: 400 });
  }
  const who = await resolveSpeaker(body?.auth, await getOwner(post.about_token_id));
  if (who.role !== "owner") return Response.json({ error: "Only the roasted Chog's owner can roast back" }, { status: 403 });

  // Claim the comeback atomically: only flips false -> true once.
  const { data: claimed } = await supabaseAdmin()
    .from("town_posts")
    .update({ comeback_used: true })
    .eq("id", post.id)
    .eq("comeback_used", false)
    .select("id");
  if (!claimed?.length) return Response.json({ error: "This roast was already answered" }, { status: 409 });

  const reply = await createPost(post.about_token_id, post.token_id, "roast", { reply_to: post.id });
  return Response.json({ post: reply });
}
