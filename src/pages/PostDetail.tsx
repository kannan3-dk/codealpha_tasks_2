import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import type { Post } from '../types/database';

export const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('posts')
        .select(
          '*, profiles!author_id(username, display_name, avatar_url), comments(count), likes(count)'
        )
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching post detail:', error.message);
        setErrorMessage(getFriendlyErrorMessage(error, 'Failed to load post.'));
        return;
      }

      if (!data) {
        setNotFound(true);
        return;
      }

      const fetchedPost = data as Post;
      setPost(fetchedPost);

      // Check if current user already liked this post
      if (user) {
        const { data: likedRow } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('post_id', fetchedPost.id)
          .maybeSingle();

        setIsLiked(Boolean(likedRow));
      }
    } catch (err: unknown) {
      console.error('Exception fetching post:', err);
      setErrorMessage(getFriendlyErrorMessage(err, 'An error occurred while loading post'));
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleToggleLike = async (postId: string, nextLiked: boolean) => {
    if (!user) return;
    setIsLiked(nextLiked);

    try {
      if (nextLiked) {
        const { error } = await supabase
          .from('likes')
          .insert({ user_id: user.id, post_id: postId });

        if (error) {
          // Gracefully ignore duplicate-key error
          if (
            error.code === '23505' ||
            error.message.includes('duplicate key') ||
            error.message.includes('already exists')
          ) {
            return;
          }
          setIsLiked(false);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);

        if (error) {
          setIsLiked(true);
          throw error;
        }
      }
    } catch (err: unknown) {
      toastError(getFriendlyErrorMessage(err, 'Failed to update like'));
      throw err;
    }
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);

    if (error) {
      toastError(getFriendlyErrorMessage(error, 'Failed to delete post'));
      throw error;
    }

    success('Post deleted successfully');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="space-y-5 max-w-[720px] mx-auto px-4 py-8">
        <div className="h-5 w-24 bg-[#1c1c1f] rounded-md animate-pulse" />
        <PostSkeleton />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold text-[#f2f2f3]">Post not found</h2>
          <p className="mt-2 text-sm text-[#a1a1a8]">
            This post may have been deleted by the author or does not exist.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              aria-label="Return to Feed"
              className="inline-flex items-center gap-2 h-11 px-6 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-sm rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              <span>Return to Feed</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-8 text-center max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-[#f2f2f3] mx-auto mb-3" strokeWidth={1.75} />
          <h3 className="text-base font-bold text-[#f2f2f3]">Unable to load post</h3>
          <p className="mt-1 text-xs text-[#a1a1a8] mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={fetchPost}
            aria-label="Retry loading post"
            className="h-11 px-6 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-xs rounded-full transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[720px] mx-auto px-4 py-8">
      {/* Back button: muted hover text #f2f2f3 */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#a1a1a8] hover:text-[#f2f2f3] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] rounded-lg p-1"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.75} />
          <span>Back to Feed</span>
        </Link>
      </div>

      {/* Main Post Card with inline comments always expanded */}
      <PostCard
        post={post}
        currentUserId={user?.id}
        isLiked={isLiked}
        onToggleLike={handleToggleLike}
        onDelete={handleDeletePost}
        defaultExpandedComments={true}
        showDetailLink={false}
      />
    </div>
  );
};
