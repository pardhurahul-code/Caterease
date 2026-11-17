import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Shield, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

function roleRedirect(role: string) {
  if (role === 'ADMIN') return '/dashboard/admin';
  if (role === 'STAFF') return '/dashboard/staff';
  return '/dashboard/customer';
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { loginWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await loginWithEmail(email, password);
      toast.success(`Signed in as ${user.name}`);
      navigate(roleRedirect(user.role));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setSubmitting(true);
    try {
      const user = await loginWithEmail(demoEmail, demoPassword);
      toast.success(`Signed in as ${user.name} (${user.role})`);
      navigate(roleRedirect(user.role));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Demo login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      const user = await loginWithGoogle();
      toast.success(`Signed in with Google as ${user.name}`);
      navigate(roleRedirect(user.role));
    } catch (err: any) {
      toast.error(err?.message || 'Google sign-in failed or was cancelled.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
      <div className="md:col-span-7 p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">Sign In to CaterEase</h1>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
          Access your bookings, invoices, kitchen tasks, or admin operations console.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-amber-800 dark:text-amber-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
          <span>or</span>
          <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting}
          className="w-full py-2.5 px-4 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-sm font-semibold text-stone-800 dark:text-stone-100 transition-colors"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs text-stone-600 dark:text-stone-400">
          New to CaterEase?{' '}
          <Link to="/register" className="font-semibold text-amber-800 dark:text-amber-400 hover:underline">
            Create a Customer Account
          </Link>
        </p>
      </div>

      {/* Role Demo Accounts */}
      <div className="md:col-span-5 space-y-3">
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Quick Demo Role Sign-In</h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Authenticates against real bcrypt hashes in PostgreSQL.
          </p>

          <div className="mt-4 space-y-2.5">
            {[
              {
                role: 'Customer Portal',
                email: 'customer@caterease.com',
                pass: 'Customer@123',
                icon: UserCheck,
              },
              {
                role: 'Admin Console',
                email: 'admin@caterease.com',
                pass: 'Admin@123',
                icon: Shield,
              },
              {
                role: 'Staff Kitchen Portal',
                email: 'staff@caterease.com',
                pass: 'Staff@123',
                icon: Users,
              },
            ].map((demo) => {
              const Icon = demo.icon;
              return (
                <button
                  key={demo.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoLogin(demo.email, demo.pass)}
                  className="w-full p-3.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 hover:border-amber-600 text-left flex items-center justify-between gap-3 transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                      {demo.role}
                    </div>
                    <div className="font-mono text-[11px] text-stone-500 mt-1">
                      {demo.email} / {demo.pass}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-400 shrink-0">Sign In</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: 'Mumbai', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const { registerCustomer } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await registerCustomer(form);
      toast.success('Account created! Welcome to CaterEase.');
      navigate('/dashboard/customer');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <h1 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100">Create Account</h1>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
          Register as a CaterEase customer to manage bookings and earn loyalty points.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reg-name" className="block text-xs font-medium mb-1">Full Name</label>
            <input
              id="reg-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label htmlFor="reg-email" className="block text-xs font-medium mb-1">Email</label>
            <input
              id="reg-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-medium mb-1">Phone</label>
              <input
                id="reg-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label htmlFor="reg-city" className="block text-xs font-medium mb-1">City</label>
              <input
                id="reg-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-xs font-medium mb-1">Password (min 6 chars)</label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Creating Account...' : 'Create Customer Account'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-stone-600 dark:text-stone-400">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-amber-800 dark:text-amber-400 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [demoToken, setDemoToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      toast.success(res.data.message);
      if (res.data.demoResetToken) {
        setDemoToken(res.data.demoResetToken);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <KeyRound className="w-6 h-6 text-amber-700 mb-3" />
        <h1 className="font-display text-2xl font-bold">Reset Your Password</h1>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
          Enter your registered email to receive a reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-xs font-medium mb-1">Email address</label>
            <input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-amber-700 text-white text-sm font-semibold"
          >
            {submitting ? 'Generating...' : 'Send Reset Link'}
          </button>
        </form>

        {demoToken && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
            <p className="font-semibold text-amber-900 dark:text-amber-300">Demo Reset Token Generated (SMTP unconfigured)</p>
            <Link
              to={`/reset-password?token=${demoToken}`}
              className="inline-block font-semibold text-amber-800 dark:text-amber-400 underline"
            >
              Proceed to Reset Password →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword });
      toast.success(res.data.message);
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <h1 className="font-display text-2xl font-bold">Choose New Password</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Reset Token</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-amber-700 text-white text-sm font-semibold"
          >
            {submitting ? 'Updating...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
