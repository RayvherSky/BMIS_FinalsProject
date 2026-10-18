const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { withAccountLock, withTicketLock } = require('../utils/accountLock');
const { populateTicket, serializeTicket, idOf } = require('../utils/ticketAccess');

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
        const updated = await Ticket.findOneAndUpdate(
          { _id: ticket._id, assignedTo: previousEmployee, isArchived: { $ne: true }, status: ticket.status },
          { $set: { assignedTo, assignedAt: assignedTo ? now : null, ...(assignedTo && ticket.status === 'Pending' ? { status: 'In Progress' } : {}) },
            $push: { assignmentHistory: { previousEmployee, newEmployee: assignedTo, changedBy: req.user.id, createdAt: now, action: !assignedTo ? 'unassigned' : previousEmployee ? 'reassigned' : 'assigned' } } },
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
