/**
 * Centralized error handler for Supabase errors and user feedback.
 * Standardizes messaging, including Row-Level Security (RLS) enforcement errors.
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallbackMessage: string = 'An unexpected error occurred. Please try again.'
): string {
  if (!error) return fallbackMessage;

  let message = '';
  let code = '';

  if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === 'string') {
      message = errObj.message;
    }
    if (typeof errObj.code === 'string') {
      code = errObj.code;
    }
  }

  const lower = message.toLowerCase();

  // 1. Row-Level Security (RLS) violation
  if (
    lower.includes('row-level security') ||
    lower.includes('violates row-level security') ||
    lower.includes('row level security') ||
    lower.includes('rls') ||
    code === '42501'
  ) {
    return 'You do not have permission to do that.';
  }

  // 2. Authentication errors
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Please check your inbox for the verification link.';
  }

  if (
    lower.includes('user already registered') ||
    lower.includes('already registered') ||
    lower.includes('email address is already in use')
  ) {
    return 'An account with this email is already registered. Please log in instead.';
  }

  // 3. Network or connection issues
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('connection refused')
  ) {
    return 'Unable to reach the server. Please check your internet connection.';
  }

  // 4. Duplicate key errors
  if (lower.includes('duplicate key') || code === '23505') {
    return 'This entry already exists.';
  }

  return message || fallbackMessage;
}
