import { useState, useEffect } from 'react';
import {
  Building2, Plus, Edit2, Trash2, X, Users, Search
} from 'lucide-react';
import api from '../lib/api';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 shadow-glass"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function DeptForm({ initial = {}, onSubmit, loading, submitLabel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    icon: initial.icon || 'stethoscope',
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="field-label">Department Name *</label>
        <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Cardiology" />
      </div>
      <div>
        <label className="field-label">Description</label>
        <textarea
          className="input min-h-[80px] resize-none"
          value={form.description}
          onChange={set('description')}
          placeholder="Brief description of this department's services…"
        />
      </div>
      <div>
        <label className="field-label">Icon name</label>
        <input className="input" value={form.icon} onChange={set('icon')} placeholder="stethoscope" />
        <p className="mt-1 text-xs text-zinc-500">Lucide icon identifier (e.g. stethoscope, heart, brain)</p>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading
          ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Saving…</span>
          : submitLabel}
      </button>
    </form>
  );
}

const DEPT_COLORS = [
  'text-blue-400 bg-blue-500/10',
  'text-purple-400 bg-purple-500/10',
  'text-emerald-400 bg-emerald-500/10',
  'text-amber-400 bg-amber-500/10',
  'text-cyan-400 bg-cyan-500/10',
  'text-rose-400 bg-rose-500/10',
  'text-indigo-400 bg-indigo-500/10',
  'text-orange-400 bg-orange-500/10',
];

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/departments');
      setDepartments(res.data || []);
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
      await api.post('/departments', form);
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create department');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit(form) {
    setFormLoading(true);
    setError('');
    try {
      await api.put(`/departments/${modal.dept.id}`, form);
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update department');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    setFormLoading(true);
    setError('');
    try {
      await api.delete(`/departments/${modal.dept.id}`);
      setModal(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete department');
    } finally {
      setFormLoading(false);
    }
  }

  const filtered = departments.filter(d =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Department <span className="gradient-text">Management</span>
          </h1>
          <p className="mt-1 text-zinc-400">{departments.length} department{departments.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => { setError(''); setModal('add'); }} className="btn-primary gap-2">
          <Plus size={16} /> Add Department
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          className="input pl-9"
          placeholder="Search departments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="shimmer-bar h-36 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Building2 className="h-14 w-14 text-zinc-700" />
          <p className="text-zinc-500">{search ? 'No departments match your search' : 'No departments yet'}</p>
          <button onClick={() => { setError(''); setModal('add'); }} className="btn-primary btn-sm">Add first department</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((dept, idx) => {
            const colorClass = DEPT_COLORS[idx % DEPT_COLORS.length];
            const [textColor, bgColor] = colorClass.split(' ');
            return (
              <div key={dept.id} className="glass-card group flex flex-col gap-3 p-5 transition hover:border-white/20">
                <div className="flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bgColor}`}>
                    <Building2 className={`h-5 w-5 ${textColor}`} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={() => { setError(''); setModal({ type: 'edit', dept }); }}
                      className="btn-ghost p-1.5 rounded-lg"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => { setError(''); setModal({ type: 'delete', dept }); }}
                      className="btn-danger p-1.5 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-zinc-100">{dept.name}</h3>
                  {dept.description && (
                    <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{dept.description}</p>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users size={12} />
                  <span>{dept.doctor_count ?? 0} doctor{(dept.doctor_count ?? 0) !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {modal === 'add' && (
        <Modal title="Add Department" onClose={() => setModal(null)}>
          {error && <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">{error}</div>}
          <DeptForm onSubmit={handleAdd} loading={formLoading} submitLabel="Create Department" />
        </Modal>
      )}

      {/* Edit Modal */}
      {modal?.type === 'edit' && (
        <Modal title={`Edit — ${modal.dept.name}`} onClose={() => setModal(null)}>
          {error && <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">{error}</div>}
          <DeptForm initial={modal.dept} onSubmit={handleEdit} loading={formLoading} submitLabel="Save Changes" />
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {modal?.type === 'delete' && (
        <Modal title="Delete Department" onClose={() => setModal(null)}>
          {error && <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">{error}</div>}
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
              <Trash2 className="h-7 w-7 text-rose-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-100">{modal.dept.name}</p>
              <p className="mt-1.5 text-sm text-zinc-400">
                Deleting this department will unlink {modal.dept.doctor_count ?? 0} doctor{(modal.dept.doctor_count ?? 0) !== 1 ? 's' : ''} from it. Appointments and doctor records will not be deleted.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleDelete} disabled={formLoading} className="btn-danger flex-1">
                {formLoading ? 'Deleting…' : 'Delete Department'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
