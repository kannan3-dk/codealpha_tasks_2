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
    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-bold'
        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <NavLink
            to="/"
            className="flex items-center gap-2.5 group focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-lg"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-red-600 text-white shadow-sm shadow-red-200 group-hover:scale-105 transition-transform duration-200">
              {/* Sleek circle ring glyph */}
              <span className="font-extrabold text-xl tracking-tighter">C</span>
              <span className="absolute w-2 h-2 rounded-full bg-red-200 -top-0.5 -right-0.5 ring-2 ring-white animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight text-slate-900 leading-none">
                Circle
              </span>
              <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">
                Social
              </span>
            </div>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2" aria-label="Main Navigation">
            <NavLink to="/" end className={navLinkClass}>
              <Home className="w-4 h-4" />
              <span>Home</span>
            </NavLink>

            <NavLink
              to={profile?.username ? `/u/${profile.username}` : '/'}
              className={navLinkClass}
            >
              <User className="w-4 h-4" />
              <span>My Profile</span>
            </NavLink>

            <div className="h-5 w-px bg-slate-200 mx-1.5" />

            {/* User Chip & Log Out */}
            <div className="flex items-center gap-2 pl-1">
              <NavLink
                to={profileUrl}
                className="flex items-center gap-2.5 py-1 px-2.5 rounded-xl hover:bg-slate-100 text-left transition-colors"
                title="View your profile"
              >
                <div className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-xs">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || 'Avatar'}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    (profile?.display_name?.[0] || profile?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()
                  )}
                </div>
                <div className="hidden lg:block leading-tight">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[110px]">
                    {profile?.display_name || 'My Account'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[110px]">
                    @{profile?.username || 'user'}
                  </div>
                </div>
              </NavLink>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-60"
                title="Log out of Circle"
              >
                <LogOut className="w-4 h-4" />
                <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </button>
            </div>
          </nav>

          {/* Mobile Menu Toggle Button */}
          <div className="flex items-center gap-2 md:hidden">
            {profileUsername && (
              <NavLink
                to={profileUrl}
                className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-xs"
              >
                {(profile?.display_name?.[0] || profile?.username?.[0] || 'U').toUpperCase()}
              </NavLink>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 shadow-lg animate-in fade-in slide-in-from-top-2">
          {profile && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-3">
              <div className="w-10 h-10 rounded-full bg-red-600 text-white font-bold text-sm flex items-center justify-center ring-2 ring-white">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (profile.display_name?.[0] || profile.username?.[0] || 'U').toUpperCase()
                )}
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-slate-900 text-sm truncate">
                  {profile.display_name}
                </div>
                <div className="text-xs text-slate-500 truncate">@{profile.username}</div>
              </div>
            </div>
          )}

          <NavLink
            to="/"
            end
            onClick={() => setMobileMenuOpen(false)}
            className={mobileNavLinkClass}
          >
            <Home className="w-5 h-5 text-indigo-600" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to={profile?.username ? `/u/${profile.username}` : '/'}
            onClick={() => setMobileMenuOpen(false)}
            className={mobileNavLinkClass}
          >
            <User className="w-5 h-5 text-indigo-600" />
            <span>My Profile</span>
          </NavLink>

          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60"
            >
              <LogOut className="w-5 h-5" />
              <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
