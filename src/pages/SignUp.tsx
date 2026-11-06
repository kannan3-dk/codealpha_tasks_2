import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Validate fields according to user requirements
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Display Name
    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      errors.displayName = 'Display name is required.';
    } else if (trimmedDisplayName.length > 50) {
      errors.displayName = 'Display name must be under 50 characters.';
    }

    // Username validation: 3-30 characters, lowercase letters, numbers and underscore only
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      errors.username = 'Username is required.';
    } else if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      errors.username = 'Username must be between 3 and 30 characters.';
    } else if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      errors.username = 'Username can only contain lowercase letters, numbers, and underscores.';
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    // Password: minimum 6 characters
    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Automatically sanitize to lowercase without spaces
    const val = e.target.value.toLowerCase().replace(/\s+/g, '');
    setUsername(val);
    if (formErrors.username) {
      setFormErrors((prev) => ({ ...prev, username: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setFormErrors({});
    setSuccessInfo(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanDisplayName = displayName.trim();

    try {
      // 1. Pre-check if username is already taken in the profiles table
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (profileCheckError) {
        console.warn('Error checking username uniqueness:', profileCheckError.message);
      }

      if (existingProfile) {
        setFormErrors({
          username: `The username "@${cleanUsername}" is already taken. Please choose another.`,
        });
        setLoading(false);
        return;
      }

      // 2. Call supabase.auth.signUp with options: { data: { username, display_name } }
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: cleanDisplayName,
          },
        },
      });

      if (error) {
        const friendlyMsg = getFriendlyErrorMessage(error);
        const msg = error.message.toLowerCase();
        if (
          msg.includes('already registered') ||
          msg.includes('user already exists') ||
          msg.includes('email address is already') ||
          error.status === 422
        ) {
          setFormErrors({
            email: 'An account with this email address is already registered. Please log in instead.',
          });
          toastError('Email already registered');
        } else if (msg.includes('username') || msg.includes('profiles_username_key')) {
          setFormErrors({
            username: `The username "@${cleanUsername}" is already taken.`,
          });
          toastError('Username already taken');
        } else {
          setFormErrors({
            general: friendlyMsg,
          });
          toastError(friendlyMsg);
        }
        return;
      }

      // Check if session was returned or email confirmation is needed
      if (data.session) {
        success('Welcome to Circle! Your account is ready.');
        navigate('/');
      } else if (data.user) {
        // Confirmation email sent
        setSuccessInfo(
          `Account created for ${cleanEmail}! Please check your email to verify your account and then log in.`
        );
        success('Account created! Please check your email.');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      console.error('Unexpected sign-up error:', err);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setFormErrors({ general: message });
      toastError(message);
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
            <Link
              to="/login"
              className="px-4 py-1.5 rounded-full text-xs font-medium text-[#a1a1a8] hover:text-[#f2f2f3] transition-colors"
            >
              Log in
            </Link>
            <span className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[#1c1c1f] text-[#f2f2f3]">
              Sign up
            </span>
          </div>

          <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#f2f2f3] mb-2">
            Join Circle
          </h2>
          <p className="text-sm text-[#a1a1a8] mb-8">
            Create an account to start sharing and connecting
          </p>

          {formErrors.general && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-[#141416] border border-[#26262a] rounded-xl text-xs text-[#f2f2f3]">
              <AlertCircle className="w-4 h-4 text-[#f2f2f3] shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>{formErrors.general}</span>
            </div>
          )}

          {successInfo ? (
            <div className="text-center py-6 space-y-4 bg-[#141416] border border-[#26262a] rounded-2xl p-6">
              <div className="w-12 h-12 bg-[#1c1c1f] border border-[#26262a] text-[#f2f2f3] rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h3 className="text-lg font-bold text-[#f2f2f3]">Account Created</h3>
              <p className="text-sm text-[#a1a1a8] leading-relaxed">{successInfo}</p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex justify-center items-center w-full h-11 px-6 rounded-full text-sm font-semibold text-[#0b0b0c] bg-[#f2f2f3] hover:bg-[#d4d4d8] transition-colors"
                >
                  Proceed to Log In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Display Name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-[13px] font-medium text-[#a1a1a8] mb-2"
                >
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (formErrors.displayName) {
                      setFormErrors((prev) => ({ ...prev, displayName: '' }));
                    }
                  }}
                  className="w-full h-12 px-4 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] text-sm placeholder-[#8a8a92] bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all"
                />
                {formErrors.displayName && (
                  <p className="mt-1 text-xs text-[#f2f2f3] font-medium">
                    {formErrors.displayName}
                  </p>
                )}
              </div>

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-[13px] font-medium text-[#a1a1a8] mb-2"
                >
                  Username
                </label>
                <div className="relative rounded-xl">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8a8a92] font-semibold text-sm">
                    @
                  </span>
                  <input
                    id="username"
                    type="text"
                    required
                    placeholder="alexmorgan"
                    value={username}
                    onChange={handleUsernameChange}
                    className="w-full h-12 pl-9 pr-4 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] text-sm placeholder-[#8a8a92] bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all"
                  />
                </div>
                {formErrors.username ? (
                  <p className="mt-1 text-xs text-[#f2f2f3] font-medium">
                    {formErrors.username}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[#8a8a92]">
                    3-30 characters: lowercase letters, numbers, and underscores only
                  </p>
                )}
              </div>

              {/* Email */}
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
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) {
                      setFormErrors((prev) => ({ ...prev, email: '' }));
                    }
                  }}
                  className="w-full h-12 px-4 rounded-xl border border-[#2a2a2e] text-[#f2f2f3] text-sm placeholder-[#8a8a92] bg-[#0b0b0c] focus:outline-none focus:border-[#3a3a40] focus-visible:ring-2 focus-visible:ring-[#f2f2f3] transition-all"
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-[#f2f2f3] font-medium">{formErrors.email}</p>
                )}
              </div>

              {/* Password */}
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
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formErrors.password) {
                        setFormErrors((prev) => ({ ...prev, password: '' }));
                      }
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
                {formErrors.password ? (
                  <p className="mt-1 text-xs text-[#f2f2f3] font-medium">
                    {formErrors.password}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[#8a8a92]">Minimum 6 characters</p>
                )}
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
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-[#a1a1a8]">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-[#f2f2f3] hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
