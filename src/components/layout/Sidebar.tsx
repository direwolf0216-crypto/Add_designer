"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMobileNav } from "../providers/MobileNavProvider";
import { useStoredBoolean } from "@/hooks/useStoredBoolean";
import { usePermissions } from "@/hooks/usePermissions";

export default function Sidebar() {
  const pathname = usePathname() || "";
  const { isSidebarOpen, closeSidebar } = useMobileNav();
  const [isCollapsed, setIsCollapsed] = useStoredBoolean('sidebar_collapsed');
  const { checkPermission, isAdmin } = usePermissions();

  if (pathname.startsWith('/settings')) {
    return null;
  }

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const navItems = [
    { name: "Dashboard", path: "/dashboard/overview", icon: "ph-house", permission: "view_analytics" },
    { name: "Jobs", path: "/jobs", icon: "ph-briefcase", permission: null },
    { name: "Daily Ledger", path: "/transactions/overview", icon: "ph-file-text", permission: "view_transactions" },
  ];

  const visibleNavItems = navItems.filter((item) => !item.permission || checkPermission(item.permission));

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[90] lg:hidden animate-[fadeIn_0.2s_ease-out]"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Content */}
      <aside style={{ viewTransitionName: "app-sidebar" }} className={`
        fixed inset-y-0 left-0 z-[100] flex flex-col py-8 shadow-[4px_0_20px_-3px_rgba(0,0,0,0.5)]
        transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 overflow-visible
        bg-[#09090b] text-white border-r border-white/5
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'lg:w-[110px] w-[260px] items-center px-0' : 'w-[280px] px-4'}
      `}>

        {/* Background Effect (Expanded Only) */}
        {!isCollapsed && (
          <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#0f111a] to-[#0f111a]"></div>
        )}

        {/* Printer Image with glowing base (Expanded Only) */}
        {!isCollapsed && (
          <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-[140%] pointer-events-none z-0">
            <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] bg-fuchsia-600/30 blur-[40px] rounded-full"></div>
            <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[40%] h-[30%] bg-blue-600/40 blur-[30px] rounded-full"></div>
            <img src="/assets/Printer.png" alt="Printer Graphic" className="relative z-10 w-full h-auto object-contain drop-shadow-2xl" />
          </div>
        )}

        {/* Collapse Button (Expanded State) */}
        {!isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex absolute right-4 top-8 w-8 h-8 bg-[#1e2030] rounded-xl items-center justify-center text-slate-400 hover:text-white shadow-sm z-20 transition-all hover:bg-[#2a2d42]"
          >
            <i className={`ph-bold ph-caret-left text-[0.9rem]`}></i>
          </button>
        )}

        {/* Expanded Logo */}
        {!isCollapsed && (
          <div className="mb-10 flex justify-center w-full min-h-[80px] items-center relative z-10 group">
            <div className="absolute top-1/2 left-[15%] -translate-y-1/2 w-[35%] h-[70%] bg-pink-600/30 blur-[25px] rounded-full z-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-70"></div>
            <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[50%] h-[40%] bg-blue-500/30 blur-[20px] rounded-full z-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-70"></div>
            <div className="absolute top-1/2 right-[15%] -translate-y-1/2 w-[30%] h-[60%] bg-yellow-500/20 blur-[25px] rounded-full z-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-60"></div>

            <Image unoptimized src="/assets/leftPanelLogo.png" alt="Logo" width={260} height={80} priority className="object-contain w-[240px] h-auto scale-125 origin-center drop-shadow-xl relative z-10" />
          </div>
        )}

        {/* Expand Button (Collapsed State) */}
        {isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex absolute -right-4 top-[56px] w-8 h-8 bg-[#1a1b23] rounded-full items-center justify-center text-slate-300 hover:text-white border-[1.5px] border-[#f5a623]/60 shadow-[0_0_12px_rgba(245,166,35,0.4)] z-50 transition-all hover:bg-[#2a2d42] hover:scale-110"
          >
            <i className="ph-bold ph-caret-right text-xs"></i>
          </button>
        )}

        {/* Collapsed Logo */}
        {isCollapsed && (
          <div className="relative mb-12 flex flex-col items-center shrink-0 z-20 mt-2">
            {/* Glowing border ring */}
            <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-[#ff007f] via-[#7928ca] to-[#0070f3] shadow-[0_0_25px_rgba(121,40,202,0.4)]">
              <div className="bg-[#050505] rounded-xl p-1.5 overflow-hidden">
                <Image
                  unoptimized
                  src="/assets/addSquare.png"
                  alt="Small Logo"
                  width={64}
                  height={64}
                  className="w-[55px] h-[55px] object-cover rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <ul className={`list-none flex flex-col relative z-10 w-full ${isCollapsed ? 'gap-6 items-center px-1' : 'gap-4 px-2 mt-2'}`}>
          {visibleNavItems.map((item) => {
            const isActive = pathname.startsWith(item.path) ||
              (item.name === "Jobs" && pathname.startsWith("/jobs")) ||
              (item.name === "Daily Ledger" && pathname.startsWith("/transactions"));

            // Shorter names for collapsed state to match the design
            const displayName = isCollapsed ?
              (item.name === "Dashboard" ? "Home" : item.name === "Daily Ledger" ? "Daily" : item.name) :
              item.name;

            return (
              <li key={item.path} className={`w-full ${isCollapsed ? 'flex justify-center relative' : ''}`}>

                {/* Active Indicator (Glowing Dot & Line for Collapsed State) */}
                {isCollapsed && isActive && (
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 flex flex-col items-center justify-center h-10 w-4">
                    <div className="absolute w-[1px] h-full bg-gradient-to-b from-transparent via-[#a855f7] to-transparent left-1"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1),0_0_15px_rgba(168,85,247,1)] relative z-10 -ml-[11px]"></div>
                  </div>
                )}

                <Link
                  href={item.path}
                  prefetch={true}
                  title={isCollapsed ? item.name : undefined}
                  className={`
                    ${isCollapsed ? 'flex flex-col items-center justify-center p-3 gap-1.5 w-[76px] h-[76px] rounded-[1.3rem]'
                      : 'flex items-center justify-between py-2.5 px-3 rounded-2xl w-full'}
                    no-underline transition-all duration-300 outline-none focus:outline-none
                    ${isActive
                      ? (isCollapsed
                        ? 'bg-gradient-to-br from-[#8B5CF6] to-[#3B82F6] text-white shadow-[0_0_25px_rgba(139,92,246,0.35)]'
                        : 'bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] text-white shadow-lg')
                      : (isCollapsed
                        ? 'bg-transparent border border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200 hover:bg-white/5'
                        : 'text-slate-300 hover:bg-white/5')
                    }
                  `}
                >
                  <div className={`flex ${isCollapsed ? 'flex-col items-center' : 'items-center gap-4'}`}>
                    {/* Icon */}
                    <div className={`
                      ${isCollapsed ? 'text-[1.5rem]' : 'w-10 h-10 rounded-[0.8rem] flex items-center justify-center shrink-0 transition-colors shadow-sm'}
                      ${!isCollapsed && isActive ? 'bg-white text-[#6366f1]' : ''}
                      ${!isCollapsed && !isActive ? 'bg-[#1e2030] text-slate-300' : ''}
                    `}>
                      <i className={`ph ${isActive ? (isCollapsed ? 'ph' : 'ph-fill') : 'ph'} ${item.icon}`}></i>
                    </div>
                    {/* Text */}
                    <span className={`
                      ${isCollapsed ? 'text-[10px] font-semibold tracking-wide mt-0.5' : 'text-[0.95rem] font-medium'}
                    `}>{displayName}</span>
                  </div>
                  {isActive && !isCollapsed && (
                    <i className="ph-bold ph-caret-right text-white mr-1 text-sm"></i>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Separator (Expanded) */}
        {!isCollapsed && <div className="w-[85%] mx-auto h-[1px] bg-white/10 my-8 relative z-10"></div>}

        {/* Separator (Collapsed) */}
        {isCollapsed && (
          <div className="w-full flex justify-center items-center my-8 relative z-10">
            <div className="w-[40px] h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
            <div className="w-1 h-1 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)] absolute"></div>
          </div>
        )}

        {/* Inline Printer Graphic (Collapsed only) */}
        {isCollapsed && (
          <div className="w-full mt-auto mb-6 flex justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 blur-xl rounded-full z-0"></div>
            <img src="/assets/Printer.png" alt="Printer" className="w-[85px] h-auto object-contain relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]" />
          </div>
        )}

        {/* Settings Button */}
        <div className={`flex flex-col relative z-20 pb-4 w-full ${isCollapsed ? 'items-center mt-0' : 'mt-auto px-2 gap-3'}`}>
          {isAdmin && (
            <Link
              href="/settings"
              prefetch={true}
              title={isCollapsed ? "Settings" : undefined}
              className={`
                ${isCollapsed ? 'flex flex-col items-center justify-center p-3 gap-1.5 w-[76px] h-[76px] rounded-[1.3rem] bg-transparent border border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200 hover:bg-white/5'
                  : 'flex items-center justify-between py-2.5 px-3 rounded-2xl bg-[#161825] border border-white/5 hover:bg-[#1e2030] text-slate-200 shadow-md'}
                no-underline transition-all duration-300
              `}
            >
              <div className={`flex ${isCollapsed ? 'flex-col items-center' : 'items-center gap-4'}`}>
                <div className={`
                  ${isCollapsed ? 'text-[1.6rem] text-[#a855f7]' : 'w-10 h-10 rounded-[0.8rem] flex items-center justify-center shrink-0 text-[#a855f7]'}
                `}>
                  <i className={`ph-fill ph-gear`}></i>
                </div>
                <span className={`
                  ${isCollapsed ? 'text-[10px] font-semibold tracking-wide mt-0.5' : 'text-[0.95rem] font-medium'}
                `}>Settings</span>
              </div>
              {!isCollapsed && (
                <i className="ph-bold ph-caret-right text-slate-500 mr-1 text-sm"></i>
              )}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
