import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import useAuthStore from '../store/authStore';
import LarkWordmark from '../components/LarkWordmark';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@mediai.com', password: 'admin123', color: 'text-amber-400' },
  { label: 'Doctor', email: 'doctor@mediai.com', password: 'doctor123', color: 'text-blue-400' },
  { label: 'Patient', email: 'patient@mediai.com', password: 'patient123', color: 'text-emerald-400' },
];

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    phone: '',
  });

  const handleChange = (e) => {
    clearError();
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let result;
    if (mode === 'login') {
      result = await login(form.email, form.password);
    } else {
      result = await register(form);
    }
    if (result.success) {
      redirectByRole(result.role);
    }
  };

  const redirectByRole = (role) => {
    if (role === 'admin') navigate('/admin');
    else if (role === 'doctor') navigate('/doctor');
    else navigate('/dashboard');
  };

  const fillDemo = (account) => {
    clearError();
    setForm((f) => ({ ...f, email: account.email, password: account.password }));
    setMode('login');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Glow orb */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-glass">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">MediAI Hospital Suite</h1>
            <p className="mt-1 text-sm text-zinc-400">AI-Powered Healthcare Management</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {/* Mode tabs */}
          <div className="mb-6 flex rounded-xl border border-white/10 bg-white/5 p-1">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); clearError(); }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
                  mode === m ? 'bg-white/20 text-white shadow-inner' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="field-label">Full Name</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="input"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    className="input"
                    placeholder="+1-555-0100"
                  />
                </div>
                <div>
                  <label className="field-label">Role</label>
                  <select name="role" value={form.role} onChange={handleChange} className="input">
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="field-label">Email Address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="input pl-9"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="field-label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  className="input pl-9 pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {/* Demo accounts */}
          {mode === 'login' && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="mb-3 text-center text-xs font-medium text-zinc-500">Quick demo access</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.label}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 transition hover:bg-white/10 hover:border-white/20"
                  >
                    <span className={`text-xs font-semibold ${acc.color}`}>{acc.label}</span>
                    <span className="text-[10px] text-zinc-500">{acc.email.split('@')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          MediAI Hospital Suite · HIPAA-Inspired Security
        </p>
      </div>
    </div>
  );
}
