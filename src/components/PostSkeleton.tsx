import React from 'react';

export const PostSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs animate-pulse space-y-4"
    >
      <div className="flex items-start gap-3.5">
        {/* Avatar skeleton */}
        <div className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />

        {/* User info skeleton */}
        <div className="space-y-1.5 flex-1 pt-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 bg-slate-200 rounded-md" />
            <div className="h-3 w-16 bg-slate-100 rounded-md" />
            <div className="h-3 w-8 bg-slate-100 rounded-md" />
          </div>
        </div>
      </div>

      {/* Content lines skeleton */}
      <div className="pl-[58px] space-y-2 -mt-1 sm:-mt-2">
        <div className="h-3.5 bg-slate-200 rounded-md w-full" />
        <div className="h-3.5 bg-slate-200 rounded-md w-5/6" />
        <div className="h-3.5 bg-slate-200 rounded-md w-3/5" />
      </div>

      {/* Action buttons skeleton */}
      <div className="pl-[58px] pt-3 border-t border-slate-100 flex items-center gap-3">
        <div className="h-6 w-16 bg-slate-100 rounded-xl" />
        <div className="h-6 w-16 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
};

export const SuggestedUserSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-between py-3 gap-2 animate-pulse first:pt-0 last:pb-0"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
        <div className="space-y-1">
          <div className="h-3 w-20 bg-slate-200 rounded-md" />
          <div className="h-2.5 w-14 bg-slate-100 rounded-md" />
        </div>
      </div>
      <div className="h-7 w-16 bg-slate-100 rounded-xl shrink-0" />
    </div>
  );
};

export const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs animate-pulse space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 flex-1 min-w-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-200 shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <div className="h-6 w-44 bg-slate-200 rounded-md" />
            <div className="h-4 w-28 bg-slate-100 rounded-md" />
            <div className="h-3.5 w-64 bg-slate-100 rounded-md pt-1" />
          </div>
        </div>
        <div className="h-10 w-28 bg-slate-100 rounded-xl shrink-0" />
      </div>

      <div className="pt-5 border-t border-slate-100 flex items-center gap-8">
        <div className="h-5 w-16 bg-slate-100 rounded-md" />
        <div className="h-5 w-20 bg-slate-100 rounded-md" />
        <div className="h-5 w-20 bg-slate-100 rounded-md" />
      </div>
    </div>
  );
};

export const CommentSkeleton: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0 animate-pulse"
    >
      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
      <div className="space-y-1.5 flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-24 bg-slate-200 rounded-md" />
          <div className="h-3 w-16 bg-slate-100 rounded-md" />
        </div>
        <div className="h-3 w-3/4 bg-slate-100 rounded-md" />
      </div>
    </div>
  );
};

