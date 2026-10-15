import { api } from "@drink/backend/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { LinkState } from "../../public-ui";
import { ConsentForm } from "./consent-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Consent form" };

export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await fetchQuery(api.public.consentContext, { token });

  if (data.state === "used") {
    return <LinkState title="You're all set." body="Your consent form is already signed. See you soon." whatsapp={data.whatsapp} />;
  }
  if (data.state !== "ok" || !data.session) {
    return (
      <LinkState
        title="This link has expired."
        body="Message us on WhatsApp and we'll sort it out."
        whatsapp={data.whatsapp}
      />
    );
  }
  return <ConsentForm token={token} session={data.session} whatsapp={data.whatsapp} />;
}
