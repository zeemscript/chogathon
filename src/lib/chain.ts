import { parseAbi } from "viem";
import { monad } from "viem/chains";

export { monad };

export const MONAD_RPC = process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://rpc.monad.xyz";
export const CHOG_NFT = (process.env.NEXT_PUBLIC_CHOG_NFT ??
  "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763") as `0x${string}`;
export const CHOG_TOKEN = (process.env.NEXT_PUBLIC_CHOG_TOKEN ??
  "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777") as `0x${string}`;
export const CHOG_SUPPLY = 1969;

export const chogNftAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
