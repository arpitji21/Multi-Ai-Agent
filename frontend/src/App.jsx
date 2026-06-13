import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorPatientView from './pages/DoctorPatientView';
import DoctorAITools from './pages/DoctorAITools';
import AdminDashboard from './pages/AdminDashboard';

const PATIENT_NAV = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/my-health', label: 'My Health' },
  { to: '/appointments', label: 'Appointments' },
];

const DOCTOR_NAV = [
  { to: '/doctor', label: 'Dashboard', end: true },
  { to: '/doctor/patients', label: 'Patients' },
  { to: '/doctor/appointments', label: 'Schedule' },
  { to: '/doctor/ai-tools', label: 'AI Tools' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/patients', label: 'Patients' },
  { to: '/admin/doctors', label: 'Doctors' },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/analytics', label: 'Analytics' },
];

function RoleRouter() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'doctor') return <Navigate to="/doctor" replace />;
  return <Navigate to="/dashboard" replace />;
}

function PatientShell({ children }) {
  const { user } = useAuthStore();
  return (
    <AppShell roleLabel="Patient Portal" navItems={PATIENT_NAV}>
      {children}
    </AppShell>
  );
}

function DoctorShell({ children }) {
  return (
    <AppShell roleLabel="Doctor Portal" navItems={DOCTOR_NAV}>
      {children}
    </AppShell>
  );
}

function AdminShell({ children }) {
  return (
    <AppShell roleLabel="Admin Portal" navItems={ADMIN_NAV}>
      {children}
    </AppShell>
  );
}

function App() {
  const { token, setToken } = useAuthStore();

  // Restore auth header on mount
  useEffect(() => {
    setToken(token);
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Role-based root redirect */}
        <Route path="/" element={<RoleRouter />} />

        {/* Patient routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientShell><Dashboard /></PatientShell>
          </ProtectedRoute>
        } />
        <Route path="/my-health" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientShell><PatientDashboard /></PatientShell>
          </ProtectedRoute>
        } />
        <Route path="/appointments" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientShell><Appointments /></PatientShell>
          </ProtectedRoute>
        } />
        <Route path="/patients" element={
          <ProtectedRoute allowedRoles={['patient', 'doctor', 'admin']}>
            <PatientShell><Patients /></PatientShell>
          </ProtectedRoute>
        } />

        {/* Doctor routes */}
        <Route path="/doctor" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorShell><DoctorDashboard /></DoctorShell>
          </ProtectedRoute>
        } />
        <Route path="/doctor/patients" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorShell><Patients /></DoctorShell>
          </ProtectedRoute>
        } />
        <Route path="/doctor/appointments" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorShell><Appointments /></DoctorShell>
          </ProtectedRoute>
        } />
        <Route path="/doctor/patient/:patientId" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorShell><DoctorPatientView /></DoctorShell>
          </ProtectedRoute>
        } />
        <Route path="/doctor/ai-tools" element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorShell><DoctorAITools /></DoctorShell>
          </ProtectedRoute>
        } />

        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminShell><AdminDashboard /></AdminShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/patients" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminShell><Patients /></AdminShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/doctors" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminShell><Patients /></AdminShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/appointments" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminShell><Appointments /></AdminShell>
          </ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminShell><AdminDashboard /></AdminShell>
          </ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
