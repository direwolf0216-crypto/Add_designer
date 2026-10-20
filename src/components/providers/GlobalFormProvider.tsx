"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface GlobalFormContextType {
  isJobFormOpen: boolean;
  jobToEditId: string | null;
  jobInitialDate: string | null;
  openJobForm: (jobId?: string, initialDate?: string) => void;
  closeJobForm: () => void;

  /** Job details are a route (/jobs/details/[id]); these stay for the standalone modal component. */
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

// Ids are cleared after the close animation; a modal reopened within that window must keep its new id.
const CLOSE_ANIMATION_MS = 300;

export function GlobalFormProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [jobToEditId, setJobToEditId] = useState<string | null>(null);
  const [jobInitialDate, setJobInitialDate] = useState<string | null>(null);

  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [transactionToEditId, setTransactionToEditId] = useState<string | null>(null);
  const [transactionInitialData, setTransactionInitialData] = useState<Record<string, any> | undefined>(undefined);

  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [transactionDetailsId, setTransactionDetailsId] = useState<string | null>(null);

  const jobFormTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const txFormTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const txDetailsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True when the details page was reached by in-app navigation, so "back" stays inside the app.
  const openedJobDetailsInApp = useRef(false);

  const openJobForm = useCallback((jobId?: string, initialDate?: string) => {
    if (jobFormTimer.current) clearTimeout(jobFormTimer.current);
    setJobToEditId(jobId || null);
    setJobInitialDate(initialDate || null);
    setIsJobFormOpen(true);
  }, []);

  const closeJobForm = useCallback(() => {
    setIsJobFormOpen(false);
    jobFormTimer.current = setTimeout(() => {
      setJobToEditId(null);
      setJobInitialDate(null);
    }, CLOSE_ANIMATION_MS);
  }, []);

  const openJobDetails = useCallback((jobId: string) => {
    openedJobDetailsInApp.current = true;
    router.push(`/jobs/details/${jobId}`);
  }, [router]);

  const closeJobDetails = useCallback(() => {
    if (openedJobDetailsInApp.current) {
      openedJobDetailsInApp.current = false;
      router.back();
    } else {
      // Deep link (search, notification, bookmark): going "back" would leave the app.
      router.push('/jobs/job-status');
    }
  }, [router]);

  const openTransactionForm = useCallback((transactionId?: string, initialData?: Record<string, any>) => {
    if (txFormTimer.current) clearTimeout(txFormTimer.current);
    setTransactionToEditId(transactionId || null);
    setTransactionInitialData(initialData);
    setIsTransactionFormOpen(true);
  }, []);

  const closeTransactionForm = useCallback(() => {
    setIsTransactionFormOpen(false);
    txFormTimer.current = setTimeout(() => {
      setTransactionToEditId(null);
      setTransactionInitialData(undefined);
    }, CLOSE_ANIMATION_MS);
  }, []);

  const openTransactionDetails = useCallback((transactionId: string) => {
    if (txDetailsTimer.current) clearTimeout(txDetailsTimer.current);
    setTransactionDetailsId(transactionId);
    setIsTransactionDetailsOpen(true);
  }, []);

  const closeTransactionDetails = useCallback(() => {
    setIsTransactionDetailsOpen(false);
    txDetailsTimer.current = setTimeout(() => setTransactionDetailsId(null), CLOSE_ANIMATION_MS);
  }, []);

  const value = useMemo<GlobalFormContextType>(() => ({
    isJobFormOpen, jobToEditId, jobInitialDate, openJobForm, closeJobForm,
    isJobDetailsOpen: false, jobDetailsId: null, openJobDetails, closeJobDetails,
    isTransactionFormOpen, transactionToEditId, transactionInitialData, openTransactionForm, closeTransactionForm,
    isTransactionDetailsOpen, transactionDetailsId, openTransactionDetails, closeTransactionDetails,
  }), [
    isJobFormOpen, jobToEditId, jobInitialDate, openJobForm, closeJobForm, openJobDetails, closeJobDetails,
    isTransactionFormOpen, transactionToEditId, transactionInitialData, openTransactionForm, closeTransactionForm,
    isTransactionDetailsOpen, transactionDetailsId, openTransactionDetails, closeTransactionDetails,
  ]);

  return <GlobalFormContext.Provider value={value}>{children}</GlobalFormContext.Provider>;
}

export function useGlobalForm() {
  const context = useContext(GlobalFormContext);
  if (context === undefined) {
    throw new Error('useGlobalForm must be used within a GlobalFormProvider');
  }
  return context;
}
