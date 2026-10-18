import api from './axios';

export const getTicketRequests = async (params = {}) => {
  const response = await api.get('/api/tickets/requests', { params });
  return response.data;
};

export const createTicketRequest = async (ticketId, type, message) => {
  const response = await api.post(`/api/tickets/${ticketId}/requests`, { type, message });
  return response.data;
};

export const handleTicketRequest = async (ticketId, requestId, action) => {
  const response = await api.patch(`/api/tickets/${ticketId}/requests/${requestId}`, action);
  return response.data;
};

export const revertTicketStatus = async (ticketId, status, reason) => {
  const response = await api.post(`/api/tickets/${ticketId}/revert`, { status, reason });
  return response.data;
};
