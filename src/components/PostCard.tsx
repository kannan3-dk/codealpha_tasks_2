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

  return (
    <article className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs hover:border-slate-300/90 transition-all duration-150">
      <div className="flex items-start justify-between gap-3">
        {/* Author Avatar and Names */}
        <div className="flex items-start gap-3.5 min-w-0">
          <Link
            to={`/u/${username}`}
            className="shrink-0 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-full group"
            title={`View @${username}'s profile`}
          >
            <div className="w-11 h-11 rounded-full bg-red-600 text-white font-bold text-sm flex items-center justify-center ring-2 ring-slate-100 shadow-2xs group-hover:scale-105 transition-transform overflow-hidden">
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

          <div className="min-w-0 leading-tight pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Link
                to={`/u/${username}`}
                className="font-bold text-slate-900 text-sm sm:text-base hover:text-indigo-600 hover:underline transition-colors truncate"
              >
                {displayName}
              </Link>
              <Link
                to={`/u/${username}`}
                className="text-xs text-slate-400 hover:text-slate-600 truncate"
              >
                @{username}
              </Link>
              <span className="text-slate-300 text-xs select-none">·</span>
              <time
                dateTime={post.created_at}
                className="text-xs text-slate-400 shrink-0"
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
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="View post detail"
              aria-label="View post detail"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}

          {isAuthor && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Delete post"
              aria-label="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="mt-3 text-slate-800 text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words pl-[58px] -mt-1 sm:-mt-2">
        {post.content}
      </div>

      {/* Post Card Footer: Heart Like and Comment Buttons */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between pl-[58px]">
        <div className="flex items-center gap-2">
          {/* Heart / Like Button */}
          <button
            type="button"
            onClick={handleHeartClick}
            disabled={isTogglingLike || !currentUserId}
            className={`inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group ${
              liked
                ? 'text-rose-600 bg-rose-50/80 hover:bg-rose-100/80'
                : 'text-slate-500 hover:text-rose-600 hover:bg-slate-100/80'
            }`}
            aria-label={liked ? 'Unlike post' : 'Like post'}
            title={liked ? 'Unlike' : 'Like'}
          >
            <Heart
              className={`w-4 h-4 transition-transform active:scale-125 ${
                liked
                  ? 'fill-rose-500 text-rose-500 scale-105'
                  : 'text-slate-400 group-hover:text-rose-500'
              }`}
            />
            <span className="tabular-nums">{likeCount}</span>
          </button>

          {/* Comment Button */}
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className={`inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              showComments
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100/80'
            }`}
            aria-expanded={showComments}
            aria-label={showComments ? `Hide comments (${commentCount})` : `Show comments (${commentCount})`}
            title="View comments"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="tabular-nums">{commentCount}</span>
          </button>
        </div>

        {showDetailLink && (
          <Link
            to={`/post/${post.id}`}
            className="text-xs font-semibold text-slate-400 hover:text-indigo-600 hover:underline transition-colors"
          >
            Thread
          </Link>
        )}
      </div>

      {/* Inline Comments Section */}
      {showComments && (
        <div className="mt-3 pl-[58px] animate-in fade-in duration-150">
          <CommentSection
            postId={post.id}
            onCommentCountChange={handleCommentCountDelta}
          />
        </div>
      )}

      {/* Delete Confirmation Modal / Backdrop */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="delete-confirm-title" className="text-base font-bold text-slate-900">
                  Delete post?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  This post will be permanently deleted from Circle. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
