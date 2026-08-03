import React from 'react';

interface ContentHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function ContentHeader({ title, subtitle, actions }: ContentHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 mb-5">
      <div className="space-y-1 text-start">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-sans text-balance">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] sm:text-xs text-slate-500 font-sans leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
