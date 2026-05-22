import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, adminOnly }) {
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'ADMIN') {
    return <Navigate to="/tasks" replace />;
  }

  // Rule 3: Passed all checks. Render the component.
  return children;
}