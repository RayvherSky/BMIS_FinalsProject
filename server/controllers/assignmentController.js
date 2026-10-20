const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { withAccountLock, withTicketLock } = require('../utils/accountLock');
const { populateTicket, serializeTicket, idOf } = require('../utils/ticketAccess');
const { statusEvent, predicate } = require('../utils/ticketLifecycle');
const { assignmentGuard, invalidateReview, mergeReviewUpdate } = require('../utils/reviewPolicy');

const assignTicket = async (req, res) => {
  try {
    const candidate = req.body.assignedTo;
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(404).json({ message: 'Ticket not found' });
    if (candidate !== null && (typeof candidate !== 'string' || !mongoose.isObjectIdOrHexString(candidate))) {
      return res.status(400).json({ message: 'Choose an active Employee or null to unassign' });
    }
    const assignedTo = candidate === null ? null : candidate.toLowerCase();
    const work = () => withTicketLock(req.params.id, async () => {
      if (assignedTo) {
        const employee = await User.findById(assignedTo).select('role isActive');
        if (!employee || employee.role !== 'employee' || employee.isActive === false) {
          return res.status(400).json({ message: 'Choose an active Employee' });
        }
      }
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
      if (ticket.isArchived) return res.status(400).json({ message: 'Archived tickets cannot be assigned' });
      const previousEmployee = idOf(ticket.assignedTo) || null;
      if (previousEmployee !== assignedTo) {
        const now = new Date();
        const update = { $set: { assignedTo, assignedAt: assignedTo ? now : null, ...(assignedTo && ticket.status === 'Pending' ? { status: 'In Progress' } : {}) },
            $inc: { workflowVersion: 1 },
            $push: { assignmentHistory: { previousEmployee, newEmployee: assignedTo, changedBy: req.user.id, createdAt: now, action: !assignedTo ? 'unassigned' : previousEmployee ? 'reassigned' : 'assigned' },
              ...(assignedTo && ticket.status === 'Pending' ? { statusHistory: statusEvent(ticket, 'In Progress', req.user, 'assignment', '', now) } : {}) } };
        mergeReviewUpdate(update, invalidateReview(ticket, req.user, now, 'assignment'));
        const updated = await Ticket.findOneAndUpdate(
          predicate(ticket, assignmentGuard(ticket)), update,
          { new: true, runValidators: true },
        );
        if (!updated) return res.status(409).json({ message: 'Ticket changed; refresh and retry assignment' });
      }
      const result = await populateTicket(Ticket.findById(ticket._id), 'admin');
      res.status(200).json(serializeTicket(result, req.user));
    });
    if (assignedTo) await withAccountLock(assignedTo, work);
    else await work();
  } catch (error) {
    res.status(500).json({ message: 'Assignment failed', error: error.message });
  }
};

module.exports = { assignTicket };
