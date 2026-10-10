"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";

// RainbowKit's modal, our button. Keeps the wallet UI on-brand.
export default function WalletButton({ size = "sm" }: { size?: "sm" | "default" | "lg" }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        if (!mounted) return <Button size={size} className="invisible" aria-hidden>Connect</Button>;
        if (!account || !chain) {
          return (
            <Button size={size} variant={size === "lg" ? "hero" : "default"} onClick={openConnectModal}>
              Connect wallet
            </Button>
          );
        }
        if (chain.unsupported) {
          return (
            <Button size={size} variant="destructive" onClick={openChainModal}>
              Switch to Monad
            </Button>
          );
        }
        return (
          <Button size={size} variant="outline" onClick={openAccountModal}>
            <span className="size-2 rounded-full bg-chog-ok shadow-[0_0_10px_#5ce68a]" />
            {account.displayName}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
