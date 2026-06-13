import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, ChevronRight } from 'lucide-react';

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newAppt, setNewAppt] = useState({ patient_id: '', date_time: '', status: 'Scheduled' });

  const fetchData = async () => {
    try {
      const [aRes, pRes] = await Promise.all([
        fetch('http://localhost:8000/appointments/'),
        fetch('http://localhost:8000/patients/')
      ]);
      setAppointments(await aRes.json());
      setPatients(await pRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:8000/appointments/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAppt)
      });
      setShowForm(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Appointments</h2>
          <p className="text-zinc-400">Manage patient visits and scheduling.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          <CalendarIcon size={20} /> Schedule Appointment
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4">
          <div>
            <label className="field-label">Select Patient</label>
            <select 
              className="input"
              value={newAppt.patient_id}
              onChange={e => setNewAppt({...newAppt, patient_id: parseInt(e.target.value)})}
              required
            >
              <option value="">Choose a patient...</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Date & Time</label>
            <input 
              type="datetime-local" 
              className="input" 
              value={newAppt.date_time} 
              onChange={e => setNewAppt({...newAppt, date_time: e.target.value})}
              required 
            />
          </div>
          <button type="submit" className="md:col-span-2 btn-primary mt-2">Book Appointment</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appointments.length === 0 ? (
          <div className="col-span-full glass-soft py-20 text-center">
             <CalendarIcon className="mx-auto text-zinc-600 mb-4" size={48} />
             <p className="text-zinc-500 font-medium">No appointments scheduled.</p>
          </div>
        ) : (
          appointments.map(a => (
            <div key={a.id} className="glass-card p-6 hover:border-brand-500/30 transition-all group cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand-500/10 text-brand-500 rounded-xl group-hover:bg-brand-500 group-hover:text-white transition-all">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-100">Patient ID: {a.patient_id}</p>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                      <Clock size={12} />
                      {new Date(a.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-zinc-600 group-hover:text-white transition-colors" />
              </div>
              
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <CalendarIcon size={14} />
                  {new Date(a.date_time).toLocaleDateString()}
                </div>
                <span className="badge border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  {a.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
