import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Loader2, UserPlus, UserCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

interface UserListItem {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  profileId: string;
  mode: 'followers' | 'following';
  currentUserId?: string;
  onFollowChange?: () => void;
}

export const UserListModal: React.FC<UserListModalProps> = ({
  isOpen,
  onClose,
  title,
  profileId,
  mode,
  currentUserId,
  onFollowChange,
}) => {
  const { toast, error: toastError } = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Set of user IDs that current user is following
  const [myFollowingSet, setMyFollowingSet] = useState<Set<string>>(new Set());
  const [inFlightSet, setInFlightSet] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      if (mode === 'followers') {
        const { data, error } = await supabase
          .from('follows')
          .select('follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)')
          .eq('following_id', profileId);

        if (error) throw error;

        // Flatten joined follower objects
        const list: UserListItem[] = [];
        if (data) {
          data.forEach((row: any) => {
            if (row.follower) {
              list.push(row.follower as UserListItem);
            }
          });
        }
        setUsers(list);
      } else {
        const { data, error } = await supabase
          .from('follows')
          .select('following:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)')
          .eq('follower_id', profileId);

        if (error) throw error;

        // Flatten joined following objects
        const list: UserListItem[] = [];
        if (data) {
          data.forEach((row: any) => {
            if (row.following) {
              list.push(row.following as UserListItem);
            }
          });
        }
        setUsers(list);
      }

      // Also fetch which users the current user follows to properly show Follow / Unfollow buttons
      if (currentUserId) {
        const { data: myFollows, error: myFollowsErr } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId);

        if (!myFollowsErr && myFollows) {
          setMyFollowingSet(new Set(myFollows.map((f: any) => f.following_id)));
        }
      }
    } catch (err: unknown) {
      console.error('Error fetching user list:', err);
      setFetchError(getFriendlyErrorMessage(err, 'Failed to load list'));
    } finally {
      setLoading(false);
    }
  }, [profileId, mode, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen, fetchUsers]);

  // Handle follow/unfollow toggle inside modal
  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUserId || inFlightSet.has(targetUserId)) return;

    const isFollowing = myFollowingSet.has(targetUserId);

    // Optimistic UI update
    setMyFollowingSet((prev) => {
      const next = new Set(prev);
      if (isFollowing) {
        next.delete(targetUserId);
      } else {
        next.add(targetUserId);
      }
      return next;
    });

    setInFlightSet((prev) => new Set(prev).add(targetUserId));

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: targetUserId,
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
      }

      if (onFollowChange) {
        onFollowChange();
      }
    } catch (err: unknown) {
      console.error('Error toggling follow:', err);
      // Rollback
      setMyFollowingSet((prev) => {
        const next = new Set(prev);
        if (isFollowing) {
          next.add(targetUserId);
        } else {
          next.delete(targetUserId);
        }
        return next;
      });
      toastError(getFriendlyErrorMessage(err, 'Failed to update follow'));
    } finally {
      setInFlightSet((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const getInitials = (displayName?: string | null, uname?: string | null) => {
    const text = (displayName || uname || 'U').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-list-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 id="user-list-modal-title" className="text-base font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-2" />
              <p className="text-xs font-semibold">Loading {title.toLowerCase()}...</p>
            </div>
          ) : fetchError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-center">
              <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-1" />
              <p className="text-xs text-rose-800 font-semibold">{fetchError}</p>
              <button
                type="button"
                onClick={fetchUsers}
                aria-label="Retry loading users"
                className="mt-3 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm font-medium">
                {mode === 'followers'
                  ? 'No followers yet.'
                  : 'Not following anyone yet.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((targetUser) => {
                const isMe = currentUserId === targetUser.id;
                const isFollowing = myFollowingSet.has(targetUser.id);
                const isInFlight = inFlightSet.has(targetUser.id);
                const initials = getInitials(targetUser.display_name, targetUser.username);

                return (
                  <div
                    key={targetUser.id}
                    className="flex items-center justify-between py-3 gap-3 first:pt-0 last:pb-0"
                  >
                    <Link
                      to={`/u/${targetUser.username}`}
                      onClick={onClose}
                      className="flex items-center gap-3 min-w-0 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-slate-100 shadow-2xs group-hover:scale-105 transition-transform shrink-0 overflow-hidden">
                        {targetUser.avatar_url ? (
                          <img
                            src={targetUser.avatar_url}
                            alt={targetUser.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>

                      <div className="min-w-0 leading-tight">
                        <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 truncate transition-colors">
                          {targetUser.display_name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          @{targetUser.username}
                        </div>
                      </div>
                    </Link>

                    {/* Follow / Unfollow Button */}
                    {!isMe && currentUserId && (
                      <button
                        type="button"
                        onClick={() => handleToggleFollow(targetUser.id)}
                        disabled={isInFlight}
                        aria-label={isFollowing ? `Unfollow @${targetUser.username}` : `Follow @${targetUser.username}`}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer ${
                          isFollowing
                            ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        {isInFlight ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isFollowing ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
