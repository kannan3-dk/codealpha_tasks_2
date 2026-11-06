import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading Circle...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0b0c] px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Ring logo mark: 20px circle, 4px white border */}
        <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-[#141416] border border-[#26262a]">
          <div className="w-5 h-5 rounded-full border-4 border-white animate-spin" />
        </div>
        <div className="flex items-center gap-2 text-[#a1a1a8] font-medium text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[#f2f2f3]" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
};
