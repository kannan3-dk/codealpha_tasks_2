import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

export const LogIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: toastError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fromLocation = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const friendlyMsg = getFriendlyErrorMessage(error);
        setErrorMessage(friendlyMsg);
        toastError(friendlyMsg);
        return;
      }

      if (data.user) {
        success('Welcome back!');
        navigate(fromLocation, { replace: true });
      }
    } catch (err: unknown) {
      console.error('Unexpected login error:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorMessage(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0c] text-[#f2f2f3] grid grid-cols-1 min-[860px]:grid-cols-2">
      {/* Left panel: #101012, right border #26262a, hidden below 860px */}
      <div className="hidden min-[860px]:flex flex-col justify-between p-12 lg:p-16 bg-[#101012] border-r border-[#26262a]">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full border-4 border-white shrink-0" />
          <span className="text-[18px] font-bold text-[#f2f2f3] tracking-tight">Circle</span>
        </div>

        <div className="my-auto py-12 max-w-[440px]">
          <h1 className="text-[48px] font-bold text-[#f2f2f3] leading-[1.1] tracking-[-0.02em] max-w-[14ch]">
            Conversations worth coming back to.
          </h1>
          <p className="text-[17px] text-[#a1a1a8] mt-4 leading-relaxed">
            The minimalist social network for people who value signal over noise.
          </p>
        </div>

        <div className="text-[13px] text-[#8a8a92]">
          Circle
        </div>
      </div>

      {/* Right panel: centered 400px column */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 min-h-screen bg-[#0b0b0c]">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand header (hidden >= 860px) */}
          <div className="min-[860px]:hidden flex items-center gap-2.5 mb-8">
            <div className="w-5 h-5 rounded-full border-4 border-white shrink-0" />
            <span className="text-[18px] font-bold text-[#f2f2f3] tracking-tight">Circle</span>
          </div>

          {/* Log in / Sign up pill toggle */}
          <div className="inline-flex p-1 rounded-full bg-[#141416] border border-[#26262a] mb-8">
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#1c1c1f] text-[#f2f2f3]">
              Log in
            </span>
            <Link
              to="/signup"
              className="px-4 py-1.5 rounded-full text-xs font-medium text-[#a1a1a8] hover:text-[#f2f2f3] transition-colors"
            >
              Sign up
            </Link>
          </div>

          <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#f2f2f3] mb-2">
            Welcome back
          </h2>
          <p className="text-sm text-[#a1a1a8] mb-8">
            Sign in to your Circle account
          </p>

          {errorMessage && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-[#141416] border border-[#26262a] rounded-xl text-xs text-[#f2f2f3]">
              <AlertCircle className="w-4 h-4 text-[#f2f2f3] shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-[13px] font-medium text-[#a1a1a8] mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full h-12 px-4 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] text-sm placeholder-[#8a8a92] bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[13px] font-medium text-[#a1a1a8] mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full h-12 px-4 pr-11 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] text-sm placeholder-[#8a8a92] bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#8a8a92] hover:text-[#f2f2f3]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 flex justify-center items-center gap-2 rounded-full text-sm font-semibold text-[#0b0b0c] bg-[#f2f2f3] hover:bg-[#d4d4d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#a1a1a8]">
              Don&apos;t have an account yet?{' '}
              <Link
                to="/signup"
                className="font-medium text-[#f2f2f3] hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
