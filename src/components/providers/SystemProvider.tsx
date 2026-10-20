"use client";

import React, { createContext, useContext } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";

interface SystemPreferences {
  currencySymbol: string;
  hotDateThreshold: number;
  calendarTiers: { max: number; bg: string; text: string }[];
  statusColors: Record<string, { bg: string; text: string }>;
}

interface SystemContextType {
  preferences: SystemPreferences | null;
  loading: boolean;
  refreshPreferences: () => void;
}

const SystemContext = createContext<SystemContextType>({
  preferences: null,
  loading: true,
  refreshPreferences: () => {},
});

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR<{ UI_PREFERENCES?: SystemPreferences }>("/api/settings/system", fetcher);
  const preferences = data?.UI_PREFERENCES ?? null;
  const loading = isLoading;
  const refreshPreferences = () => {
    void mutate();
  };

  return (
    <SystemContext.Provider value={{ preferences, loading, refreshPreferences }}>
      {children}
    </SystemContext.Provider>
  );
}

export const useSystem = () => useContext(SystemContext);
