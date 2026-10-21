import type React from "react";
import { FolderClock, PenTool, Printer, Package, AlertTriangle } from "lucide-react";
import type { JobStatusTab } from "@/lib/jobs/statusCounts";

export const ICON_MAP: Record<string, React.ReactNode> = {
  FolderClock: <FolderClock size={18} />,
  PenTool: <PenTool size={18} />,
  Printer: <Printer size={18} />,
  Package: <Package size={18} />,
  AlertTriangle: <AlertTriangle size={18} />,
};

export interface StatusCardConfig {
  status: JobStatusTab;
  label: string;
  sublabel: string;
  icon: keyof typeof ICON_MAP;
  iconBg: string;
  iconColor: string;
  accentColor: string;
  /** Inner SVG markup for the decorative background wave. */
  waveSvg: string;
}

export const STATUS_CARDS: StatusCardConfig[] = [
  {
    status: 'Pending',
    label: 'Pending Jobs',
    sublabel: 'Awaiting action',
    icon: 'FolderClock',
    iconBg: '#ec008c', // Solid pink
    iconColor: '#ffffff',
    accentColor: '#ec008c',
    waveSvg: '<path fill="#ec008c" fill-opacity="0.05" d="M0,64L48,58.7C96,53,192,43,288,48C384,53,480,75,576,80C672,85,768,75,816,69.3L864,64L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Overdue',
    label: 'Overdue Jobs',
    sublabel: 'Past due date',
    icon: 'AlertTriangle',
    iconBg: '#f97316', // Solid orange
    iconColor: '#ffffff',
    accentColor: '#f97316',
    waveSvg: '<path fill="#f97316" fill-opacity="0.05" d="M0,64L48,74.7C96,85,192,107,288,106.7C384,107,480,85,576,80C672,75,768,85,816,90.7L864,96L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Designing',
    label: 'Designing',
    sublabel: 'In design phase',
    icon: 'PenTool',
    iconBg: '#8b5cf6', // Solid purple
    iconColor: '#ffffff',
    accentColor: '#8b5cf6',
    waveSvg: '<path fill="#8b5cf6" fill-opacity="0.05" d="M0,96L48,85.3C96,75,192,53,288,58.7C384,64,480,96,576,106.7C672,117,768,107,816,101.3L864,96L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Printing',
    label: 'Printing in Progress',
    sublabel: 'Currently printing',
    icon: 'Printer',
    iconBg: '#1d4ed8', // Solid blue
    iconColor: '#ffffff',
    accentColor: '#1d4ed8',
    waveSvg: '<path fill="#1d4ed8" fill-opacity="0.05" d="M0,32L48,48C96,64,192,96,288,101.3C384,107,480,85,576,74.7C672,64,768,64,816,64L864,64L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
  {
    status: 'Ready for Delivery',
    label: 'Ready for Delivery',
    sublabel: 'Ready to dispatch',
    icon: 'Package',
    iconBg: '#16a34a', // Solid green
    iconColor: '#ffffff',
    accentColor: '#16a34a',
    waveSvg: '<path fill="#16a34a" fill-opacity="0.05" d="M0,64L48,58.7C96,53,192,43,288,48C384,53,480,75,576,80C672,85,768,75,816,69.3L864,64L864,120L816,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"></path>',
  },
];
