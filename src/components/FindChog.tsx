"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Spectator entry point: open any Chog by token ID.
export default function FindChog() {
  const router = useRouter();
  const [id, setId] = useState("");
  const valid = Number(id) >= 1 && Number(id) <= 1969;
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/chog/${id}`);
      }}
    >
      <Input
        value={id}
        onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        placeholder="Token # 1–1969"
        aria-label="Token ID"
        className="h-11 w-40 rounded-[10px] bg-white/[.04] font-mono"
      />
      <Button type="submit" disabled={!valid}>
        Meet
      </Button>
    </form>
  );
}
