import { MessageCircle } from "lucide-react";

export function WhatsAppButton({ whatsapp, label = "Message us on WhatsApp" }: { whatsapp: string; label?: string }) {
  return (
    <a
      href={`https://wa.me/${whatsapp}`}
      className="tap inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 font-semibold hover:bg-hover"
    >
      <MessageCircle className="size-4" aria-hidden /> {label}
    </a>
  );
}

export function LinkState({ title, body, whatsapp }: { title: string; body: string; whatsapp: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-heading font-semibold">{title}</h1>
      <p className="text-fg-2">{body}</p>
      <WhatsAppButton whatsapp={whatsapp} />
    </div>
  );
}
