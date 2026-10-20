"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface GlobalFormContextType {
  isJobFormOpen: boolean;
  jobToEditId: string | null;
  jobInitialDate: string | null;
  openJobForm: (jobId?: string, initialDate?: string) => void;
  closeJobForm: () => void;
  
  isJobDetailsOpen: boolean;
  jobDetailsId: string | null;
  openJobDetails: (jobId: string) => void;
  closeJobDetails: () => void;
  
  isTransactionFormOpen: boolean;
  transactionToEditId: string | null;
  transactionInitialData?: Record<string, any>;
  openTransactionForm: (transactionId?: string, initialData?: Record<string, any>) => void;
  closeTransactionForm: () => void;

  isTransactionDetailsOpen: boolean;
  transactionDetailsId: string | null;
  openTransactionDetails: (transactionId: string) => void;
  closeTransactionDetails: () => void;
  

}

const GlobalFormContext = createContext<GlobalFormContextType | undefined>(undefined);

export function GlobalFormProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [jobToEditId, setJobToEditId] = useState<string | null>(null);
  const [jobInitialDate, setJobInitialDate] = useState<string | null>(null);

  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [jobDetailsId, setJobDetailsId] = useState<string | null>(null);

  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [transactionToEditId, setTransactionToEditId] = useState<string | null>(null);
  const [transactionInitialData, setTransactionInitialData] = useState<Record<string, any> | undefined>(undefined);

  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [transactionDetailsId, setTransactionDetailsId] = useState<string | null>(null);



  const openJobForm = (jobId?: string, initialDate?: string) => {
    setJobToEditId(jobId || null);
    setJobInitialDate(initialDate || null);
    setIsJobFormOpen(true);
  };

  const closeJobForm = () => {
    setIsJobFormOpen(false);
    setTimeout(() => {
      setJobToEditId(null);
      setJobInitialDate(null);
    }, 300);
  };

  const openJobDetails = (jobId: string) => {
    router.push(`/jobs/details/${jobId}`);
  };

  const closeJobDetails = () => {
    router.back();
  };

  const openTransactionForm = (transactionId?: string, initialData?: Record<string, any>) => {
    setTransactionToEditId(transactionId || null);
    if (initialData) setTransactionInitialData(initialData);
    setIsTransactionFormOpen(true);
  };

  const closeTransactionForm = () => {
    setIsTransactionFormOpen(false);
    setTimeout(() => {
      setTransactionToEditId(null);
      setTransactionInitialData(undefined);
    }, 300);
  };

  const openTransactionDetails = (transactionId: string) => {
    setTransactionDetailsId(transactionId);
    setIsTransactionDetailsOpen(true);
  };

  const closeTransactionDetails = () => {
    setIsTransactionDetailsOpen(false);
    setTimeout(() => setTransactionDetailsId(null), 300);
  };



  return (
    <GlobalFormContext.Provider value={{
      isJobFormOpen, jobToEditId, jobInitialDate, openJobForm, closeJobForm,
      isJobDetailsOpen, jobDetailsId, openJobDetails, closeJobDetails,
      isTransactionFormOpen, transactionToEditId, transactionInitialData, openTransactionForm, closeTransactionForm,
      isTransactionDetailsOpen, transactionDetailsId, openTransactionDetails, closeTransactionDetails
    }}>
      {children}
    </GlobalFormContext.Provider>
  );
}

export function useGlobalForm() {
  const context = useContext(GlobalFormContext);
  if (context === undefined) {
    throw new Error('useGlobalForm must be used within a GlobalFormProvider');
  }
  return context;
}
