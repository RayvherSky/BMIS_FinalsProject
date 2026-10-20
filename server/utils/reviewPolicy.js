const idOf = value => value?._id?.toString() || value?.toString();
const timeOf = value => value ? new Date(value).getTime() : null;

function eligible(ticket) {
  return Boolean(ticket && ticket.assignedTo && !ticket.isArchived && ['Pending', 'In Progress'].includes(ticket.status));
}
function boundReview(ticket) {
  const review = ticket?.review;
  return Boolean(review && idOf(review.requestedBy) === idOf(ticket.assignedTo) &&
    idOf(review.assignmentId) === idOf(ticket.assignedTo) && timeOf(review.assignedAt) === timeOf(ticket.assignedAt));
}
function pendingReview(ticket) {
  return eligible(ticket) && boundReview(ticket) && ticket.review.status === 'pending';
}
function assignmentGuard(ticket) {
  return { assignedTo: ticket.assignedTo?._id || ticket.assignedTo || null, assignedAt: ticket.assignedAt || null };
}
function reviewEvent(ticket, action, actor, now, source, review = ticket.review) {
  return { action, actor: actor.id, createdAt: now, requestedBy: review?.requestedBy,
    requestedAt: review?.requestedAt, assignmentId: review?.assignmentId, assignedAt: review?.assignedAt, source };
}
function markReviewed(ticket, actor, now, source) {
  return { $set: { 'review.status': 'reviewed', 'review.reviewedBy': actor.id, 'review.reviewedAt': now },
    $push: { reviewHistory: reviewEvent(ticket, 'reviewed', actor, now, source) } };
}
function invalidateReview(ticket, actor, now, source) {
  return ticket.review ? { $set: { review: null }, $push: { reviewHistory: reviewEvent(ticket, 'invalidated', actor, now, source) } } : {};
}
function mergeReviewUpdate(update, change) {
  for (const operation of ['$set', '$push']) {
    if (change[operation]) update[operation] = { ...update[operation], ...change[operation] };
  }
  return update;
}
module.exports = { eligible, boundReview, pendingReview, assignmentGuard, reviewEvent, markReviewed, invalidateReview, mergeReviewUpdate };
