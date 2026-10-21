import { Image as ImageIcon, LayoutList, Printer, UserCircle, Users, Wallet } from "lucide-react";
import FieldRenderer from "@/components/forms/FieldRenderer";
import type { FieldMap, FormLayout } from "@/lib/forms/types";
import { dynamicFieldValue, resolveDynamicSections, type DetailsJob } from "@/lib/jobs/resolveJobFields";
import { DetailsCard } from "./DetailsCard";

const noop = () => {};

function getSectionIcon(title: string | undefined) {
  const t = (title || "").toLowerCase();
  if (t.includes("job") || t.includes("print")) return <Printer className="w-5 h-5 text-indigo-500" />;
  if (t.includes("finishing") || t.includes("deliverable") || t.includes("proof")) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
  if (t.includes("payment") || t.includes("finance")) return <Wallet className="w-5 h-5 text-emerald-500" />;
  if (t.includes("client") || t.includes("contact") || t.includes("detail")) return <UserCircle className="w-5 h-5 text-blue-500" />;
  if (t.includes("team") || t.includes("staff") || t.includes("assign")) return <Users className="w-5 h-5 text-orange-500" />;
  return <LayoutList className="w-5 h-5 text-slate-500" />;
}

/**
 * Layout sections not covered by the fixed cards, rendered read-only (one card per section,
 * repeatable entries listed one after another). Visibility rules are not applied here.
 */
export default function DynamicSectionsView({ job, layout, fieldMap }: { job: DetailsJob; layout: FormLayout | null; fieldMap: FieldMap }) {
  return (
    <>
      {resolveDynamicSections(job, layout).map(({ section, globalFields, itemFields, entries }) => (
        <DetailsCard key={section.id} icon={getSectionIcon(section.title)} iconBg="bg-slate-50" title={section.title} className="col-span-1 lg:col-span-2">
          {/* Render Global Fields */}
          {globalFields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-50 border-t border-slate-50 pt-2">
              {globalFields.map((field) => (
                <FieldRenderer key={field.id} readOnly field={field} name={field.id} value={dynamicFieldValue(job, field, fieldMap, job.customData)} onChange={noop} variant="job" />
              ))}
            </div>
          )}

          {/* Render Repeatable Items */}
          {itemFields.length > 0 &&
            entries.map((entry, index) => (
              <div key={index} className={`grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-50 border-t border-slate-50 pt-2 ${index > 0 ? "mt-4 border-t-2 border-slate-100" : ""}`}>
                {itemFields.map((field) => (
                  <FieldRenderer key={field.id} readOnly field={field} name={field.id} value={dynamicFieldValue(job, field, fieldMap, entry)} onChange={noop} variant="job" />
                ))}
              </div>
            ))}
        </DetailsCard>
      ))}
    </>
  );
}
