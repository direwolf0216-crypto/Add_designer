"use client";

import { useState, Suspense, useCallback, useEffect, useMemo, startTransition, ViewTransition } from "react";
import { useSlidingPill } from "@/components/motion/useSlidingPill";
import { createPortal } from "react-dom";
import { useStoredBoolean } from "@/hooks/useStoredBoolean";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import PageReveal from "@/components/motion/PageReveal";
import PrinterLoader from "@/components/motion/PrinterLoader";
import { useConfirmSettingsLeave } from "@/lib/settings/leaveGuard";
import { useSession } from "next-auth/react";
import { homePathFor } from "@/lib/permissions";
import { markArriving, startNavProgress } from "@/components/motion/NavProgress";

// Each settings tab is code-split; the open tab's bundle comes first and the rest download in the
// background once the page is idle, so switching tabs never waits on a download.
const tabLoading = () => <PrinterLoader label="Printing your settings" />;
const TAB_CODE = {
  users: () => import("@/components/settings/UserManagement"),
  permissions: () => import("@/components/settings/RolesPermissions"),
  layouts: () => import("@/components/settings/LayoutsFieldsBuilder"),
  "recycle-bin": () => import("@/components/settings/RecycleBin"),
  teams: () => import("@/components/settings/TeamsSettings"),
  business: () => import("@/components/settings/BusinessDetails"),
  pricing: () => import("@/components/settings/PricingRules"),
  "google-drive": () => import("@/components/settings/integrations/GoogleDriveIntegration"),
};
const UserManagement = dynamic(TAB_CODE.users, { loading: tabLoading });
const RolesPermissions = dynamic(TAB_CODE.permissions, { loading: tabLoading });
const LayoutsFieldsBuilder = dynamic(TAB_CODE.layouts, { loading: tabLoading });
const RecycleBin = dynamic(TAB_CODE["recycle-bin"], { loading: tabLoading });
const TeamsSettings = dynamic(TAB_CODE.teams, { loading: tabLoading });
const BusinessDetails = dynamic(TAB_CODE.business, { loading: tabLoading });
const PricingRules = dynamic(TAB_CODE.pricing, { loading: tabLoading });
const GoogleDriveIntegration = dynamic(TAB_CODE["google-drive"], { loading: tabLoading });

const GROUPS = [
  {
    label: "Team",
    items: [
      { id: "users", label: "Users & Team", icon: "ph-users-three" },
      { id: "permissions", label: "Roles & Permissions", icon: "ph-shield-check" },
      { id: "teams", label: "Teams", icon: "ph-users-four" },
    ]
  },
  {
    label: "Customization",
    items: [
      { id: "layouts", label: "Layouts & Fields", icon: "ph-layout" },
      { id: "business", label: "Business Details", icon: "ph-storefront" },
      { id: "pricing", label: "Pricing", icon: "ph-ruler" },
    ]
  },
  {
    label: "Integrations",
    items: [
      { id: "google-drive", label: "Google Drive", icon: "ph-google-logo" },
    ]
  },
  {
    label: "Data",
    items: [
      { id: "recycle-bin", label: "Recycle Bin", icon: "ph-trash" },
    ]
  }
] as const;

type SectionId = typeof GROUPS[number]["items"][number]["id"];

interface SidebarContentProps {
  groups: typeof GROUPS;
  activeSection: SectionId;
  onSectionSwitch: (id: SectionId) => void;
  isCollapsed?: boolean;
}

const SidebarContent = ({ groups, activeSection, onSectionSwitch, isCollapsed = false }: SidebarContentProps) => {
  const router = useRouter();
  const confirmLeave = useConfirmSettingsLeave();
  // Back goes straight to the person's home page (not "/", which redirects through a server round
  // trip and the app-wide loader), and that page is prefetched so the switch is instant.
  const { data: session } = useSession();
  const home = homePathFor(session?.user?.role, session?.user?.permissions);
  useEffect(() => {
    router.prefetch(home);
  }, [router, home]);
  // The orange highlight glides to the picked tab.
  const { ref: pillRef, style: pillStyle } = useSlidingPill<HTMLDivElement>(activeSection);
  return (
  <div ref={pillRef} className="relative flex flex-col h-full py-4 px-3 overflow-y-auto no-scrollbar overflow-x-hidden">
    {pillStyle && <span aria-hidden="true" data-sliding-pill className="rounded-xl bg-orange-50" style={pillStyle} />}
    <button 
      onClick={async () => {
        if (!(await confirmLeave())) return;
        startNavProgress();
        router.push(home);
      }}
      className={`flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-slate-800 transition-colors mb-4 ${isCollapsed ? 'justify-center px-0' : ''}`}
      title={isCollapsed ? "Back" : undefined}
    >
      <i className="ph-bold ph-arrow-left text-lg shrink-0"></i>
      {!isCollapsed && <span className="text-[0.85rem] font-bold">Back</span>}
    </button>

    {groups.map((group, groupIdx) => (
      <div key={group.label} className={groupIdx > 0 ? "mt-6" : ""}>
        <div className={`mb-2 text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ${isCollapsed ? 'hidden' : 'px-3'}`}>
          {group.label}
        </div>
        <div className="flex flex-col gap-1">
          {group.items.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                data-pill-key={item.id}
                onClick={() => onSectionSwitch(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`relative z-10 flex items-center gap-3 py-2.5 rounded-xl transition-colors duration-300 text-[0.85rem] font-semibold outline-none ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  isActive
                    ? "text-orange-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <i className={`${isActive ? "ph-fill" : "ph"} ${item.icon} text-lg shrink-0 transition-colors duration-300 ${isActive ? "text-orange-500" : "text-slate-400"}`}></i>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
    ))}
  </div>
)};

function SettingsPage() {
  const searchParams = useSearchParams();

  const urlSection = (searchParams.get("section") as SectionId) ?? "users";
  // The shown tab is switched inside a React transition (so it crossfades) and mirrored to the URL;
  // back / forward (the URL changing on its own) follows too.
  const [activeSection, setActiveSection] = useState<SectionId>(urlSection);
  const [seenUrlSection, setSeenUrlSection] = useState<SectionId>(urlSection);
  if (urlSection !== seenUrlSection) {
    setSeenUrlSection(urlSection);
    if (urlSection !== activeSection) setActiveSection(urlSection);
  }
  // The top bar's menu button (phones) navigates to ?menu=open; the sheet also opens from that.
  const menuRequested = searchParams.get("menu") === "open";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(menuRequested);
  const [prevMenuRequested, setPrevMenuRequested] = useState(menuRequested);
  if (menuRequested !== prevMenuRequested) {
    setPrevMenuRequested(menuRequested);
    if (menuRequested) setIsMobileMenuOpen(true);
  }
  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
    if (menuRequested) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("menu");
      window.history.replaceState(null, "", `?${next.toString()}`);
    }
  }, [menuRequested, searchParams]);
  const [isCollapsed, setIsCollapsed] = useStoredBoolean('settingsPanelCollapsed');

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  
  const confirmLeave = useConfirmSettingsLeave();

  // Download the other tabs' code once the page is idle.
  useEffect(() => {
    const load = () => Object.values(TAB_CODE).forEach((f) => void f());
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(load, 800); // Safari has no requestIdleCallback
    return () => clearTimeout(t);
  }, []);

  // Switching tabs is instant: the address bar updates without a server round trip (Next keeps
  // useSearchParams in sync), and the new tab eases in.
  const handleSectionSwitch = useCallback(async (id: SectionId) => {
    if (id === activeSection) return;
    if (!(await confirmLeave())) return;
    setIsMobileMenuOpen(false);
    markArriving();
    setSeenUrlSection(id);
    startTransition(() => setActiveSection(id));
    window.history.pushState(null, "", `?section=${id}`);
  }, [activeSection, confirmLeave]);

  const groupsMemo = useMemo(() => GROUPS, []);

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-6 lg:gap-8 relative">
      
      {/* Desktop Sidebar */}
      <aside className={`hidden md:block shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm h-[calc(100dvh-140px)] sticky top-6 transition-all duration-200 ease-in-out ${isCollapsed ? 'w-[56px]' : 'w-[220px]'}`}>
        <SidebarContent 
          groups={groupsMemo} 
          activeSection={activeSection} 
          onSectionSwitch={handleSectionSwitch} 
          isCollapsed={isCollapsed}
        />
        {/* Toggle Button */}
        <button 
          onClick={toggleCollapse}
          className="absolute -right-3 top-10 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-orange-500 hover:text-orange-600 shadow-sm z-10 transition-colors"
        >
          <i className={`ph-bold animate-heartbeat ${isCollapsed ? 'ph-caret-right' : 'ph-caret-left'}`}></i>
        </button>
      </aside>

      {/* Mobile bottom sheet, portalled to <body> so it stacks above the top bar (the page area is its own z-10 layer). */}
      {isMobileMenuOpen && typeof document !== "undefined" && createPortal(
        <div className="md:hidden fixed inset-0 z-[140] flex flex-col justify-end" style={{ animation: "fadeIn 0.2s ease-out forwards" }}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeMobileMenu}></div>
          <div 
            className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" 
            style={{ animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full"></div>
            </div>
            <div className="flex justify-between items-center px-6 pb-2 border-b border-gray-100">
              <h3 className="font-bold text-slate-800">Settings Menu</h3>
              <button onClick={closeMobileMenu} aria-label="Close settings menu" className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                <i className="ph-bold ph-x"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 pb-8">
              <SidebarContent 
                groups={groupsMemo} 
                activeSection={activeSection} 
                onSectionSwitch={handleSectionSwitch} 
              />
            </div>
          </div>
        </div>
      , document.body)}

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <ViewTransition key={activeSection} name="settings-tab" share="page-xfade" enter="soft-in" exit="soft-out" default="none">
        <div>
          {activeSection === "users" && <UserManagement />}
          {activeSection === "permissions" && <RolesPermissions />}
          {activeSection === "layouts" && <LayoutsFieldsBuilder />}
          {activeSection === "recycle-bin" && <RecycleBin />}
          {activeSection === "google-drive" && <GoogleDriveIntegration />}
          {activeSection === "business" && <BusinessDetails />}
          {activeSection === "pricing" && <PricingRules />}
          {activeSection === "teams" && <TeamsSettings />}
        </div>
        </ViewTransition>
      </div>
      
      {/* Add keyframes for inline animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />
    </div>
  );
}

function SettingsPageWrapperContent() {
  return (
    <Suspense fallback={<PrinterLoader label="Printing your settings" />}>
      <SettingsPage />
    </Suspense>
  );
}

export default function SettingsPageWrapper() {
  return (
    <PageReveal>
      <SettingsPageWrapperContent />
    </PageReveal>
  );
}
