const mongoose = require('mongoose');
const User = require('../models/User');
const { reversalOptions } = require('./requestPolicy');
const { canonicalRole } = require('./roles');
function problem(status, message, extra = {}) { return Object.assign(new Error(message), { status, ...extra }); }
function textInput(value, label, required = true) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > 5000) throw problem(400, `${label} must be ${required ? 'nonblank text' : 'text'} of at most 5000 characters`);
  return value.trim();
}
function predicate(ticket, extra = {}) {
  const version = ticket.workflowVersion || 0;
  return { $and: [{ _id: ticket._id, status: ticket.status, isArchived: ticket.isArchived ? true : { $ne: true } },
    version ? { workflowVersion: version } : { $or: [{ workflowVersion: 0 }, { workflowVersion: { $exists: false } }] }, extra] };
}
function statusEvent(ticket, to, actor, kind = 'status', reason = '', now = new Date()) {
  return { _id: new mongoose.Types.ObjectId(), from: ticket.status, to, kind, reason, changedBy: actor.id, createdAt: now,
    previousEvent: ticket.statusHistory?.at(-1)?._id,
    previousResolvedAt: ticket.resolvedAt || null, previousDismissedAt: ticket.dismissedAt || null,
    previousArchivedAt: ticket.archivedAt || null, previousIsArchived: Boolean(ticket.isArchived) };
}
async function currentActor(actor) {
  const account = await User.findById(actor.id).select('role isActive');
  if (!account || account.isActive === false || canonicalRole(account.role) !== actor.role) throw problem(403, 'Your access has changed. Please sign in again.');
}
async function reversalUpdate(ticket, status, reason, actor, now = new Date()) {
  const options = reversalOptions(ticket);
  if (!options.options.includes(status)) throw problem(400, 'Choose an available previous status. Refresh the ticket if it has changed.');
  const event = statusEvent(ticket, status, actor, options.legacy ? 'legacy_correction' : 'reversal', reason, now);
  const update = { $set: { status, isArchived: false, archivedAt: null, resolvedAt: null, dismissedAt: null },
    $push: { statusHistory: event }, $inc: { workflowVersion: 1 } };
  const employeeId = ticket.assignedTo?._id || ticket.assignedTo;
  if (employeeId) {
    const employee = await User.findById(employeeId).select('role isActive');
    if (!employee || employee.role !== 'employee' || employee.isActive === false) {
      Object.assign(update.$set, { assignedTo: null, assignedAt: null });
      update.$push.assignmentHistory = { previousEmployee: employeeId, newEmployee: null, changedBy: actor.id,
        createdAt: now, action: 'unassigned', reason: 'Reopened report: previous Employee is unavailable' };
    }
  }
  return update;
}
function sendProblem(res, error) {
  const status = error.status || (error.kind === 'ObjectId' ? 404 : 500);
  if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
  return res.status(status).json({ message: status === 500 ? 'Unable to save this action. Please try again.' : error.message,
    ...(error.retryAfter ? { retryAfter: error.retryAfter, nextAllowedAt: error.nextAllowedAt } : {}) });
}
module.exports = { problem, textInput, predicate, statusEvent, currentActor, reversalUpdate, sendProblem };
