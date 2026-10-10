"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { authMessage } from "@/lib/auth";

export type Auth = { address: string; issuedAt: string; signature: `0x${string}` };

const KEY = (a: string) => `chog-souls:auth:${a.toLowerCase()}`;

function load(address?: string): Auth | undefined {
  if (!address) return;
  try {
    const a = JSON.parse(localStorage.getItem(KEY(address)) ?? "null") as Auth | null;
    if (a && Date.now() - Date.parse(a.issuedAt) < 23 * 3600_000) return a;
  } catch {}
}

// One signature per wallet per day proves "I'm this Chog's human".
export function useOwnerAuth(owner?: string) {
  const { address } = useAccount();
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const [signed, setSigned] = useState<Auth>();

  const isOwner = !!address && address.toLowerCase() === owner;
  const auth = signed?.address === address ? signed : load(address);

  async function signIn(): Promise<Auth | undefined> {
    if (!address) return;
    const issuedAt = new Date().toISOString();
    const signature = await signMessageAsync({ message: authMessage(address, issuedAt) });
    const a = { address, issuedAt, signature };
    try {
      localStorage.setItem(KEY(address), JSON.stringify(a));
    } catch {}
    setSigned(a);
    return a;
  }

  return { address, isOwner, auth, signIn, signing };
}
