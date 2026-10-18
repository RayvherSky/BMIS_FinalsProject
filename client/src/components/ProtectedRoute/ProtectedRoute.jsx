import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { getHomePath, normalizeRole } from '../../utils/roles';

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

  const role = normalizeRole(user?.role);
  if (!role || (allowedRoles && !allowedRoles.map(normalizeRole).includes(role))) {
    return <Navigate to={getHomePath(role)} replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
