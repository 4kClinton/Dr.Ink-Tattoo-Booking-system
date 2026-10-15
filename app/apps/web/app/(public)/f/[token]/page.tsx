import { api } from "@drink/backend/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { LinkState } from "../../public-ui";
import { FeedbackForm } from "./feedback-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "How did it go?" };

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchQuery(api.public.feedbackContext, { token });
  if (data.state === "used") {
    return <LinkState title="Thanks — we already have your feedback." body="Anything else? We're on WhatsApp." whatsapp={data.whatsapp} />;
  }
  if (data.state !== "ok") {
    return <LinkState title="This link has expired." body="We'd still love to hear from you on WhatsApp." whatsapp={data.whatsapp} />;
  }
  return (
    <FeedbackForm
      token={token}
      firstName={data.firstName}
      googleReviewUrl={data.googleReviewUrl}
      instagramHandle={data.instagramHandle}
    />
  );
}
