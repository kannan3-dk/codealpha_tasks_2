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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Logo */}
        <div className="flex justify-center mb-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-red-600 text-white shadow-md shadow-red-200">
            <span className="font-extrabold text-2xl tracking-tighter">C</span>
            <span className="absolute w-2.5 h-2.5 rounded-full bg-red-200 -top-0.5 -right-0.5 ring-2 ring-white" />
          </div>
        </div>

        <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Join Circle
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Create an account to start sharing and connecting
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {formErrors.general && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{formErrors.general}</span>
            </div>
          )}

          {successInfo ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Account Created</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{successInfo}</p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex justify-center items-center w-full py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                  Proceed to Log In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4.5" noValidate>
              {/* Display Name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-900 text-sm placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                    formErrors.displayName
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-200'
                  }`}
                />
                {formErrors.displayName && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {formErrors.displayName}
                  </p>
                )}
              </div>

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Username
                </label>
                <div className="relative rounded-xl">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
                    @
                  </span>
                  <input
                    id="username"
                    type="text"
                    required
                    placeholder="alexmorgan"
                    value={username}
                    onChange={handleUsernameChange}
                    className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl border text-slate-900 text-sm placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                      formErrors.username
                        ? 'border-rose-300 focus:ring-rose-500'
                        : 'border-slate-200'
                    }`}
                  />
                </div>
                {formErrors.username ? (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {formErrors.username}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">
                    3-30 characters: lowercase letters, numbers, and underscores only
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
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
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-slate-900 text-sm placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                    formErrors.email
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-200'
                  }`}
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{formErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
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
                    className={`w-full px-3.5 pr-10 py-2.5 rounded-xl border text-slate-900 text-sm placeholder-slate-400 bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                      formErrors.password
                        ? 'border-rose-300 focus:ring-rose-500'
                        : 'border-slate-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formErrors.password ? (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    {formErrors.password}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">Minimum 6 characters</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
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

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline"
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
