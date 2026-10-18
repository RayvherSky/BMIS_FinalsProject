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
  process.env.JWT_SECRET = 'isolated-ticket-request-tests';
  database = await createTestDatabase('ticket_request_tests');
  await mongoose.connect(database.getUri('ticket_request_tests'));
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
    const row = { _id: new mongoose.Types.ObjectId(), firstName: name, lastName: 'Request',
      email: `${name}@example.test`, password: 'unused', isActive: true,
      role: name === 'other' ? 'user' : name === 'employee2' ? 'employee' : name };
    await User.collection.insertOne(row); accounts[name] = row;
  }
});
async function send(path, role = 'admin', body, method = body === undefined ? 'GET' : 'POST') {
  const token = role && jwt.sign({ id: String(accounts[role]._id), role: 'admin' }, process.env.JWT_SECRET);
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text,
    retry: response.headers.get('retry-after') };
}
const pathOf = t => `/tickets/${t._id}`;
async function report(fields = {}) { return Ticket.create({ title: 'Drainage report', description: 'Inspect drainage', category: 'Infrastructure', location: 'Baclaran', submittedBy: accounts.user._id, ...fields }); }
const status = (t, next) => send(`${pathOf(t)}/status`, 'admin', { status: next }, 'PUT');
const assign = (t, who = 'employee') => send(`${pathOf(t)}/assign`, 'admin', { assignedTo: who ? String(accounts[who]._id) : null }, 'PATCH');
const request = (t, type, message = '', who = 'user') => send(`${pathOf(t)}/requests`, who, { type, message });
const handle = (t, id, body, who = 'admin') => send(`${pathOf(t)}/requests/${id}`, who, body, 'PATCH');

test('reversal records the previous status and reason, restores archive/assignment consistently, and retains content', async () => {
  const t = await report({ priority: 'High', notes: [{ text: 'Original note', addedBy: accounts.admin._id, isPrivate: true }] });
  await assign(t); await status(t, 'Resolved');
  const result = await send(`${pathOf(t)}/revert`, 'admin', { status: 'In Progress', reason: 'Completion entered by mistake' });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'In Progress'); assert.equal(result.body.isArchived, false);
  assert.equal(result.body.resolvedAt, null); assert.equal(result.body.priority, 'High');
  assert.equal(String(result.body.assignedTo._id), String(accounts.employee._id));
  assert.equal(result.body.notes[0].text, 'Original note');
  assert.deepEqual(result.body.statusHistory.map(e => [e.from, e.to]), [['Pending', 'In Progress'], ['In Progress', 'Resolved'], ['Resolved', 'In Progress']]);
  assert.equal(result.body.statusHistory.at(-1).reason, 'Completion entered by mistake');
  assert.ok(result.body.statusHistory.at(-1).previousResolvedAt);
  const user = await send(pathOf(t), 'user');
  assert.equal(user.body.statusHistory, undefined); assert.equal(user.body.reversal, undefined);
  assert.equal(user.body.notes.length, 0);
});
test('reversal denies missing reason, invalid destinations and non-Admins including direct ordinary-status bypass', async () => {
  const t = await report(); await assign(t); await status(t, 'Resolved');
  for (const role of ['employee', 'user', null]) {
    const result = await send(`${pathOf(t)}/revert`, role, { status: 'In Progress', reason: 'Forged' });
    assert.equal(result.status, role ? 403 : 401);
  }
  assert.equal((await send(`${pathOf(t)}/revert`, 'admin', { status: 'In Progress', reason: ' ' })).status, 400);
  assert.equal((await send(`${pathOf(t)}/revert`, 'admin', { status: 'Pending', reason: 'Skip history' })).status, 400);
  assert.equal((await status(t, 'In Progress')).status, 409);
  assert.equal((await Ticket.findById(t._id)).status, 'Resolved');
});
test('legacy correction permits explicit earlier active statuses without inventing prior history', async () => {
  const t = await report({ status: 'Dismissed', isArchived: true, dismissedAt: new Date('2026-01-01'), assignedTo: accounts.employee._id });
  await User.updateOne({ _id: accounts.employee._id }, { $set: { isActive: false } });
  const detail = await send(pathOf(t));
  assert.deepEqual(detail.body.reversal, { options: ['Pending', 'In Progress'], legacy: true });
  const result = await send(`${pathOf(t)}/revert`, 'admin', { status: 'Pending', reason: 'Legacy correction' });
  assert.equal(result.status, 200); assert.equal(result.body.assignedTo, null);
  assert.equal(result.body.statusHistory.length, 1); assert.equal(result.body.statusHistory[0].kind, 'legacy_correction');
  assert.equal(result.body.assignmentHistory.at(-1).action, 'unassigned');
});
test('two concurrent reversals produce only one event', async () => {
  const t = await report({ status: 'Resolved', isArchived: true });
  const results = await Promise.all([1, 2].map(() => send(`${pathOf(t)}/revert`, 'admin', { status: 'In Progress', reason: 'Correction' })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal((await Ticket.findById(t._id)).statusHistory.length, 1);
});
test('Pending follow-up belongs to its owner, retains Pending and is denied to staff or foreign users', async () => {
  const t = await report();
  for (const role of ['admin', 'employee', 'other', null]) {
    const result = await request(t, 'follow_up', 'Please inspect', role);
    assert.ok([401, 403, 404].includes(result.status));
  }
  const result = await request(t, 'follow_up', 'Please inspect');
  assert.equal(result.status, 201); assert.equal(result.body.status, 'Pending');
  assert.equal(result.body.requests[0].state, 'pending');
  assert.equal(result.body.requestEligibility.follow_up.allowed, false);
  assert.equal((await request(t, 'progress_update')).status, 409);
});
test('same-day requests are atomic across sessions, and unresolved requests still block a later day', async () => {
  const t = await report();
  const results = await Promise.all(Array.from({ length: 6 }, () => request(t, 'follow_up')));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.ok(results.filter(r => r.status !== 201).every(r => [409, 429].includes(r.status)));
  let saved = await Ticket.findById(t._id); assert.equal(saved.requests.length, 1);
  await Ticket.updateOne({ _id: t._id }, { $set: { 'requests.0.day': '2000-01-01', 'requests.0.createdAt': new Date('2000-01-01') } });
  assert.equal((await request(t, 'follow_up')).status, 409);
  await handle(t, saved.requests[0]._id, { action: 'respond', text: 'We have reviewed this report.' });
  assert.equal((await request(t, 'follow_up')).status, 201);
  saved = await Ticket.findById(t._id); assert.equal(saved.requests.length, 2);
});
test('completion does not permit a second request on the same Manila day', async () => {
  const t = await report(); const created = await request(t, 'follow_up');
  assert.equal(created.status, 201);
  await handle(t, created.body.requests[0]._id, { action: 'respond', text: 'Inspection is scheduled.' });
  const duplicate = await request(t, 'follow_up');
  assert.equal(duplicate.status, 429); assert.ok(Number(duplicate.retry) > 0);
});
test('Manila day boundaries and next midnight are independent of server timezone', () => {
  const { localDay, nextDay } = require('../utils/requestPolicy');
  assert.equal(localDay(new Date('2026-10-19T15:59:59.999Z')), '2026-10-19');
  assert.equal(localDay(new Date('2026-10-19T16:00:00.000Z')), '2026-10-20');
  assert.equal(nextDay(new Date('2026-10-19T15:59:59.999Z')).toISOString(), '2026-10-19T16:00:00.000Z');
});
test('progress requests route only to the current eligible Employee and Admin; filters/counts preserve scope', async () => {
  const t = await report(); await assign(t);
  assert.equal((await request(t, 'progress_update', 'Any progress?')).status, 201);
  const own = await send('/tickets/requests', 'employee');
  assert.equal(own.status, 200); assert.equal(own.body.total, 1); assert.equal(own.body.counts.outstanding, 1);
  assert.equal((await send('/tickets/requests', 'employee2')).body.total, 0);
  assert.equal((await send('/tickets/requests', 'user')).status, 403);
  assert.equal((await send('/tickets/requests?type=appeal', 'employee')).body.total, 0);
  assert.equal((await send('/tickets/requests?search=%5B', 'employee')).status, 200);
  await assign(t, 'employee2');
  assert.equal((await send('/tickets/requests', 'employee')).body.total, 0);
  assert.equal((await send('/tickets/requests', 'employee2')).body.total, 1);
});
test('view and acknowledge do not complete; response creates exactly one public note and completed state', async () => {
  const t = await report(); await assign(t);
  const created = await request(t, 'progress_update'); const id = created.body.requests[0]._id;
  assert.equal((await handle(t, id, { action: 'view' }, 'employee')).status, 200);
  let inbox = await send('/tickets/requests', 'employee');
  assert.equal(inbox.body.counts.unread, 0); assert.equal(inbox.body.counts.outstanding, 1);
  assert.equal((await handle(t, id, { action: 'acknowledge' }, 'employee')).body.requests[0].state, 'acknowledged');
  await send(`${pathOf(t)}/notes`, 'employee', { text: 'Internal plan', isPrivate: true });
  assert.equal((await Ticket.findById(t._id)).requests[0].state, 'acknowledged');
  const results = await Promise.all([1, 2].map(() => handle(t, id, { action: 'respond', text: 'Repair is scheduled tomorrow.' }, 'employee')));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  const saved = await Ticket.findById(t._id);
  assert.equal(saved.requests[0].state, 'completed'); assert.equal(saved.status, 'In Progress');
  assert.equal(saved.notes.filter(n => n.text === 'Repair is scheduled tomorrow.').length, 1);
  const user = await send(pathOf(t), 'user');
  assert.equal(user.body.requests[0].responseText, 'Repair is scheduled tomorrow.');
  assert.equal(user.body.requests[0].viewedBy, undefined); assert.equal(user.body.requests[0].history, undefined);
  assert.equal(user.body.notes.some(n => n.isPrivate), false);
});
test('revoked assignee cannot view, acknowledge or answer a request, and final tickets route to Admin', async () => {
  const t = await report(); await assign(t); const r = await request(t, 'progress_update'); const id = r.body.requests[0]._id;
  await assign(t, 'employee2');
  for (const action of ['view', 'acknowledge', 'respond']) {
    assert.equal((await handle(t, id, { action, text: 'Unauthorized' }, 'employee')).status, 404);
  }
  await status(t, 'Dismissed');
  assert.equal((await send('/tickets/requests', 'employee2')).body.total, 0);
  assert.equal((await send('/tickets/requests', 'admin')).body.total, 1);
});
test('appeals require an explanation, are Admin-only decisions, and reject repeated appeals for one dismissal', async () => {
  const t = await report({ status: 'Dismissed', isArchived: true, dismissedAt: new Date('2020-01-01') });
  assert.equal((await request(t, 'appeal', ' ')).status, 400);
  const created = await request(t, 'appeal', 'The issue is still present.'); assert.equal(created.status, 201);
  const id = created.body.requests[0]._id;
  assert.equal((await handle(t, id, { action: 'decide', decision: 'rejected', text: 'No' }, 'employee')).status, 404);
  const rejected = await handle(t, id, { action: 'decide', decision: 'rejected', text: 'A separate completed report covers this location.' });
  assert.equal(rejected.status, 200); assert.equal(rejected.body.status, 'Dismissed'); assert.equal(rejected.body.isArchived, true);
  assert.equal((await request(t, 'appeal', 'Again')).status, 409);
  const own = await send('/tickets/my-tickets?archived=dismissed', 'user');
  assert.equal(own.status, 200); assert.equal(own.body.length, 1);
  assert.equal((await send('/tickets/my-tickets?archived=dismissed', 'other')).body.length, 0);
  assert.equal((await send('/tickets/my-tickets', 'user')).body.length, 0);
});
test('accepted appeal atomically records a public decision and audited reopening; a new dismissal permits a new appeal', async () => {
  const t = await report(); await assign(t); await status(t, 'Dismissed');
  const r = await request(t, 'appeal', 'There is additional context.'); const id = r.body.requests[0]._id;
  assert.equal((await handle(t, id, { action: 'decide', decision: 'accepted', text: 'We will investigate.' })).status, 400);
  const results = await Promise.all([1, 2].map(() => handle(t, id, { action: 'decide', decision: 'accepted', text: 'We will investigate.', status: 'In Progress' })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  let saved = await Ticket.findById(t._id);
  assert.equal(saved.status, 'In Progress'); assert.equal(saved.requests[0].decision, 'accepted');
  assert.equal(saved.statusHistory.filter(h => h.kind === 'reversal').length, 1);
  await status(t, 'Dismissed');
  assert.equal((await request(t, 'appeal', 'This is a different dismissal.')).status, 201);
  saved = await Ticket.findById(t._id); assert.equal(saved.requests.length, 2);
});
test('concurrent identical notes are suppressed and normal visibility distinctions remain independent', async () => {
  const t = await report(); await assign(t);
  const responses = await Promise.all(Array.from({ length: 5 }, () => send(`${pathOf(t)}/notes`, 'employee', { text: 'Inspect tomorrow', isPrivate: false })));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.ok(responses.filter(r => r.status !== 200).every(r => r.status === 409));
  assert.equal((await send(`${pathOf(t)}/notes`, 'employee', { text: 'Inspect tomorrow', isPrivate: true })).status, 200);
  assert.equal((await send(`${pathOf(t)}/notes`, 'user', { text: 'Inspect tomorrow' })).status, 200);
  assert.equal((await Ticket.findById(t._id)).notes.length, 3);
});
test('User note quota rejects the sixth note per minute with retry information and retains all five notes', async () => {
  const t = await report();
  for (let i = 0; i < 5; i++) assert.equal((await send(`${pathOf(t)}/notes`, 'user', { text: `Detail ${i}` })).status, 200);
  const limited = await send(`${pathOf(t)}/notes`, 'user', { text: 'Sixth detail' });
  assert.equal(limited.status, 429); assert.ok(Number(limited.retry) > 0); assert.ok(limited.body.nextAllowedAt);
  assert.equal((await Ticket.findById(t._id)).notes.length, 5);
  await Ticket.updateOne({ _id: t._id }, { $set: { 'notes.$[].createdAt': new Date(Date.now() - 61000) } });
  assert.equal((await send(`${pathOf(t)}/notes`, 'user', { text: 'After interval' })).status, 200);
});
test('User account quota includes communications across tickets and staff has the approved higher capacity', async () => {
  for (let i = 0; i < 20; i++) { const t = await report(); assert.equal((await request(t, 'follow_up')).status, 201); }
  const t = await report(); const limited = await request(t, 'follow_up');
  assert.equal(limited.status, 429); assert.equal((await Ticket.findById(t._id)).requests.length, 0);
  for (let i = 0; i < 20; i++) assert.equal((await send(`${pathOf(t)}/notes`, 'admin', { text: `Staff update ${i}` })).status, 200);
  assert.equal((await send(`${pathOf(t)}/notes`, 'admin', { text: 'Staff burst exceeded' })).status, 429);
});
test('request input validation rejects malformed types, messages, queries and IDs without leaking another ticket', async () => {
  const t = await report();
  assert.equal((await request(t, 'invented')).status, 400);
  assert.equal((await request(t, 'follow_up', { malicious: true })).status, 400);
  assert.equal((await send('/tickets/not-an-id/requests', 'user', { type: 'follow_up' })).status, 404);
  assert.equal((await send('/tickets/requests?type[bad]=x', 'admin')).status, 400);
  assert.equal((await send('/tickets/requests?page=-1', 'admin')).status, 400);
  const foreign = await request(t, 'follow_up', 'Secret', 'other');
  assert.equal(foreign.status, 404); assert.doesNotMatch(JSON.stringify(foreign.body), /Drainage report/);
});
