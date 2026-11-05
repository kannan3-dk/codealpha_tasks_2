import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  User,
  ArrowLeft,
  Loader2,
  FileText,
  CheckCircle2,
  Edit3,
  X,
  AlertCircle,
  Image as ImageIcon,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PostCard } from '../components/PostCard';
import { UserListModal } from '../components/UserListModal';
import { PostSkeleton, ProfileHeaderSkeleton } from '../components/PostSkeleton';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import type { Profile as ProfileType, Post } from '../types/database';

const POSTS_PER_PAGE = 20;

export const Profile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, profile: currentProfile, refreshProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [postsCount, setPostsCount] = useState<number>(0);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowInFlight, setIsFollowInFlight] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Modal state for followers / following list
  const [modalMode, setModalMode] = useState<'followers' | 'following' | null>(null);

  // User posts feed state
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  // Edit profile modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Compute initials fallback from display_name or username
  const getInitials = (displayName?: string | null, uname?: string | null) => {
    const text = (displayName || uname || 'U').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  // Fetch which posts the current user liked
  const fetchLikedStatus = useCallback(
    async (postIds: string[]) => {
      if (!currentUser || postIds.length === 0) return;
      try {
        const { data, error } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', currentUser.id)
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
    [currentUser]
  );

  // Fetch author posts
  const fetchUserPosts = useCallback(
    async (authorId: string) => {
      setPostsLoading(true);
      setPostsError(null);

      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*, profiles!author_id(username, display_name, avatar_url), comments(count), likes(count)')
          .eq('author_id', authorId)
          .order('created_at', { ascending: false })
          .range(0, POSTS_PER_PAGE - 1);

        if (error) {
          console.error('Error fetching user posts:', error.message);
          setPostsError(getFriendlyErrorMessage(error, 'Failed to load user posts.'));
          return;
        }

        const list = (data as Post[]) || [];
        setUserPosts(list);
        setPostsHasMore(list.length === POSTS_PER_PAGE);

        if (list.length > 0) {
          await fetchLikedStatus(list.map((p) => p.id));
        }
      } catch (err: unknown) {
        console.error('Exception fetching user posts:', err);
        setPostsError(getFriendlyErrorMessage(err, 'Failed to load user posts.'));
      } finally {
        setPostsLoading(false);
      }
    },
    [fetchLikedStatus]
  );

  // Fetch user profile, counts, and following status
  const fetchProfileAndStats = useCallback(async () => {
    if (!username) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    setFetchError(null);
    setImageError(false);

    try {
      const cleanUsername = username.trim().toLowerCase();

      // Load profile by username from the profiles table
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (profileErr) {
        console.error('Error fetching profile:', profileErr.message);
        setFetchError(getFriendlyErrorMessage(profileErr, 'Failed to load profile. Please try again.'));
        setLoading(false);
        return;
      }

      if (!profileData) {
        setNotFound(true);
        setProfile(null);
        setLoading(false);
        return;
      }

      const loadedProfile = profileData as ProfileType;
      setProfile(loadedProfile);

      // 1. Posts count
      const { count: postsTotal } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', loadedProfile.id);

      setPostsCount(postsTotal ?? 0);

      // 2. Real Followers count (following_id = profile.id)
      const { count: fersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', loadedProfile.id);

      setFollowersCount(fersCount ?? 0);

      // 3. Real Following count (follower_id = profile.id)
      const { count: fingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', loadedProfile.id);

      setFollowingCount(fingCount ?? 0);

      // 4. Check if current user is following this profile
      if (currentUser && currentUser.id !== loadedProfile.id) {
        const { data: followRow } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id)
          .eq('following_id', loadedProfile.id)
          .maybeSingle();

        setIsFollowing(Boolean(followRow));
      }

      // Fetch the posts for this user's profile
      await fetchUserPosts(loadedProfile.id);
    } catch (err: unknown) {
      console.error('Exception fetching profile data:', err);
      setFetchError(getFriendlyErrorMessage(err, 'An unexpected error occurred while loading profile.'));
    } finally {
      setLoading(false);
    }
  }, [username, currentUser, fetchUserPosts]);

  useEffect(() => {
    fetchProfileAndStats();
  }, [fetchProfileAndStats]);

  // Handle Follow / Unfollow on other user's profile with optimistic UI
  const handleToggleFollow = async () => {
    if (!currentUser || !profile || currentUser.id === profile.id || isFollowInFlight) return;

    const previousIsFollowing = isFollowing;
    const previousFollowersCount = followersCount;
    const nextIsFollowing = !previousIsFollowing;

    // Optimistic UI
    setIsFollowing(nextIsFollowing);
    setFollowersCount((prev) => (nextIsFollowing ? prev + 1 : Math.max(0, prev - 1)));
    setIsFollowInFlight(true);

    try {
      if (nextIsFollowing) {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: profile.id,
          });

        if (error) {
          // Ignore duplicate constraint if already exists
          if (
            error.code === '23505' ||
            error.message.includes('duplicate') ||
            error.message.includes('already exists')
          ) {
            return;
          }
          throw error;
        }
        success(`Following @${profile.username}`);
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id);

        if (error) throw error;
        success(`Unfollowed @${profile.username}`);
      }
    } catch (err: unknown) {
      console.error('Error toggling follow:', err);
      // Rollback
      setIsFollowing(previousIsFollowing);
      setFollowersCount(previousFollowersCount);
      toastError(getFriendlyErrorMessage(err, 'Failed to update follow'));
    } finally {
      setIsFollowInFlight(false);
    }
  };

  // Load more posts for profile
  const handleLoadMorePosts = async () => {
    if (!profile || postsLoadingMore || !postsHasMore) return;
    setPostsLoadingMore(true);

    try {
      const from = userPosts.length;
      const to = from + POSTS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles!author_id(username, display_name, avatar_url), comments(count), likes(count)')
        .eq('author_id', profile.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error loading more user posts:', error.message);
        toastError(getFriendlyErrorMessage(error, 'Failed to load more posts'));
        return;
      }

      const newPosts = (data as Post[]) || [];
      setUserPosts((prev) => [...prev, ...newPosts]);
      setPostsHasMore(newPosts.length === POSTS_PER_PAGE);

      if (newPosts.length > 0) {
        await fetchLikedStatus(newPosts.map((p) => p.id));
      }
    } catch (err: unknown) {
      console.error('Exception loading more user posts:', err);
      toastError(getFriendlyErrorMessage(err, 'Failed to load more posts'));
    } finally {
      setPostsLoadingMore(false);
    }
  };

  // Toggle like with optimistic UI & rollback
  const handleToggleLike = async (postId: string, nextLiked: boolean) => {
    if (!currentUser) return;

    if (nextLiked) {
      setLikedPostIds((prev) => new Set(prev).add(postId));

      const { error } = await supabase
        .from('likes')
        .insert({ user_id: currentUser.id, post_id: postId });

      if (error) {
        if (
          error.code === '23505' ||
          error.message.includes('duplicate key') ||
          error.message.includes('already exists')
        ) {
          return;
        }
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
        .eq('user_id', currentUser.id)
        .eq('post_id', postId);

      if (error) {
        setLikedPostIds((prev) => new Set(prev).add(postId));
        throw error;
      }
    }
  };

  // Delete post from profile feed
  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);

    if (error) {
      toastError(getFriendlyErrorMessage(error, 'Failed to delete post'));
      throw error;
    }

    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
    setPostsCount((prev) => Math.max(0, prev - 1));
    success('Post deleted successfully');
  };

  // Open Edit Profile modal with prefilled data
  const handleOpenEdit = () => {
    if (!profile) return;
    setEditDisplayName(profile.display_name || '');
    setEditBio(profile.bio || '');
    setEditAvatarUrl(profile.avatar_url || '');
    setEditFormErrors({});
    setIsEditing(true);
  };

  const handleCloseEdit = () => {
    setIsEditing(false);
    setEditFormErrors({});
  };

  // Save profile updates
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !profile) return;

    // Validation
    const errors: Record<string, string> = {};
    const trimmedDisplayName = editDisplayName.trim();
    if (!trimmedDisplayName) {
      errors.displayName = 'Display name cannot be empty.';
    } else if (trimmedDisplayName.length > 50) {
      errors.displayName = 'Display name must be 50 characters or less.';
    }

    if (editBio.length > 160) {
      errors.bio = 'Bio must be 160 characters or less.';
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    setIsSaving(true);
    setEditFormErrors({});

    try {
      const updates = {
        display_name: trimmedDisplayName,
        bio: editBio.trim() ? editBio.trim() : null,
        avatar_url: editAvatarUrl.trim() ? editAvatarUrl.trim() : null,
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error.message);
        const friendly = getFriendlyErrorMessage(error, 'Failed to update profile.');
        setEditFormErrors({ general: friendly });
        toastError(friendly);
        return;
      }

      if (data) {
        const updatedProfile = data as ProfileType;
        setProfile(updatedProfile);
        setImageError(false);

        // Update profile in author data of local posts
        setUserPosts((prev) =>
          prev.map((post) => ({
            ...post,
            profiles: {
              username: updatedProfile.username,
              display_name: updatedProfile.display_name,
              avatar_url: updatedProfile.avatar_url,
            },
          }))
        );

        // Refresh AuthContext profile so navbar and global state update
        await refreshProfile();
        success('Profile updated successfully!');
        setIsEditing(false);
      }
    } catch (err: unknown) {
      console.error('Unexpected error saving profile:', err);
      const msg = getFriendlyErrorMessage(err, 'An error occurred while saving');
      setEditFormErrors({ general: msg });
      toastError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <ProfileHeaderSkeleton />
        <div className="space-y-4">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      </div>
    );
  }

  // Network/Query Error state
  if (fetchError) {
    return (
      <div className="bg-white border border-rose-200 rounded-2xl p-8 sm:p-10 text-center max-w-lg mx-auto shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Unable to load profile</h2>
        <p className="mt-2 text-sm text-slate-600">{fetchError}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={fetchProfileAndStats}
            aria-label="Retry loading profile"
            className="px-4 py-2 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Try Again
          </button>
          <Link
            to="/"
            aria-label="Return to Home feed"
            className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-200 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // User not found state
  if (notFound || !profile) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-50/50">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">User not found</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          The user <span className="font-semibold text-slate-900">@{username}</span> does not exist or may have been removed.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            aria-label="Return to Home feed"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  const isCurrentUser = currentUser?.id === profile.id;
  const formattedJoinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  const hasAvatarImg = Boolean(profile.avatar_url && !imageError);
  const initials = getInitials(profile.display_name, profile.username);

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 flex-1 min-w-0">
            {/* Avatar: Image with fallback to initials circle */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-600 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center ring-4 ring-slate-100 shadow-md overflow-hidden">
                {hasAvatarImg ? (
                  <img
                    src={profile.avatar_url!}
                    alt={profile.display_name}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
            </div>

            {/* User details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
                  {profile.display_name}
                </h1>
                {isCurrentUser && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>You</span>
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-slate-500 mt-0.5">@{profile.username}</p>

              {/* Bio */}
              {profile.bio ? (
                <p className="mt-3 text-sm text-slate-700 leading-relaxed max-w-2xl whitespace-pre-line break-words">
                  {profile.bio}
                </p>
              ) : isCurrentUser ? (
                <p className="mt-2 text-xs text-slate-400 italic">
                  No bio yet. Click &quot;Edit profile&quot; to add one.
                </p>
              ) : null}

              {/* Joined Date */}
              {formattedJoinedDate && (
                <div className="mt-3.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Joined {formattedJoinedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button: Edit profile (for self) or Follow / Unfollow (for others) */}
          <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
            {isCurrentUser ? (
              <button
                type="button"
                onClick={handleOpenEdit}
                aria-label="Edit your profile"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-sm rounded-xl border border-slate-200/80 transition-all shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-slate-600" />
                <span>Edit profile</span>
              </button>
            ) : currentUser ? (
              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={isFollowInFlight}
                aria-label={isFollowing ? `Unfollow @${profile.username}` : `Follow @${profile.username}`}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 font-bold text-sm rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
                  isFollowing
                    ? 'bg-slate-100 hover:bg-rose-50 text-slate-800 hover:text-rose-600 border border-slate-200/90'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                }`}
              >
                {isFollowInFlight ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* Three stat labels: Posts, Followers, Following (Clickable for Followers and Following) */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-7 sm:gap-10">
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-slate-900 text-lg">{postsCount}</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {postsCount === 1 ? 'Post' : 'Posts'}
            </span>
          </div>

          {/* Clickable Followers */}
          <button
            type="button"
            onClick={() => setModalMode('followers')}
            className="flex items-baseline gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer group text-left"
            title="View followers"
            aria-label={`View ${followersCount} followers`}
          >
            <span className="font-extrabold text-slate-900 group-hover:text-indigo-600 text-lg transition-colors">
              {followersCount}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-indigo-600 transition-colors">
              {followersCount === 1 ? 'Follower' : 'Followers'}
            </span>
          </button>

          {/* Clickable Following */}
          <button
            type="button"
            onClick={() => setModalMode('following')}
            className="flex items-baseline gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer group text-left"
            title="View following"
            aria-label={`View ${followingCount} following`}
          >
            <span className="font-extrabold text-slate-900 group-hover:text-indigo-600 text-lg transition-colors">
              {followingCount}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-indigo-600 transition-colors">
              Following
            </span>
          </button>
        </div>
      </div>

      {/* Posts Section */}
      <div className="space-y-4">
        {/* Section Header / Tab */}
        <div className="bg-white border border-slate-200/80 rounded-2xl px-6 pt-4 pb-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-indigo-600 border-b-2 border-indigo-600 pb-3 -mb-3 px-1 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Posts</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                {postsCount}
              </span>
            </span>
          </div>
        </div>

        {/* Posts Content */}
        {postsLoading ? (
          <div className="space-y-4">
            <PostSkeleton />
            <PostSkeleton />
          </div>
        ) : postsError ? (
          <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center shadow-xs">
            <AlertCircle className="w-9 h-9 text-rose-500 mx-auto mb-2" />
            <p className="text-sm text-slate-700 font-semibold">{postsError}</p>
            <button
              type="button"
              onClick={() => profile && fetchUserPosts(profile.id)}
              aria-label="Retry loading posts"
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : userPosts.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-10 sm:p-14 text-center shadow-xs">
            <div className="max-w-sm mx-auto space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
                <FileText className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No posts yet</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {isCurrentUser
                  ? "You haven't posted anything yet. Share your thoughts on Home!"
                  : `@${profile.username} hasn't posted anything yet.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {userPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUser?.id}
                isLiked={likedPostIds.has(post.id)}
                onToggleLike={handleToggleLike}
                onDelete={handleDeletePost}
              />
            ))}

            {/* Load More Button */}
            {postsHasMore && (
              <div className="pt-2 pb-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMorePosts}
                  disabled={postsLoadingMore}
                  aria-label="Load more posts"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-200/90 shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
                >
                  {postsLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Loading more posts...</span>
                    </>
                  ) : (
                    <span>Load more</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Followers / Following List Modal */}
      {modalMode && profile && (
        <UserListModal
          isOpen={Boolean(modalMode)}
          onClose={() => setModalMode(null)}
          title={modalMode === 'followers' ? 'Followers' : 'Following'}
          profileId={profile.id}
          mode={modalMode}
          currentUserId={currentUser?.id}
          onFollowChange={fetchProfileAndStats}
        />
      )}

      {/* Edit Profile Modal Dialog */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 id="edit-profile-title" className="text-lg font-bold text-slate-900">
                Edit Profile
              </h2>
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={isSaving}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4.5" noValidate>
              {editFormErrors.general && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{editFormErrors.general}</span>
                </div>
              )}

              {/* Username (Not editable) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  disabled
                  value={`@${profile.username}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm bg-slate-100/80 cursor-not-allowed select-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Usernames cannot be changed once created.
                </p>
              </div>

              {/* Display Name (max 50 chars) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="edit-display-name"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Display Name
                  </label>
                  <span
                    className={`text-[11px] font-medium ${
                      editDisplayName.length > 50 ? 'text-rose-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {editDisplayName.length}/50
                  </span>
                </div>
                <input
                  id="edit-display-name"
                  type="text"
                  required
                  maxLength={50}
                  value={editDisplayName}
                  onChange={(e) => {
                    setEditDisplayName(e.target.value);
                    if (editFormErrors.displayName) {
                      setEditFormErrors((prev) => ({ ...prev, displayName: '' }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-900 text-sm bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                    editFormErrors.displayName
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-200'
                  }`}
                  placeholder="Your Name"
                />
                {editFormErrors.displayName && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {editFormErrors.displayName}
                  </p>
                )}
              </div>

              {/* Bio (max 160 chars) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="edit-bio"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    Bio
                  </label>
                  <span
                    className={`text-[11px] font-medium ${
                      editBio.length > 160 ? 'text-rose-600 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {editBio.length}/160
                  </span>
                </div>
                <textarea
                  id="edit-bio"
                  rows={3}
                  maxLength={160}
                  value={editBio}
                  onChange={(e) => {
                    setEditBio(e.target.value);
                    if (editFormErrors.bio) {
                      setEditFormErrors((prev) => ({ ...prev, bio: '' }));
                    }
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-900 text-sm bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all resize-none ${
                    editFormErrors.bio
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-200'
                  }`}
                  placeholder="Tell Circle about yourself..."
                />
                {editFormErrors.bio && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{editFormErrors.bio}</p>
                )}
              </div>

              {/* Avatar URL (text URL field) */}
              <div>
                <label
                  htmlFor="edit-avatar-url"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Avatar URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                    {editAvatarUrl.trim() ? (
                      <img
                        src={editAvatarUrl.trim()}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <input
                    id="edit-avatar-url"
                    type="url"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Optional image URL for your profile picture.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSaving}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-xs disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
