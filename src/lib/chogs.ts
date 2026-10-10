import "server-only";
import data from "@/data/chogs.json";

export type Traits = Record<string, string>;

export type Chog = {
  tokenId: number;
  name: string;
  image: string; // ipfs:// URI
  traits: Traits;
};

const GATEWAY = process.env.IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";
const byId = new Map((data as Chog[]).map((c) => [c.tokenId, c]));

export function getChog(tokenId: number): Chog | undefined {
  const c = byId.get(tokenId);
  return c && { ...c, image: c.image.replace(/^ipfs:\/\//, `${GATEWAY}/`) };
}

export function parseTokenId(raw: string | null | undefined): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && byId.has(n) ? n : undefined;
}
