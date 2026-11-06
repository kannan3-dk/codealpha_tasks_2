import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2,
  Loader2,
  AlertTriangle,
  MessageCircle,
  ExternalLink,
  Heart,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import type { Post } from '../types/database';
import { formatRelativeTime } from '../utils/time';
import { CommentSection } from './CommentSection';

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  isLiked?: boolean;
  onToggleLike?: (postId: string, nextLiked: boolean) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  defaultExpandedComments?: boolean;
  showDetailLink?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  isLiked = false,
  onToggleLike,
  onDelete,
  defaultExpandedComments = false,
  showDetailLink = true,
}) => {
  const { error: toastError } = useToast();

  const [imageError, setImageError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showComments, setShowComments] = useState(defaultExpandedComments);

  // Extract initial comment count from post.comments[0]?.count or comments_count
  const getInitialCommentCount = () => {
    if (typeof post.comments_count === 'number') return post.comments_count;
    if (Array.isArray(post.comments) && post.comments.length > 0) {
      return post.comments[0]?.count ?? 0;
    }
    return 0;
  };

  // Extract initial like count from post.likes[0]?.count or likes_count
  const getInitialLikeCount = () => {
    if (typeof post.likes_count === 'number') return post.likes_count;
    if (Array.isArray(post.likes) && post.likes.length > 0) {
      return post.likes[0]?.count ?? 0;
    }
    return 0;
  };

  const [commentCount, setCommentCount] = useState(getInitialCommentCount);
  const [likeCount, setLikeCount] = useState(getInitialLikeCount);
  const [liked, setLiked] = useState(Boolean(isLiked));
  const [isTogglingLike, setIsTogglingLike] = useState(false);

  useEffect(() => {
    setLiked(Boolean(isLiked));
  }, [isLiked]);

  useEffect(() => {
    setCommentCount(getInitialCommentCount());
    setLikeCount(getInitialLikeCount());
  }, [post]);

  const authorProfile = post.profiles || post.author;
  const username = authorProfile?.username || 'unknown';
  const displayName = authorProfile?.display_name || username || 'User';
  const avatarUrl = authorProfile?.avatar_url;
  const isAuthor = Boolean(currentUserId && currentUserId === post.author_id);
  const relativeTime = formatRelativeTime(post.created_at);

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
      await onDelete(post.id);
    } catch (err) {
      console.error('Error in post card delete:', err);
      toastError(getFriendlyErrorMessage(err, 'Failed to delete post'));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCommentCountDelta = (delta: number) => {
    setCommentCount((prev) => Math.max(0, prev + delta));
  };

  // Like click with optimistic UI and duplicate double-click protection
  const handleHeartClick = async () => {
    if (isTogglingLike || !currentUserId) return;

    const previousLiked = liked;
    const previousCount = likeCount;
    const nextLiked = !previousLiked;

    // 1. Optimistic UI: update state instantly
    setLiked(nextLiked);
    setLikeCount((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    setIsTogglingLike(true);

    try {
      if (onToggleLike) {
        await onToggleLike(post.id, nextLiked);
      } else {
        if (nextLiked) {
          const { error } = await supabase
            .from('likes')
            .insert({ user_id: currentUserId, post_id: post.id });

          if (error) {
            // Ignore duplicate-key error gracefully
            if (
              error.code === '23505' ||
              error.message.includes('duplicate key') ||
              error.message.includes('already exists')
            ) {
              return;
            }
            throw error;
          }
        } else {
          const { error } = await supabase
            .from('likes')
            .delete()
            .eq('user_id', currentUserId)
            .eq('post_id', post.id);

          if (error) throw error;
        }
      }
    } catch (err: unknown) {
      console.error('Error toggling like:', err);
      // Rollback on failure
      setLiked(previousLiked);
      setLikeCount(previousCount);
      toastError(getFriendlyErrorMessage(err, 'Failed to update like. Please try again.'));
    } finally {
      setIsTogglingLike(false);
    }
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDeleteConfirm) {
        setShowDeleteConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm]);

  return (
    <article className="bg-[#141416] border border-[#26262a] rounded-2xl p-5 transition-colors duration-150">
      <div className="flex items-start justify-between gap-3">
        {/* Author Avatar and Names */}
        <div className="flex items-center gap-3.5 min-w-0">
          <Link
            to={`/u/${username}`}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c]"
            title={`View @${username}'s profile`}
          >
            <div className="w-11 h-11 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-sm flex items-center justify-center border border-[#3a3a40] overflow-hidden">
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

          <div className="min-w-0 leading-tight">
            {/* avatar + bold display name (link) + muted '@username · relative time' on one line */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                to={`/u/${username}`}
                className="font-bold text-[#f2f2f3] text-[15px] hover:text-[#d4d4d8] hover:underline transition-colors truncate"
              >
                {displayName}
              </Link>
              <Link
                to={`/u/${username}`}
                className="text-[13px] text-[#a1a1a8] hover:text-[#f2f2f3] truncate"
              >
                @{username}
              </Link>
              <span className="text-[#3a3a40] text-xs select-none">·</span>
              <time
                dateTime={post.created_at}
                className="text-[13px] text-[#a1a1a8] shrink-0"
                title={new Date(post.created_at).toLocaleString()}
              >
                {relativeTime}
              </time>
            </div>
          </div>
        </div>

        {/* Post Actions (Delete button for author, thread link) */}
        <div className="flex items-center gap-1 shrink-0">
          {showDetailLink && (
            <Link
              to={`/post/${post.id}`}
              className="p-2 text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
              title="View post detail"
              aria-label="View post detail"
            >
              <ExternalLink className="w-4 h-4" strokeWidth={1.75} />
            </Link>
          )}

          {isAuthor && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="p-2 text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f] rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
              title="Delete post"
              aria-label="Delete post"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Post Content: 16px below */}
      <div className="mt-4 text-[#f2f2f3] text-[15px] leading-relaxed whitespace-pre-wrap break-words">
        {post.content}
      </div>

      {/* Post Card Footer: Action row with ghost icon buttons (min 44px height, muted, hover #1c1c1f) */}
      <div className="mt-4 pt-3 border-t border-[#26262a] flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-2">
          {/* Heart / Like Button */}
          <button
            type="button"
            onClick={handleHeartClick}
            disabled={isTogglingLike || !currentUserId}
            className={`min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1c1c1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] ${
              liked ? 'text-[#f2f2f3]' : 'text-[#a1a1a8] hover:text-[#f2f2f3]'
            }`}
            aria-label={liked ? 'Unlike post' : 'Like post'}
            title={liked ? 'Unlike' : 'Like'}
          >
            <Heart
              className={`w-5 h-5 transition-transform duration-150 ${
                liked
                  ? 'fill-[#f2f2f3] text-[#f2f2f3]'
                  : 'text-[#a1a1a8]'
              }`}
              strokeWidth={1.75}
            />
            <span className="tabular-nums text-[13px]">{likeCount}</span>
          </button>

          {/* Comment Button */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className={`min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-colors duration-150 cursor-pointer hover:bg-[#1c1c1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] ${
              showComments ? 'text-[#f2f2f3] bg-[#1c1c1f]' : 'text-[#a1a1a8] hover:text-[#f2f2f3]'
            }`}
            aria-expanded={showComments}
            aria-label={showComments ? `Hide comments (${commentCount})` : `Show comments (${commentCount})`}
            title="View comments"
          >
            <MessageCircle className="w-5 h-5 text-[#a1a1a8]" strokeWidth={1.75} />
            <span className="tabular-nums text-[13px]">{commentCount}</span>
          </button>
        </div>

        {showDetailLink && (
          <Link
            to={`/post/${post.id}`}
            className="text-[13px] font-medium text-[#a1a1a8] hover:text-[#f2f2f3] transition-colors"
          >
            Thread
          </Link>
        )}
      </div>

      {/* Inline Comments Section: Indented list inside post card */}
      {showComments && (
        <div className="mt-3 pl-2 sm:pl-4 border-l border-[#26262a] animate-in fade-in duration-150">
          <CommentSection
            postId={post.id}
            onCommentCountChange={handleCommentCountDelta}
          />
        </div>
      )}

      {/* Delete Confirmation Modal / Backdrop (dimmed #000 at 70% overlay, Esc closes) */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-[#141416] w-full max-w-sm rounded-2xl shadow-2xl border border-[#26262a] p-6 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#f2f2f3]" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="delete-confirm-title" className="text-base font-bold text-[#f2f2f3]">
                  Delete post?
                </h3>
                <p className="mt-1 text-[13px] text-[#a1a1a8] leading-relaxed">
                  This post will be permanently deleted from Circle. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="h-11 px-4 text-sm font-medium text-[#f2f2f3] hover:bg-[#1c1c1f] rounded-full border border-[#3a3a40] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="h-11 px-5 inline-flex items-center gap-2 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-sm rounded-full transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
    </article>
  );
};
