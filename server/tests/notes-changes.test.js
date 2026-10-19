const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const userRoutes = require('../routes/userRoutes');
const ticketRoutes = require('../routes/ticketRoutes');
const archiveRoutes = require('../routes/archiveRoutes');

const adminId = '507f1f77bcf86cd799439021';
const residentId = '507f1f77bcf86cd799439022';

// Real HTTP routes/middleware/controllers, with no MongoDB or normal app server.
async function fixture(t) {
  const accounts = new Map([
    [adminId, new User({ _id: adminId, firstName: 'Test', lastName: 'Admin', email: 'admin@example.com', password: 'fixture-only', role: 'admin' })],
    [residentId, new User({ _id: residentId, firstName: 'Test', lastName: 'Resident', email: 'resident@example.com', password: 'fixture-only', role: 'resident' })],
  ]);
  let saves = 0;
  for (const account of accounts.values()) t.mock.method(account, 'save', async () => { saves++; return account; });
  t.mock.method(jwt, 'verify', token => {
    if (token === 'admin-fixture') return { id: adminId };
    if (token === 'resident-fixture') return { id: residentId };
    throw new Error('Invalid fixture token');
  });
  t.mock.method(User.Query.prototype, 'exec', async function () {
    const filter = this.getFilter();
    if (this.op === 'find') return [...accounts.values()].map(account => ({ _id: account._id, role: account.role }));
    const account = filter._id ? accounts.get(String(filter._id)) : [...accounts.values()].find(item => item.email === filter.email);
    if (!account) return null;
    const projection = this.projection();
    if (projection?.password === 0 || projection?.['-password'] === 0) {
      const plain = account.toObject();
      delete plain.password;
      return plain;
    }
    return account;
  });
  const reports = new Map();
  t.mock.method(Ticket, 'create', async data => {
    const report = new Ticket(data);
    const error = report.validateSync();
    if (error) throw error;
    t.mock.method(report, 'save', async () => report);
    reports.set(String(report._id), report);
    return report;
  });
  t.mock.method(Ticket.Query.prototype, 'exec', async function () {
    if (this.op === 'findOneAndUpdate') {
      // Model the conditional write used by lifecycle operations, preserving
      // the original HTTP/state assertions rather than bypassing the predicate.
      const matches = (report, filter) => Object.entries(filter).every(([key, value]) => {
        if (key === '$and') return value.every(part => matches(report, part));
        if (key === '$or') return value.some(part => matches(report, part));
        if (value && typeof value === 'object' && '$ne' in value) return String(report[key]) !== String(value.$ne);
        if (value && typeof value === 'object' && '$exists' in value) return (report[key] !== undefined) === value.$exists;
        return String(report[key]) === String(value);
      });
      const report = [...reports.values()].find(row => matches(row, this.getFilter()));
      if (!report) return null;
      const update = this.getUpdate();
      for (const [key, value] of Object.entries(update.$set || {})) report.set(key, value);
      for (const [key, value] of Object.entries(update.$inc || {})) report.set(key, (report[key] || 0) + value);
      for (const [key, value] of Object.entries(update.$push || {})) report[key].push(value);
      return report;
    }
    if (this.op === 'find') {
      const filter = this.getFilter();
      return [...reports.values()].filter(report => Object.entries(filter).every(([key, value]) => {
        if (key === '$or') return value.some(branch => Object.entries(branch).some(([field, pattern]) => new RegExp(pattern.$regex, pattern.$options).test(report[field])));
        return String(report[key]) === String(value);
      }));
    }
    return reports.get(String(this.getFilter()._id)) || null;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/archive', archiveRoutes);
  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const send = async (path, body, token = 'admin-fixture', method = 'PATCH') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text };
  };
  return { accounts, reports, send, saves: () => saves };
}

test('NOTES-role contact editing rejects role changes before changing any fields', async t => {
  const f = await fixture(t);
  const result = await f.send(`/api/users/${residentId}`, { firstName: 'Unwanted change', role: 'admin' }, 'admin-fixture', 'PUT');
  assert.equal(result.status, 400);
  assert.match(result.body.message, /role/i);
  assert.equal(f.accounts.get(residentId).firstName, 'Test');
  assert.equal(f.accounts.get(residentId).role, 'resident');
  assert.equal(f.saves(), 0);
});

test('NOTES-role ordinary contact edits preserve role and exclude the password', async t => {
  const f = await fixture(t);
  const result = await f.send(`/api/users/${residentId}`, { phone: '09171234567', address: 'Updated address' }, 'admin-fixture', 'PUT');
  assert.equal(result.status, 200);
  assert.equal(result.body.role, 'user');
  assert.equal(result.body.address, 'Updated address');
  assert.equal(Object.hasOwn(result.body, 'password'), false);
});

test('NOTES-role dedicated changes require a valid role and the target email confirmation', async t => {
  const f = await fixture(t);
  for (const body of [
    { role: 'admin' },
    { role: 'admin', confirmationEmail: 'wrong@example.com' },
    { role: 'admin', confirmationEmail: [] },
    { role: 'owner', confirmationEmail: 'resident@example.com' },
    { role: null, confirmationEmail: 'resident@example.com' },
  ]) {
    assert.equal((await f.send(`/api/users/${residentId}/role`, body)).status, 400);
    assert.equal(f.accounts.get(residentId).role, 'resident');
  }
  assert.equal(f.saves(), 0);
});

test('NOTES-role only authenticated current admins can use the dedicated endpoint', async t => {
  const f = await fixture(t);
  const body = { role: 'admin', confirmationEmail: 'resident@example.com' };
  assert.equal((await f.send(`/api/users/${residentId}/role`, body, null)).status, 401);
  assert.equal((await f.send(`/api/users/${residentId}/role`, body, 'invalid-fixture')).status, 401);
  assert.equal((await f.send(`/api/users/${residentId}/role`, body, 'resident-fixture')).status, 403);
  assert.equal(f.saves(), 0);
});

test('NOTES-role confirmed promotion/demotion persists and changes access on an existing session', async t => {
  const f = await fixture(t);
  const path = `/api/users/${residentId}/role`;
  const promoted = await f.send(path, { role: 'admin', confirmationEmail: ' RESIDENT@example.com ' });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.body.role, 'admin');
  assert.equal(Object.hasOwn(promoted.body, 'password'), false);
  assert.equal((await f.send('/api/users', undefined, 'resident-fixture', 'GET')).status, 200);
  const demoted = await f.send(path, { role: 'resident', confirmationEmail: 'resident@example.com' });
  assert.equal(demoted.status, 200);
  assert.equal(demoted.body.role, 'user');
  assert.equal((await f.send('/api/users', undefined, 'resident-fixture', 'GET')).status, 403);
  assert.equal(f.accounts.get(residentId).firstName, 'Test');
});

test('NOTES-role a missing target returns 404 without saving', async t => {
  const f = await fixture(t);
  assert.equal((await f.send('/api/users/507f1f77bcf86cd799439099/role', { role: 'admin', confirmationEmail: 'missing@example.com' })).status, 404);
  assert.equal(f.saves(), 0);
});

const reportBody = { title: 'Test report', description: 'Maintenance requested.', category: 'Infrastructure', location: 'Baclaran' };

test('NOTES-priority residents cannot choose initial priority through report submission', async t => {
  const f = await fixture(t);
  for (const priority of [undefined, 'Low', 'High', 'Urgent', 'Extreme', { level: 'Urgent' }]) {
    const created = await f.send('/api/tickets', { ...reportBody, priority }, 'resident-fixture', 'POST');
    assert.equal(created.status, 201);
    assert.equal(created.body.priority, 'Medium');
    assert.equal(String(f.reports.get(created.body._id).submittedBy), residentId);
  }
});

test('NOTES-priority existing admin endpoint persists all allowed levels for the resident', async t => {
  const f = await fixture(t);
  const created = await f.send('/api/tickets', reportBody, 'resident-fixture', 'POST');
  assert.equal(created.status, 201);
  for (const priority of ['Low', 'Medium', 'High', 'Urgent']) {
    const changed = await f.send(`/api/tickets/${created.body._id}/priority`, { priority });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.priority, priority);
    const residentView = await f.send(`/api/tickets/${created.body._id}`, undefined, 'resident-fixture', 'GET');
    assert.equal(residentView.status, 200);
    assert.equal(residentView.body.priority, priority);
  }
});

test('NOTES-priority resident updates and invalid admin values are rejected without changing priority', async t => {
  const f = await fixture(t);
  const created = await f.send('/api/tickets', reportBody, 'resident-fixture', 'POST');
  const path = `/api/tickets/${created.body._id}/priority`;
  assert.equal((await f.send(path, { priority: 'Urgent' }, 'resident-fixture')).status, 403);
  assert.equal((await f.send(path, { priority: 'Urgent' }, null)).status, 401);
  for (const priority of [undefined, '', 'Extreme', null, ['Urgent']]) {
    assert.equal((await f.send(path, { priority })).status, 400);
  }
  assert.equal(f.reports.get(created.body._id).priority, 'Medium');
});

async function createReport(f, fields = {}) {
  const created = await f.send('/api/tickets', { ...reportBody, ...fields }, 'resident-fixture', 'POST');
  assert.equal(created.status, 201);
  return created.body;
}

test('NAV-archive resolving a ticket records resolution and archive in the same response', async t => {
  const f = await fixture(t);
  const ticket = await createReport(f);
  assert.equal((await f.send(`/api/tickets/${ticket._id}/status`, { status: 'In Progress' }, 'admin-fixture', 'PUT')).status, 200);
  const result = await f.send(`/api/tickets/${ticket._id}/status`, { status: 'Resolved' }, 'admin-fixture', 'PUT');
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'Resolved');
  assert.equal(result.body.isArchived, true);
  assert.ok(result.body.resolvedAt);
  assert.ok(result.body.archivedAt);
  assert.equal(result.body.dismissedAt, null);
  const active = await f.send('/api/tickets', undefined, 'admin-fixture', 'GET');
  const mine = await f.send('/api/tickets/my-tickets', undefined, 'resident-fixture', 'GET');
  assert.equal(active.status, 200);
  assert.equal(mine.status, 200);
  assert.equal(active.body.some(item => item._id === ticket._id), false);
  assert.equal(mine.body.some(item => item._id === ticket._id), false);
  const archive = await f.send('/api/archive', undefined, 'admin-fixture', 'GET');
  assert.equal(archive.status, 200);
  assert.equal(archive.body.some(item => item._id === ticket._id), true);
});

test('NAV-archive repeated resolution preserves the original completion and archive dates', async t => {
  const f = await fixture(t);
  const ticket = await createReport(f);
  const record = f.reports.get(ticket._id);
  record.status = 'Resolved';
  record.isArchived = true;
  record.resolvedAt = new Date('2026-10-01T00:00:00Z');
  record.archivedAt = new Date('2026-10-01T00:00:01Z');
  const result = await f.send(`/api/tickets/${ticket._id}/status`, { status: 'Resolved' }, 'admin-fixture', 'PUT');
  assert.equal(result.status, 200);
  assert.equal(result.body.resolvedAt, '2026-10-01T00:00:00.000Z');
  assert.equal(result.body.archivedAt, '2026-10-01T00:00:01.000Z');
});

test('NAV-archive dismissed tickets stay active until manually archived', async t => {
  const f = await fixture(t);
  const ticket = await createReport(f);
  const dismissed = await f.send(`/api/tickets/${ticket._id}/status`, { status: 'Dismissed' }, 'admin-fixture', 'PUT');
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.body.isArchived, false);
  assert.equal(dismissed.body.archivedAt, null);
  const archived = await f.send(`/api/archive/${ticket._id}/archive`, {}, 'admin-fixture', 'PUT');
  assert.equal(archived.status, 200);
  assert.equal(archived.body.isArchived, true);
  assert.ok(archived.body.archivedAt);
  const restored = await f.send(`/api/archive/${ticket._id}/restore`, {}, 'admin-fixture', 'PUT');
  assert.equal(restored.status, 200);
  assert.equal(restored.body.status, 'Dismissed');
  assert.equal(restored.body.dismissedAt, dismissed.body.dismissedAt);
  assert.equal(restored.body.isArchived, false);
  assert.equal(restored.body.archivedAt, null);
});

test('NAV-archive restoring an auto-archived ticket preserves status and resolution date', async t => {
  const f = await fixture(t);
  const ticket = await createReport(f);
  const resolved = await f.send(`/api/tickets/${ticket._id}/status`, { status: 'Resolved' }, 'admin-fixture', 'PUT');
  const restored = await f.send(`/api/archive/${ticket._id}/restore`, {}, 'admin-fixture', 'PUT');
  assert.equal(restored.status, 200);
  assert.equal(restored.body.status, 'Resolved');
  assert.equal(restored.body.resolvedAt, resolved.body.resolvedAt);
  assert.equal(restored.body.isArchived, false);
  assert.equal(restored.body.archivedAt, null);
  assert.equal((await f.send('/api/tickets', undefined, 'admin-fixture', 'GET')).body.some(item => item._id === ticket._id), true);
});

test('NAV-archive status and category filters combine without including active tickets', async t => {
  const f = await fixture(t);
  const infrastructure = await createReport(f, { title: 'Resolved infrastructure' });
  const sanitation = await createReport(f, { title: 'Resolved sanitation', category: 'Sanitation' });
  const dismissed = await createReport(f, { title: 'Dismissed infrastructure' });
  await createReport(f, { title: 'Active infrastructure' });
  for (const ticket of [infrastructure, sanitation]) await f.send(`/api/tickets/${ticket._id}/status`, { status: 'Resolved' }, 'admin-fixture', 'PUT');
  await f.send(`/api/tickets/${dismissed._id}/status`, { status: 'Dismissed' }, 'admin-fixture', 'PUT');
  await f.send(`/api/archive/${dismissed._id}/archive`, {}, 'admin-fixture', 'PUT');
  for (const [status, wanted] of [['Resolved', infrastructure], ['Dismissed', dismissed]]) {
    const result = await f.send(`/api/archive?status=${status}&category=Infrastructure`, undefined, 'admin-fixture', 'GET');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.map(item => item._id), [wanted._id]);
  }
});

test('NAV-archive new resolutions do not migrate older active resolved reports', async t => {
  const f = await fixture(t);
  const older = await createReport(f);
  f.reports.get(older._id).status = 'Resolved';
  const recent = await createReport(f);
  await f.send(`/api/tickets/${recent._id}/status`, { status: 'Resolved' }, 'admin-fixture', 'PUT');
  assert.equal(f.reports.get(older._id).isArchived, false);
  assert.equal(f.reports.get(recent._id).isArchived, true);
});

test('NAV-archive residents cannot resolve or archive reports and invalid requests preserve state', async t => {
  const f = await fixture(t);
  const ticket = await createReport(f);
  const path = `/api/tickets/${ticket._id}/status`;
  assert.equal((await f.send(path, { status: 'Resolved' }, 'resident-fixture', 'PUT')).status, 403);
  assert.equal((await f.send(`/api/archive/${ticket._id}/archive`, {}, 'resident-fixture', 'PUT')).status, 403);
  assert.equal((await f.send(path, { status: 'Invalid' }, 'admin-fixture', 'PUT')).status, 400);
  assert.equal((await f.send(`/api/archive/${ticket._id}/archive`, {}, 'admin-fixture', 'PUT')).status, 400);
  assert.equal(f.reports.get(ticket._id).status, 'Pending');
  assert.equal(f.reports.get(ticket._id).isArchived, false);
});

test('LINK resolved or archived reports cannot be either side of a new duplicate link', async t => {
  const f = await fixture(t);
  const child = await createReport(f);
  const master = await createReport(f);
  for (const id of [child._id, master._id]) {
    const record = f.reports.get(id);
    for (const [status, archived] of [['Resolved', false], ['Resolved', true], ['Pending', true]]) {
      record.status = status;
      record.isArchived = archived;
      const result = await f.send(`/api/tickets/${child._id}/link`, { linkedTicketId: master._id }, 'admin-fixture', 'PUT');
      assert.equal(result.status, 400, `${id}: ${status}/${archived}`);
      assert.equal(f.reports.get(child._id).linkedTicket, null);
    }
    record.status = 'Pending';
    record.isArchived = false;
  }
  assert.equal((await f.send(`/api/tickets/${child._id}/link`, { linkedTicketId: master._id }, 'admin-fixture', 'PUT')).status, 200);
  assert.equal(String(f.reports.get(child._id).linkedTicket), master._id);
});
