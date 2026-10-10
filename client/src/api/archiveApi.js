import api from './axios';

export const getArchivedTickets = async (params = {}) => {
  const response = await api.get('/api/archive', { params });
  return response.data;
};

export const archiveTicket = async (id) => {
  const response = await api.put(`/api/archive/${id}/archive`);
  return response.data;
};

export const restoreTicket = async (id) => {
  const response = await api.put(`/api/archive/${id}/restore`);
  return response.data;
};
