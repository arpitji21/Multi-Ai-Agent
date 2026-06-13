import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    const redirectMap = { admin: '/admin', doctor: '/doctor', patient: '/dashboard' };
    return <Navigate to={redirectMap[user.role] || '/login'} replace />;
  }

  return children;
}
