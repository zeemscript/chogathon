# What Chog Souls needs from you

Your checklist. Each item says why it matters and exactly what to do.
Tick items off as you go (`[ ]` → `[x]`). Never put private keys or seed phrases here.

Last updated: 2026-10-10

## Blocking features

- [ ] **Top up DeepSeek** (chat replies, AI-written Town Square posts and roasts)
  - Go to https://platform.deepseek.com → Top up. $5 is plenty for development.
  - Checked 2026-10-10: balance is still $0, so chat says "napping" and roasts come from templates.

- [ ] **Test $CHOG feeding once** (treasury is set ✓). You need a little $CHOG + MON for gas.
      Open any Chog page and press Feed 100. No feeds recorded yet.

## Testing

- [ ] **A Chog to test as an owner** (or a borrowed wallet holding one)
  - Floor is ~5,450 MON. A real buy also gives the best demo: the Chog noticing its new owner.
  - Meanwhile: add `DEV_IMPERSONATE_OWNER=1` to `.env.local` to act as the owner of any Chog (dev only).

- [ ] **10–20 real holders to try it** (day 13 of the plan). The site is public now:
      https://chog-souls.vercel.app, so you can start sharing it in the Chog Discord.

## Ask the organizers (Chog Discord)

- [ ] **Who is the Chog Genesis artist?** toad said to credit them if it's an independent artist.
      Send me the name/handle and I'll add it to the footer, README and demo video.
- [ ] **What got "extended"** (build deadline or registration)? Affects how much we can build.
- [ ] **Can the submission be edited after submitting?** (Chog World shows "UPDATE 29".)

## Optional

- [ ] **WalletConnect project ID** (lets people connect mobile wallets via QR): https://cloud.reown.com →
      new project → copy the ID into `.env.local` as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...` and tell me.
- [ ] **Regenerate the OpenSea API key** (it was shared in chat), then tell me the new one.
- [ ] **If you change any key in `.env.local`**, tell me so I update it on Vercel too.

## Done

- [x] Supabase project created
- [x] Migrations `0001_init.sql`, `0002_aura.sql`, `0003_boost_roast_market.sql` run
- [x] `SUPABASE_SECRET_KEY`, `DEEPSEEK_API_KEY`, `OPENSEA_API_KEY` added to `.env.local`
- [x] Treasury wallet set (`NEXT_PUBLIC_CHOG_TREASURY`)
- [x] `OPENSEA_API_KEY` and `CRON_SECRET` added on Vercel
- [x] Deployed to production: https://chog-souls.vercel.app (daily Square cron active)
- [x] Cleared to use Chog Genesis art in the app and demo (toad, Chog Discord, 2026-10-10)
