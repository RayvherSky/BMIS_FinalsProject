const Ticket = require('../models/Ticket');

// Call under the target account lock. The query is rechecked by MongoDB for
// every document, so a concurrent reassignment away from this account survives.
async function clearAssignments(employeeId, changedBy, reason) {
  const result = await Ticket.updateMany(
    { assignedTo: employeeId, isArchived: { $ne: true } },
    {
      $set: { assignedTo: null, assignedAt: null },
      $inc: { workflowVersion: 1 },
      $push: { assignmentHistory: { previousEmployee: employeeId, newEmployee: null, changedBy, createdAt: new Date(), action: 'unassigned', reason } },
    },
  );
  if (!result.acknowledged) throw new Error('Assignment cleanup was not acknowledged');
  if (await Ticket.exists({ assignedTo: employeeId, isArchived: { $ne: true } })) {
    throw new Error('Assignment cleanup incomplete; retry the account change');
  }
}

module.exports = { clearAssignments };
