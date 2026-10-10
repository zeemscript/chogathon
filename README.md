# Chog Souls

Every Chog wakes up as an AI character with its own personality and memory — and that memory lives with the NFT. Sell your Chog, and its friendships, grudges and story go with it.

Built for Chogathon 2026.

## Key facts
- Chain: Monad mainnet (143), RPC `https://rpc.monad.xyz`
- Chog Genesis NFT: `0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763` (1969 supply)
- $CHOG token: `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` (18 decimals)
- Metadata: always call `tokenURI(id)` — token IDs don't match file numbers (token #1 → `1462.json`). Use `gateway.pinata.cloud`; ipfs.io/dweb.link are unreliable.
- Traits: Background, Base, Skin, Side, Body, Mouth, Eyes, Head, Accessory, Form, Tier, Naked

## Stack
Next.js + TypeScript, wagmi/viem/RainbowKit, Supabase (memory keyed by `token_id`), DeepSeek (`deepseek-chat`).

## Dev
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Credits

Chog art is from the [Chog Genesis](https://chog.xyz) collection, used with permission from the Chog team (toad, Chog Discord, 2026-10-10).
