const Ticket = require('../models/Ticket');
const mongoose = require('mongoose');

// Call under the target account lock. The query is rechecked by MongoDB for
// every document, so a concurrent reassignment away from this account survives.
async function clearAssignments(employeeId, changedBy, reason) {
  const now = new Date();
  const actor = new mongoose.Types.ObjectId(changedBy);
  const employee = new mongoose.Types.ObjectId(employeeId);
  const result = await Ticket.updateMany(
    { assignedTo: employeeId, isArchived: { $ne: true } },
    [{ $set: {
      assignedTo: null, assignedAt: null, review: null,
      workflowVersion: { $add: [{ $ifNull: ['$workflowVersion', 0] }, 1] },
      updatedAt: now,
      assignmentHistory: { $concatArrays: [{ $ifNull: ['$assignmentHistory', []] }, [
        { previousEmployee: employee, newEmployee: null, changedBy: actor, createdAt: now, action: 'unassigned', reason },
      ]] },
      reviewHistory: { $concatArrays: [{ $ifNull: ['$reviewHistory', []] }, { $cond: [
        { $ne: [{ $ifNull: ['$review', null] }, null] }, [
          { action: 'invalidated', actor, createdAt: now, requestedBy: '$review.requestedBy', requestedAt: '$review.requestedAt',
            assignmentId: '$review.assignmentId', assignedAt: '$review.assignedAt', source: 'account_transition' },
        ], [],
      ] }] },
    } }],
  );
  if (!result.acknowledged) throw new Error('Assignment cleanup was not acknowledged');
  if (await Ticket.exists({ assignedTo: employeeId, isArchived: { $ne: true } })) {
    throw new Error('Assignment cleanup incomplete; retry the account change');
  }
}

module.exports = { clearAssignments };
