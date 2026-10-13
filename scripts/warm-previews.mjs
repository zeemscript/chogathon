// After a deploy the CDN cache is empty and share images take 2–4s to render.
// X gives up on slow images and then remembers "no preview" for days, so warm
// the main ones right after deploying.
// Usage: node scripts/warm-previews.mjs [baseUrl]
const base = process.argv[2] ?? "https://chog-souls.vercel.app";
const pages = ["/", "/town", "/aura", "/chog/1", "/chog/561", "/chog/1432", "/chog/1903", "/chog/284", "/chog/561?card=poster", "/chog/561?card=paper"];
for (const page of pages) {
  const html = await (await fetch(base + page, { headers: { "user-agent": "Twitterbot/1.0" } })).text();
  const img = html.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!img) {
    console.log(`${page}: no twitter:image tag!`);
    continue;
  }
  const t = Date.now();
  const res = await fetch(img, { headers: { "user-agent": "Twitterbot/1.0" } });
  console.log(`${page}: ${res.status} ${res.headers.get("content-type")} ${Date.now() - t}ms`);
}
process.exit(0); // keep-alive sockets would otherwise hold the process open
