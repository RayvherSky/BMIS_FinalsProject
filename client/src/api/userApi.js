import api from './axios';

export const getAllUsers = async (params = {}) => {
  const response = await api.get('/api/users', { params });
  return response.data;
};

export const getUserById = async (id) => {
  const response = await api.get(`/api/users/${id}`);
  return response.data;
};

export const updateUser = async (id, data) => {
  const response = await api.put(`/api/users/${id}`, data);
  return response.data;
};

export const changeUserRole = async (id, role, confirmationEmail) => {
  const response = await api.patch(`/api/users/${id}/role`, { role, confirmationEmail });
  return response.data;
};

export const getEmployees = async () => (await api.get('/api/users/employees')).data;
export const setUserActive = async (id, isActive, confirmationEmail) =>
  (await api.patch(`/api/users/${id}/active`, { isActive, confirmationEmail })).data;
