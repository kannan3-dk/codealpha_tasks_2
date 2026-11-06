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

  // Handle Escape key to close edit modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditing) {
        setIsEditing(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing]);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-8 space-y-6">
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
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-8 sm:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7" strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold text-[#f2f2f3]">Unable to load profile</h2>
          <p className="mt-2 text-sm text-[#a1a1a8]">{fetchError}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={fetchProfileAndStats}
              aria-label="Retry loading profile"
              className="h-11 px-5 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-sm rounded-full transition-colors cursor-pointer"
            >
              Try Again
            </button>
            <Link
              to="/"
              aria-label="Return to Home feed"
              className="h-11 px-5 border border-[#3a3a40] text-[#f2f2f3] hover:bg-[#1c1c1f] font-medium text-sm rounded-full transition-colors flex items-center justify-center"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // User not found state
  if (notFound || !profile) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-8 sm:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" strokeWidth={1.75} />
          </div>
          <h2 className="text-2xl font-bold text-[#f2f2f3] tracking-tight">User not found</h2>
          <p className="mt-2 text-sm text-[#a1a1a8] leading-relaxed">
            The user <span className="font-semibold text-[#f2f2f3]">@{username}</span> does not exist or may have been removed.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              aria-label="Return to Home feed"
              className="inline-flex items-center gap-2 h-11 px-6 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-sm rounded-full transition-colors"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              <span>Return to Home</span>
            </Link>
          </div>
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
    <div className="max-w-[720px] mx-auto px-4 py-8 space-y-6">
      {/* Profile Header Card */}
      <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 flex-1 min-w-0">
            {/* 88px Avatar */}
            <div className="relative shrink-0">
              <div className="w-[88px] h-[88px] rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-2xl flex items-center justify-center border-2 border-[#3a3a40] overflow-hidden">
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
                {/* 28px Page title name */}
                <h1 className="text-[28px] font-bold text-[#f2f2f3] tracking-[-0.02em] leading-tight truncate">
                  {profile.display_name}
                </h1>
                {isCurrentUser && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1c1c1f] text-[#f2f2f3] border border-[#26262a]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#f2f2f3]" strokeWidth={1.75} />
                    <span>You</span>
                  </span>
                )}
              </div>

              {/* Muted '@username · Joined date' on one line */}
              <div className="flex items-center gap-2 text-sm text-[#a1a1a8] mt-1">
                <span>@{profile.username}</span>
                {formattedJoinedDate && (
                  <>
                    <span className="text-[#3a3a40] select-none">·</span>
                    <span>Joined {formattedJoinedDate}</span>
                  </>
                )}
              </div>

              {/* Bio */}
              {profile.bio ? (
                <p className="mt-3 text-sm text-[#f2f2f3] leading-relaxed max-w-2xl whitespace-pre-line break-words">
                  {profile.bio}
                </p>
              ) : isCurrentUser ? (
                <p className="mt-2 text-xs text-[#8a8a92] italic">
                  No bio yet. Click &quot;Edit profile&quot; to add one.
                </p>
              ) : null}
            </div>
          </div>

          {/* Action Button: Edit profile (own) or Follow / Unfollow (others) */}
          <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
            {isCurrentUser ? (
              <button
                type="button"
                onClick={handleOpenEdit}
                aria-label="Edit your profile"
                className="w-full sm:w-auto h-11 px-5 inline-flex items-center justify-center gap-2 bg-transparent hover:bg-[#1c1c1f] text-[#f2f2f3] font-medium text-sm rounded-full border border-[#3a3a40] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
              >
                <Edit3 className="w-4 h-4 text-[#a1a1a8]" strokeWidth={1.75} />
                <span>Edit profile</span>
              </button>
            ) : currentUser ? (
              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={isFollowInFlight}
                aria-label={isFollowing ? `Unfollow @${profile.username}` : `Follow @${profile.username}`}
                className={`w-full sm:w-auto h-11 px-5 inline-flex items-center justify-center gap-2 font-semibold text-sm rounded-full transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] ${
                  isFollowing
                    ? 'bg-transparent hover:bg-[#1c1c1f] text-[#f2f2f3] border border-[#3a3a40]'
                    : 'bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c]'
                }`}
              >
                {isFollowInFlight ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4" strokeWidth={1.75} />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" strokeWidth={1.75} />
                    <span>Follow</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* Stats row (Posts, Followers, Following) as buttons with 20px bold number over 13px muted label */}
        <div className="mt-6 pt-5 border-t border-[#26262a] flex items-center gap-8 sm:gap-10">
          <div className="flex flex-col items-start">
            <span className="text-[20px] font-bold text-[#f2f2f3] leading-none">{postsCount}</span>
            <span className="text-[13px] text-[#a1a1a8] font-normal mt-1">
              {postsCount === 1 ? 'Post' : 'Posts'}
            </span>
          </div>

          {/* Clickable Followers button */}
          <button
            type="button"
            onClick={() => setModalMode('followers')}
            className="flex flex-col items-start hover:opacity-80 transition-opacity cursor-pointer group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] rounded-lg p-0.5"
            title="View followers"
            aria-label={`View ${followersCount} followers`}
          >
            <span className="text-[20px] font-bold text-[#f2f2f3] leading-none">
              {followersCount}
            </span>
            <span className="text-[13px] text-[#a1a1a8] font-normal mt-1">
              {followersCount === 1 ? 'Follower' : 'Followers'}
            </span>
          </button>

          {/* Clickable Following button */}
          <button
            type="button"
            onClick={() => setModalMode('following')}
            className="flex flex-col items-start hover:opacity-80 transition-opacity cursor-pointer group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] rounded-lg p-0.5"
            title="View following"
            aria-label={`View ${followingCount} following`}
          >
            <span className="text-[20px] font-bold text-[#f2f2f3] leading-none">
              {followingCount}
            </span>
            <span className="text-[13px] text-[#a1a1a8] font-normal mt-1">
              Following
            </span>
          </button>
        </div>
      </div>

      {/* Posts Section */}
      <div className="space-y-4">
        {/* Section Header: 'Posts' heading 18px */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[18px] font-semibold text-[#f2f2f3] tracking-tight">
            Posts
          </h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#1c1c1f] text-[#a1a1a8] border border-[#26262a]">
            {postsCount}
          </span>
        </div>

        {/* Posts Content */}
        {postsLoading ? (
          <div className="space-y-4">
            <PostSkeleton />
            <PostSkeleton />
          </div>
        ) : postsError ? (
          <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-8 text-center">
            <AlertCircle className="w-9 h-9 text-[#f2f2f3] mx-auto mb-2" strokeWidth={1.75} />
            <p className="text-sm text-[#a1a1a8] font-semibold">{postsError}</p>
            <button
              type="button"
              onClick={() => profile && fetchUserPosts(profile.id)}
              aria-label="Retry loading posts"
              className="mt-3 h-11 px-5 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] rounded-full text-xs font-semibold transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : userPosts.length === 0 ? (
          <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-10 sm:p-14 text-center">
            <div className="max-w-sm mx-auto space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] flex items-center justify-center mx-auto">
                <FileText className="w-7 h-7" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-bold text-[#f2f2f3]">No posts yet</h3>
              <p className="text-sm text-[#a1a1a8] leading-relaxed">
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

            {/* Load More Button: centered secondary button */}
            {postsHasMore && (
              <div className="pt-2 pb-4 text-center flex justify-center">
                <button
                  type="button"
                  onClick={handleLoadMorePosts}
                  disabled={postsLoadingMore}
                  aria-label="Load more posts"
                  className="h-11 px-6 rounded-full border border-[#3a3a40] text-[#f2f2f3] font-medium text-sm hover:bg-[#1c1c1f] transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
                >
                  {postsLoadingMore ? (
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

      {/* Edit Profile Modal Dialog: surface card, 16px radius, dimmed #000 at 70% overlay, Esc closes */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={handleCloseEdit}
        >
          <div
            className="bg-[#141416] w-full max-w-lg rounded-2xl shadow-2xl border border-[#26262a] overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#26262a]">
              <h2 id="edit-profile-title" className="text-lg font-bold text-[#f2f2f3]">
                Edit Profile
              </h2>
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={isSaving}
                className="text-[#a1a1a8] hover:text-[#f2f2f3] p-1.5 rounded-full hover:bg-[#1c1c1f] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-4" noValidate>
              {editFormErrors.general && (
                <div className="flex items-start gap-2.5 p-3.5 bg-[#1c1c1f] border border-[#26262a] rounded-xl text-xs text-[#f2f2f3]">
                  <AlertCircle className="w-4 h-4 text-[#f2f2f3] shrink-0 mt-0.5" strokeWidth={1.75} />
                  <span>{editFormErrors.general}</span>
                </div>
              )}

              {/* Username (Not editable) */}
              <div>
                <label className="block text-[13px] font-medium text-[#a1a1a8] mb-2">
                  Username
                </label>
                <input
                  type="text"
                  disabled
                  value={`@${profile.username}`}
                  className="w-full h-12 px-4 rounded-xl border border-[#2a2a2e] text-[#a1a1a8] text-sm bg-[#0b0b0c]/60 cursor-not-allowed select-none"
                />
                <p className="mt-1.5 text-[11px] text-[#8a8a92]">
                  Usernames cannot be changed once created.
                </p>
              </div>

              {/* Display Name (max 50 chars) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="edit-display-name"
                    className="block text-[13px] font-medium text-[#a1a1a8]"
                  >
                    Display Name
                  </label>
                  <span
                    className={`text-[11px] font-medium ${
                      editDisplayName.length > 50 ? 'text-[#f2f2f3] font-bold underline' : 'text-[#8a8a92]'
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
                  className="w-full h-12 px-4 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] placeholder-[#8a8a92] text-sm bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all"
                  placeholder="Your Name"
                />
                {editFormErrors.displayName && (
                  <p className="mt-1 text-xs text-[#f2f2f3] font-medium">
                    {editFormErrors.displayName}
                  </p>
                )}
              </div>

              {/* Bio (max 160 chars) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="edit-bio"
                    className="block text-[13px] font-medium text-[#a1a1a8]"
                  >
                    Bio
                  </label>
                  <span
                    className={`text-[11px] font-medium ${
                      editBio.length > 160 ? 'text-[#f2f2f3] font-bold underline' : 'text-[#8a8a92]'
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
                  className="w-full p-3.5 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] placeholder-[#8a8a92] text-sm bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all resize-none"
                  placeholder="Tell Circle about yourself..."
                />
                {editFormErrors.bio && (
                  <p className="mt-1 text-xs text-[#f2f2f3] font-medium">{editFormErrors.bio}</p>
                )}
              </div>

              {/* Avatar URL (text URL field) */}
              <div>
                <label
                  htmlFor="edit-avatar-url"
                  className="block text-[13px] font-medium text-[#a1a1a8] mb-2"
                >
                  Avatar URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#26262a] border border-[#3a3a40] overflow-hidden flex items-center justify-center text-[#a1a1a8] shrink-0">
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
                      <ImageIcon className="w-5 h-5 text-[#a1a1a8]" strokeWidth={1.75} />
                    )}
                  </div>
                  <input
                    id="edit-avatar-url"
                    type="url"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="flex-1 h-12 px-4 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] placeholder-[#8a8a92] text-sm bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[#8a8a92]">
                  Optional image URL for your profile picture.
                </p>
              </div>

              {/* Action Buttons: Cancel (secondary), Save Changes (primary) */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#26262a]">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={isSaving}
                  className="h-11 px-5 text-sm font-medium text-[#f2f2f3] hover:bg-[#1c1c1f] rounded-full border border-[#3a3a40] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-11 px-6 inline-flex items-center gap-2 bg-[#f2f2f3] hover:bg-[#d4d4d8] text-[#0b0b0c] font-semibold text-sm rounded-full transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
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
