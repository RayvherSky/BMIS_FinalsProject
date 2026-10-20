const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createTestDatabase } = require('./helpers/testDatabase');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

let database, server, base, accounts;
before(async () => {
  process.env.JWT_SECRET = 'isolated-employee-review-tests';
  database = await createTestDatabase('employee_review');
  await mongoose.connect(database.getUri('employee_review'));
  const app = express(); app.use(express.json());
  app.use('/api/tickets', require('../routes/ticketRoutes'));
  app.use('/api/users', require('../routes/userRoutes'));
  app.use('/api/archive', require('../routes/archiveRoutes'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await mongoose.disconnect(); if (database) await database.stop();
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  accounts = {};
  for (const name of ['admin', 'employee', 'employee2', 'user', 'other']) {
    const row = { _id: new mongoose.Types.ObjectId(), firstName: name, lastName: 'Review',
      email: `${name}@example.test`, password: 'unused', isActive: true, phone: '09171234567',
      role: name === 'other' ? 'user' : name === 'employee2' ? 'employee' : name };
    await User.collection.insertOne(row); accounts[name] = row;
  }
});
async function send(path, who = 'admin', body, method = body === undefined ? 'GET' : 'POST') {
  const token = who && jwt.sign({ id: String(accounts[who]._id) }, process.env.JWT_SECRET);
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
const ticketPath = row => `/tickets/${row._id}`;
async function report(fields = {}) {
  return Ticket.create({ title: 'Employee review report', description: 'Inspect the drainage.', category: 'Infrastructure',
    location: 'Baclaran', submittedBy: accounts.user._id, ...fields });
}
async function assigned(fields = {}) {
  return report({ status: 'In Progress', assignedTo: accounts.employee._id, assignedAt: new Date('2026-10-19T01:00:00Z'), ...fields });
}
const ask = (row, who = 'employee') => send(`${ticketPath(row)}/review`, who, {});
const review = row => send(`${ticketPath(row)}/review`, 'admin', { action: 'reviewed' }, 'PATCH');
const note = (row, text, who = 'admin', isPrivate = false) => send(`${ticketPath(row)}/notes`, who, { text, isPrivate });
const status = (row, value) => send(`${ticketPath(row)}/status`, 'admin', { status: value }, 'PUT');

test('Employees request review only for their current active assignments and Users never receive review metadata', async () => {
  const row = await assigned();
  for (const who of ['admin', 'user', null]) assert.equal((await ask(row, who)).status, who ? 403 : 401);
  assert.equal((await ask(row, 'employee2')).status, 404);
  const result = await ask(row);
  assert.equal(result.status, 201); assert.equal(result.body.review.status, 'pending');
  assert.equal(String(result.body.review.requestedBy._id || result.body.review.requestedBy), String(accounts.employee._id));
  assert.ok(result.body.review.requestedAt); assert.equal(result.body.status, 'In Progress');
  const own = await send(ticketPath(row), 'user');
  assert.equal(own.body.review, undefined); assert.equal(own.body.reviewHistory, undefined);
  for (const fields of [{ isArchived: true }, { status: 'Dismissed' }, { status: 'Resolved' }]) {
    assert.equal((await ask(await assigned(fields))).status, 404);
  }
});

test('concurrent review requests create one pending review and cannot overwrite its original request time', async () => {
  const row = await assigned();
  const results = await Promise.all(Array.from({ length: 6 }, () => ask(row)));
  assert.equal(results.filter(result => result.status === 201).length, 1);
  assert.ok(results.filter(result => result.status !== 201).every(result => result.status === 409));
  const saved = await Ticket.findById(row._id);
  assert.equal(saved.reviewHistory.filter(event => event.action === 'requested').length, 1);
  assert.equal(saved.review.requestedAt.toISOString(), results.find(result => result.status === 201).body.review.requestedAt);
});

test('Admin review queue is separate from User requests and filters current review eligibility', async () => {
  const row = await assigned(); await ask(row);
  await report({ requests: [{ type: 'follow_up', state: 'pending', requestedBy: accounts.user._id }] });
  for (const who of ['employee', 'user']) assert.equal((await send('/tickets/reviews', who)).status, 403);
  let result = await send('/tickets/reviews');
  assert.equal(result.status, 200); assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0]._id, String(row._id)); assert.equal(result.body.counts.pending, 1);
  await review(row);
  result = await send('/tickets/reviews');
  assert.equal(result.body.items.length, 0); assert.equal(result.body.counts.reviewed, 1);
  assert.equal((await send('/tickets/reviews?status=reviewed')).body.items.length, 1);
  assert.equal((await send('/tickets/reviews?status=invalid')).status, 400);
});

test('assigned-ticket Admin public updates require pending review while internal notes and Employee updates remain available', async () => {
  const row = await assigned();
  assert.equal((await note(row, 'Unreviewed public update')).status, 409);
  assert.equal((await note(row, 'Internal triage', 'admin', true)).status, 200);
  assert.equal((await note(row, 'Employee findings', 'employee')).status, 200);
  assert.equal((await Ticket.findById(row._id)).review, undefined);
  assert.equal((await note(await report(), 'Unassigned Admin triage')).status, 200);
});

test('a normal Admin public update atomically completes pending review and a later update needs a new request', async () => {
  const row = await assigned(); await ask(row);
  const result = await note(row, 'Reviewed public update');
  assert.equal(result.status, 200); assert.equal(result.body.review.status, 'reviewed');
  assert.equal(String(result.body.review.reviewedBy._id || result.body.review.reviewedBy), String(accounts.admin._id));
  const saved = await Ticket.findById(row._id);
  assert.equal(saved.notes.length, 1); assert.equal(saved.notes[0].createdAt.toISOString(), saved.review.reviewedAt.toISOString());
  assert.equal(saved.reviewHistory.filter(event => event.action === 'reviewed').length, 1);
  assert.equal((await note(row, 'A second public update')).status, 409);
  assert.equal((await ask(row)).status, 201);
});

test('assigned-ticket resolution needs pending review and saves review, lifecycle event and archive together', async () => {
  const row = await assigned();
  assert.equal((await status(row, 'Resolved')).status, 409);
  assert.equal((await Ticket.findById(row._id)).status, 'In Progress');
  await ask(row);
  const result = await status(row, 'Resolved');
  assert.equal(result.status, 200); assert.equal(result.body.status, 'Resolved'); assert.equal(result.body.isArchived, true);
  assert.equal(result.body.review.status, 'reviewed'); assert.equal(result.body.review.reviewedAt, result.body.resolvedAt);
  assert.equal(result.body.statusHistory.at(-1).to, 'Resolved');
  const repeated = await status(row, 'Resolved');
  assert.equal(repeated.status, 200); assert.equal(repeated.body.resolvedAt, result.body.resolvedAt);
});

test('explicit Mark Reviewed requires pending review and changes no notes or ticket status', async () => {
  const row = await assigned();
  assert.equal((await review(row)).status, 409);
  assert.equal((await send(`${ticketPath(row)}/review`, 'employee', { action: 'reviewed' }, 'PATCH')).status, 403);
  await ask(row);
  const results = await Promise.all([review(row), review(row)]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  const saved = await Ticket.findById(row._id);
  assert.equal(saved.review.status, 'reviewed'); assert.equal(saved.status, 'In Progress'); assert.equal(saved.notes.length, 0);
  assert.equal((await note(row, 'Already reviewed is not a new request')).status, 409);
});

test('reassignment invalidates review and an earlier assignment cannot grant review to a later assignee', async () => {
  const row = await assigned(); await ask(row);
  const moved = await send(`${ticketPath(row)}/assign`, 'admin', { assignedTo: String(accounts.employee2._id) }, 'PATCH');
  assert.equal(moved.status, 200); assert.ok(!moved.body.review);
  assert.equal((await ask(row)).status, 404); assert.equal((await note(row, 'Stale review')).status, 409);
  assert.equal((await ask(row, 'employee2')).status, 201);
  assert.equal((await review(row)).status, 200);
  await send(`${ticketPath(row)}/assign`, 'admin', { assignedTo: String(accounts.employee._id) }, 'PATCH');
  assert.ok(!(await Ticket.findById(row._id)).review);
});

test('account deactivation invalidates pending review while removing current assignments', async () => {
  const row = await assigned(); await ask(row);
  const result = await send(`/users/${accounts.employee._id}/active`, 'admin', { isActive: false, confirmationEmail: accounts.employee.email }, 'PATCH');
  assert.equal(result.status, 200);
  const saved = await Ticket.findById(row._id);
  assert.equal(saved.assignedTo, null); assert.ok(!saved.review);
  assert.equal((await send('/tickets/reviews')).body.items.length, 0);
});

test('dismissal and reopening invalidate an old pending review without gating Admin triage', async () => {
  const row = await assigned(); await ask(row);
  assert.equal((await status(row, 'Dismissed')).status, 200);
  assert.ok(!(await Ticket.findById(row._id)).review);
  const reopened = await send(`${ticketPath(row)}/revert`, 'admin', { status: 'In Progress', reason: 'Continue inspection.' });
  assert.equal(reopened.status, 200); assert.equal((await note(row, 'Old review must not revive')).status, 409);
});

test('User request responses and appeal decisions remain exempt from Employee review gating', async () => {
  const row = await assigned();
  let created = await send(`${ticketPath(row)}/requests`, 'user', { type: 'progress_update', message: 'Any progress?' });
  let result = await send(`${ticketPath(row)}/requests/${created.body.requests[0]._id}`, 'admin', { action: 'respond', text: 'Inspection is scheduled.' }, 'PATCH');
  assert.equal(result.status, 200); assert.ok(!result.body.review);
  await status(row, 'Dismissed');
  created = await send(`${ticketPath(row)}/requests`, 'user', { type: 'appeal', message: 'The drainage remains blocked.' });
  result = await send(`${ticketPath(row)}/requests/${created.body.requests.at(-1)._id}`, 'admin', { action: 'decide', decision: 'accepted', text: 'Reopening for another inspection.', status: 'In Progress' }, 'PATCH');
  assert.equal(result.status, 200); assert.equal(result.body.status, 'In Progress'); assert.ok(!result.body.review);
});

test('Admin resolution also resolves assigned linked reports without a separate review request', async () => {
  const primary = await report({ status: 'In Progress' });
  const child = await assigned({ linkedTicket: primary._id });
  assert.equal((await status(primary, 'Resolved')).status, 200);
  const saved = await Ticket.findById(child._id);
  assert.equal(saved.status, 'Resolved'); assert.equal(saved.isArchived, true);
  assert.equal(saved.statusHistory.at(-1).to, 'Resolved');
  assert.equal(String(saved.statusHistory.at(-1).changedBy), String(accounts.admin._id));
  assert.match(saved.statusHistory.at(-1).reason, new RegExp(String(primary._id)));
});

test('resolving any linked report resolves its parent, siblings and chained duplicates only once', async () => {
  const parent = await report({ status: 'In Progress' });
  const selected = await report({ linkedTicket: parent._id, status: 'In Progress' });
  const sibling = await report({ linkedTicket: parent._id });
  const descendant = await report({ linkedTicket: sibling._id });
  const unrelated = await report();
  // Existing links may form a cycle; traversal must terminate and preserve them.
  await Ticket.updateOne({ _id: parent._id }, { $set: { linkedTicket: descendant._id } });
  const result = await status(selected, 'Resolved');
  assert.equal(result.status, 200);
  for (const row of [parent, selected, sibling, descendant]) {
    const saved = await Ticket.findById(row._id);
    assert.equal(saved.status, 'Resolved'); assert.equal(saved.isArchived, true);
    assert.equal(saved.resolvedAt.toISOString(), result.body.resolvedAt);
    assert.equal(saved.archivedAt.toISOString(), result.body.archivedAt);
    assert.equal(saved.statusHistory.length, 1);
    assert.equal(saved.workflowVersion, 1);
    assert.ok(saved.linkedTicket);
  }
  assert.equal((await Ticket.findById(unrelated._id)).status, 'Pending');
  assert.equal((await status(selected, 'Resolved')).status, 200);
  for (const row of [parent, selected, sibling, descendant]) {
    const saved = await Ticket.findById(row._id);
    assert.equal(saved.statusHistory.length, 1);
    assert.equal(saved.resolvedAt.toISOString(), result.body.resolvedAt);
  }
});

test('a rejected assigned-ticket resolution leaves every linked report unchanged', async () => {
  const parent = await assigned();
  const child = await report({ linkedTicket: parent._id });
  assert.equal((await status(parent, 'Resolved')).status, 409);
  assert.equal((await Ticket.findById(child._id)).status, 'Pending');
  await ask(parent);
  assert.equal((await status(parent, 'Resolved')).status, 200);
  assert.equal((await Ticket.findById(child._id)).status, 'Resolved');
});

test('linked resolution completes pending employee reviews and preserves earlier resolution timestamps', async () => {
  const parent = await report({ status: 'In Progress' });
  const child = await assigned({ linkedTicket: parent._id });
  await ask(child);
  const resolvedAt = new Date('2026-10-01T00:00:00Z');
  const earlier = await report({ linkedTicket: child._id, status: 'Resolved', isArchived: true, resolvedAt, archivedAt: resolvedAt });
  assert.equal((await status(parent, 'Resolved')).status, 200);
  const saved = await Ticket.findById(child._id);
  assert.equal(saved.status, 'Resolved'); assert.equal(saved.review.status, 'reviewed');
  assert.equal(saved.review.reviewedAt.toISOString(), saved.resolvedAt.toISOString());
  assert.equal(saved.reviewHistory.at(-1).source, 'linked_resolution');
  const unchanged = await Ticket.findById(earlier._id);
  assert.equal(unchanged.resolvedAt.toISOString(), resolvedAt.toISOString());
  assert.equal(unchanged.statusHistory.length, 0);
});

test('other Admin status changes do not propagate and Employees and Users cannot resolve a linked group', async () => {
  const parent = await report();
  const child = await report({ linkedTicket: parent._id });
  for (const who of ['employee', 'user']) {
    assert.equal((await send(`${ticketPath(parent)}/status`, who, { status: 'Resolved' }, 'PUT')).status, 403);
  }
  assert.equal((await status(parent, 'In Progress')).status, 200);
  assert.equal((await Ticket.findById(child._id)).status, 'Pending');
  assert.equal((await status(parent, 'Dismissed')).status, 200);
  assert.equal((await Ticket.findById(child._id)).status, 'Pending');
});

test('review mutation rejects reassignment at the database predicate and does not persist the stale request', async t => {
  const row = await assigned();
  const original = Ticket.findOneAndUpdate.bind(Ticket); let changed = false;
  t.mock.method(Ticket, 'findOneAndUpdate', async (...args) => {
    if (!changed) {
      changed = true;
      await Ticket.collection.updateOne({ _id: row._id }, { $set: { assignedTo: accounts.employee2._id, assignedAt: new Date() }, $inc: { workflowVersion: 1 } });
    }
    return original(...args);
  });
  assert.equal((await ask(row)).status, 404);
  assert.ok(!(await Ticket.findById(row._id)).review);
});

test('a failed Admin public update cannot complete review after concurrent reassignment', async t => {
  const row = await assigned(); await ask(row);
  const original = Ticket.findOneAndUpdate.bind(Ticket); let changed = false;
  t.mock.method(Ticket, 'findOneAndUpdate', async (...args) => {
    if (!changed && args[1].$push?.notes) {
      changed = true;
      await Ticket.collection.updateOne({ _id: row._id }, { $set: { assignedTo: accounts.employee2._id, assignedAt: new Date() }, $inc: { workflowVersion: 1 } });
    }
    return original(...args);
  });
  assert.equal((await note(row, 'Must not post')).status, 409);
  const saved = await Ticket.findById(row._id);
  assert.equal(saved.notes.length, 0); assert.equal(saved.review.status, 'pending');
});

const submission = { title: 'Submission contact', description: 'Inspect the market.', category: 'Infrastructure', location: 'Baclaran' };
test('ticket submission requires a valid account phone or explicit contact and stores a normalized snapshot', async () => {
  await User.collection.updateOne({ _id: accounts.user._id }, { $set: { phone: '' } });
  assert.equal((await send('/tickets', 'user', submission)).status, 400);
  assert.equal((await send('/tickets', 'user', { ...submission, contactNumber: 'invalid' })).status, 400);
  const result = await send('/tickets', 'user', { ...submission, contactNumber: '+63 917-123-4567' });
  assert.equal(result.status, 201); assert.equal(result.body.contactNumber, '09171234567');
  assert.equal((await Ticket.findById(result.body._id)).contactNumber, '09171234567');
  assert.equal((await User.findById(accounts.user._id)).phone, '');
});

test('ticket submission snapshots the current valid profile phone but rejects an explicitly invalid contact', async () => {
  const result = await send('/tickets', 'user', submission);
  assert.equal(result.status, 201); assert.equal(result.body.contactNumber, '09171234567');
  await User.collection.updateOne({ _id: accounts.user._id }, { $set: { phone: '09991234567' } });
  assert.equal((await Ticket.findById(result.body._id)).contactNumber, '09171234567');
  assert.equal((await send('/tickets', 'user', { ...submission, contactNumber: '' })).status, 400);
});

test('one pending review permits only one concurrent Admin public action', async () => {
  const row = await assigned(); await ask(row);
  const results = await Promise.all([note(row, 'First reviewed outcome'), note(row, 'Second reviewed outcome')]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal((await Ticket.findById(row._id)).notes.length, 1);
  await ask(row);
  const outcomes = await Promise.all([note(row, 'Third reviewed outcome'), status(row, 'Resolved')]);
  assert.deepEqual(outcomes.map(result => result.status).sort(), [200, 409]);
  assert.equal((await Ticket.findById(row._id)).reviewHistory.filter(event => event.action === 'reviewed').length, 2);
});
