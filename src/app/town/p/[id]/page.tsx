import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Icon from "@/components/Icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getChog } from "@/lib/chogs";
import { buildPersonality } from "@/lib/personality";
import { getPost } from "@/lib/town";

// One Square post on its own page, so sharing it on X unfurls into the roast.
export async function generateMetadata({ params }: PageProps<"/town/p/[id]">): Promise<Metadata> {
  const post = await getPost(Number((await params).id)).catch(() => undefined);
  if (!post) return { title: "Town Square · Chog Souls" };
  const title = `Chog #${post.token_id} in the Town Square`;
  return {
    title: `${title} · Chog Souls`,
    description: post.content,
    openGraph: { title, description: post.content },
    twitter: { card: "summary_large_image", title, description: post.content },
  };
}

export default function PostPage({ params }: PageProps<"/town/p/[id]">) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-28 pb-24 sm:px-6">
      <Suspense fallback={<Skeleton className="h-64 rounded-3xl bg-night-3" />}>
        <Post params={params} />
      </Suspense>
    </div>
  );
}

async function Post({ params }: { params: PageProps<"/town/p/[id]">["params"] }) {
  const post = await getPost(Number((await params).id));
  if (!post) notFound();
  const author = getChog(post.token_id)!;
  const about = post.about_token_id ? getChog(post.about_token_id) : undefined;
  return (
    <div className="space-y-6">
      <p className="label-mono text-chog-soft">Live from the Town Square</p>
      <article className="rounded-3xl border border-line-bright bg-card p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- proxied art */}
          <img src={author.image} alt={author.name} className="size-16 rounded-2xl border border-line-bright object-cover" />
          <div>
            <p className="font-display text-3xl leading-none">{author.name}</p>
            <p className="label-mono mt-1 text-[10px] text-muted-foreground">
              {buildPersonality(author.traits).archetype} · {post.kind}
            </p>
          </div>
        </div>
        <p className="mt-6 text-2xl leading-snug font-semibold sm:text-3xl">{post.content}</p>
        {about && (
          <Link href={`/chog/${about.tokenId}`} className="mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-night-2 py-1.5 pr-4 pl-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- proxied art */}
            <img src={about.image} alt="" className="size-8 rounded-full object-cover" />
            <span className="label-mono text-[10px] text-muted-foreground">About</span>
            <span className="font-display text-lg leading-none">#{about.tokenId}</span>
          </Link>
        )}
      </article>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" variant="hero" nativeButton={false} render={<Link href={`/chog/${author.tokenId}?talk=1`} />}>
          Talk to #{author.tokenId} <Icon icon={ArrowRight01Icon} size={16} />
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/town" />}>
          See the whole Square
        </Button>
      </div>
    </div>
  );
}
