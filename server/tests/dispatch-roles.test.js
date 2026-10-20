const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { createTestDatabase } = require('./helpers/testDatabase');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

let database, server, base, accounts;
const password = 'IsolatedPassword123!';
before(async () => {
  process.env.JWT_SECRET = 'isolated-dispatch-role-tests';
  database = await createTestDatabase('dispatch_role_tests');
  await mongoose.connect(database.getUri('dispatch_role_tests'));
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/users', require('../routes/userRoutes'));
  app.use('/api/tickets', require('../routes/ticketRoutes'));
  app.use('/api/archive', require('../routes/archiveRoutes'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await mongoose.disconnect();
  if (database) await database.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Ticket.deleteMany({})]);
  const hash = await bcrypt.hash(password, 4);
  accounts = {};
  for (const role of ['admin', 'employee', 'employee2', 'user', 'other', 'resident', 'unknown']) {
    const row = { _id: new mongoose.Types.ObjectId(), firstName: role, lastName: 'Test', email: `${role}@example.test`, password: hash,
      role: role === 'employee2' ? 'employee' : role === 'other' ? 'user' : role, isActive: true,
      resetPasswordToken: 'never-expose-reset', resetPasswordExpires: new Date() };
    await User.collection.insertOne(row);
    accounts[role] = row;
  }
});
async function send(path, { role = 'admin', body, method = body === undefined ? 'GET' : 'PATCH' } = {}) {
  const token = role && jwt.sign({ id: String(accounts[role]._id), role: 'admin' }, process.env.JWT_SECRET);
  const response = await fetch(base + '/api' + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const content = await response.text();
  return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(content) : content };
}
async function report(fields = {}) {
  return Ticket.create({ title: 'Dispatch drainage', description: 'Repair needed', category: 'Infrastructure', location: 'Baclaran', submittedBy: accounts.user._id, ...fields });
}
async function assign(ticket, role = 'employee') {
  return send(`/tickets/${ticket._id}/assign`, { body: { assignedTo: role ? String(accounts[role]._id) : null } });
}
function noCredentials(value) {
  assert.doesNotMatch(JSON.stringify(value), /never-expose-reset|resetPasswordToken|resetPasswordExpires|"password"/);
}

test('canonical roles, legacy sessions, Employee login and forged public registration', async () => {
  for (const role of ['employee', 'resident', 'user']) {
    const login = await send('/auth/login', { role: null, method: 'POST', body: { email: accounts[role].email, password } });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, role === 'resident' ? 'user' : role);
    noCredentials(login.body);
    const me = await send('/auth/me', { role });
    assert.equal(me.body.role, role === 'resident' ? 'user' : role);
    noCredentials(me.body);
  }
  const created = await send('/auth/register', { role: null, method: 'POST', body: { firstName: 'Public', lastName: 'Person', email: 'public@example.test', password, phone: '09171234567', role: 'admin', isActive: false } });
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, 'user');
  assert.equal((await User.findById(created.body.user._id)).role, 'user');
  const profile = await send('/auth/profile', { role: 'resident', method: 'PUT', body: { address: 'New address', role: 'admin', isActive: false } });
  assert.equal(profile.body.role, 'user');
  noCredentials(profile.body);
});

test('inactive accounts cannot log in or reuse existing JWTs; unknown roles deny', async () => {
  await User.collection.updateOne({ _id: accounts.employee._id }, { $set: { isActive: false } });
  assert.equal((await send('/auth/me', { role: 'employee' })).status, 401);
  assert.equal((await send('/auth/login', { role: null, method: 'POST', body: { email: accounts.employee.email, password } })).status, 401);
  assert.equal((await send('/tickets', { role: 'unknown' })).status, 403);
  assert.equal((await send('/tickets/my-tickets', { role: 'unknown' })).status, 403);
  await User.collection.updateOne({ _id: accounts.resident._id }, { $unset: { isActive: '' } });
  assert.equal((await send('/auth/me', { role: 'resident' })).status, 200);
});

test('Employee directory is active-only/Admin-only; all user responses exclude reset credentials', async () => {
  await User.collection.updateOne({ _id: accounts.employee2._id }, { $set: { isActive: false } });
  const directory = await send('/users/employees');
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.body.map(x => x.email), [accounts.employee.email]);
  assert.equal(directory.body[0].name, 'employee Test');
  for (const role of ['employee', 'user']) assert.equal((await send('/users/employees', { role })).status, 403);
  noCredentials((await send('/users')).body);
  noCredentials((await send(`/users/${accounts.resident._id}`)).body);
});

test('confirmed role changes support Employee and resident alias and reject generic status bypass', async () => {
  const id = accounts.user._id;
  assert.equal((await send(`/users/${id}/role`, { body: { role: 'employee', confirmationEmail: 'wrong' } })).status, 400);
  const promoted = await send(`/users/${id}/role`, { body: { role: 'employee', confirmationEmail: accounts.user.email } });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.body.role, 'employee');
  noCredentials(promoted.body);
  assert.equal((await send(`/users/${id}`, { method: 'PUT', body: { isActive: false, firstName: 'Bypass' } })).status, 400);
  assert.equal((await User.findById(id)).firstName, 'user');
  const demoted = await send(`/users/${id}/role`, { body: { role: 'resident', confirmationEmail: accounts.user.email } });
  assert.equal(demoted.body.role, 'user');
  assert.equal((await User.findById(id)).role, 'user');
});

test('assignment moves Pending, records exact history, no-ops, reassigns and unassigns', async () => {
  const ticket = await report();
  const first = await assign(ticket);
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'In Progress');
  assert.equal(first.body.assignedTo.email, accounts.employee.email);
  assert.ok(first.body.assignedAt);
  assert.equal(first.body.assignmentHistory.length, 1);
  assert.equal(first.body.assignmentHistory[0].action, 'assigned');
  assert.equal(first.body.assignmentHistory[0].previousEmployee, null);
  assert.equal(String(first.body.assignmentHistory[0].newEmployee._id || first.body.assignmentHistory[0].newEmployee), String(accounts.employee._id));
  assert.equal((await assign(ticket)).body.assignmentHistory.length, 1);
  const second = await assign(ticket, 'employee2');
  assert.equal(second.body.assignmentHistory[1].action, 'reassigned');
  assert.equal(second.body.status, 'In Progress');
  const unassigned = await assign(ticket, null);
  assert.equal(unassigned.body.assignedTo, null);
  assert.equal(unassigned.body.assignedAt, null);
  assert.equal(unassigned.body.assignmentHistory[2].action, 'unassigned');
  assert.equal(unassigned.body.status, 'In Progress');
});

test('assignment validates target, IDs, archives and privileges and ignores forged fields', async () => {
  const ticket = await report();
  for (const assignedTo of [undefined, 'malformed', String(new mongoose.Types.ObjectId()), String(accounts.user._id), String(accounts.admin._id), {}, []]) {
    assert.equal((await send(`/tickets/${ticket._id}/assign`, { body: { assignedTo } })).status, 400);
  }
  for (const role of ['employee', 'user']) assert.equal((await send(`/tickets/${ticket._id}/assign`, { role, body: { assignedTo: String(accounts.employee._id) } })).status, 403);
  await User.collection.updateOne({ _id: accounts.employee._id }, { $set: { isActive: false } });
  assert.equal((await assign(ticket)).status, 400);
  assert.equal((await send('/tickets/bad/assign', { body: { assignedTo: null } })).status, 404);
  assert.equal((await send(`/tickets/${new mongoose.Types.ObjectId()}/assign`, { body: { assignedTo: null } })).status, 404);
  await Ticket.updateOne({ _id: ticket._id }, { $set: { isArchived: true } });
  assert.equal((await assign(ticket, 'employee2')).status, 400);
  const active = await report({ status: 'Dismissed' });
  const result = await send(`/tickets/${active._id}/assign`, { body: { assignedTo: String(accounts.employee2._id), status: 'Resolved', assignmentHistory: [], priority: 'Urgent' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'Dismissed');
  assert.equal(result.body.priority, 'Medium');
});

test('Employee queue/detail scope cannot be expanded by query, personal endpoint or linked references', async () => {
  const foreign = await report({ title: 'Foreign secret', notes: [{ text: 'Foreign note', isPrivate: false }] });
  const own = await report({ assignedTo: accounts.employee._id, linkedTicket: foreign._id, notes: [{ text: 'Internal', isPrivate: true }] });
  await report({ assignedTo: accounts.employee2._id });
  await report({ assignedTo: accounts.employee._id, isArchived: true });
  const list = await send(`/tickets?assignedTo=${accounts.employee2._id}&submittedBy=${accounts.other._id}`, { role: 'employee' });
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map(x => x._id), [String(own._id)]);
  assert.equal((await send('/tickets/my-tickets', { role: 'employee' })).status, 403);
  assert.equal((await send(`/tickets/${foreign._id}`, { role: 'employee' })).status, 403);
  const detail = await send(`/tickets/${own._id}`, { role: 'employee' });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.notes[0].text, 'Internal');
  assert.deepEqual(Object.keys(detail.body.linkedTicket), ['_id']);
  assert.equal(Object.hasOwn(detail.body, 'assignmentHistory'), false);
  assert.equal(Object.hasOwn(detail.body.assignedTo, 'email'), false);
  assert.doesNotMatch(JSON.stringify(detail.body), /Foreign secret|Foreign note/);
  for (const path of ['/archive', '/users']) assert.equal((await send(path, { role: 'employee' })).status, 403);
  assert.equal((await send('/tickets', { role: 'employee', method: 'POST', body: { title: 'Forbidden' } })).status, 403);
});

test('Employee full ticket-ID search remains scoped to active assignments and preserves title/category/status filtering', async () => {
  const own = await report({ assignedTo: accounts.employee._id, status: 'In Progress' });
  const foreign = await report({ assignedTo: accounts.employee2._id });
  const unassigned = await report();
  const archived = await report({ assignedTo: accounts.employee._id, isArchived: true });
  for (const search of [String(own._id), String(own._id).toUpperCase()]) {
    const found = await send(`/tickets?search=${search}`, { role: 'employee' });
    assert.equal(found.status, 200);
    assert.deepEqual(found.body.map(ticket => ticket._id), [String(own._id)]);
  }
  for (const ticket of [foreign, unassigned, archived]) {
    const denied = await send(`/tickets?search=${ticket._id}`, { role: 'employee' });
    assert.equal(denied.status, 200);
    assert.deepEqual(denied.body, []);
  }
  const filtered = await send(`/tickets?search=${own._id}&category=Infrastructure&status=In%20Progress`, { role: 'employee' });
  assert.deepEqual(filtered.body.map(ticket => ticket._id), [String(own._id)]);
  for (const filter of ['category=Sanitation', 'status=Pending', 'priority=Urgent']) {
    const excluded = await send(`/tickets?search=${own._id}&${filter}`, { role: 'employee' });
    assert.deepEqual(excluded.body, []);
  }
  const title = await send('/tickets?search=drainage&category=Infrastructure&status=In%20Progress', { role: 'employee' });
  assert.deepEqual(title.body.map(ticket => ticket._id), [String(own._id)]);
  assert.deepEqual((await send('/tickets?search=not-a-ticket-id', { role: 'employee' })).body, []);
});

test('User report creation uses the restricted response without assignment history or forged staff fields', async () => {
  const created = await send('/tickets', { role: 'user', method: 'POST', body: {
    title: 'New public report', description: 'Report details', category: 'Infrastructure', location: 'Baclaran', contactNumber: '09171234567',
    priority: 'Urgent', assignedTo: String(accounts.employee._id), assignmentHistory: [{ action: 'assigned' }],
  } });
  assert.equal(created.status, 201);
  assert.equal(Object.hasOwn(created.body, 'assignmentHistory'), false);
  assert.equal(created.body.assignedTo, null);
  assert.equal(created.body.priority, 'Medium');
  assert.equal(created.body.submittedBy._id, String(accounts.user._id));
  assert.equal(created.body.title, 'New public report');
  noCredentials(created.body);
  const saved = await Ticket.findById(created.body._id);
  assert.deepEqual(saved.assignmentHistory.toObject(), []);
  assert.equal(saved.assignedTo, null);
});

test('User serialization hides internal messages, Employee email/history and foreign linked contents', async () => {
  const foreign = await report({ submittedBy: accounts.other._id, title: 'Foreign private title' });
  const own = await report({ assignedTo: accounts.employee._id, linkedTicket: foreign._id,
    assignmentHistory: [{ previousEmployee: null, newEmployee: accounts.employee._id, changedBy: accounts.admin._id, action: 'assigned' }],
    notes: [{ text: 'Internal secret', isPrivate: true, addedBy: accounts.employee._id }, { text: 'Public update', addedBy: accounts.employee._id }] });
  for (const path of [`/tickets/${own._id}`, '/tickets/my-tickets']) {
    const result = await send(path, { role: 'user' });
    assert.equal(result.status, 200);
    const value = Array.isArray(result.body) ? result.body[0] : result.body;
    assert.equal(value.notes.length, 1);
    assert.equal(Object.hasOwn(value, 'assignmentHistory'), false);
    assert.deepEqual(Object.keys(value.assignedTo).sort(), ['_id', 'firstName', 'lastName']);
    assert.doesNotMatch(JSON.stringify(value), /Internal secret|employee@example.test|Foreign private title/);
    noCredentials(value);
  }
  assert.equal((await send(`/tickets/${foreign._id}`, { role: 'user' })).status, 403);
});

test('Employee notes enforce current assignment; public/internal provenance is server selected', async () => {
  const ticket = await report({ assignedTo: accounts.employee._id });
  for (const isPrivate of [false, true]) {
    const result = await send(`/tickets/${ticket._id}/notes`, { role: 'employee', method: 'POST', body: { text: isPrivate ? 'Staff internal' : 'Staff public', isPrivate, kind: 'forged', authorRole: 'admin', addedBy: accounts.admin._id, status: 'Resolved' } });
    assert.equal(result.status, 200);
    const note = result.body.notes.at(-1);
    assert.equal(note.isPrivate, isPrivate);
    assert.equal(note.authorRole, 'employee');
    assert.equal(note.kind, isPrivate ? 'internal' : 'update');
    assert.equal(note.addedBy._id, String(accounts.employee._id));
    assert.equal(result.body.status, 'Pending');
  }
  assert.equal((await send(`/tickets/${ticket._id}/notes`, { role: 'employee2', method: 'POST', body: { text: 'Denied' } })).status, 403);
  const reply = await send(`/tickets/${ticket._id}/notes`, { role: 'user', method: 'POST', body: { text: 'User reply', isPrivate: true, authorRole: 'admin' } });
  assert.equal(reply.status, 200);
  assert.equal(reply.body.notes.at(-1).isPrivate, false);
  assert.equal(reply.body.notes.at(-1).kind, 'reply');
  assert.equal(reply.body.notes.at(-1).authorRole, 'user');
  assert.equal(reply.body.notes.some(n => n.isPrivate), false);
});

test('Employee mutation checks assignment again in the database write after a read/write race', async t => {
  const ticket = await report({ assignedTo: accounts.employee._id });
  const original = Ticket.findOneAndUpdate;
  let raced = false;
  t.mock.method(Ticket, 'findOneAndUpdate', function(filter, update, options) {
    if (update.$push?.notes && !raced) {
      raced = true;
      return Ticket.updateOne({ _id: ticket._id }, { $set: { assignedTo: accounts.employee2._id } })
        .then(() => original.call(this, filter, update, options));
    }
    return original.call(this, filter, update, options);
  });
  const result = await send(`/tickets/${ticket._id}/notes`, { role: 'employee', method: 'POST', body: { text: 'Stale update' } });
  assert.equal(result.status, 403);
  assert.equal((await Ticket.findById(ticket._id)).notes.length, 0);
});

test('Employee disposition/priority/link/archive/assignment bypasses are denied', async () => {
  const ticket = await report({ assignedTo: accounts.employee._id });
  for (const [suffix, method, body] of [['status', 'PUT', { status: 'Resolved' }], ['priority', 'PATCH', { priority: 'Urgent' }], ['link', 'PUT', { linkedTicketId: String(ticket._id) }], ['unlink', 'PUT', {}]]) {
    assert.equal((await send(`/tickets/${ticket._id}/${suffix}`, { role: 'employee', method, body })).status, 403);
  }
  await Ticket.updateOne({ _id: ticket._id }, { $set: { isArchived: true } });
  assert.equal((await send(`/tickets/${ticket._id}`, { role: 'employee' })).status, 403);
  assert.equal((await send(`/tickets/${ticket._id}/notes`, { role: 'employee', method: 'POST', body: { text: 'Archived denial' } })).status, 403);
});

test('Employee demotion to Admin or User clears active assignments with retained messages/history', async () => {
  for (const role of ['admin', 'user']) {
    await User.collection.updateOne({ _id: accounts.employee._id }, { $set: { role: 'employee' } });
    const ticket = await report({ assignedTo: accounts.employee._id, notes: [{ text: 'Preserved' }] });
    const archived = await report({ assignedTo: accounts.employee._id, isArchived: true });
    const result = await send(`/users/${accounts.employee._id}/role`, { body: { role, confirmationEmail: accounts.employee.email } });
    assert.equal(result.status, 200);
    const saved = await Ticket.findById(ticket._id);
    assert.equal(saved.assignedTo, null);
    assert.equal(saved.notes.length, 1);
    assert.equal(saved.assignmentHistory.at(-1).action, 'unassigned');
    assert.equal(String((await Ticket.findById(archived._id)).assignedTo), String(accounts.employee._id));
  }
});

test('restore clears an inactive/demoted historical assignee with audit history and preserves report completion', async () => {
  for (const [suffix, transition] of [['active', { isActive: false }], ['role', { role: 'user' }], ['role', { role: 'admin' }]]) {
    await User.collection.updateOne({ _id: accounts.employee._id }, { $set: { isActive: true, role: 'employee' } });
    const resolvedAt = new Date('2026-10-01T00:00:00Z');
    const ticket = await report({ assignedTo: accounts.employee._id, assignedAt: resolvedAt, isArchived: true,
      status: 'Resolved', resolvedAt, archivedAt: resolvedAt, notes: [{ text: 'Preserved report message' }],
      assignmentHistory: [{ newEmployee: accounts.employee._id, changedBy: accounts.admin._id, action: 'assigned' }] });
    const changed = await send(`/users/${accounts.employee._id}/${suffix}`, { body: { ...transition, confirmationEmail: accounts.employee.email } });
    assert.equal(changed.status, 200);
    assert.equal(String((await Ticket.findById(ticket._id)).assignedTo), String(accounts.employee._id));
    const restored = await send(`/archive/${ticket._id}/restore`, { method: 'PUT', body: {} });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.assignedTo, null);
    assert.equal(restored.body.assignedAt, null);
    assert.equal(restored.body.isArchived, false);
    assert.equal(restored.body.archivedAt, null);
    assert.equal(restored.body.status, 'Resolved');
    assert.equal(restored.body.resolvedAt, resolvedAt.toISOString());
    assert.equal(restored.body.notes[0].text, 'Preserved report message');
    assert.equal(restored.body.assignmentHistory.length, 2);
    const history = restored.body.assignmentHistory.at(-1);
    assert.equal(history.action, 'unassigned');
    assert.equal(history.previousEmployee._id, String(accounts.employee._id));
    assert.equal(history.newEmployee, null);
    assert.equal(history.changedBy._id, String(accounts.admin._id));
    assert.match(history.reason, /restor|unavailable/i);
  }
});

test('restore retains a currently active Employee assignment without adding history', async () => {
  const assignedAt = new Date('2026-10-01T00:00:00Z');
  const ticket = await report({ assignedTo: accounts.employee._id, assignedAt, status: 'Resolved', isArchived: true,
    assignmentHistory: [{ newEmployee: accounts.employee._id, changedBy: accounts.admin._id, action: 'assigned' }] });
  const restored = await send(`/archive/${ticket._id}/restore`, { method: 'PUT', body: {} });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.assignedTo._id, String(accounts.employee._id));
  assert.equal(restored.body.assignedAt, assignedAt.toISOString());
  assert.equal(restored.body.assignmentHistory.length, 1);
  assert.equal((await send(`/tickets/${ticket._id}`, { role: 'employee' })).status, 200);
  assert.equal((await send(`/users/${accounts.employee._id}/active`, { body: { isActive: false, confirmationEmail: accounts.employee.email } })).status, 200);
  assert.equal((await Ticket.findById(ticket._id)).assignedTo, null);
});

test('restore racing after transition cleanup cannot reactivate an unavailable Employee assignment', async t => {
  for (const [suffix, transition] of [['active', { isActive: false }], ['role', { role: 'user' }]]) {
    await User.collection.updateOne({ _id: accounts.employee._id }, { $set: { isActive: true, role: 'employee' } });
    const ticket = await report({ assignedTo: accounts.employee._id, status: 'Resolved', isArchived: true });
    let reachedCleanup, releaseCleanup, reachedRestore;
    const started = new Promise(resolve => { reachedCleanup = resolve; });
    const gate = new Promise(resolve => { releaseCleanup = resolve; });
    const restoreStarted = new Promise(resolve => { reachedRestore = resolve; });
    const originalCleanup = Ticket.updateMany;
    const cleanupMock = t.mock.method(Ticket, 'updateMany', async function(...args) {
      const result = await originalCleanup.apply(this, args);
      reachedCleanup();
      await gate;
      return result;
    });
    const originalFind = Ticket.findById;
    const findMock = t.mock.method(Ticket, 'findById', function(...args) {
      if (String(args[0]) === String(ticket._id)) reachedRestore();
      return originalFind.apply(this, args);
    });
    const changing = send(`/users/${accounts.employee._id}/${suffix}`, { body: { ...transition, confirmationEmail: accounts.employee.email } });
    await started;
    const restoring = send(`/archive/${ticket._id}/restore`, { method: 'PUT', body: {} });
    await restoreStarted;
    releaseCleanup();
    const [changed, restored] = await Promise.all([changing, restoring]);
    assert.equal(changed.status, 200);
    assert.equal(restored.status, 200);
    const saved = await Ticket.findById(ticket._id);
    assert.equal(saved.isArchived, false);
    assert.equal(saved.assignedTo, null);
    assert.equal(saved.assignmentHistory.at(-1).action, 'unassigned');
    cleanupMock.mock.restore();
    findMock.mock.restore();
  }
});

test('confirmed activation/deactivation clears active assignments and rejects self-deactivation/status bypasses', async () => {
  const ticket = await report({ assignedTo: accounts.employee._id });
  const path = `/users/${accounts.employee._id}/active`;
  for (const body of [{ isActive: false }, { isActive: 'false', confirmationEmail: accounts.employee.email }]) assert.equal((await send(path, { body })).status, 400);
  assert.equal((await send(`/users/${accounts.admin._id}/active`, { body: { isActive: false, confirmationEmail: accounts.admin.email } })).status, 400);
  assert.equal((await send(`/users/${String(accounts.admin._id).toUpperCase()}/active`, { body: { isActive: false, confirmationEmail: accounts.admin.email } })).status, 400);
  assert.equal((await send(path, { role: 'user', body: { isActive: false, confirmationEmail: accounts.employee.email } })).status, 403);
  const result = await send(path, { body: { isActive: false, confirmationEmail: accounts.employee.email } });
  assert.equal(result.status, 200);
  assert.equal(result.body.isActive, false);
  noCredentials(result.body);
  assert.equal((await Ticket.findById(ticket._id)).assignedTo, null);
  assert.equal((await send('/tickets', { role: 'employee' })).status, 401);
  assert.equal((await send(path, { body: { isActive: true, confirmationEmail: accounts.employee.email } })).body.isActive, true);
});

test('assignment IDs are canonical so uppercase IDs preserve no-op history and transition locks', async () => {
  const ticket = await report();
  assert.equal((await assign(ticket)).status, 200);
  const result = await send(`/tickets/${String(ticket._id).toUpperCase()}/assign`, { body: { assignedTo: String(accounts.employee._id).toUpperCase() } });
  assert.equal(result.status, 200);
  assert.equal(result.body.assignmentHistory.length, 1);
});

test('Admin detail and disposition responses retain populated assignment and canonical note author roles', async () => {
  const ticket = await report({ assignedTo: accounts.employee._id, notes: [{ text: 'Legacy reply', addedBy: accounts.resident._id }] });
  const detail = await send(`/tickets/${ticket._id}`);
  assert.equal(detail.body.notes[0].addedBy.role, 'user');
  const updated = await send(`/tickets/${ticket._id}/priority`, { body: { priority: 'High' } });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.assignedTo.firstName, 'employee');
  assert.equal(updated.body.notes[0].addedBy.role, 'user');
});

test('assignment waits through cleanup and cannot escape a simultaneous account transition with uppercase IDs', async t => {
  for (const [suffix, transition] of [['active', { isActive: false }], ['role', { role: 'user' }]]) {
    await User.collection.updateOne({ _id: accounts.employee._id }, { $set: { isActive: true, role: 'employee' } });
    const ticket = await report();
    let reachedCleanup, releaseCleanup;
    const started = new Promise(resolve => { reachedCleanup = resolve; });
    const gate = new Promise(resolve => { releaseCleanup = resolve; });
    const original = Ticket.updateMany;
    const mocked = t.mock.method(Ticket, 'updateMany', async function(...args) {
      const result = await original.apply(this, args);
      reachedCleanup();
      await gate;
      return result;
    });
    const changing = send(`/users/${String(accounts.employee._id).toUpperCase()}/${suffix}`, { body: { ...transition, confirmationEmail: accounts.employee.email } });
    await started;
    const assigning = assign(ticket);
    releaseCleanup();
    const [accountResult, assignmentResult] = await Promise.all([changing, assigning]);
    assert.equal(accountResult.status, 200);
    assert.equal(assignmentResult.status, 400);
    assert.equal((await Ticket.findById(ticket._id)).assignedTo, null);
    mocked.mock.restore();
  }
});

test('cleanup failures return failure and leave the account transition unapplied', async t => {
  await report({ assignedTo: accounts.employee._id });
  t.mock.method(Ticket, 'updateMany', async () => { throw new Error('Injected cleanup failure'); });
  for (const [suffix, body] of [['role', { role: 'user' }], ['active', { isActive: false }]]) {
    const result = await send(`/users/${accounts.employee._id}/${suffix}`, { body: { ...body, confirmationEmail: accounts.employee.email } });
    assert.equal(result.status, 500);
    assert.match(result.body.error, /cleanup failure/);
  }
  const account = await User.findById(accounts.employee._id);
  assert.equal(account.role, 'employee');
  assert.equal(account.isActive, true);
});

test('concurrent assignment and deactivation cannot leave an inactive assignee', async () => {
  const tickets = await Promise.all(Array.from({ length: 8 }, () => report()));
  const requests = tickets.map(ticket => assign(ticket));
  requests.splice(3, 0, send(`/users/${accounts.employee._id}/active`, { body: { isActive: false, confirmationEmail: accounts.employee.email } }));
  const results = await Promise.all(requests);
  assert.ok(results.every(x => [200, 400].includes(x.status)));
  assert.equal(await Ticket.countDocuments({ assignedTo: accounts.employee._id, isArchived: false }), 0);
});

async function provisionFixture(t) {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const os = require('node:os');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bmis-provision-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let provisioner;
  try { provisioner = require('../scripts/provision-accounts'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  assert.equal(typeof provisioner?.provisionAccounts, 'function', 'additive provisioner is available without starting a server/database');
  return { ...provisioner, fs, credentialsPath: path.join(directory, 'credentials.json') };
}

test('provisioner adds exactly one Admin/two Employees/two Users and preserves unrelated accounts/tickets', async t => {
  const f = await provisionFixture(t);
  const originalUsers = await User.collection.find({}).toArray();
  const ticket = await report();
  const result = await f.provisionAccounts({ credentialsPath: f.credentialsPath });
  assert.equal(result.created, 5);
  assert.equal(result.existing, 0);
  const created = await User.find({ email: { $in: f.DEMO_ACCOUNTS.map(x => x.email) } });
  assert.deepEqual(created.reduce((counts, row) => ({ ...counts, [row.role]: (counts[row.role] || 0) + 1 }), {}), { admin: 1, employee: 2, user: 2 });
  assert.deepEqual(await User.collection.find({ _id: { $in: originalUsers.map(row => row._id) } }).toArray(), originalUsers);
  assert.equal(await Ticket.countDocuments({}), 1);
  assert.equal((await Ticket.findById(ticket._id)).title, ticket.title);
  const credentials = JSON.parse(await f.fs.readFile(f.credentialsPath, 'utf8')).accounts;
  assert.equal(credentials.length, 5);
  assert.equal(new Set(credentials.map(row => row.password)).size, 5);
  for (const credential of credentials) {
    const login = await send('/auth/login', { role: null, method: 'POST', body: { email: credential.email, password: credential.password } });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, credential.role);
  }
});

test('provisioner reruns preserve passwords, credentials and subsequent role/contact changes', async t => {
  const f = await provisionFixture(t);
  await f.provisionAccounts({ credentialsPath: f.credentialsPath });
  const first = await f.fs.readFile(f.credentialsPath, 'utf8');
  const email = f.DEMO_ACCOUNTS[0].email;
  await User.updateOne({ email }, { $set: { firstName: 'Changed', role: 'user', isActive: false } });
  const before = await User.collection.find({}).sort({ email: 1 }).toArray();
  const result = await f.provisionAccounts({ credentialsPath: f.credentialsPath });
  assert.equal(result.created, 0);
  assert.equal(result.existing, 5);
  assert.deepEqual(await User.collection.find({}).sort({ email: 1 }).toArray(), before);
  assert.equal(await f.fs.readFile(f.credentialsPath, 'utf8'), first);
});

test('provisioner preflights all email collisions before changing any accounts or credentials', async t => {
  const f = await provisionFixture(t);
  await User.create({ firstName: 'Unrelated', lastName: 'Existing', email: f.DEMO_ACCOUNTS.at(-1).email, password });
  const before = await User.collection.find({}).toArray();
  await assert.rejects(f.provisionAccounts({ credentialsPath: f.credentialsPath }), /collision/i);
  assert.deepEqual(await User.collection.find({}).toArray(), before);
  await assert.rejects(f.fs.access(f.credentialsPath));
});
