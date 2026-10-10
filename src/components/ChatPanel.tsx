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
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll only the message list (scrollIntoView would move the whole page).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
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
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "Something went wrong");
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

  return (
    <section className="overflow-hidden rounded-2xl border border-line-bright bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-night-2/70 px-5 py-4">
        <div>
          <p className="label-mono text-chog-soft">✦ Talk</p>
          <h2 className="font-display text-2xl">Say gm to {name}</h2>
        </div>
        {isOwner && !auth ? (
          <Button size="sm" variant="ok" onClick={signIn} disabled={signing}>
            {signing ? "Check your wallet…" : "Sign in as its human"}
          </Button>
        ) : (
          <span
            className={cn(
              "label-mono rounded-full border px-3 py-1 text-[10.5px]",
              isOwner ? "border-chog-ok/40 bg-chog-ok/10 text-chog-ok" : "border-border text-muted-foreground",
            )}
          >
            {isOwner ? "You're its human" : "Visitor · it may not trust you"}
          </span>
        )}
      </div>

      <div ref={listRef} className="h-[360px] space-y-3 overflow-y-auto px-5 py-5">
        {lines.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="font-display text-3xl text-white/20">It&apos;s listening</p>
              <p className="mt-1 text-sm text-muted-foreground">Say something. It remembers.</p>
            </div>
          </div>
        )}
        {lines.map((l, i) => (
          <p
            key={i}
            className={cn(
              "w-fit max-w-[85%] animate-in rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed duration-300 fade-in slide-in-from-bottom-2",
              l.from === "you"
                ? "ml-auto rounded-br-md bg-chog text-white shadow-hard"
                : "rounded-bl-md border border-border bg-night-3",
            )}
          >
            {l.text || <span className="inline-flex gap-1 py-1">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-pulse-dot rounded-full bg-chog-soft" style={{ animationDelay: `${d * 0.2}s` }} />)}</span>}
          </p>
        ))}
      </div>

      {error && <p className="px-5 pb-2 text-sm text-destructive">{error}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-border bg-night-2/50 p-3">
        <Input
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
