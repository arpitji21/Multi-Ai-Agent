import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import LarkWordmark from './LarkWordmark';
import NotificationBell from './NotificationBell';

function AppShell({ roleLabel, navItems, user, children }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    localStorage.removeItem('accessToken');
    navigate('/');
    window.location.reload();
  }

  const linkClass = ({ isActive }) => `nav-pill ${isActive ? 'nav-pill-active' : ''}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 shadow-glass backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <LarkWordmark className="h-6 w-auto text-zinc-100" />
            <span className="hidden h-6 w-px bg-white/15 sm:block" />
            <p className="hidden text-xs font-medium text-zinc-400 sm:block">{roleLabel}</p>
          </div>

          <div className="flex items-center gap-2">
          <NotificationBell />

          {/* Full nav on large screens — single line, no wrap, no scroll */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            <span className="mx-1 h-6 w-px bg-white/25" />
            {user?.email ? (
              <span className="hidden rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 xl:inline">
                {user.email}
              </span>
            ) : null}
            <button type="button" onClick={handleLogout} className="nav-pill border-white/30 hover:bg-white/20">
              Sign out
            </button>
          </nav>

          {/* Compact menu button on smaller screens */}
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
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
        {menuOpen ? (
          <div className="border-t border-white/10 bg-black/70 px-4 py-3 backdrop-blur-xl lg:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `nav-pill w-full justify-start ${isActive ? 'nav-pill-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
              {user?.email ? <p className="px-3 pt-2 text-xs text-zinc-400">{user.email}</p> : null}
              <button
                type="button"
                onClick={handleLogout}
                className="nav-pill mt-1 w-full justify-start border-white/30 hover:bg-white/20"
              >
                Sign out
              </button>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-6xl animate-fade-in px-4 py-8">{children}</main>
    </div>
  );
}

export default AppShell;
