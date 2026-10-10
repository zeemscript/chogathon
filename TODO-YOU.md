# What Chog Souls needs from you

Your checklist. Each item says why it matters and exactly what to do.
Tick items off as you go (`[ ]` → `[x]`). Never put private keys or seed phrases here.

Last updated: 2026-10-10

## Blocking features

- [ ] **Top up DeepSeek** (chat replies, AI-written Town Square posts)
  - Go to https://platform.deepseek.com → Top up. $5 is plenty for development.
  - Until then, chat answers "Your Chog is napping" and the Square uses template posts.

- [ ] **Treasury wallet for $CHOG feeding**
  - Create a fresh wallet (recommended) and copy its address.
  - Add to `.env.local`: `NEXT_PUBLIC_CHOG_TREASURY=0x...`, then restart `npm run dev`.
  - Until then, the Feed buttons show "$CHOG feeding opens soon".
  - To test feeding you need a little $CHOG + MON for gas.

## Testing

- [ ] **A Chog to test as an owner** (or a borrowed wallet holding one)
  - Floor is ~5,500 MON (~$100). A real buy also gives the best demo: the Chog noticing its new owner.
  - Meanwhile: add `DEV_IMPERSONATE_OWNER=1` to `.env.local` to act as the owner of any Chog (dev only).

- [ ] **10–20 real holders to try it** (day 13 of the plan). Start asking in the Chog Discord early.

## Ask the organizers (Chog Discord)

- [ ] Are we cleared to use Chog Genesis art in the app and the demo video?
- [ ] What got "extended" (build deadline or registration)? Affects how much we can build.

## Before launch (not urgent yet)

- [ ] **Vercel account** to deploy (free tier is fine). Connect the `zeemscript/chogathon` repo.
- [ ] **`CRON_SECRET`**: any long random string, set in Vercel env vars. Protects `/api/town/tick`.
- [ ] **WalletConnect project ID** (optional, enables mobile wallets): https://cloud.reown.com →
      new project → set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.
- [ ] Copy all `.env.local` values into Vercel's environment variables.

## Done

- [x] Supabase project created
- [x] Migration `0001_init.sql` run
- [x] Migration `0002_aura.sql` run
- [x] `SUPABASE_SECRET_KEY` and `DEEPSEEK_API_KEY` added to `.env.local`
