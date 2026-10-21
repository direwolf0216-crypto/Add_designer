"use client";

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { 
  Layers, 
  Lightbulb, 
  Zap, 
  ScrollText, 
  Mail, 
  ContactRound, 
  Image as ImageIcon, 
  IdCard, 
  Printer, 
  BookOpen, 
  Trophy, 
  Grid, 
  LayoutTemplate, 
  Tag 
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Flex Printing": Layers,
  "Lighting Board": Lightbulb,
  "LED Lighting Board": Zap,
  "Vinyl Printing": ScrollText,
  "Invitations": Mail,
  "Visiting Cards": ContactRound,
  "Litho Posters": ImageIcon,
  "ID Cards": IdCard,
  "Offset Printing": Printer,
  "Book Printing": BookOpen,
  "Trophy & Shields": Trophy,
  "Screen Printing": Grid,
  "A3 Color Board Print": LayoutTemplate,
  "Sticker Print": Tag
};

const CATEGORY_COLORS: Record<string, string> = {
  "Flex Printing": "bg-blue-50 text-blue-500",
  "Lighting Board": "bg-yellow-50 text-yellow-500",
  "LED Lighting Board": "bg-amber-50 text-amber-500",
  "Vinyl Printing": "bg-purple-50 text-purple-500",
  "Invitations": "bg-pink-50 text-pink-500",
  "Visiting Cards": "bg-emerald-50 text-emerald-500",
  "Litho Posters": "bg-cyan-50 text-cyan-500",
  "ID Cards": "bg-indigo-50 text-indigo-500",
  "Offset Printing": "bg-slate-50 text-slate-500",
  "Book Printing": "bg-orange-50 text-orange-500",
  "Trophy & Shields": "bg-yellow-100 text-yellow-600",
  "Screen Printing": "bg-rose-50 text-rose-500",
  "A3 Color Board Print": "bg-teal-50 text-teal-500",
  "Sticker Print": "bg-fuchsia-50 text-fuchsia-500"
};

type CategoryStat = {
  category: string;
  activeJobs: number;
  pendingDelivery: number;
  monthlyRevenue: number;
};

export default function StatCards() {
  const { data: stats, isLoading, error } = useSWR<CategoryStat[]>('/api/dashboard/category-stats', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 mb-6">
        <h3 className="font-bold mb-1">Failed to load category stats</h3>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 h-[120px] animate-pulse border border-gray-100"></div>
        ))}
      </div>
    );
  }

  if (stats.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {stats.map((stat) => {
        const Icon = CATEGORY_ICONS[stat.category] || Printer;
        const colorClass = CATEGORY_COLORS[stat.category] || "bg-gray-50 text-gray-500";

        return (
          <Link 
            key={stat.category} 
            href={`/jobs?view=list&categories=${encodeURIComponent(stat.category)}`}
            className="dashboard-card p-4 flex flex-col justify-between transition-all hover:shadow-md hover:border-emerald-200 relative group min-h-[110px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <span className="text-slate-700 font-semibold text-sm">{stat.category}</span>
              </div>
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                ₹{stat.monthlyRevenue.toLocaleString('en-IN')} this month
              </div>
            </div>
            
            <div className="mt-4 flex gap-4 text-sm">
              <div>
                <span className="text-slate-500">Active: </span>
                <span className="font-bold text-slate-900">{stat.activeJobs}</span>
              </div>
              <div>
                <span className="text-slate-500">Pending: </span>
                <span className="font-bold text-slate-900">{stat.pendingDelivery}</span>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 text-[0.7rem] font-bold text-emerald-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              View Jobs <span className="text-lg leading-none">&rarr;</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
