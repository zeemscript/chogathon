"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { authMessage } from "@/lib/auth";

type Auth = { address: string; issuedAt: string; signature: `0x${string}` };
type Line = { from: "you" | "chog"; text: string };

const AUTH_KEY = (a: string) => `chog-souls:auth:${a.toLowerCase()}`;

function loadAuth(address?: string): Auth | undefined {
  if (!address) return;
  try {
    const a = JSON.parse(localStorage.getItem(AUTH_KEY(address)) ?? "null") as Auth | null;
    if (a && Date.now() - Date.parse(a.issuedAt) < 23 * 3600_000) return a;
  } catch {}
}

export default function ChatPanel({ tokenId, name, owner }: { tokenId: number; name: string; owner?: string }) {
  const { address } = useAccount();
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const [signed, setSigned] = useState<Auth>();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  const isOwner = !!address && address.toLowerCase() === owner;
  // Fresh signature from this session, else one saved earlier for this wallet.
  const auth = signed?.address === address ? signed : loadAuth(address);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [lines]);

  async function signIn() {
    if (!address) return;
    const issuedAt = new Date().toISOString();
    const signature = await signMessageAsync({ message: authMessage(address, issuedAt) });
    const a = { address, issuedAt, signature };
    try {
      localStorage.setItem(AUTH_KEY(address), JSON.stringify(a));
    } catch {}
    setSigned(a);
  }

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
    <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Talk to {name}</h2>
        {isOwner && !auth ? (
          <button
            onClick={signIn}
            disabled={signing}
            className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {signing ? "Check your wallet…" : "Sign in as its human"}
          </button>
        ) : (
          <span className="text-xs text-zinc-400">
            {isOwner ? "You're its human" : "You're a visitor. It may not trust you."}
          </span>
        )}
      </div>

      <div className="max-h-96 min-h-32 space-y-2 overflow-y-auto">
        {lines.length === 0 && <p className="text-sm text-zinc-500">Say something. It remembers.</p>}
        {lines.map((l, i) => (
          <p
            key={i}
            className={
              l.from === "you"
                ? "ml-auto w-fit max-w-[85%] rounded-2xl bg-violet-500 px-3 py-2 text-sm"
                : "w-fit max-w-[85%] rounded-2xl bg-white/10 px-3 py-2 text-sm"
            }
          >
            {l.text || "…"}
          </p>
        ))}
        <div ref={endRef} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder={`Message ${name}`}
          className="flex-1 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm outline-none focus:border-violet-400"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-full bg-violet-500 px-4 py-2 text-sm font-medium hover:bg-violet-400 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}
