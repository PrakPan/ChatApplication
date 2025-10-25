import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      
        <p>Loading...</p>
      
    );
  }

  if (!isAuthenticated) {
    return (
        <>
        {children}
        </>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
        <>
        {children}
        </>
    );
  }

  return children;
};