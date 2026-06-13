import { useState, useEffect } from 'react';
import {
  Stethoscope, Plus, Search, Edit2, Trash2, CheckCircle,
  XCircle, ChevronDown, X, Star, DollarSign, Briefcase
} from 'lucide-react';
import api from '../lib/api';

/* ── Modal wrapper ── */
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950/95 shadow-glass"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Doctor form (shared by add + edit) ── */
function DoctorForm({ initial = {}, departments = [], onSubmit, loading, submitLabel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    email: initial.email || '',
    password: '',
    phone: initial.phone || '',
    specialization: initial.specialization || '',
    license_number: initial.license_number || '',
    department_id: initial.department_id || '',
    consultation_fee: initial.consultation_fee || '',
    experience_years: initial.experience_years || '',
    bio: initial.bio || '',
    available: initial.available !== undefined ? initial.available : true,
  });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  const isEdit = !!initial.id;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Full Name *</label>
          <input className="input" value={form.name} onChange={set('name')} required disabled={isEdit} placeholder="Dr. Jane Smith" />
        </div>
        <div>
          <label className="field-label">Email *</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} required disabled={isEdit} placeholder="doctor@hospital.com" />
        </div>
      </div>

      {!isEdit && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Password *</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} required placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="+1 234 567 8900" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Specialization</label>
          <input className="input" value={form.specialization} onChange={set('specialization')} placeholder="Cardiology" />
        </div>
        <div>
          <label className="field-label">License Number</label>
          <input className="input" value={form.license_number} onChange={set('license_number')} placeholder="MED-12345" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Department</label>
          <div className="relative mt-1.5">
            <select
              className="input appearance-none pr-8"
              value={form.department_id}
              onChange={set('department_id')}
            >
              <option value="">No Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          </div>
        </div>
        <div>
          <label className="field-label">Experience (years)</label>
          <input className="input" type="number" min="0" value={form.experience_years} onChange={set('experience_years')} placeholder="5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Consultation Fee ($)</label>
          <input className="input" type="number" min="0" step="0.01" value={form.consultation_fee} onChange={set('consultation_fee')} placeholder="150" />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand-500" checked={form.available} onChange={set('available')} />
            <span className="text-sm text-zinc-300">Available for appointments</span>
          </label>
        </div>
      </div>

      <div>
        <label className="field-label">Bio / Notes</label>
        <textarea className="input min-h-[80px] resize-none" value={form.bio} onChange={set('bio')} placeholder="Brief description of expertise..." />
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Saving…</span> : submitLabel}
      </button>
    </form>
  );
}

/* ── Main page ── */
export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | { type:'edit', doc } | { type:'deactivate', doc }
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [docRes, deptRes] = await Promise.all([
        api.get('/doctors'),
        api.get('/departments'),
      ]);
      setDoctors(docRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(form) {
    setFormLoading(true);
    setError('');
    try {
      await api.post('/doctors', {
        ...form,
        consultation_fee: parseFloat(form.consultation_fee) || 0,
        experience_years: parseInt(form.experience_years) || 0,
        department_id: form.department_id || null,
      });
      setModal(null);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create doctor');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit(form) {
    setFormLoading(true);
    setError('');
    try {
      await api.put(`/doctors/${modal.doc.id}`, {
        specialization: form.specialization,
        consultation_fee: parseFloat(form.consultation_fee) || 0,
        experience_years: parseInt(form.experience_years) || 0,
        available: form.available,
        bio: form.bio,
        department_id: form.department_id || null,
      });
      setModal(null);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update doctor');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDeactivate() {
    setFormLoading(true);
    setError('');
    try {
      await api.delete(`/doctors/${modal.doc.id}`);
      setModal(null);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deactivate doctor');
    } finally {
      setFormLoading(false);
    }
  }

  const filtered = doctors.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.name?.toLowerCase().includes(q) || d.specialization?.toLowerCase().includes(q) || d.email?.toLowerCase().includes(q);
    const matchDept = !filterDept || String(d.department_id) === filterDept;
    return matchSearch && matchDept;
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Doctor <span className="gradient-text">Management</span>
          </h1>
          <p className="mt-1 text-zinc-400">{doctors.length} doctor{doctors.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => { setError(''); setModal('add'); }} className="btn-primary gap-2">
          <Plus size={16} /> Add Doctor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="input pl-9"
            placeholder="Search by name, specialty or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            className="input min-w-44 appearance-none pr-8"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">{[1,2,3,4,5].map(i=><div key={i} className="shimmer-bar h-16 rounded-xl"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Stethoscope className="h-12 w-12 text-zinc-700" />
            <p className="text-zinc-500">{search || filterDept ? 'No doctors match your filters' : 'No doctors registered yet'}</p>
            <button onClick={() => setModal('add')} className="btn-primary btn-sm">Add first doctor</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Doctor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Department</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Fee</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Rating</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filtered.map(doc => (
                  <tr key={doc.id} className="group transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-sm font-bold text-purple-400">
                          {doc.name?.charAt(0) || 'D'}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-200">{doc.name}</p>
                          <p className="text-xs text-zinc-500">{doc.email}</p>
                          <p className="text-xs text-zinc-600">{doc.specialization}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{doc.department_name || <span className="italic text-zinc-600">None</span>}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <DollarSign size={13} />{parseFloat(doc.consultation_fee || 0).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {doc.rating ? (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Star size={12} />{parseFloat(doc.rating).toFixed(1)}
                        </span>
                      ) : <span className="text-zinc-600 text-xs">No rating</span>}
                    </td>
                    <td className="px-5 py-4">
                      {doc.available ? (
                        <span className="badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                          <CheckCircle size={11} /> Active
                        </span>
                      ) : (
                        <span className="badge bg-zinc-500/10 border-zinc-500/30 text-zinc-400">
                          <XCircle size={11} /> Unavailable
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setError(''); setModal({ type: 'edit', doc }); }}
                          className="btn-ghost btn-sm gap-1.5 px-2.5"
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          onClick={() => { setError(''); setModal({ type: 'deactivate', doc }); }}
                          className="btn-danger btn-sm gap-1.5 px-2.5"
                        >
                          <Trash2 size={13} /> Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {modal === 'add' && (
        <Modal title="Add New Doctor" onClose={() => setModal(null)}>
          {error && <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">{error}</div>}
          <DoctorForm departments={departments} onSubmit={handleAdd} loading={formLoading} submitLabel="Create Doctor" />
        </Modal>
      )}

      {/* Edit Modal */}
      {modal?.type === 'edit' && (
        <Modal title={`Edit — ${modal.doc.name}`} onClose={() => setModal(null)}>
          {error && <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">{error}</div>}
          <DoctorForm initial={modal.doc} departments={departments} onSubmit={handleEdit} loading={formLoading} submitLabel="Save Changes" />
        </Modal>
      )}

      {/* Deactivate Confirm Modal */}
      {modal?.type === 'deactivate' && (
        <Modal title="Deactivate Doctor" onClose={() => setModal(null)}>
          {error && <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">{error}</div>}
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
              <Trash2 className="h-7 w-7 text-rose-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-100">{modal.doc.name}</p>
              <p className="mt-1.5 text-sm text-zinc-400">
                This will deactivate the doctor's account. They will no longer appear in appointment booking, but their past records will be preserved.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleDeactivate} disabled={formLoading} className="btn-danger flex-1">
                {formLoading ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
