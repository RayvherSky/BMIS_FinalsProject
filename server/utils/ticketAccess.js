const { canonicalRole } = require('./roles');
const idOf = value => value?._id?.toString() || value?.toString();
const staffName = value => value && ({ _id: value._id || value, ...(value.firstName !== undefined ? { firstName: value.firstName, lastName: value.lastName } : {}) });

function populateTicket(query, role) {
  const admin = canonicalRole(role) === 'admin';
  query.populate('submittedBy', 'firstName lastName email')
    .populate('notes.addedBy', 'firstName lastName role')
    .populate('assignedTo', admin ? 'firstName lastName email' : 'firstName lastName')
    .populate({ path: 'linkedTicket', select: admin ? undefined : '_id title submittedBy assignedTo isArchived' });
  if (admin) {
    for (const field of ['previousEmployee', 'newEmployee', 'changedBy']) {
      query.populate(`assignmentHistory.${field}`, 'firstName lastName');
    }
  }
  return query;
}

function canRead(ticket, actor) {
  const role = canonicalRole(actor.role);
  if (role === 'admin') return true;
  if (role === 'employee') return !ticket.isArchived && idOf(ticket.assignedTo) === actor.id;
  if (role === 'user') return idOf(ticket.submittedBy) === actor.id;
  return false;
}

function serializeTicket(document, actor) {
  const ticket = typeof document.toObject === 'function' ? document.toObject() : { ...document };
  const role = canonicalRole(actor.role);
  ticket.notes = (ticket.notes || []).map(note => ({ ...note, ...(note.addedBy?.role ? { addedBy: { ...note.addedBy, role: canonicalRole(note.addedBy.role) } } : {}) }));
  if (role === 'admin') return ticket;
  delete ticket.assignmentHistory;
  ticket.assignedTo = staffName(ticket.assignedTo) || null;
  if (role === 'user') ticket.notes = (ticket.notes || []).filter(note => !note.isPrivate);
  if (ticket.linkedTicket) {
    const linked = ticket.linkedTicket;
    const authorized = role === 'user' ? idOf(linked.submittedBy) === actor.id : !linked.isArchived && idOf(linked.assignedTo) === actor.id;
    ticket.linkedTicket = authorized ? { _id: linked._id || linked, title: linked.title } : { _id: linked._id || linked };
  }
  return ticket;
}

module.exports = { populateTicket, serializeTicket, canRead, idOf };
