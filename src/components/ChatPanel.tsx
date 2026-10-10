"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { cn } from "@/lib/utils";

type Line = { from: "you" | "chog"; text: string };

export default function ChatPanel({ tokenId, name, owner }: { tokenId: number; name: string; owner?: string }) {
  const { isOwner, auth, signIn, signing } = useOwnerAuth(owner);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [left, setLeft] = useState<{ remaining: number; limit: number }>();
  const listRef = useRef<HTMLDivElement>(null);

  // Arriving with ?talk=1 (from "Talk to a Chog") jumps straight into the chat.
  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("talk")) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 600);
    return () => clearTimeout(t);
  }, []);

  // The first-meeting screen can hand us an opening line.
  useEffect(() => {
    const onPrefill = (e: Event) => setInput(String((e as CustomEvent).detail ?? ""));
    window.addEventListener("chog:prefill", onPrefill);
    return () => window.removeEventListener("chog:prefill", onPrefill);
  }, []);

  // Scroll only the message list (scrollIntoView would move the whole page).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  async function send(e?: React.FormEvent, preset?: string) {
    e?.preventDefault();
    const message = (preset ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setError(undefined);
    setBusy(true);
    setLines((l) => [...l, { from: "you", text: message }, { from: "chog", text: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, message, auth }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        if (res.status === 429) setLeft({ remaining: 0, limit: j?.limit ?? 0 });
        throw new Error(j?.error ?? "Something went wrong");
      }
      const remaining = Number(res.headers.get("x-chat-remaining"));
      const limit = Number(res.headers.get("x-chat-limit"));
      if (Number.isFinite(remaining) && limit) setLeft({ remaining, limit });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setLines((l) => [...l.slice(0, -1), { from: "chog", text: l[l.length - 1].text + chunk }]);
      }
    } catch (err) {
      setLines((l) => l.slice(0, -1));
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const avatar = `/api/img/${tokenId}`;
  const prompts = isOwner
    ? ["gm, did you miss me?", "Who's your nemesis?", "What did the Square say about you?", "Tell me a secret"]
    : ["gm stranger", "Who's your human?", "Who do you hate the most?", "Why should I trust you?"];

  return (
    <section ref={sectionRef} className="flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-line-bright bg-card shadow-card">
      <div className="flex items-center gap-3 border-b border-border bg-night-2/70 px-4 py-3.5">
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image */}
          <img src={avatar} alt="" className="size-11 rounded-xl border border-line-bright object-cover" />
          <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-night-2 bg-chog-ok" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl leading-none">{name}</h2>
          <p className="label-mono mt-1 truncate text-[10px] text-muted-foreground">
            {busy ? "typing…" : isOwner ? (auth ? "Talking to its human" : "Your Chog · sign in to be recognised") : "Visitor · it may not trust you"}
          </p>
        </div>
        {isOwner && !auth ? (
          <Button size="sm" variant="ok" onClick={signIn} disabled={signing}>
            {signing ? "Check wallet…" : "Sign in"}
          </Button>
        ) : (
          left && (
            <span
              className={cn(
                "label-mono shrink-0 rounded-full border px-2.5 py-1 text-[10px]",
                left.remaining <= 3 ? "border-chog-pink/40 text-pink-300" : "border-border text-muted-foreground",
              )}
            >
              {left.remaining}/{left.limit} left
            </span>
          )
        )}
      </div>

      <div ref={listRef} className="h-[380px] space-y-3 overflow-y-auto px-4 py-5 sm:h-[440px]">
        {lines.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <div>
              <p className="font-display text-4xl text-white/20">It&apos;s listening</p>
              <p className="mt-1 text-sm text-muted-foreground">Say something. It remembers. Forever.</p>
            </div>
            <div className="flex max-w-sm flex-wrap justify-center gap-2">
              {prompts.map((q) => (
                <button
                  key={q}
                  onClick={() => send(undefined, q)}
                  disabled={busy}
                  className="cursor-pointer rounded-full border border-line-bright bg-white/[.04] px-3.5 py-2 text-sm text-chog-soft transition-colors hover:border-chog hover:bg-chog/15 hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn("flex animate-in items-end gap-2 duration-300 fade-in slide-in-from-bottom-2", l.from === "you" && "flex-row-reverse")}
          >
            {l.from === "chog" && (
              // eslint-disable-next-line @next/next/no-img-element -- proxied IPFS image
              <img src={avatar} alt="" className="size-7 shrink-0 rounded-lg object-cover" />
            )}
            <p
              className={cn(
                "w-fit max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                l.from === "you" ? "rounded-br-md bg-chog text-white shadow-hard" : "rounded-bl-md border border-border bg-night-3",
              )}
            >
              {l.text || (
                <span className="inline-flex gap-1 py-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="size-1.5 animate-pulse-dot rounded-full bg-chog-soft" style={{ animationDelay: `${d * 0.2}s` }} />
                  ))}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {error && <p className="border-t border-border px-4 py-2.5 text-sm text-pink-200">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-border bg-night-2/50 p-3">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder={`Message ${name}…`}
          className="h-11 flex-1 rounded-[10px] bg-white/[.04]"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </section>
  );
}
