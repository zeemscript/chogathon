// JSON with CDN caching: Vercel's edge serves the copy for `fresh` seconds,
// then keeps serving it while refreshing in the background for `stale` more.
export function cachedJson(data: unknown, fresh: number, stale = fresh * 20) {
  return Response.json(data, {
    headers: { "cache-control": `public, max-age=0, s-maxage=${fresh}, stale-while-revalidate=${stale}` },
  });
}
