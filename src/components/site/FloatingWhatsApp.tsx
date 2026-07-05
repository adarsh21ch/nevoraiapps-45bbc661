import { MessageCircle } from "lucide-react";
import { useTenant } from "@/lib/tenant-context";

export function FloatingWhatsApp() {
  const tenant = useTenant();
  const num = (tenant.whatsapp ?? tenant.phone ?? "").replace(/[^\d]/g, "");
  if (!num) return null;
  const href = `https://wa.me/${num}?text=${encodeURIComponent(`Hi ${tenant.name}, I'd like to know more.`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-110 sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-6 w-6" fill="currentColor" />
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-[#25D366] ring-2 ring-white" />
      </span>
    </a>
  );
}
