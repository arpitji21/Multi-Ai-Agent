import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, User, Mail, Phone, Calendar, MapPin, AlertCircle } from 'lucide-react';
import api from '../lib/api';

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [newPatient, setNewPatient] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    date_of_birth: '',
    gender: 'Other',
    blood_group: '',
    address: '',
    emergency_contact: '',
    allergies: ''
  });

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/patients');
      setPatients(res.data);
    } catch (e) {
      setError('Failed to load patients. Please check your connection.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPatients(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/patients', newPatient);
      setShowForm(false);
      setNewPatient({
        name: '', email: '', password: '', phone: '',
        date_of_birth: '', gender: 'Other', blood_group: '',
        address: '', emergency_contact: '', allergies: ''
      });
      fetchPatients();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to register patient.');
      console.error(e);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    return Math.floor((Date.now() - new Date(dob)) / 31557600000);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Patient Records</h2>
          <p className="text-zinc-400">Manage and register hospital patients</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="btn-primary w-full sm:w-auto"
        >
          {showForm ? 'Cancel Registration' : <><UserPlus size={18} className="mr-2" /> Add New Patient</>}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 grid grid-cols-1 md:grid-cols-3 gap-5 animate-in slide-in-from-top-4">
          <div className="md:col-span-3">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <User size={18} className="text-brand-primary" /> Basic Information
            </h3>
          </div>
          <div>
            <label className="field-label">Full Name</label>
            <input 
              placeholder="Full legal name" 
              className="input mt-1.5" 
              value={newPatient.name} 
              onChange={e => setNewPatient({...newPatient, name: e.target.value})}
              required 
            />
          </div>
          <div>
            <label className="field-label">Email Address</label>
            <input 
              type="email"
              placeholder="patient@email.com" 
              className="input mt-1.5" 
              value={newPatient.email} 
              onChange={e => setNewPatient({...newPatient, email: e.target.value})}
              required 
            />
          </div>
          <div>
            <label className="field-label">Password (Initial)</label>
            <input 
              type="password"
              placeholder="Temporary password" 
              className="input mt-1.5" 
              value={newPatient.password} 
              onChange={e => setNewPatient({...newPatient, password: e.target.value})}
              required 
            />
          </div>
          
          <div className="md:col-span-3 mt-2 border-t border-white/5 pt-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Phone size={18} className="text-brand-primary" /> Contact & Medical
            </h3>
          </div>
          <div>
            <label className="field-label">Phone Number</label>
            <input 
              placeholder="+1-XXX-XXX-XXXX" 
              className="input mt-1.5" 
              value={newPatient.phone} 
              onChange={e => setNewPatient({...newPatient, phone: e.target.value})}
            />
          </div>
          <div>
            <label className="field-label">Date of Birth</label>
            <input 
              type="date"
              className="input mt-1.5" 
              value={newPatient.date_of_birth} 
              onChange={e => setNewPatient({...newPatient, date_of_birth: e.target.value})}
            />
          </div>
          <div>
            <label className="field-label">Gender</label>
            <select 
              className="input mt-1.5"
              value={newPatient.gender}
              onChange={e => setNewPatient({...newPatient, gender: e.target.value})}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="field-label">Blood Group</label>
            <input 
              placeholder="e.g. O+, AB-" 
              className="input mt-1.5" 
              value={newPatient.blood_group} 
              onChange={e => setNewPatient({...newPatient, blood_group: e.target.value})}
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Allergies (if any)</label>
            <input 
              placeholder="Peanuts, Penicillin, etc." 
              className="input mt-1.5" 
              value={newPatient.allergies} 
              onChange={e => setNewPatient({...newPatient, allergies: e.target.value})}
            />
          </div>
          <div className="md:col-span-3">
            <label className="field-label">Address</label>
            <textarea 
              placeholder="Current residential address" 
              className="input mt-1.5 min-h-[80px]" 
              value={newPatient.address} 
              onChange={e => setNewPatient({...newPatient, address: e.target.value})}
            />
          </div>
          
          <button type="submit" className="md:col-span-3 btn-primary mt-2 py-3 shadow-lg shadow-brand-primary/20">
            Confirm Patient Registration
          </button>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input 
              className="input pl-10 h-10 text-sm" 
              placeholder="Search patients by name, email or ID..."
            />
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-lg text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {patients.length} total
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/[0.02] text-zinc-400 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Patient</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Demographics</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Health Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">Loading patients...</td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">No patients found.</td>
                </tr>
              ) : (
                patients.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center bg-zinc-800 rounded-xl text-zinc-400 group-hover:bg-brand-primary/20 group-hover:text-brand-primary transition-colors">
                          <User size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-100">{p.name}</p>
                          <p className="text-xs text-zinc-500 flex items-center gap-1"><Mail size={10} /> {p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-zinc-300 flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${p.gender === 'Male' ? 'bg-blue-400' : p.gender === 'Female' ? 'bg-pink-400' : 'bg-zinc-400'}`} />
                          {p.gender}, {calculateAge(p.date_of_birth)} yrs
                        </p>
                        <p className="text-xs text-zinc-500">BG: {p.blood_group || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-sm">
                        <p className="text-zinc-300 flex items-center gap-1.5"><Phone size={12} className="text-zinc-500" /> {p.phone || 'N/A'}</p>
                        <p className="text-xs text-zinc-500 flex items-center gap-1.5 truncate max-w-[150px]"><MapPin size={12} className="text-zinc-500" /> {p.address || 'No address'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden min-w-[60px]">
                          <div 
                            className={`h-full rounded-full ${p.health_score > 80 ? 'bg-emerald-500' : p.health_score > 60 ? 'bg-amber-500' : 'bg-red-500'}`} 
                            style={{ width: `${p.health_score || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-zinc-400">{p.health_score || 0}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/doctor/patient/${p.id}`)}
                        className="nav-pill text-xs border-white/10 hover:bg-white/10 px-4"
                      >
                        View Records
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
