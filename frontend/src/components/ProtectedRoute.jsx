import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
    // 1. Get the raw user string
    const userString = localStorage.getItem('user');
    const token = localStorage.getItem('token'); 
    
    // 2. Parse it to get the object
    const user = userString ? JSON.parse(userString) : null;
    const userRole = user?.role || 'USER'; // Now this will correctly see 'ADMIN'

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // 3. Check permissions
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/tasks" replace />;
    }

    return children;
}