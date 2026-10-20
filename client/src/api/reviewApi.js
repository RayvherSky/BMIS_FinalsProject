import api from './axios';

export const REVIEW_CHANGED_EVENT = 'bmis:ticket-review-changed';

export const getTicketReviews = async (params = { status: 'pending' }) => {
  const response = await api.get('/api/tickets/reviews', { params });
  return response.data;
};

export const submitTicketReview = async ticketId => {
  const response = await api.post(`/api/tickets/${ticketId}/review`);
  window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT));
  return response.data;
};

export const markTicketReviewed = async ticketId => {
  const response = await api.patch(`/api/tickets/${ticketId}/review`, { action: 'reviewed' });
  window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT));
  return response.data;
};
