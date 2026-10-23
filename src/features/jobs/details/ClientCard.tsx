import { UserCircle } from "lucide-react";
import { DetailsCard, InfoRow } from "./DetailsCard";

/**
 * The customer, labelled and ordered as the shop's job form layout has them (name, phone, email and
 * any other client fields such as the address). Only what's filled in is shown; the phone row offers
 * WhatsApp.
 */
export default function ClientCard({ rows, onWhatsApp }: { rows: { id: string; label: string; value: string }[]; onWhatsApp?: () => void }) {
  if (rows.length === 0) return null;
  return (
    <DetailsCard icon={<UserCircle className="w-4 h-4 text-indigo-500" />} iconBg="bg-indigo-50" title="Client Information">
      <div className="flex flex-col gap-0 divide-y divide-slate-50">
        {rows.map((row) =>
          row.id === "fld_b_phone" ? (
            <InfoRow key={row.id} label={row.label}>
              <span className="inline-flex items-center gap-2">
                {row.value}
                {onWhatsApp && (
                  <button
                    type="button"
                    onClick={onWhatsApp}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[0.72rem] font-bold text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 print:hidden"
                    title="Chat on WhatsApp"
                  >
                    <i className="ph-fill ph-whatsapp-logo" aria-hidden="true"></i>
                    WhatsApp
                  </button>
                )}
              </span>
            </InfoRow>
          ) : (
            <InfoRow key={row.id} label={row.label}>{row.value}</InfoRow>
          )
        )}
      </div>
    </DetailsCard>
  );
}
