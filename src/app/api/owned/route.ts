import { type NextRequest } from "next/server";
import { isAddress } from "viem";
import { getChog } from "@/lib/chogs";
import { getOwnedTokenIds } from "@/lib/owners";

// GET /api/owned?address=0x... -> the Chogs that wallet holds right now.
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !isAddress(address)) {
    return Response.json({ error: "invalid address" }, { status: 400 });
  }
  const ids = await getOwnedTokenIds(address);
  return Response.json({ chogs: ids.map(getChog).filter(Boolean) });
}
