import "server-only";
import sharp from "sharp";

// Share previews must be small and fast: WhatsApp skips images over ~300KB and
// gives up on slow ones. Re-encode the PNG as JPEG and let the CDN cache it.
export async function asShareJpeg(img: Response, { maxAge = 3600 }: { maxAge?: number } = {}): Promise<Response> {
  const png = Buffer.from(await img.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": `public, max-age=300, s-maxage=${maxAge}, stale-while-revalidate=86400`,
    },
  });
}
