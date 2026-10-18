const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { populateTicket, serializeTicket, idOf } = require('../utils/ticketAccess');
const { withAccountLock, withTicketLock } = require('../utils/accountLock');
const escapeSearch = require('../utils/escapeSearch');

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

    ticket.isArchived = true;
    ticket.archivedAt = new Date();
    await ticket.save();

    const archivedTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');

    res.status(200).json(serializeTicket(archivedTicket, req.user));
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
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
      if (employeeId) {
        const employee = await User.findById(employeeId).select('role isActive');
        if (!employee || employee.role !== 'employee' || employee.isActive === false) {
          ticket.assignmentHistory.push({ previousEmployee: employeeId, newEmployee: null,
            changedBy: req.user.id, createdAt: new Date(), action: 'unassigned',
            reason: 'Restored report: previous Employee is unavailable' });
          ticket.assignedTo = null;
          ticket.assignedAt = null;
        }
      }
      ticket.isArchived = false;
      ticket.archivedAt = null;
      await ticket.save();
      const restoredTicket = await populateTicket(Ticket.findById(ticket._id), 'admin');
      res.status(200).json(serializeTicket(restoredTicket, req.user));
    });
    if (employeeId) await withAccountLock(employeeId, work);
    else await work();
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getArchivedTickets,
  archiveTicket,
  restoreTicket,
};
