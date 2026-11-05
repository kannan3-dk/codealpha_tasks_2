import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import type { Comment } from '../types/database';
import { formatRelativeTime } from '../utils/time';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onDelete?: (commentId: string) => Promise<void>;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onDelete,
}) => {
  const [imageError, setImageError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const authorProfile = comment.profiles || comment.author;
  const username = authorProfile?.username || 'unknown';
  const displayName = authorProfile?.display_name || username || 'User';
  const avatarUrl = authorProfile?.avatar_url;
  const isAuthor = Boolean(currentUserId && currentUserId === comment.author_id);
  const relativeTime = formatRelativeTime(comment.created_at);

  const getInitials = (name: string, uname: string) => {
    const text = (name || uname || 'U').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(displayName, username);
  const hasAvatarImg = Boolean(avatarUrl && !imageError);

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(comment.id);
    } catch (err) {
      console.error('Error in comment delete:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0 group">
      {/* Avatar */}
      <Link
        to={`/u/${username}`}
        className="shrink-0 focus:outline-hidden rounded-full"
        title={`View @${username}'s profile`}
      >
        <div className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-2xs overflow-hidden">
          {hasAvatarImg ? (
            <img
              src={avatarUrl!}
              alt={displayName}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      </Link>

      {/* Comment Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <Link
              to={`/u/${username}`}
              className="font-bold text-slate-900 text-xs sm:text-sm hover:underline hover:text-indigo-600 transition-colors truncate"
            >
              {displayName}
            </Link>
            <Link
              to={`/u/${username}`}
              className="text-[11px] text-slate-400 hover:text-slate-600 truncate"
            >
              @{username}
            </Link>
            <span className="text-slate-300 text-[10px] select-none">·</span>
            <time className="text-[11px] text-slate-400 shrink-0">
              {relativeTime}
            </time>
          </div>

          {/* Delete Comment button (Author only) */}
          {isAuthor && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
              title="Delete comment"
              aria-label="Delete comment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Comment Content */}
        <p className="mt-1 text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>

      {/* Delete Comment Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-5 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900">Delete comment?</h4>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  This comment will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
