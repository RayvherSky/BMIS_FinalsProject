import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute component that guards routes based on authentication and roles.
 * @param {Object} props
 * @param {string[]} [props.allowedRoles] - Optional array of allowed roles (e.g., ['admin', 'resident'])
 * @param {React.ReactNode} [props.children] - Optional children to render instead of Outlet
 */
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to the appropriate dashboard based on user role
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/resident/dashboard" replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
