import { Bell } from 'lucide-react';

export default function NotificationBell() {
  return (
    <button className="nav-pill border-white/10 hover:bg-white/10">
      <Bell size={20} className="text-zinc-400" />
    </button>
  );
}
