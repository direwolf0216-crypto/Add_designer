import React from 'react';

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export default function DashboardCard({ children, className = '', ...props }: DashboardCardProps) {
  return (
    <div className={`dashboard-card ${className}`} {...props}>
      {children}
    </div>
  );
}
