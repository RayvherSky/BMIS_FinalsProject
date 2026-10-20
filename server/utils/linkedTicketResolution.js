const Ticket = require('../models/Ticket');
const { withTicketLock } = require('./accountLock');
const { predicate, problem, statusEvent } = require('./ticketLifecycle');
const { assignmentGuard, pendingReview, markReviewed, invalidateReview, mergeReviewUpdate } = require('./reviewPolicy');

// Links are stored on duplicates only. Follow both directions so resolving any
// member reaches the entire group, including chains and pre-existing cycles.
// The caller holds the group-resolution lock and the selected ticket's lock.
async function resolveLinkedTickets(selected, actor, now) {
  const group = new Map([[String(selected._id), selected]]);
  const queue = [selected];
  for (let index = 0; index < queue.length; index++) {
    const ticket = queue[index];
    const neighbors = await Ticket.find({ linkedTicket: ticket._id });
    if (ticket.linkedTicket) {
      const parent = await Ticket.findById(ticket.linkedTicket);
      if (parent) neighbors.push(parent);
    }
    for (const neighbor of neighbors) {
      const id = String(neighbor._id);
      if (group.has(id)) continue;
      group.set(id, neighbor);
      queue.push(neighbor);
    }
  }

  for (const id of group.keys()) {
    if (id === String(selected._id)) continue;
    await withTicketLock(id, async () => {
      const current = await Ticket.findById(id);
      if (!current || current.status === 'Resolved') return;
      const update = {
        $set: { status: 'Resolved', resolvedAt: now, dismissedAt: null, isArchived: true,
          archivedAt: current.isArchived && current.archivedAt ? current.archivedAt : now },
        $inc: { workflowVersion: 1 },
        $push: { statusHistory: statusEvent(current, 'Resolved', actor, 'status',
          `Resolved with linked ticket ${selected._id}`, now) },
      };
      mergeReviewUpdate(update, pendingReview(current)
        ? markReviewed(current, actor, now, 'linked_resolution')
        : invalidateReview(current, actor, now, 'linked_resolution'));
      const saved = await Ticket.findOneAndUpdate(predicate(current, assignmentGuard(current)), update,
        { new: true, runValidators: true });
      if (!saved) throw problem(409, 'A linked ticket changed. Refresh and retry the resolution to finish resolving the group.');
    });
  }
}

module.exports = { resolveLinkedTickets };
