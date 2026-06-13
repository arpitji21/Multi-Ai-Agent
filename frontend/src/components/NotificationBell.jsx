import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

export default function NotificationBell() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      setUnread(res.data.filter(n => !n.is_read).length);
    } catch {
      // not logged in yet
    }
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/read-all');
      setNotifications(n => n.map(x => ({ ...x, is_read: true })));
      setUnread(0);
    } catch {}
  }

  async function markRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
      setUnread(c => Math.max(0, c - 1));
    } catch {}
  }

  const typeColors = {
    appointment: 'bg-blue-500/10 border-blue-500/30',
    alert: 'bg-rose-500/10 border-rose-500/30',
    info: 'bg-white/5 border-white/10',
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="nav-pill relative border-white/10 hover:bg-white/10"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-zinc-400" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50 glass-card overflow-hidden shadow-glass-lg">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">No notifications</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`border-b border-white/5 px-4 py-3 transition cursor-pointer hover:bg-white/[0.04] ${!n.is_read ? 'bg-white/[0.03]' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />}
                    <div className={!n.is_read ? '' : 'pl-3.5'}>
                      <p className="text-sm font-medium text-zinc-200">{n.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {new Date(n.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
