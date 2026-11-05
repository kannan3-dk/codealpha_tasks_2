import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading Circle...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-red-600 shadow-md shadow-red-200">
          <div className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        </div>
        <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
};
