import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import api from '../api/axios';
import { getHomePath, normalizeRole } from '../utils/roles';

const normalizeAccount = account => {
  const role = normalizeRole(account?.role);
  if (!role) throw new Error('Unsupported account role');
  return { ...account, role };
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/api/auth/me');
        setUser(normalizeAccount(response.data.user || response.data));
        setToken(storedToken);
      } catch (error) {
        console.error('Token validation failed:', error);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      const account = normalizeAccount(userData);
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(account);

      message.success('Login successful!');

      navigate(getHomePath(account.role));

      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Login failed. Please try again.';
      message.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [navigate]);

  const register = useCallback(async (data) => {
    try {
      const response = await api.post('/api/auth/register', data);
      const { token: newToken, user: userData } = response.data;
      const account = normalizeAccount(userData);
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(account);

      message.success('Registration successful!');
      navigate(getHomePath(account.role));

      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Registration failed. Please try again.';
      message.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, [navigate]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    message.success('Logged out successfully.');
    navigate('/login');
  }, [navigate]);

  const updateProfile = useCallback(async (data) => {
    try {
      const response = await api.put('/api/auth/profile', data);
      const updatedUser = response.data.user || response.data;
      setUser(normalizeAccount(updatedUser));
      message.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Profile update failed.';
      message.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
