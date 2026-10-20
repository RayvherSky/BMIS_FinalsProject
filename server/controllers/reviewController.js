const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const { withAccountLock, withTicketLock } = require('../utils/accountLock');
const { populateTicket, serializeTicket, canRead, idOf } = require('../utils/ticketAccess');
const { predicate, problem, currentActor, sendProblem } = require('../utils/ticketLifecycle');
const { eligible, boundReview, pendingReview, assignmentGuard, reviewEvent, markReviewed } = require('../utils/reviewPolicy');

const validId = value => typeof value === 'string' && mongoose.isObjectIdOrHexString(value);
async function mutate(req, res, operation) {
  try {
    if (!validId(req.params.id)) throw problem(404, 'Ticket not found');
    await withAccountLock(req.user.id, () => withTicketLock(req.params.id, async () => {
      await currentActor(req.user);
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket || !canRead(ticket, req.user)) throw problem(404, 'Ticket not found');
      if (req.user.role === 'employee' && !eligible(ticket)) throw problem(404, 'Ticket not found');
      const { update, code = 200 } = operation(ticket, req.user, new Date());
      update.$inc = { workflowVersion: 1 };
      const saved = await Ticket.findOneAndUpdate(predicate(ticket, assignmentGuard(ticket)), update, { new: true, runValidators: true });
      if (!saved) {
        const current = await Ticket.findById(ticket._id);
        if (req.user.role === 'employee' && (!current || !canRead(current, req.user) || !eligible(current))) throw problem(404, 'Ticket not found');
        throw problem(409, 'The ticket changed. Refresh and try again.');
      }
      const updated = await populateTicket(Ticket.findById(ticket._id), req.user.role);
      if (!updated || !canRead(updated, req.user) || (req.user.role === 'employee' && !eligible(updated))) throw problem(404, 'Ticket not found');
      res.status(code).json(serializeTicket(updated, req.user));
    }));
  } catch (error) { sendProblem(res, error); }
}
const requestReview = (req, res) => mutate(req, res, (ticket, actor, now) => {
  if (pendingReview(ticket)) throw problem(409, 'A review request is already pending.');
  const review = { status: 'pending', requestedBy: actor.id, requestedAt: now, reviewedBy: null, reviewedAt: null,
    assignmentId: ticket.assignedTo, assignedAt: ticket.assignedAt || null };
  return { code: 201, update: { $set: { review }, $push: { reviewHistory: reviewEvent(ticket, 'requested', actor, now, 'employee', review) } } };
});
const completeReview = (req, res) => mutate(req, res, (ticket, actor, now) => {
  if (req.body.action !== 'reviewed') throw problem(400, 'Choose Mark Reviewed to complete this review.');
  if (!pendingReview(ticket)) throw problem(409, 'An Employee must request review for the current assignment first.');
  return { update: markReviewed(ticket, actor, now, 'explicit') };
});
const getReviews = async (req, res) => {
  try {
    const { status = 'pending', search = '', page: rawPage = '1', limit: rawLimit = '10' } = req.query;
    if ([status, search, rawPage, rawLimit].some(value => typeof value !== 'string') || !['pending', 'reviewed'].includes(status) ||
      !/^\d+$/.test(rawPage) || !Number.isSafeInteger(Number(rawPage)) || Number(rawPage) < 1 ||
      !/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50) throw problem(400, 'Invalid review filters or pagination');
    const tickets = await populateTicket(Ticket.find({ assignedTo: { $ne: null }, isArchived: { $ne: true },
      status: { $in: ['Pending', 'In Progress'] }, 'review.status': { $in: ['pending', 'reviewed'] } }), 'admin');
    const all = tickets.filter(ticket => eligible(ticket) && boundReview(ticket));
    const counts = { pending: all.filter(ticket => ticket.review.status === 'pending').length,
      reviewed: all.filter(ticket => ticket.review.status === 'reviewed').length };
    const needle = search.trim().toLowerCase();
    const filtered = all.filter(ticket => ticket.review.status === status && (!needle || ticket.title.toLowerCase().includes(needle) || idOf(ticket) === needle))
      .sort((a, b) => new Date(b.review.requestedAt) - new Date(a.review.requestedAt) || idOf(b).localeCompare(idOf(a)));
    const limit = Number(rawLimit), pages = Math.max(1, Math.ceil(filtered.length / limit)), page = Math.min(Number(rawPage), pages);
    res.json({ items: filtered.slice((page - 1) * limit, page * limit).map(ticket => serializeTicket(ticket, req.user)),
      total: filtered.length, page, pages, counts });
  } catch (error) { sendProblem(res, error); }
};
module.exports = { requestReview, completeReview, getReviews };
