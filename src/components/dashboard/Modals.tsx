"use client";

import dynamic from 'next/dynamic';

const JobFilterModal = dynamic(() => import('./JobFilterModal'), { ssr: false });

export default function Modals() {
  return (
    <>
      <JobFilterModal />
    </>
  );
}
