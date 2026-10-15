import { api } from "@drink/backend/api";
import { formatDateLong } from "@drink/shared";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { LinkState } from "../../public-ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Booking terms" };

export default async function TermsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchQuery(api.public.termsForToken, { token });
  if (!data.terms) {
    return <LinkState title="This link has expired." body="Message us on WhatsApp for a copy of our terms." whatsapp={data.whatsapp} />;
  }
  return (
    <article className="max-w-[65ch]">
      <p className="mb-4 text-caption text-fg-3">
        Version {data.terms.version} · in force from {formatDateLong(data.terms.publishedAt)}
      </p>
      <Markdown source={data.terms.body} />
    </article>
  );
}
