import { type NextRequest } from "next/server";
import { CHAT_MODEL, deepseek } from "@/lib/ai";
import { addLoyalty, auraDay, award, getAura } from "@/lib/aura";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
import { DEV_OWNER } from "@/lib/dev";
import { chatQuota } from "@/lib/limits";
import { addCredits, getCredits } from "@/lib/payments";
import { isRealWallet, resolveSpeaker, visitorId, type AuthPayload } from "@/lib/speaker";
import { marketPulse } from "@/lib/pulse";
import { prepareSoul, remember, systemPrompt, type Speaker } from "@/lib/soul";
import { getRelations, listPosts, nudgeRelation } from "@/lib/town";

// Mentions like "#123" or "chog 123" in a message.
function mentionedChogs(text: string, self: number): number[] {
  const ids = [...text.matchAll(/(?:#|chog\s*#?)(\d{1,4})\b/gi)].map((m) => parseTokenId(m[1])).filter((n): n is number => !!n);
  return [...new Set(ids)].filter((id) => id !== self).slice(0, 3);
}

const NEGATIVE = /\b(hate|ugly|stupid|fake|rug|scam|loser|worse|trash|copy|copied|annoying|weird|rival|fight|enemy)\b/i;
const POSITIVE = /\b(love|cool|best|friend|cute|nice|great|amazing|respect|gm|legend|bestie)\b/i;

// When the owner talks about another Chog, it colours how this Chog feels.
async function absorbMentions(tokenId: number, message: string, owner: boolean) {
  const weight = owner ? 1 : 0.4; // visitors are less trusted
  for (const other of mentionedChogs(message, tokenId)) {
    if (NEGATIVE.test(message)) {
      await nudgeRelation(tokenId, other, -12 * weight, owner ? `my human said: "${message.slice(0, 80)}"` : undefined);
    } else if (POSITIVE.test(message)) {
      await nudgeRelation(tokenId, other, 10 * weight);
    } else {
      await nudgeRelation(tokenId, other, 0);
    }
  }
}

type Body = {
  tokenId: number;
  message: string;
  auth?: AuthPayload;
};

// Visitors make a Chog famous (once per visitor per day); owners earn care.
async function earnChatAura(request: Request, tokenId: number, speaker: Speaker) {
  if (speaker.role === "owner") {
    await award(tokenId, "owner_chat", 1, { actor: speaker.address });
    await addLoyalty(tokenId, 2);
  } else if (speaker.address && (await isRealWallet(speaker.address))) {
    // Fame only from real wallets; anonymous or throwaway visitors don't count.
    const who = speaker.address;
    await award(tokenId, "visitor_chat", 2, { actor: who, dedupeKey: `visit:${tokenId}:${who}:${auraDay()}` });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const tokenId = parseTokenId(String(body?.tokenId));
  const message = body?.message?.trim().slice(0, 1000);
  if (!tokenId || !message) return Response.json({ error: "tokenId and message required" }, { status: 400 });

  const owner = await getOwner(tokenId);
  const speaker = await resolveSpeaker(body?.auth, owner);
  // Who these turns belong to: the owner's wallet, or this specific visitor.
  // Dev owner mode files its turns as a visitor's, so the real holder never
  // "remembers" test chats; the dev session still sees them (filter below).
  const memoryOwner = DEV_OWNER ? "visitor:dev-owner" : speaker.role === "owner" ? speaker.address! : `visitor:${visitorId(request, speaker)}`;

  const quota = await chatQuota(memoryOwner, speaker.role);
  // Free chats used up? Spend a chat bought with $CHOG, if this wallet has one.
  let credits = 0;
  if (!quota.allowed && quota.reason === "you" && speaker.address) credits = await getCredits(speaker.address);
  const useCredit = credits > 0;
  if (!quota.allowed && !useCredit) {
    const error =
      quota.reason === "global"
        ? "The Chogs are worn out from talking today. Come back tomorrow."
        : speaker.role === "owner"
          ? `You've used all ${quota.limit} chats for today. Your Chog needs its beauty sleep.`
          : `You've used all ${quota.limit} visitor chats for today. Own a Chog to talk more.`;
    return Response.json({ error, remaining: 0, limit: quota.limit, canBuy: quota.reason === "you" }, { status: 429 });
  }
  const [{ chog, memory }, relations, gossip, aura, pulse] = await Promise.all([
    prepareSoul(tokenId, owner),
    getRelations(tokenId),
    listPosts({ tokenId, limit: 3 }),
    getAura(tokenId).catch(() => undefined),
    marketPulse(),
  ]);
  const { data: state } = await supabaseAdmin().from("chog_state").select("loyalty").eq("token_id", tokenId).maybeSingle();
  const standing = aura && { tier: aura.tier, score: aura.score, loyalty: state?.loyalty ?? 0 };

  // Owners get the full shared history; visitors only get their own thread.
  const turns = memory
    .filter((m) => m.kind === "chat")
    // Owners inherit every past owner's conversations; visitors only see their own.
    .filter((m) =>
      m.owner === memoryOwner || (speaker.role === "owner" && !m.owner?.startsWith("visitor:")),
    )
    // Token budget: the last 12 turns, each trimmed. Older context lives in events/summary.
    .slice(-12)
    .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content.slice(0, 400) }));

  let stream;
  try {
    stream = await deepseek.chat.completions.create({
    model: CHAT_MODEL,
    stream: true,
    temperature: 1.1,
    max_tokens: 180,
    messages: [
      { role: "system", content: systemPrompt(chog, owner, speaker, memory, { relations, gossip }, standing, pulse) },
      ...turns,
      { role: "user", content: message },
    ],
    });
  } catch (err) {
    console.error("deepseek error", err);
    return Response.json({ error: "Your Chog is napping (AI unavailable). Try again soon." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  let reply = "";
  const body2 = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            reply += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        await absorbMentions(tokenId, message, speaker.role === "owner").catch(() => {});
        await earnChatAura(request, tokenId, speaker).catch((err) => console.error("aura", err));
        if (reply && useCredit) await addCredits(speaker.address!, -1);
        if (reply) {
          await remember(tokenId, [
            { kind: "chat", role: "user", content: message, owner: memoryOwner },
            { kind: "chat", role: "chog", content: reply, owner: memoryOwner },
          ]);
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(body2, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-speaker-role": speaker.role,
      "x-chat-remaining": String(useCredit ? 0 : quota.remaining - 1),
      "x-chat-credits": String(useCredit ? credits - 1 : credits),
      "x-chat-limit": String(quota.limit),
    },
  });
}
