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

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDeleteConfirm) {
        setShowDeleteConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm]);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#26262a] last:border-b-0 group">
      {/* Avatar (32px) */}
      <Link
        to={`/u/${username}`}
        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
        title={`View @${username}'s profile`}
      >
        <div className="w-8 h-8 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-xs flex items-center justify-center border border-[#3a3a40] overflow-hidden">
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
              className="font-bold text-[#f2f2f3] text-[13px] hover:underline hover:text-[#d4d4d8] transition-colors truncate"
            >
              {displayName}
            </Link>
            <Link
              to={`/u/${username}`}
              className="text-xs text-[#a1a1a8] hover:text-[#f2f2f3] truncate"
            >
              @{username}
            </Link>
            <span className="text-[#3a3a40] text-xs select-none">·</span>
            <time className="text-xs text-[#a1a1a8] shrink-0">
              {relativeTime}
            </time>
          </div>

          {/* Delete Comment button (Author only) */}
          {isAuthor && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f] p-1.5 rounded-lg transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
              title="Delete comment"
              aria-label="Delete comment"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Comment Content */}
        <p className="mt-1 text-[#f2f2f3] text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>

      {/* Delete Comment Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-[#141416] w-full max-w-sm rounded-2xl shadow-2xl border border-[#26262a] p-5 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#f2f2f3]">Delete comment?</h4>
                <p className="mt-1 text-xs text-[#a1a1a8] leading-relaxed">
                  This comment will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="h-9 px-3.5 text-xs font-semibold text-[#f2f2f3] hover:bg-[#1c1c1f] border border-[#3a3a40] rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="h-9 px-4 inline-flex items-center gap-1.5 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-xs rounded-full transition-colors disabled:opacity-50 cursor-pointer"
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
