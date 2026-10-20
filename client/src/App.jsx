import React, { useCallback, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import SplashScreen from './components/SplashScreen/SplashScreen';
import AppLayout from './components/Layout/AppLayout';
import LegacyUserRedirect from './components/ProtectedRoute/LegacyUserRedirect';
import EmployeeQueue from './pages/EmployeeQueue';
import ActionCenter from './pages/ActionCenter';
import ReviewQueue from './pages/ReviewQueue';
import './roles.css';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import ResidentDashboard from './pages/ResidentDashboard';
import SubmitTicket from './pages/SubmitTicket';
import MyTickets from './pages/MyTickets';
import AdminDashboard from './pages/AdminDashboard';
import TicketDetails from './pages/TicketDetails';
import UserManagement from './pages/UserManagement';
import ArchiveView from './pages/ArchiveView';

const theme = {
  token: {
    colorPrimary: '#0A4D68',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorInfo: '#1890FF',
    colorBgLayout: '#F0F2F5',
    borderRadius: 6,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#0A4D68',
      headerBg: '#ffffff',
    },
    Menu: {
      darkItemBg: '#0A4D68',
      darkItemSelectedBg: '#2D6A4F',
      darkItemHoverBg: '#0d6080',
      darkItemColor: 'rgba(255,255,255,0.85)',
      darkItemSelectedColor: '#D4A017',
    },
    Button: {
      primaryShadow: '0 2px 0 rgba(10, 77, 104, 0.1)',
    },
  },
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  return (
    <ConfigProvider theme={theme}>
      <AuthProvider>
        {showSplash && <SplashScreen onComplete={finishSplash} />}
        <div
          className={`app-content${showSplash ? ' app-content--loading' : ''}`}
          inert={showSplash ? '' : undefined}
          aria-disabled={showSplash ? true : undefined}
          aria-hidden={showSplash ? true : undefined}
        >
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
  
            {/* Protected: any authenticated user */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/profile" element={<Profile />} />
                {/* Canonical User routes and existing-link compatibility. */}
                <Route element={<ProtectedRoute allowedRoles={['user']} />}>
                  <Route path="/user/dashboard" element={<ResidentDashboard />} />
                  <Route path="/user/submit-ticket" element={<SubmitTicket />} />
                  <Route path="/user/my-tickets" element={<MyTickets />} />
                  <Route path="/user/ticket/:id" element={<TicketDetails />} />
                  <Route path="/resident/*" element={<LegacyUserRedirect />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
                  <Route path="/employee/assigned-tickets" element={<EmployeeQueue />} />
                  <Route path="/employee/action-center" element={<ActionCenter />} />
                  <Route path="/employee/ticket/:id" element={<TicketDetails />} />
                </Route>
                {/* Protected: admin role */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/action-center" element={<ActionCenter />} />
                  <Route path="/admin/for-review" element={<ReviewQueue />} />
                  <Route path="/admin/ticket/:id" element={<TicketDetails />} />
                  <Route path="/admin/users" element={<UserManagement />} />
                  <Route path="/admin/archive" element={<ArchiveView />} />
                </Route>
              </Route>
            </Route>
  
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
