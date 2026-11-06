import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, User, LogOut, Menu, X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

export const Navbar: React.FC = () => {
  const { profile, user, signOut } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const profileUsername = profile?.username || '';
  const profileUrl = profileUsername ? `/u/${profileUsername}` : '/';

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      success('Logged out successfully');
      navigate('/login');
    } catch (err: unknown) {
      error(getFriendlyErrorMessage(err, 'Failed to log out'));
    } finally {
      setIsLoggingOut(false);
      setMobileMenuOpen(false);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `h-11 px-4 rounded-full text-sm font-medium flex items-center gap-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] ${
      isActive
        ? 'bg-[#1c1c1f] text-[#f2f2f3]'
        : 'text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f]/60'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `h-11 px-4 rounded-full text-sm font-medium flex items-center gap-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] ${
      isActive
        ? 'bg-[#1c1c1f] text-[#f2f2f3]'
        : 'text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f]/60'
    }`;

  const getInitials = (displayName?: string | null, uname?: string | null) => {
    const text = (displayName || uname || user?.email || 'U').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(profile?.display_name, profile?.username);

  return (
    <header className="sticky top-0 z-40 h-16 bg-[#0b0b0c]/95 backdrop-blur-md border-b border-[#26262a] transition-colors">
      <div className="max-w-[1040px] mx-auto px-4 sm:px-8 h-full">
        <div className="flex items-center justify-between h-full gap-4">
          {/* Brand Logo & Left Nav */}
          <div className="flex items-center gap-6">
            <NavLink
              to="/"
              className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c]"
              aria-label="Circle Home"
            >
              {/* Ring logo mark: 20px circle, 4px white border */}
              <div className="w-5 h-5 rounded-full border-4 border-white shrink-0" />
              <span className="text-[18px] font-bold text-[#f2f2f3] tracking-tight">
                Circle
              </span>
            </NavLink>

            {/* Center-left Nav Links */}
            <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
              <NavLink to="/" end className={navLinkClass}>
                <Home className="w-4 h-4" strokeWidth={1.75} />
                <span>Home</span>
              </NavLink>

              <NavLink
                to={profile?.username ? `/u/${profile.username}` : '/'}
                className={navLinkClass}
              >
                <User className="w-4 h-4" strokeWidth={1.75} />
                <span>My Profile</span>
              </NavLink>
            </nav>
          </div>

          {/* Right Section: Search Input + Profile Chip + Secondary Log out button */}
          <div className="hidden md:flex items-center gap-3">
            {/* Search Input: 240px pill, hidden below 860px */}
            <div className="relative hidden min-[860px]:block">
              <input
                type="text"
                placeholder="Search Circle..."
                aria-label="Search"
                className="w-[240px] h-11 px-4 rounded-full bg-[#141416] border border-[#2a2a2e] text-sm text-[#f2f2f3] placeholder-[#8a8a92] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] transition-all"
              />
            </div>

            {/* User Profile Chip */}
            {profile && (
              <NavLink
                to={profileUrl}
                className="flex items-center gap-2.5 h-11 px-2.5 rounded-full hover:bg-[#1c1c1f] text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
                title="View your profile"
              >
                <div className="w-8 h-8 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 border border-[#3a3a40]">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || 'Avatar'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="hidden min-[960px]:block leading-tight pr-1">
                  <div className="text-xs font-semibold text-[#f2f2f3] truncate max-w-[100px]">
                    {profile.display_name}
                  </div>
                  <div className="text-[11px] text-[#a1a1a8] truncate max-w-[100px]">
                    @{profile.username}
                  </div>
                </div>
              </NavLink>
            )}

            {/* Secondary Log out button */}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="h-11 px-4 rounded-full border border-[#3a3a40] text-sm font-medium text-[#f2f2f3] hover:bg-[#1c1c1f] transition-colors duration-150 flex items-center gap-2 disabled:opacity-60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c]"
              title="Log out of Circle"
            >
              <LogOut className="w-4 h-4 text-[#a1a1a8]" strokeWidth={1.75} />
              <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex items-center gap-2 md:hidden">
            {profileUsername && (
              <NavLink
                to={profileUrl}
                className="w-9 h-9 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-xs flex items-center justify-center overflow-hidden border border-[#3a3a40]"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name || 'Avatar'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </NavLink>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-full text-[#a1a1a8] hover:text-[#f2f2f3] hover:bg-[#1c1c1f] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3]"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" strokeWidth={1.75} /> : <Menu className="w-5 h-5" strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#26262a] bg-[#141416] px-4 pt-3 pb-5 space-y-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          {profile && (
            <div className="flex items-center gap-3 p-3 bg-[#1c1c1f] rounded-xl mb-3 border border-[#26262a]">
              <div className="w-10 h-10 rounded-full bg-[#26262a] text-[#f2f2f3] font-bold text-sm flex items-center justify-center overflow-hidden border border-[#3a3a40]">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-[#f2f2f3] text-sm truncate">
                  {profile.display_name}
                </div>
                <div className="text-xs text-[#a1a1a8] truncate">@{profile.username}</div>
              </div>
            </div>
          )}

          <NavLink
            to="/"
            end
            onClick={() => setMobileMenuOpen(false)}
            className={mobileNavLinkClass}
          >
            <Home className="w-4 h-4 text-[#a1a1a8]" strokeWidth={1.75} />
            <span>Home</span>
          </NavLink>

          <NavLink
            to={profile?.username ? `/u/${profile.username}` : '/'}
            onClick={() => setMobileMenuOpen(false)}
            className={mobileNavLinkClass}
          >
            <User className="w-4 h-4 text-[#a1a1a8]" strokeWidth={1.75} />
            <span>My Profile</span>
          </NavLink>

          <div className="pt-2 border-t border-[#26262a]">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="w-full h-11 px-4 rounded-full border border-[#3a3a40] text-sm font-medium text-[#f2f2f3] hover:bg-[#1c1c1f] transition-colors flex items-center gap-3 disabled:opacity-60 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-[#a1a1a8]" strokeWidth={1.75} />
              <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
