import "server-only";

// Public gateways rate-limit hard (Pinata 429s under load), so try several.
const GATEWAYS = [
  "https://ipfs.filebase.io/ipfs",
  process.env.IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://w3s.link/ipfs",
];

const coolUntil = new Map<string, number>();

export async function fetchIpfs(uri: string): Promise<Response> {
  const path = uri.replace(/^ipfs:\/\//, "");
  const ready = GATEWAYS.filter((g) => (coolUntil.get(g) ?? 0) <= Date.now());
  for (const gw of ready.length ? ready : GATEWAYS) {
    try {
      const res = await fetch(`${gw}/${path}`, { signal: AbortSignal.timeout(12_000) });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) coolUntil.set(gw, Date.now() + 60_000);
    } catch (err) {
      console.warn(`ipfs ${gw} failed:`, err instanceof Error ? err.message : err);
      coolUntil.set(gw, Date.now() + 30_000);
    }
  }
  throw new Error(`all gateways failed for ${path}`);
}
