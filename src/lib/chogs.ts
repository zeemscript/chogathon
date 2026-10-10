import "server-only";
import data from "@/data/chogs.json";

export type Traits = Record<string, string>;

export type Chog = {
  tokenId: number;
  name: string;
  image: string; // ipfs:// URI
  traits: Traits;
};

const byId = new Map((data as Chog[]).map((c) => [c.tokenId, c]));

// Images are served through our /api/img proxy (IPFS gateways rate-limit browsers).
export function getChog(tokenId: number): Chog | undefined {
  const c = byId.get(tokenId);
  return c && { ...c, image: `/api/img/${tokenId}` };
}

// Raw metadata with the original ipfs:// image URI.
export function getChogRaw(tokenId: number): Chog | undefined {
  return byId.get(tokenId);
}

export function parseTokenId(raw: string | null | undefined): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && byId.has(n) ? n : undefined;
}
