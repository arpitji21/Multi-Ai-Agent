import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import PatientDashboard from './pages/PatientDashboard';
import AppShell from './components/AppShell';

const NAV_ITEMS = [
  { to: '/', label: 'Overview' },
  { to: '/patient-dashboard', label: 'My Health' },
  { to: '/patients', label: 'Patients' },
  { to: '/appointments', label: 'Appointments' },
];

function App() {
  const user = { email: 'demo@larkai.com' }; // Mock user

  return (
    <Router>
      <AppShell roleLabel="Medical Staff Portal" navItems={NAV_ITEMS} user={user}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />
        </Routes>
      </AppShell>
    </Router>
  );
}

export default App;
