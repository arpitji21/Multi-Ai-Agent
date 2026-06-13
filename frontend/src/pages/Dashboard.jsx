import React, { useState, useEffect } from 'react';
import { Users, Calendar, Activity, CheckCircle } from 'lucide-react';

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="glass-card p-6 flex items-center">
      <div className={`p-4 rounded-xl ${color} mr-4 text-white shadow-lg`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-zinc-400 font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-white">{value}</h3>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ patients: 0, appointments: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          fetch('http://localhost:8000/patients/'),
          fetch('http://localhost:8000/appointments/')
        ]);
        const pData = await pRes.json();
        const aData = await aRes.json();
        setStats({
          patients: pData.length,
          appointments: aData.length
        });
      } catch (e) {
        console.error("Failed to fetch stats", e);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">System Overview</h2>
        <p className="text-zinc-400">Welcome back to the Medical Staff Portal.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Patients" value={stats.patients} icon={Users} color="bg-blue-600" />
        <StatCard title="Appointments" value={stats.appointments} icon={Calendar} color="bg-brand-500" />
        <StatCard title="Pending Review" value="5" icon={Activity} color="bg-amber-500" />
        <StatCard title="Completed" value="12" icon={CheckCircle} color="bg-emerald-600" />
      </div>

      <div className="glass-card p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="text-brand-500" /> Recent Activity
        </h3>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-zinc-300">System is up and running. 5 new reports pending analysis.</p>
          <div className="mt-4 flex gap-2">
            <span className="badge border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Database Online</span>
            <span className="badge border-blue-500/30 bg-blue-500/10 text-blue-400">AI Service Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
