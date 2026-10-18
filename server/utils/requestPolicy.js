const TYPES = ['follow_up', 'progress_update', 'appeal'];
const STATUS_FOR = { follow_up: 'Pending', progress_update: 'In Progress', appeal: 'Dismissed' };
const OFFSET = 8 * 60 * 60 * 1000;
function localDay(now = new Date()) { return new Date(now.getTime() + OFFSET).toISOString().slice(0, 10); }
function nextDay(now = new Date()) { return new Date(Date.parse(`${localDay(now)}T00:00:00Z`) + 86400000 - OFFSET); }
function dismissalKey(ticket) {
  const event = [...(ticket.statusHistory || [])].reverse().find(e => e.to === 'Dismissed');
  return event ? String(event._id) : `legacy:${ticket.dismissedAt ? new Date(ticket.dismissedAt).toISOString() : 'unknown'}`;
}
function eligibility(ticket, type, now = new Date()) {
  const deny = (reason, nextAllowedAt = null) => ({ allowed: false, reason, nextAllowedAt });
  if (ticket.status !== STATUS_FOR[type] || (type !== 'appeal' && ticket.isArchived)) return deny('This request is unavailable for the current ticket status.');
  const previous = (ticket.requests || []).filter(r => r.type === type);
  if (type === 'appeal') {
    if (previous.some(r => r.dismissalKey === dismissalKey(ticket))) return deny('An appeal has already been submitted for this dismissal.');
    if (previous.some(r => r.state !== 'completed')) return deny('An earlier appeal is still awaiting a decision.');
  } else {
    if (previous.some(r => r.state !== 'completed')) return deny('An earlier request of this type is still awaiting a response.');
    if (previous.some(r => r.day === localDay(now))) return deny('You have already submitted this request today. Please try again after midnight in Manila.', nextDay(now));
  }
  return { allowed: true, reason: '', nextAllowedAt: null };
}
function reversalOptions(ticket) {
  const history = ticket.statusHistory || [];
  const last = history.at(-1);
  if (last) return { options: last.to === ticket.status && ['Pending', 'In Progress'].includes(last.from) && last.from !== ticket.status ? [last.from] : [], legacy: false };
  return { options: ticket.status === 'In Progress' ? ['Pending'] : ['Resolved', 'Dismissed'].includes(ticket.status) ? ['Pending', 'In Progress'] : [], legacy: true };
}
function canHandle(ticket, request, actor) {
  if (actor.role === 'admin') return true;
  return actor.role === 'employee' && request.type !== 'appeal' && !ticket.isArchived &&
    ['Pending', 'In Progress'].includes(ticket.status) && String(ticket.assignedTo?._id || ticket.assignedTo) === actor.id;
}
module.exports = { TYPES, STATUS_FOR, localDay, nextDay, dismissalKey, eligibility, reversalOptions, canHandle };
