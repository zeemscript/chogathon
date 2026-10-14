"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { authMessage } from "@/lib/auth";
import { DEV_OWNER } from "@/lib/dev";

export type Auth = { address: string; issuedAt: string; signature: `0x${string}` };

const KEY = (a: string) => `chog-souls:auth:${a.toLowerCase()}`;

function load(address?: string): Auth | undefined {
  if (!address) return;
  try {
    const a = JSON.parse(localStorage.getItem(KEY(address)) ?? "null") as Auth | null;
    if (a && Date.now() - Date.parse(a.issuedAt) < 23 * 3600_000) return a;
  } catch {}
}

// Who's looking, and do they hold this Chog? In dev owner mode (lib/dev) you
// hold every Chog, with or without a wallet.
export function useViewer(owner?: string) {
  const { address: wallet } = useAccount();
  const dev = DEV_OWNER && !!owner;
  const address = wallet ?? (dev ? owner : undefined);
  return { address, isOwner: dev || (!!wallet && wallet.toLowerCase() === owner), dev };
}

// One signature per wallet per day proves "I'm this Chog's human".
export function useOwnerAuth(owner?: string) {
  const { address, isOwner, dev } = useViewer(owner);
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const [signed, setSigned] = useState<Auth>();

  // Dev owner mode: the server ignores the signature, so don't ask for one.
  const devAuth = dev && address ? { address, issuedAt: new Date(0).toISOString(), signature: "0x" as const } : undefined;
  const auth = devAuth ?? (signed?.address === address ? signed : load(address));

  async function signIn(): Promise<Auth | undefined> {
    if (devAuth) return devAuth;
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
