import Sidebar from "@/components/layout/Sidebar";
import TopNavigation from "@/components/layout/TopNavigation";
import { SystemProvider } from "@/components/providers/SystemProvider";
import { MobileNavProvider } from "@/components/providers/MobileNavProvider";
import { GlobalFormProvider } from "@/components/providers/GlobalFormProvider";
import GlobalModals from "@/components/layout/GlobalModals";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import UpcomingJobsBanner from "@/components/layout/UpcomingJobsBanner";

import React from "react";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SystemProvider>
      <MobileNavProvider>
          <GlobalFormProvider>
          <ConfirmDialogProvider>
            <Sidebar />
            <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden bg-transparent relative">
              {/* Colorful Background Patterns */}
              <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  backgroundImage: 'url("/assets/saas_dashboard_bg.png")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: 0.70
                }}
              ></div>

              <div className="relative z-50" style={{ viewTransitionName: "app-topbar" }}>
                <TopNavigation />
              </div>
              <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 xl:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 xl:pb-8 relative z-10">
                {children}
              </div>
            </main>

            {/* Global Forms */}
            <GlobalModals />
            <UpcomingJobsBanner />

          </ConfirmDialogProvider>
          </GlobalFormProvider>
      </MobileNavProvider>
    </SystemProvider>
  );
}
