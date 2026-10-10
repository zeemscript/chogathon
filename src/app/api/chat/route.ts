import { type NextRequest } from "next/server";
import { isAddress, verifyMessage } from "viem";
import { CHAT_MODEL, deepseek } from "@/lib/ai";
import { AUTH_TTL_MS, authMessage } from "@/lib/auth";
import { parseTokenId } from "@/lib/chogs";
import { getOwner } from "@/lib/owners";
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
  auth?: { address: string; issuedAt: string; signature: `0x${string}` };
};

// Resolve who is talking. A valid signature from the current holder = owner.
async function resolveSpeaker(auth: Body["auth"], owner: string | undefined): Promise<Speaker> {
  // Dev only: DEV_IMPERSONATE_OWNER=1 treats every speaker as the owner.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_IMPERSONATE_OWNER === "1" && owner) {
    return { role: "owner", address: owner };
  }
  if (!auth || !isAddress(auth.address)) return { role: "visitor" };
  const age = Date.now() - Date.parse(auth.issuedAt);
  if (!(age >= 0 && age < AUTH_TTL_MS)) return { role: "visitor" };
  const ok = await verifyMessage({
    address: auth.address,
    message: authMessage(auth.address, auth.issuedAt),
    signature: auth.signature,
  }).catch(() => false);
  if (!ok) return { role: "visitor" };
  const address = auth.address.toLowerCase();
  return address === owner ? { role: "owner", address } : { role: "visitor", address };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const tokenId = parseTokenId(String(body?.tokenId));
  const message = body?.message?.trim().slice(0, 1000);
  if (!tokenId || !message) return Response.json({ error: "tokenId and message required" }, { status: 400 });

  const owner = await getOwner(tokenId);
  const speaker = await resolveSpeaker(body?.auth, owner);
  const [{ chog, memory }, relations, gossip] = await Promise.all([
    prepareSoul(tokenId, owner),
    getRelations(tokenId),
    listPosts({ tokenId, limit: 5 }),
  ]);

  // Owners get the full shared history; visitors only get their own thread.
  const turns = memory
    .filter((m) => m.kind === "chat")
    // Owners inherit every past owner's conversations; visitors only see their own.
    .filter((m) =>
      speaker.role === "owner" ? !m.owner?.startsWith("visitor:") : m.owner === `visitor:${speaker.address ?? "anon"}`,
    )
    .slice(-20)
    .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content }));

  let stream;
  try {
    stream = await deepseek.chat.completions.create({
    model: CHAT_MODEL,
    stream: true,
    temperature: 1.1,
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt(chog, owner, speaker, memory, { relations, gossip }) },
      ...turns,
      { role: "user", content: message },
    ],
    });
  } catch (err) {
    console.error("deepseek error", err);
    return Response.json({ error: "Your Chog is napping (AI unavailable). Try again soon." }, { status: 503 });
  }

  const memoryOwner = speaker.role === "owner" ? speaker.address! : `visitor:${speaker.address ?? "anon"}`;
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
    headers: { "content-type": "text/plain; charset=utf-8", "x-speaker-role": speaker.role },
  });
}
