"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FilterState } from '@/types';

interface JobContextType {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  
  isFilterModalOpen: boolean;
  setIsFilterModalOpen: (open: boolean) => void;
  
  hasData: boolean;
  setHasData: (has: boolean) => void;
}

const defaultFilters: FilterState = {
  categories: [],
  statuses: [],
  clientName: '',
  location: '',
  dateStart: '',
  dateEnd: '',
  amountMin: '',
  amountMax: ''
};

const JobContext = createContext<JobContextType | undefined>(undefined);

export function JobProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [hasData, setHasData] = useState(false);
  
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  return (
    <JobContext.Provider value={{ 
      filters, setFilters, 
      isFilterModalOpen, setIsFilterModalOpen,
      hasData, setHasData
    }}>
      {children}
    </JobContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
}
