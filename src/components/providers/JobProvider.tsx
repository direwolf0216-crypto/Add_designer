"use client";

import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FilterState } from '@/types';
import { jobFiltersToParams, parseJobFilters } from '@/lib/jobs/filters';

interface JobContextType {
  filters: FilterState;
  setFilters: (next: FilterState | ((prev: FilterState) => FilterState)) => void;

  isFilterModalOpen: boolean;
  setIsFilterModalOpen: (open: boolean) => void;

  hasData: boolean;
  setHasData: (has: boolean) => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

/** Job list filters live in the URL so the server filters before paginating and links are shareable. */
export function JobProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseJobFilters(searchParams), [searchParams]);
  const [hasData, setHasData] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const setFilters = useCallback<JobContextType['setFilters']>((next) => {
    const value = typeof next === 'function' ? next(filters) : next;
    const qs = jobFiltersToParams(value, new URLSearchParams(searchParams.toString())).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [filters, pathname, router, searchParams]);

  const value = useMemo(() => ({
    filters, setFilters, isFilterModalOpen, setIsFilterModalOpen, hasData, setHasData,
  }), [filters, setFilters, isFilterModalOpen, hasData]);

  return <JobContext.Provider value={value}>{children}</JobContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
}
