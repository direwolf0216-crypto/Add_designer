"use client";

import { useState, useEffect } from "react";
import { useJobs } from "../providers/JobProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Autocomplete from "../ui/Autocomplete";
import DatePickerInput from "../ui/DatePickerInput";

export default function JobFilterModal() {
  const { 
    filters, setFilters,
    isFilterModalOpen, setIsFilterModalOpen
  } = useJobs();

  const clientSuggestions: string[] = [];
  const locationSuggestions: string[] = [];

  const [filterState, setFilterState] = useState(filters);

  useEffect(() => {
    if (isFilterModalOpen) {
      setFilterState(filters);
    }
  }, [isFilterModalOpen, filters]);

  const toggleFilterCategory = (cat: string) => {
    setFilterState(prev => ({
      ...prev, 
      categories: prev.categories.includes(cat) 
        ? prev.categories.filter(c => c !== cat) 
        : [...prev.categories, cat]
    }));
  };

  const toggleFilterStatus = (status: string) => {
    setFilterState(prev => ({
      ...prev, 
      statuses: prev.statuses.includes(status) 
        ? prev.statuses.filter(s => s !== status) 
        : [...prev.statuses, status]
    }));
  };

  const applyFilters = () => {
    setFilters(filterState);
    setIsFilterModalOpen(false);
  };

  const resetFilters = () => {
    const emptyFilters = { categories: [], statuses: [], clientName: '', location: '', dateStart: '', dateEnd: '', amountMin: '', amountMax: '' };
    setFilterState(emptyFilters);
    setFilters(emptyFilters);
    setIsFilterModalOpen(false);
  };

  return (
    <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
      <DialogContent className="max-w-[480px] sm:max-w-[480px] p-0 bg-white rounded-3xl overflow-visible border-0 shadow-2xl !rounded-3xl">
        <DialogHeader className="bg-slate-50 border-b border-gray-100 px-8 py-6 rounded-t-3xl">
          <DialogTitle className="text-xl font-extrabold text-slate-900">Filter Jobs</DialogTitle>
        </DialogHeader>
        <div className="px-8 py-6 overflow-visible">
          <div className="flex flex-col gap-2 mb-6">
            <label className="font-bold text-slate-500 text-[0.85rem] uppercase tracking-[0.5px]">Client Name</label>
            <Autocomplete 
              suggestions={clientSuggestions}
              value={filterState.clientName}
              onChange={val => setFilterState({...filterState, clientName: val})}
              placeholder="Search by client name..."
            />
          </div>
          
          <div className="font-bold text-slate-500 text-[0.85rem] uppercase tracking-[0.5px] mb-3">Category</div>
          <div className="flex flex-wrap gap-2 mb-6">
            {['Flex Printing', 'Business Cards', 'Invitations', 'Posters'].map(cat => (
              <button
                key={cat}
                onClick={() => {
                  if (filterState.categories.includes(cat)) {
                    setFilterState({ ...filterState, categories: filterState.categories.filter(c => c !== cat) });
                  } else {
                    setFilterState({ ...filterState, categories: [...filterState.categories, cat] });
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${filterState.categories.includes(cat) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="font-bold text-slate-500 text-[0.85rem] uppercase tracking-[0.5px] mb-3">Date Range</div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <DatePickerInput value={filterState.dateStart} onChange={val => setFilterState({...filterState, dateStart: val})} placeholder="Start Date" />
            <DatePickerInput value={filterState.dateEnd} onChange={val => setFilterState({...filterState, dateEnd: val})} placeholder="End Date" />
          </div>
          
          <div className="flex flex-col gap-2 mb-6">
            <label className="font-bold text-slate-500 text-[0.85rem] uppercase tracking-[0.5px]">Location</label>
            <Autocomplete 
              suggestions={locationSuggestions}
              value={filterState.location}
              onChange={val => setFilterState({...filterState, location: val})}
              placeholder="Search by location..."
            />
          </div>
          
          <div className="font-bold text-slate-500 text-[0.85rem] uppercase tracking-[0.5px] mb-3">Status</div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {['Confirmed', 'Pending', 'Partial'].map(status => (
              <label key={status} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterState.statuses.includes(status)} onChange={() => toggleFilterStatus(status)} className={`w-4 h-4 ${status === 'Confirmed' ? 'accent-green-500' : status === 'Pending' ? 'accent-red-500' : 'accent-orange-500'}`} />
                <span className="text-[0.9rem] text-slate-700 font-medium">{status}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="bg-slate-50 border-t border-gray-100 px-8 py-5 flex justify-end gap-3 rounded-b-3xl">
          <button className="px-5 py-2.5 rounded-full font-bold text-[0.95rem] text-slate-700 bg-white border border-gray-200 hover:bg-slate-50 transition-colors" onClick={resetFilters}>Reset</button>
          <button className="px-6 py-2.5 rounded-full font-bold text-[0.95rem] text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-all" onClick={applyFilters}>Apply Filters</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
