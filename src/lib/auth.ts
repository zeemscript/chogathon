import { getAddress } from "viem";

// Owners sign this once; the server re-verifies it on every chat request.
export const AUTH_TTL_MS = 24 * 60 * 60 * 1000;

export function authMessage(address: string, issuedAt: string): string {
  return `Chog Souls\n\nSign in to talk to your Chogs.\n\nAddress: ${getAddress(address)}\nIssued: ${issuedAt}`;
}
