import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import LarkWordmark from './LarkWordmark';
import NotificationBell from './NotificationBell';
import useAuthStore from '../store/authStore';

function AppShell({ roleLabel, navItems, children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const linkClass = ({ isActive }) => `nav-pill ${isActive ? 'nav-pill-active' : ''}`;

  const roleColors = {
    admin: 'text-amber-400',
    doctor: 'text-blue-400',
    patient: 'text-emerald-400',
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 shadow-glass backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-gradient">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <LarkWordmark className="h-5 w-auto text-zinc-100" />
            </div>
            <span className="hidden h-6 w-px bg-white/15 sm:block" />
            <p className="hidden text-xs font-medium text-zinc-400 sm:block">{roleLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* Full nav on large screens */}
            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end ?? item.to === '/'} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
              <span className="mx-1 h-6 w-px bg-white/25" />
              {user?.name && (
                <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-medium xl:inline">
                  <span className={roleColors[user?.role] || 'text-zinc-300'}>{user.name}</span>
                </span>
              )}
              <button type="button" onClick={handleLogout} className="nav-pill border-white/30 hover:bg-white/20">
                Sign out
              </button>
            </nav>

            {/* Compact menu button on smaller screens */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="nav-pill border-white/20 lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Dropdown menu (smaller screens) */}
        {menuOpen && (
          <div className="border-t border-white/10 bg-black/70 px-4 py-3 backdrop-blur-xl lg:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `nav-pill w-full justify-start ${isActive ? 'nav-pill-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
              {user?.name && <p className="px-3 pt-2 text-xs text-zinc-400">{user.name}</p>}
              <button
                type="button"
                onClick={handleLogout}
                className="nav-pill mt-1 w-full justify-start border-white/30 hover:bg-white/20"
              >
                Sign out
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl animate-fade-in px-4 py-8">{children}</main>
    </div>
  );
}

export default AppShell;
