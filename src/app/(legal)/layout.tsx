import type { ReactNode } from "react";
import { Outfit } from "next/font/google";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

/** Public legal pages (privacy, terms): the sign-in page's dark canvas, scrolling on its own inside the fixed body. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`relative h-[100dvh] w-full overflow-y-auto overflow-x-hidden bg-[#060b1c] text-slate-200 ${outfit.className} selection:bg-pink-500 selection:text-white`}>
      <div className="pointer-events-none absolute right-0 top-0 h-[260px] w-[260px] sm:h-[420px] sm:w-[420px]" aria-hidden="true">
        <div className="absolute right-[-50px] top-[-50px] h-[280px] w-[330px] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-gradient-to-bl from-[#ff007a] via-[#ff4d00] to-[#ffb800] opacity-90 blur-sm" />
      </div>
      <div className="pointer-events-none absolute left-1/4 top-1/3 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-blue-600/10 blur-[140px]" aria-hidden="true" />
      <div className="relative z-10 mx-auto w-full max-w-[880px] px-4 py-6 sm:px-8 sm:py-10 lg:py-14">{children}</div>
    </div>
  );
}
