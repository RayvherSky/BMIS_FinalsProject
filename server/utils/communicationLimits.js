const mongoose = require('mongoose');
const Quota = require('../models/CommunicationQuota');
const limits = require('../config/communicationLimits');
const { problem } = require('./ticketLifecycle');
function limited(next, now = new Date(), message = "You've reached the limit for this action. Please try again later.") {
  return problem(429, message, { retryAfter: Math.max(1, Math.ceil((next - now) / 1000)), nextAllowedAt: next });
}
function checkNote(ticket, actor, text, isPrivate, now = new Date()) {
  const own = (ticket.notes || []).filter(n => String(n.addedBy?._id || n.addedBy) === actor.id);
  if (own.some(n => n.text.trim() === text && Boolean(n.isPrivate) === isPrivate && new Date(n.createdAt).getTime() > now.getTime() - limits.duplicateSeconds * 1000)) {
    throw problem(409, 'This message was already posted. Refresh the ticket to see it.');
  }
  const recent = own.filter(n => new Date(n.createdAt).getTime() > now.getTime() - 60000).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const maximum = actor.role === 'user' ? limits.userNotesPerMinute : limits.staffNotesPerMinute;
  if (recent.length >= maximum) throw limited(new Date(new Date(recent[recent.length - maximum].createdAt).getTime() + 60000), now);
}
async function reserve(actor, now = new Date()) {
  const maximum = actor.role === 'user' ? limits.userSubmissionsPerTenMinutes : limits.staffSubmissionsPerTenMinutes;
  const cutoff = new Date(now.getTime() - 600000);
  const kept = { $filter: { input: { $ifNull: ['$events', []] }, as: 'event', cond: { $gt: ['$$event.at', cutoff] } } };
  const entry = { _id: new mongoose.Types.ObjectId(), at: now };
  // MongoDB forbids $expr in an upsert predicate. Create the empty bucket by
  // its unique ID first, then reserve against the atomic capacity predicate.
  try {
    await Quota.updateOne({ _id: actor.id }, { $setOnInsert: { events: [], touchedAt: now } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const row = await Quota.findOneAndUpdate({ _id: actor.id, $expr: { $lt: [{ $size: kept }, maximum] } },
    [{ $set: { events: { $concatArrays: [kept, [entry]] }, touchedAt: now } }], { new: true });
  if (!row) {
    const existing = await Quota.findById(actor.id).lean();
    const times = (existing?.events || []).filter(e => new Date(e.at) > cutoff).map(e => new Date(e.at).getTime()).sort((a, b) => a - b);
    // A TTL cleanup can remove an idle bucket between initialization and reservation.
    if (times.length < maximum) return reserve(actor, now);
    throw limited(new Date(times[times.length - maximum] + 600000), now);
  }
  return async () => { await Quota.updateOne({ _id: actor.id }, { $pull: { events: { _id: entry._id } } }); };
}
module.exports = { reserve, checkNote, limited };
