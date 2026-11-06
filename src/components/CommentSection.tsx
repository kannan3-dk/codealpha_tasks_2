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
    <div className="space-y-4 pt-4 border-t border-[#26262a]">
      {/* Comment Input Form */}
      {user && (
        <form onSubmit={handleSubmitComment} className="flex items-start gap-3">
          <div className="shrink-0 pt-1">
            <div className="w-8 h-8 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-xs flex items-center justify-center border border-[#3a3a40] overflow-hidden">
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
                className="w-full min-h-[48px] p-3 text-sm text-[#f2f2f3] placeholder-[#8a8a92] bg-[#0b0b0c] rounded-xl border border-[#2a2a2e] focus:border-[#3a3a40] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all resize-none"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span
                className={`text-[11px] font-medium tabular-nums ${
                  isOverLimit ? 'text-[#f2f2f3] font-bold underline' : 'text-[#a1a1a8]'
                }`}
              >
                {charCount}/300
              </span>

              <button
                type="submit"
                disabled={isSubmitDisabled}
                aria-label="Post comment"
                className="h-9 px-4 inline-flex items-center gap-1.5 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-xs rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" strokeWidth={1.75} />
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
        <div className="p-3 bg-[#141416] border border-[#26262a] rounded-xl flex items-center justify-between text-xs text-[#a1a1a8]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#f2f2f3] shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchComments}
            aria-label="Retry loading comments"
            className="font-semibold underline text-[#f2f2f3] hover:text-[#d4d4d8] cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : comments.length === 0 ? (
        <div className="py-4 text-center text-[#a1a1a8]">
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
