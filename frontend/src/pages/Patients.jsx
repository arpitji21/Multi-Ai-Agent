import React, { useState, useEffect } from 'react';
import { UserPlus, Search, User } from 'lucide-react';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', age: '', gender: 'Other', contact: '' });

  const fetchPatients = async () => {
    try {
      const res = await fetch('http://localhost:8000/patients/');
      const data = await res.json();
      setPatients(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchPatients(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:8000/patients/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPatient)
      });
      setShowForm(false);
      fetchPatients();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Patient Records</h2>
          <p className="text-zinc-400">Total registered patients: {patients.length}</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          <UserPlus size={20} /> Add New Patient
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4">
          <div>
            <label className="field-label">Full Name</label>
            <input 
              placeholder="e.g. John Doe" 
              className="input" 
              value={newPatient.name} 
              onChange={e => setNewPatient({...newPatient, name: e.target.value})}
              required 
            />
          </div>
          <div>
            <label className="field-label">Age</label>
            <input 
              placeholder="e.g. 45" 
              type="number" 
              className="input" 
              value={newPatient.age} 
              onChange={e => setNewPatient({...newPatient, age: parseInt(e.target.value)})}
              required 
            />
          </div>
          <div>
            <label className="field-label">Gender</label>
            <select 
              className="input"
              value={newPatient.gender}
              onChange={e => setNewPatient({...newPatient, gender: e.target.value})}
            >
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="field-label">Contact Number</label>
            <input 
              placeholder="e.g. +1 234 567 890" 
              className="input" 
              value={newPatient.contact} 
              onChange={e => setNewPatient({...newPatient, contact: e.target.value})}
              required 
            />
          </div>
          <button type="submit" className="md:col-span-2 btn-primary mt-2 py-3">Confirm Registration</button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/5 border-b border-white/10 text-zinc-400">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Patient Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Age</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Gender</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {patients.map(p => (
                <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-800 rounded-lg text-zinc-400">
                        <User size={16} />
                      </div>
                      <span className="font-semibold text-zinc-200">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">{p.age}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${p.gender === 'Male' ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-pink-500/30 bg-pink-500/10 text-pink-400'}`}>
                      {p.gender}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">{p.contact}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-zinc-500 hover:text-white transition-colors text-sm font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
