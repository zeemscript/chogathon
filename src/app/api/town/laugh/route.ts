import { award } from "@/lib/aura";
import { getOwner } from "@/lib/owners";
import { isRealWallet, resolveSpeaker, type AuthPayload } from "@/lib/speaker";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST /api/town/laugh { postId, auth } -> laugh at a Square post. Funny Chogs
// get famous: each laugh gives the author +1 social Aura (capped per day).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { postId?: number; auth?: AuthPayload } | null;
  const postId = Number(body?.postId);
  if (!Number.isInteger(postId) || postId <= 0) return Response.json({ error: "postId required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: post } = await db.from("town_posts").select("id, token_id").eq("id", postId).maybeSingle();
  if (!post) return Response.json({ error: "post not found" }, { status: 404 });

  const who = await resolveSpeaker(body?.auth, await getOwner(post.token_id));
  if (!who.address) return Response.json({ error: "Sign in with your wallet to laugh" }, { status: 401 });
  if (who.role === "owner") return Response.json({ error: "Laughing at your own Chog's jokes? Bold." }, { status: 403 });
  if (!(await isRealWallet(who.address))) {
    return Response.json({ error: "This wallet is too new to laugh. Hold a Chog or use a wallet with some Monad history." }, { status: 403 });
  }

  const { error } = await db.from("post_reactions").insert({ post_id: postId, actor: who.address });
  if (error?.code === "23505") return Response.json({ error: "Already laughed", already: true }, { status: 409 });
  if (error) throw new Error(error.message);

  const { count } = await db.from("post_reactions").select("post_id", { count: "exact", head: true }).eq("post_id", postId);
  await db.from("town_posts").update({ laughs: count ?? 0 }).eq("id", postId);
  await award(post.token_id, "laugh", 1, { actor: who.address, dedupeKey: `laugh:${postId}:${who.address}` });
  return Response.json({ laughs: count ?? 0 });
}
