// Reusable loading UI: a full-screen branded preloader and a small inline spinner.

import LarkWordmark from './LarkWordmark';

export function Spinner({ className = 'h-5 w-5', tone = 'brand' }) {
  const ring =
    tone === 'white'
      ? 'border-white/40 border-t-white'
      : 'border-white/15 border-t-brand-500';
  return <span className={`inline-block animate-spin-slow rounded-full border-2 ${ring} ${className}`} />;
}

export function PageLoading({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm font-medium text-zinc-400">
      <Spinner />
      {label}
    </div>
  );
}

export function Preloader() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-app-gradient">
      <div className="flex flex-col items-center gap-6 text-white">
        <span className="animate-float">
          <LarkWordmark className="h-10 w-auto text-zinc-100" />
        </span>
        <div className="text-center">
          <p className="text-sm text-zinc-400">Field Sales, Demands &amp; Expenses</p>
        </div>
        <div className="mt-1 flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" />
        </div>
      </div>
    </div>
  );
}

export default Preloader;
