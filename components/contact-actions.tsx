import { normalizePhone, whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";

export function ContactActions({
  phone,
  whatsappMessage,
  mapsLink,
}: {
  phone: string;
  whatsappMessage: string;
  mapsLink?: string | null;
}) {
  const items = [
    { href: `tel:+${normalizePhone(phone)}`, label: "Call", external: false },
    { href: whatsappLink(phone, whatsappMessage), label: "WhatsApp", external: true },
    ...(mapsLink ? [{ href: mapsLink, label: "Maps", external: true }] : []),
  ];

  return (
    <div className={cn("grid gap-2", items.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noreferrer" : undefined}
          className="text-center rounded-xl border border-line py-3 text-sm font-semibold text-foreground hover:border-brand transition-colors"
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
