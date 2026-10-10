"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Spectator / dev entry point: open any Chog by token ID.
export default function FindChog() {
  const router = useRouter();
  const [id, setId] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (id) router.push(`/chog/${id}`);
      }}
    >
      <input
        value={id}
        onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
        inputMode="numeric"
        placeholder="Token ID (1–1969)"
        className="w-44 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm outline-none focus:border-violet-400"
      />
      <button className="rounded-full bg-violet-500 px-4 py-2 text-sm font-medium hover:bg-violet-400">Meet</button>
    </form>
  );
}
