const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const { withAccountLock, withTicketLock } = require('../utils/accountLock');
const { populateTicket, serializeTicket, idOf, canRead } = require('../utils/ticketAccess');
const { TYPES, localDay, dismissalKey, eligibility, canHandle } = require('../utils/requestPolicy');
const { problem, textInput, predicate, currentActor, reversalUpdate, sendProblem } = require('../utils/ticketLifecycle');
const { reserve, checkNote, limited } = require('../utils/communicationLimits');

const validId = value => typeof value === 'string' && mongoose.isObjectIdOrHexString(value);
const withAccounts = (ids, work) => [...new Set(ids.filter(Boolean))].sort().reduceRight((next, id) => () => withAccountLock(id, next), work)();
async function commit(ticket, update, extra = {}) {
  update.$inc = { ...update.$inc, workflowVersion: 1 };
  const saved = await Ticket.findOneAndUpdate(predicate(ticket, extra), update, { new: true, runValidators: true });
  if (!saved) {
    if (extra.assignedTo) {
      const current = await Ticket.findById(ticket._id).select('assignedTo isArchived status');
      if (!current || idOf(current.assignedTo) !== extra.assignedTo || current.isArchived || !['Pending', 'In Progress'].includes(current.status)) {
        throw problem(404, 'Request not found');
      }
    }
    throw problem(409, 'The ticket changed before this action was saved. Refresh and try again.');
  }
  return saved;
}
async function withTicket(req, res, operation, lockAssignee = false) {
  try {
    if (!validId(req.params.id)) throw problem(404, 'Ticket not found');
    const snapshot = lockAssignee ? await Ticket.findById(req.params.id).select('assignedTo') : null;
    const employee = snapshot && idOf(snapshot.assignedTo);
    await withAccounts([req.user.id, employee], () => withTicketLock(req.params.id, async () => {
      await currentActor(req.user);
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) throw problem(404, 'Ticket not found');
      if (lockAssignee && (idOf(ticket.assignedTo) || null) !== (employee || null)) throw problem(409, 'Assignment changed. Refresh and retry.');
      const result = await operation(ticket, req.user, new Date());
      const updated = await populateTicket(Ticket.findById(ticket._id), req.user.role);
      if (!updated || !canRead(updated, req.user)) throw problem(404, 'Ticket not found');
      if (req.user.role === 'employee') {
        const request = updated.requests.id(req.params.requestId);
        if (!request || !canHandle(updated, request, req.user)) throw problem(404, 'Request not found');
      }
      res.status(result || 200).json(serializeTicket(updated, req.user));
    }));
  } catch (error) { sendProblem(res, error); }
}
const revertStatus = (req, res) => withTicket(req, res, async (ticket, actor, now) => {
  const reason = textInput(req.body.reason, 'Reversal reason');
  await commit(ticket, await reversalUpdate(ticket, req.body.status, reason, actor, now));
}, true);

const createRequest = (req, res) => withTicket(req, res, async (ticket, actor, now) => {
  if (idOf(ticket.submittedBy) !== actor.id) throw problem(404, 'Ticket not found');
  const { type } = req.body;
  if (!TYPES.includes(type)) throw problem(400, 'Choose a valid request type');
  const message = textInput(req.body.message, type === 'appeal' ? 'Appeal explanation' : 'Message', type === 'appeal');
  const availability = eligibility(ticket, type, now);
  if (!availability.allowed) {
    if (availability.nextAllowedAt) throw limited(new Date(availability.nextAllowedAt), now, availability.reason);
    throw problem(409, availability.reason);
  }
  const item = { _id: new mongoose.Types.ObjectId(), type, message, requestedBy: actor.id,
    day: localDay(now), state: 'pending', createdAt: now,
    ...(type === 'appeal' ? { dismissalKey: dismissalKey(ticket) } : {}),
    history: [{ action: 'submitted', actor: actor.id, createdAt: now }] };
  const release = await reserve(actor, now);
  try { await commit(ticket, { $push: { requests: item } }, { submittedBy: actor.id }); }
  catch (error) { await release(); throw error; }
  return 201;
});

const handleRequest = (req, res) => withTicket(req, res, async (ticket, actor, now) => {
  if (!validId(req.params.requestId)) throw problem(404, 'Request not found');
  const item = ticket.requests.id(req.params.requestId);
  if (!item || !canHandle(ticket, item, actor)) throw problem(404, 'Request not found');
  const action = req.body.action;
  if (!['view', 'acknowledge', 'respond', 'decide'].includes(action)) throw problem(400, 'Choose a valid handling action');
  const prefix = `requests.${ticket.requests.findIndex(r => String(r._id) === String(item._id))}`;
  const guard = actor.role === 'employee' ? { assignedTo: actor.id, isArchived: { $ne: true } } : {};
  const update = { $set: {}, $push: {} };
  const seen = item.viewedBy.some(v => idOf(v.user) === actor.id);
  if (action === 'view') {
    if (seen) return;
    update.$push[`${prefix}.viewedBy`] = { user: actor.id, at: now };
    await commit(ticket, update, guard); return;
  }
  if (item.state === 'completed') throw problem(409, 'This request has already been completed.');
  if (action === 'acknowledge') {
    if (item.state === 'acknowledged') return;
    Object.assign(update.$set, { [`${prefix}.state`]: 'acknowledged', [`${prefix}.acknowledgedAt`]: now });
  } else {
    const text = textInput(req.body.text, action === 'decide' ? 'Decision reason' : 'Public response');
    if (action === 'decide') {
      if (actor.role !== 'admin' || item.type !== 'appeal') throw problem(403, 'Only Admins can decide appeals.');
      if (!['accepted', 'rejected'].includes(req.body.decision)) throw problem(400, 'Choose Accept or Reject');
      if (req.body.decision === 'accepted') {
        if (ticket.status !== 'Dismissed' || item.dismissalKey !== dismissalKey(ticket)) throw problem(409, 'The ticket dismissal changed. Refresh before accepting this appeal.');
        const reversal = await reversalUpdate(ticket, req.body.status, text, actor, now);
        Object.assign(update.$set, reversal.$set); Object.assign(update.$push, reversal.$push);
      }
      Object.assign(update.$set, { [`${prefix}.decision`]: req.body.decision, [`${prefix}.decisionReason`]: text });
    } else if (item.type === 'appeal') throw problem(400, 'An appeal requires an Admin decision.');
    checkNote(ticket, actor, text, false, now);
    const note = { _id: new mongoose.Types.ObjectId(), text, addedBy: actor.id, isPrivate: false, kind: 'update', authorRole: actor.role, createdAt: now };
    update.$push.notes = note;
    Object.assign(update.$set, { [`${prefix}.state`]: 'completed', [`${prefix}.completedAt`]: now,
      [`${prefix}.handledBy`]: actor.id, [`${prefix}.responseText`]: text, [`${prefix}.responseNote`]: note._id });
  }
  if (!seen) update.$push[`${prefix}.viewedBy`] = { user: actor.id, at: now };
  update.$push[`${prefix}.history`] = { action, actor: actor.id, createdAt: now };
  const release = ['respond', 'decide'].includes(action) ? await reserve(actor, now) : null;
  try {
    await commit(ticket, update, guard);
  } catch (error) { if (release) await release(); throw error; }
}, req.body.action === 'decide' && req.body.decision === 'accepted');

const getRequests = async (req, res) => {
  try {
    const { type, state, search = '', page: rawPage = '1', limit: rawLimit = '10' } = req.query;
    if ([type, state, search, rawPage, rawLimit].some(v => v !== undefined && typeof v !== 'string') ||
      (type && !TYPES.includes(type)) || (state && !['pending', 'acknowledged', 'completed'].includes(state)) ||
      !/^\d+$/.test(rawPage) || !/^\d+$/.test(rawLimit) || Number(rawPage) < 1 || !Number.isSafeInteger(Number(rawPage)) || Number(rawLimit) < 1 || Number(rawLimit) > 50) {
      throw problem(400, 'Invalid request filters or pagination');
    }
    const filter = { 'requests.0': { $exists: true } };
    if (req.user.role === 'employee') Object.assign(filter, { assignedTo: req.user.id, isArchived: { $ne: true }, status: { $in: ['Pending', 'In Progress'] } });
    const tickets = await Ticket.find(filter).select('title status isArchived assignedTo submittedBy requests')
      .populate('submittedBy', 'firstName lastName').lean();
    const all = [];
    for (const ticket of tickets) for (const request of ticket.requests || []) {
      if (!canHandle(ticket, request, req.user)) continue;
      const { viewedBy, history, requestedBy, dismissalKey: unusedKey, day, ...safe } = request;
      all.push({ ...safe, ticketId: String(ticket._id), title: ticket.title, ticketStatus: ticket.status,
        isArchived: Boolean(ticket.isArchived), requester: ticket.submittedBy,
        read: (viewedBy || []).some(v => idOf(v.user) === req.user.id) });
    }
    const counts = { outstanding: all.filter(r => r.state !== 'completed').length, unread: all.filter(r => !r.read).length };
    const needle = search.trim().toLowerCase();
    const filtered = all.filter(r => (!type || r.type === type) && (!state || r.state === state) &&
      (!needle || r.title.toLowerCase().includes(needle) || r.ticketId.toLowerCase() === needle || String(r._id).toLowerCase() === needle))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || String(b._id).localeCompare(String(a._id)));
    const limit = Number(rawLimit), pages = Math.max(1, Math.ceil(filtered.length / limit)), page = Math.min(Number(rawPage), pages);
    res.json({ items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, pages, counts });
  } catch (error) { sendProblem(res, error); }
};
module.exports = { createRequest, handleRequest, getRequests, revertStatus };
