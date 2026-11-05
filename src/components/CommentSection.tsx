import React, { useState, useEffect, useCallback } from 'react';
import { Send, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CommentItem } from './CommentItem';
import { CommentSkeleton } from './PostSkeleton';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import type { Comment } from '../types/database';

interface CommentSectionProps {
  postId: string;
  onCommentCountChange?: (delta: number) => void;
  autoFocus?: boolean;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  onCommentCountChange,
  autoFocus = false,
}) => {
  const { user, profile } = useAuth();
  const { success, error: toastError } = useToast();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New comment form
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const charCount = newContent.length;
  const isOverLimit = charCount > 300;
  const isSubmitDisabled = newContent.trim().length === 0 || isOverLimit || isSubmitting;

  // Load comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryErr } = await supabase
        .from('comments')
        .select('*, profiles(username, display_name, avatar_url)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (queryErr) {
        console.error('Error loading comments:', queryErr.message);
        setError(getFriendlyErrorMessage(queryErr, 'Failed to load comments'));
        return;
      }

      setComments((data as Comment[]) || []);
    } catch (err: unknown) {
      console.error('Exception fetching comments:', err);
      setError(getFriendlyErrorMessage(err, 'Error loading comments'));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Insert comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newContent.trim();
    if (!user || !trimmed || isOverLimit) return;

    setIsSubmitting(true);

    try {
      const { data, error: insertErr } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content: trimmed,
        })
        .select('*, profiles(username, display_name, avatar_url)')
        .single();

      if (insertErr) {
        console.error('Error inserting comment:', insertErr.message);
        toastError(getFriendlyErrorMessage(insertErr, 'Failed to post comment'));
        return;
      }

      if (data) {
        const fullComment: Comment = {
          ...data,
          profiles: data.profiles || {
            username: profile?.username || 'user',
            display_name: profile?.display_name || 'User',
            avatar_url: profile?.avatar_url || null,
          },
        };

        // Show the new comment instantly
        setComments((prev) => [...prev, fullComment]);
        setNewContent('');
        if (onCommentCountChange) {
          onCommentCountChange(1);
        }
        success('Comment added!');
      }
    } catch (err: unknown) {
      console.error('Exception creating comment:', err);
      toastError(getFriendlyErrorMessage(err, 'Failed to post comment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    const { error: delErr } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (delErr) {
      console.error('Error deleting comment:', delErr.message);
      toastError(getFriendlyErrorMessage(delErr, 'Failed to delete comment'));
      throw delErr;
    }

    setComments((prev) => prev.filter((c) => c.id !== commentId));
    if (onCommentCountChange) {
      onCommentCountChange(-1);
    }
    success('Comment deleted');
  };

  const getInitials = (displayName?: string | null, uname?: string | null) => {
    const text = (displayName || uname || 'U').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const userInitials = getInitials(profile?.display_name, profile?.username);

  return (
    <div className="space-y-4 pt-4 border-t border-slate-100">
      {/* Comment Input Form */}
      {user && (
        <form onSubmit={handleSubmitComment} className="flex items-start gap-2.5">
          <div className="shrink-0 pt-1">
            <div className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-slate-100 shadow-2xs overflow-hidden">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{userInitials}</span>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative">
              <textarea
                rows={2}
                autoFocus={autoFocus}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write a comment..."
                aria-label="Write a comment"
                className="w-full p-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 bg-slate-50/80 rounded-xl border border-slate-200 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span
                className={`text-[11px] font-medium tabular-nums ${
                  isOverLimit ? 'text-rose-600 font-bold' : 'text-slate-400'
                }`}
              >
                {charCount}/300
              </span>

              <button
                type="submit"
                disabled={isSubmitDisabled}
                aria-label="Post comment"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    <span>Reply</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="space-y-1">
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchComments}
            aria-label="Retry loading comments"
            className="font-bold underline text-rose-900 hover:text-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-4 text-center text-slate-400">
          <p className="text-xs">No comments yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onDelete={handleDeleteComment}
            />
          ))}
        </div>
      )}
    </div>
  );
};
