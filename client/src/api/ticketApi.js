import api from './axios';

export const createTicket = async (formData) => {
  const response = await api.post('/api/tickets', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getAllTickets = async (params = {}) => {
  const response = await api.get('/api/tickets', { params });
  return response.data;
};

export const getMyTickets = async (params = {}) => {
  const response = await api.get('/api/tickets/my-tickets', { params });
  return response.data;
};

export const getTicketById = async (id) => {
  const response = await api.get(`/api/tickets/${id}`);
  return response.data;
};

export const updateTicketStatus = async (id, status) => {
  const response = await api.put(`/api/tickets/${id}/status`, { status });
  return response.data;
};

export const linkTicket = async (id, linkedTicketId) => {
  const response = await api.put(`/api/tickets/${id}/link`, { linkedTicketId });
  return response.data;
};
