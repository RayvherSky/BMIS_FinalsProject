import { formatDate } from './helpers';

export const REQUEST_LABELS = { follow_up: 'Follow-up', progress_update: 'Progress update', appeal: 'Dismissal appeal' };
export const REQUEST_STATES = { pending: 'Pending', acknowledged: 'Acknowledged', completed: 'Completed' };

export const requestErrorMessage = (error, fallback) => {
  const data = error.response?.data;
  const explanation = data?.message || fallback;
  if (error.response?.status !== 429) return explanation;
  const seconds = Number(data?.retryAfter || error.response?.headers?.['retry-after']);
  if (seconds > 0) return `${explanation} Try again in ${Math.ceil(seconds)} seconds.`;
  if (data?.nextAllowedAt) return `${explanation} Try again after ${formatDate(data.nextAllowedAt)}.`;
  return explanation;
};
