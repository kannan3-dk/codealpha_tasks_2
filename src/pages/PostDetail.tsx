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
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="h-5 w-24 bg-slate-200 rounded-md animate-pulse" />
        <PostSkeleton />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-50/50">
          <MessageCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Post not found</h2>
        <p className="mt-2 text-sm text-slate-600">
          This post may have been deleted by the author or does not exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            aria-label="Return to Feed"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Feed</span>
          </Link>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center max-w-md mx-auto shadow-xs">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Unable to load post</h3>
        <p className="mt-1 text-xs text-slate-600 mb-4">{errorMessage}</p>
        <button
          type="button"
          onClick={fetchPost}
          aria-label="Retry loading post"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
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
