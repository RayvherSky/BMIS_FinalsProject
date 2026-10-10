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
