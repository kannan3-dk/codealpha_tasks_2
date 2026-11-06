import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  Loader2,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Users,
  UserPlus,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PostCard } from '../components/PostCard';
import { PostSkeleton, SuggestedUserSkeleton } from '../components/PostSkeleton';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import type { Post, Profile as ProfileType } from '../types/database';

const POSTS_PER_PAGE = 20;

export const Home: React.FC = () => {
  const { user, profile } = useAuth();
  const { success, error: toastError } = useToast();

  // Tab state: 'everyone' or 'following'
  const [activeTab, setActiveTab] = useState<'everyone' | 'following'>('everyone');

  // Composer state
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  // Following list state
  const [myFollowingIds, setMyFollowingIds] = useState<string[]>([]);
  const [followingEmpty, setFollowingEmpty] = useState(false);

  // Suggested people state
  const [suggestedUsers, setSuggestedUsers] = useState<ProfileType[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [followedSuggestedIds, setFollowedSuggestedIds] = useState<Set<string>>(new Set());
  const [followInFlight, setFollowInFlight] = useState<Set<string>>(new Set());

  const characterCount = content.length;
  const isOverLimit = characterCount > 500;
  const isPostDisabled = content.trim().length === 0 || isOverLimit || isSubmitting;

  // Query which visible posts are liked by the user
  const fetchLikedStatus = useCallback(
    async (postIds: string[]) => {
      if (!user || postIds.length === 0) return;
      try {
        const { data, error } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postIds);

        if (error) {
          console.error('Error fetching liked posts:', error.message);
          return;
        }

        if (data && data.length > 0) {
          setLikedPostIds((prev) => {
            const next = new Set(prev);
            data.forEach((row) => next.add(row.post_id));
            return next;
          });
        }
      } catch (err) {
        console.error('Exception fetching liked status:', err);
      }
    },
    [user]
  );

  // Fetch suggested people (profiles not followed yet and not current user, limit 5)
  const fetchSuggestedPeople = useCallback(
    async (followingList: string[]) => {
      if (!user) return;
      setSuggestedLoading(true);

      try {
        const excludeIds = [user.id, ...followingList];
        let query = supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio');

        if (excludeIds.length > 0) {
          query = query.not('id', 'in', `(${excludeIds.join(',')})`);
        }

        const { data, error } = await query.limit(5);

        if (error) {
          console.error('Error fetching suggested people:', error.message);
          return;
        }

        setSuggestedUsers((data as ProfileType[]) || []);
      } catch (err) {
        console.error('Exception fetching suggested people:', err);
      } finally {
        setSuggestedLoading(false);
      }
    },
    [user]
  );

  // Fetch initial posts based on activeTab
  const fetchFeed = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setFeedError(null);
    setFollowingEmpty(false);

    try {
      // 1. Always get fresh following IDs for Following tab and Suggested People
      const { data: followRows, error: followErr } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followErr) {
        console.error('Error fetching following IDs:', followErr.message);
      }

      const followingList = followRows ? followRows.map((f: any) => f.following_id) : [];
      setMyFollowingIds(followingList);

      // Trigger suggested people loading with latest following list
      fetchSuggestedPeople(followingList);

      let fetchedPosts: Post[] = [];

      if (activeTab === 'following') {
        // If I follow nobody, show 'Follow people to see their posts here'
        if (followingList.length === 0) {
          setPosts([]);
          setFollowingEmpty(true);
          setHasMore(false);
          setLoading(false);
          return;
        }

        // Include my own posts and followed users' posts
        const authorIds = [user.id, ...followingList];

        const { data, error } = await supabase
          .from('posts')
          .select(
            '*, profiles!author_id(username, display_name, avatar_url), comments(count), likes(count)'
          )
          .in('author_id', authorIds)
          .order('created_at', { ascending: false })
          .range(0, POSTS_PER_PAGE - 1);

        if (error) throw error;
        fetchedPosts = (data as Post[]) || [];
      } else {
        // 'everyone' tab
        const { data, error } = await supabase
          .from('posts')
          .select(
            '*, profiles!author_id(username, display_name, avatar_url), comments(count), likes(count)'
          )
          .order('created_at', { ascending: false })
          .range(0, POSTS_PER_PAGE - 1);

        if (error) throw error;
        fetchedPosts = (data as Post[]) || [];
      }

      setPosts(fetchedPosts);
      setHasMore(fetchedPosts.length === POSTS_PER_PAGE);

      if (fetchedPosts.length > 0) {
        await fetchLikedStatus(fetchedPosts.map((p) => p.id));
      }
    } catch (err: unknown) {
      console.error('Exception fetching feed:', err);
      const friendly = getFriendlyErrorMessage(err, 'Failed to load posts. Please try again.');
      setFeedError(friendly);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab, fetchLikedStatus, fetchSuggestedPeople]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Load more posts with pagination
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !user) return;
    setLoadingMore(true);

    try {
      const from = posts.length;
      const to = from + POSTS_PER_PAGE - 1;

      let query = supabase
        .from('posts')
        .select(
          '*, profiles!author_id(username, display_name, avatar_url), comments(count), likes(count)'
        );

      if (activeTab === 'following') {
        const authorIds = [user.id, ...myFollowingIds];
        query = query.in('author_id', authorIds);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const newPosts = (data as Post[]) || [];
      setPosts((prev) => [...prev, ...newPosts]);
      setHasMore(newPosts.length === POSTS_PER_PAGE);

      if (newPosts.length > 0) {
        await fetchLikedStatus(newPosts.map((p) => p.id));
      }
    } catch (err: unknown) {
      console.error('Exception loading more posts:', err);
      toastError(getFriendlyErrorMessage(err, 'Failed to load more posts.'));
    } finally {
      setLoadingMore(false);
    }
  };

  // Submit new post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!user || !trimmed || isOverLimit) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          content: trimmed,
        })
        .select(
          '*, profiles!author_id(username, display_name, avatar_url), comments(count), likes(count)'
        )
        .single();

      if (error) {
        toastError(getFriendlyErrorMessage(error, 'Failed to create post.'));
        return;
      }

      if (data) {
        const newPost: Post = {
          ...data,
          comments: [{ count: 0 }],
          comments_count: 0,
          likes: [{ count: 0 }],
          likes_count: 0,
          profiles: data.profiles || {
            username: profile?.username || 'user',
            display_name: profile?.display_name || 'User',
            avatar_url: profile?.avatar_url || null,
          },
        };

        // Newly created post appears at the top immediately without a page reload
        setPosts((prev) => [newPost, ...prev]);
        setFollowingEmpty(false);
        setContent('');
        success('Post shared to Circle!');
      }
    } catch (err: unknown) {
      console.error('Exception creating post:', err);
      toastError(getFriendlyErrorMessage(err, 'Failed to publish post.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Follow a suggested person
  const handleFollowSuggested = async (targetId: string, targetUsername: string) => {
    if (!user || followInFlight.has(targetId)) return;

    setFollowInFlight((prev) => new Set(prev).add(targetId));
    setFollowedSuggestedIds((prev) => new Set(prev).add(targetId));

    try {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: targetId });

      if (error) {
        if (
          error.code === '23505' ||
          error.message.includes('duplicate') ||
          error.message.includes('already exists')
        ) {
          // Already followed
        } else {
          throw error;
        }
      }

      // Add to myFollowingIds so following tab stays updated
      setMyFollowingIds((prev) => [...prev, targetId]);
      success(`Following @${targetUsername}`);
    } catch (err) {
      console.error('Error following suggested person:', err);
      // Rollback
      setFollowedSuggestedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      toastError(getFriendlyErrorMessage(err, 'Failed to follow.'));
    } finally {
      setFollowInFlight((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  // Toggle like with optimistic UI & rollback
  const handleToggleLike = async (postId: string, nextLiked: boolean) => {
    if (!user) return;

    if (nextLiked) {
      setLikedPostIds((prev) => new Set(prev).add(postId));

      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, post_id: postId });

      if (error) {
        if (
          error.code === '23505' ||
          error.message.includes('duplicate key') ||
          error.message.includes('already exists')
        ) {
          return;
        }
        // Rollback state on error
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        throw error;
      }
    } else {
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });

      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);

      if (error) {
        // Rollback state on error
        setLikedPostIds((prev) => new Set(prev).add(postId));
        throw error;
      }
    }
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);

    if (error) {
      const friendly = getFriendlyErrorMessage(error, 'Failed to delete post.');
      toastError(friendly);
      throw error;
    }

    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
    success('Post deleted successfully');
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
    <div className="max-w-[1040px] mx-auto px-4 sm:px-8 py-8">
      <div className="flex flex-col min-[860px]:flex-row gap-8 items-start">
        {/* Main Feed Column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Post Composer Card */}
          <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-5">
            <form onSubmit={handleCreatePost}>
              <div className="flex items-start gap-3.5">
                {/* User Avatar (44px) */}
                <div className="shrink-0 pt-0.5">
                  <div className="w-11 h-11 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-sm flex items-center justify-center border border-[#3a3a40] overflow-hidden">
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

                {/* Composer Textarea */}
                <div className="flex-1 min-w-0">
                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What's happening in your circle?"
                    aria-label="What's happening in your circle?"
                    className="w-full bg-transparent border-none text-[#f2f2f3] text-[16px] placeholder-[#8a8a92] focus:outline-none focus:ring-0 resize-none p-1"
                  />

                  {/* Composer Footer: Divider, Counter, and Post Button */}
                  <div className="mt-3 pt-3 border-t border-[#26262a] flex items-center justify-between gap-3">
                    <span
                      className={`text-[13px] tabular-nums ${
                        isOverLimit ? 'text-[#f2f2f3] font-bold underline' : 'text-[#a1a1a8]'
                      }`}
                    >
                      {characterCount} / 500
                    </span>

                    <button
                      type="submit"
                      disabled={isPostDisabled}
                      aria-label="Publish post"
                      className="h-11 px-6 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-sm rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Posting...</span>
                        </div>
                      ) : (
                        <span>Post</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Feed Tabs: Everyone & Following (pill buttons, active = white bg with black text, inactive = muted text with 1px border) */}
          <div className="flex items-center gap-2.5 py-1">
            <button
              type="button"
              onClick={() => setActiveTab('everyone')}
              aria-selected={activeTab === 'everyone'}
              aria-pressed={activeTab === 'everyone'}
              className={`h-11 px-5 rounded-full text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] ${
                activeTab === 'everyone'
                  ? 'bg-[#f2f2f3] text-[#0b0b0c] font-semibold'
                  : 'bg-transparent border border-[#26262a] text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f]'
              }`}
            >
              Everyone
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('following')}
              aria-selected={activeTab === 'following'}
              aria-pressed={activeTab === 'following'}
              className={`h-11 px-5 rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] ${
                activeTab === 'following'
                  ? 'bg-[#f2f2f3] text-[#0b0b0c] font-semibold'
                  : 'bg-transparent border border-[#26262a] text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f]'
              }`}
            >
              <span>Following</span>
              {myFollowingIds.length > 0 && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    activeTab === 'following'
                      ? 'bg-[#0b0b0c] text-[#f2f2f3]'
                      : 'bg-[#1c1c1f] text-[#a1a1a8]'
                  }`}
                >
                  {myFollowingIds.length}
                </span>
              )}
            </button>
          </div>

          {/* Feed Content with Loading Skeletons */}
          {loading ? (
            <div className="space-y-4">
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </div>
          ) : feedError ? (
            <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-8 text-center max-w-md mx-auto">
              <AlertCircle className="w-10 h-10 text-[#f2f2f3] mx-auto mb-3" strokeWidth={1.75} />
              <h3 className="text-base font-bold text-[#f2f2f3]">Failed to load feed</h3>
              <p className="mt-1 text-xs text-[#a1a1a8] mb-4">{feedError}</p>
              <button
                type="button"
                onClick={fetchFeed}
                aria-label="Retry loading feed"
                className="h-11 px-6 rounded-full bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-xs transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : activeTab === 'following' && followingEmpty ? (
            /* Following Tab empty state: "Follow people to see their posts here" */
            <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-10 sm:p-14 text-center">
              <div className="max-w-sm mx-auto space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center mx-auto">
                  <Users className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-bold text-[#f2f2f3]">
                  Follow people to see their posts here
                </h3>
                <p className="text-sm text-[#a1a1a8] leading-relaxed">
                  When you follow other people in Circle, their latest updates and posts will appear in this feed.
                </p>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-10 sm:p-14 text-center">
              <div className="max-w-sm mx-auto space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center mx-auto">
                  <MessageSquare className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-bold text-[#f2f2f3]">No posts yet</h3>
                <p className="text-sm text-[#a1a1a8] leading-relaxed">
                  {activeTab === 'following'
                    ? "Nobody you follow has posted yet. Share something above!"
                    : "The circle is quiet right now. Use the composer above to share the first thought!"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id}
                  isLiked={likedPostIds.has(post.id)}
                  onToggleLike={handleToggleLike}
                  onDelete={handleDeletePost}
                />
              ))}

              {/* Load More Button: centered secondary button */}
              {hasMore && (
                <div className="pt-2 pb-4 text-center flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    aria-label="Load more posts"
                    className="h-11 px-6 rounded-full border border-[#3a3a40] text-[#f2f2f3] font-medium text-sm hover:bg-[#1c1c1f] transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
                  >
                    {loadingMore ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#f2f2f3]" />
                        <span>Loading more posts...</span>
                      </div>
                    ) : (
                      <span>Load more</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Suggested People Sidebar Card (300px sticky right sidebar, hidden below 860px) */}
        <div className="w-[300px] shrink-0 sticky top-24 hidden min-[860px]:block space-y-4">
          <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="text-[#f2f2f3] font-bold text-sm tracking-tight">
                Suggested people
              </div>
              {suggestedLoading && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#a1a1a8]" />
              )}
            </div>

            {suggestedLoading && suggestedUsers.length === 0 ? (
              <div className="divide-y divide-[#26262a]">
                <SuggestedUserSkeleton />
                <SuggestedUserSkeleton />
                <SuggestedUserSkeleton />
              </div>
            ) : suggestedUsers.length === 0 ? (
              <div className="py-5 text-center text-[#a1a1a8] text-xs">
                <p>No new suggestions right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#26262a]">
                {suggestedUsers.map((su) => {
                  const isFollowed = followedSuggestedIds.has(su.id);
                  const isInFlight = followInFlight.has(su.id);
                  const suInitials = getInitials(su.display_name, su.username);

                  return (
                    <div
                      key={su.id}
                      className="flex items-center justify-between py-3 gap-2 first:pt-0 last:pb-0"
                    >
                      <Link
                        to={`/u/${su.username}`}
                        aria-label={`View ${su.display_name}'s profile`}
                        className="flex items-center gap-2.5 min-w-0 group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
                      >
                        <div className="w-10 h-10 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-xs flex items-center justify-center border border-[#3a3a40] shrink-0 overflow-hidden">
                          {su.avatar_url ? (
                            <img
                              src={su.avatar_url}
                              alt={su.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{suInitials}</span>
                          )}
                        </div>

                        <div className="min-w-0 leading-tight">
                          <div className="text-xs font-semibold text-[#f2f2f3] group-hover:text-[#d4d4d8] truncate transition-colors">
                            {su.display_name}
                          </div>
                          <div className="text-[11px] text-[#a1a1a8] truncate">
                            @{su.username}
                          </div>
                        </div>
                      </Link>

                      {/* Secondary Follow button */}
                      <button
                        type="button"
                        onClick={() => handleFollowSuggested(su.id, su.username)}
                        disabled={isFollowed || isInFlight}
                        aria-label={isFollowed ? `Following ${su.display_name}` : `Follow ${su.display_name}`}
                        className={`shrink-0 inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] ${
                          isFollowed
                            ? 'bg-transparent text-[#a1a1a8] border border-[#2a2a2e]'
                            : 'bg-transparent border border-[#3a3a40] text-[#f2f2f3] hover:bg-[#1c1c1f]'
                        }`}
                      >
                        {isInFlight ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isFollowed ? (
                          <>
                            <UserCheck className="w-3 h-3 text-[#a1a1a8]" strokeWidth={1.75} />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3 text-[#f2f2f3]" strokeWidth={1.75} />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
