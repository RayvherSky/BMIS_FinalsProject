const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { populateTicket, serializeTicket, idOf } = require('../utils/ticketAccess');
const { withAccountLock, withTicketLock } = require('../utils/accountLock');
const escapeSearch = require('../utils/escapeSearch');
const { predicate, problem, sendProblem } = require('../utils/ticketLifecycle');

// @desc    Get all archived tickets
// @route   GET /api/archive
// @access  Private (Admin)
const getArchivedTickets = async (req, res) => {
  try {
    const { category, status, priority, search } = req.query;
    if (search !== undefined && typeof search !== 'string') {
      return res.status(400).json({ message: 'Search must be text' });
    }

    const filter = { isArchived: true };

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (search) {
      filter.$or = [
        { title: { $regex: escapeSearch(search), $options: 'i' } },
        { description: { $regex: escapeSearch(search), $options: 'i' } },
      ];
    }

    const tickets = await populateTicket(Ticket.find(filter), 'admin')
      .sort({ archivedAt: -1, updatedAt: -1 });

    res.status(200).json(tickets.map(ticket => serializeTicket(ticket, { role: 'admin' })));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Archive a ticket (only Resolved or Dismissed)
// @route   PUT /api/archive/:id/archive
// @access  Private (Admin)
const archiveTicket = async (req, res) => {
  try {
    await withTicketLock(req.params.id, async () => {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Only allow archiving Resolved or Dismissed tickets
    if (ticket.status !== 'Resolved' && ticket.status !== 'Dismissed') {
      return res.status(400).json({
        message: 'Only Resolved or Dismissed tickets can be archived',
      });
    }

    if (ticket.isArchived) {
      return res.status(400).json({ message: 'Ticket is already archived' });
    }

    const saved = await Ticket.findOneAndUpdate(predicate(ticket),
      { $set: { isArchived: true, archivedAt: new Date() }, $inc: { workflowVersion: 1 } }, { new: true });
    if (!saved) throw problem(409, 'Ticket changed. Refresh and retry archiving.');

    const archivedTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');

    res.status(200).json(serializeTicket(archivedTicket, req.user));
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    sendProblem(res, error);
  }
};

// @desc    Restore an archived ticket
// @route   PUT /api/archive/:id/restore
// @access  Private (Admin)
const restoreTicket = async (req, res) => {
  try {
    const snapshot = await Ticket.findById(req.params.id);
    if (!snapshot) return res.status(404).json({ message: 'Ticket not found' });
    const employeeId = idOf(snapshot.assignedTo) || null;
    const work = () => withTicketLock(req.params.id, async () => {
      // Both ticket and account must be read again after acquiring the same
      // eligibility lock used by assignment and account transitions.
      const ticket = await Ticket.findById(req.params.id);
      if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
      if (!ticket.isArchived) return res.status(400).json({ message: 'Ticket is not archived' });
      if ((idOf(ticket.assignedTo) || null) !== employeeId) {
        return res.status(409).json({ message: 'Ticket assignment changed; refresh and retry restore' });
      }
      const update = { $set: { isArchived: false, archivedAt: null }, $inc: { workflowVersion: 1 } };
      if (employeeId) {
        const employee = await User.findById(employeeId).select('role isActive');
        if (!employee || employee.role !== 'employee' || employee.isActive === false) {
          update.$push = { assignmentHistory: { previousEmployee: employeeId, newEmployee: null,
            changedBy: req.user.id, createdAt: new Date(), action: 'unassigned',
            reason: 'Restored report: previous Employee is unavailable' } };
          Object.assign(update.$set, { assignedTo: null, assignedAt: null });
        }
      }
      const saved = await Ticket.findOneAndUpdate(predicate(ticket), update, { new: true });
      if (!saved) throw problem(409, 'Ticket changed. Refresh and retry restoration.');
      const restoredTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');
      res.status(200).json(serializeTicket(restoredTicket, req.user));
    });
    if (employeeId) await withAccountLock(employeeId, work);
    else await work();
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    sendProblem(res, error);
  }
};

module.exports = {
  getArchivedTickets,
  archiveTicket,
  restoreTicket,
};
