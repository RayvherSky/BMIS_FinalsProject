const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createTestDatabase } = require('./helpers/testDatabase');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
let database, server, base, accounts;
before(async () => {
  process.env.JWT_SECRET = 'isolated-review-contact-tests';
  database = await createTestDatabase('review_contacts');
  await mongoose.connect(database.getUri('review_contacts'));
  const app = express(); app.use(express.json());
  app.use('/api/tickets', require('../routes/ticketRoutes'));
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/users', require('../routes/userRoutes'));
  app.use('/api/archive', require('../routes/archiveRoutes'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  accounts = {};
  for (const [i, name] of ['admin', 'employee', 'employee2', 'user', 'other'].entries()) {
    accounts[name] = await User.create({ firstName: name, lastName: 'Contact', email: `${name}@example.test`,
      password: 'Password123!', role: name === 'employee2' ? 'employee' : name === 'other' ? 'user' : name,
      phone: `0917123456${i}`, address: `${name} address` });
  }
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await mongoose.disconnect(); if (database) await database.stop();
});
async function send(path, role = 'admin', body, method = body === undefined ? 'GET' : 'POST') {
  const token = role && jwt.sign({ id: String(accounts[role]._id) }, process.env.JWT_SECRET);
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, body: response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
async function report(fields = {}) { return Ticket.create({ title: 'Contact report', description: 'Inspect the market.', category: 'Infrastructure', location: 'Baclaran', submittedBy: accounts.user._id, ...fields }); }

test('assigned Employees can read User contact details while other Employees cannot access them', async () => {
  const row = await report({ status: 'In Progress', assignedTo: accounts.employee._id });
  const own = await send(`/tickets/${row._id}`, 'employee');
  assert.equal(own.status, 200); assert.equal(own.body.submittedBy.phone, accounts.user.phone);
  assert.equal(own.body.submittedBy.email, accounts.user.email); assert.equal(own.body.submittedBy.address, accounts.user.address);
  const foreign = await send(`/tickets/${row._id}`, 'employee2');
  assert.equal(foreign.status, 403); assert.doesNotMatch(JSON.stringify(foreign.body), /09171234563|user@example/);
});

test('Admin links eligible reports across categories while archive and self-link safeguards remain', async () => {
  const parent = await report(); const child = await report({ category: 'Sanitation' });
  const linked = await send(`/tickets/${child._id}/link`, 'admin', { linkedTicketId: String(parent._id) }, 'PUT');
  assert.equal(linked.status, 200); assert.equal(linked.body.linkedTicket._id, String(parent._id));
  assert.equal((await send(`/tickets/${parent._id}/link`, 'admin', { linkedTicketId: String(parent._id) }, 'PUT')).status, 400);
  await Ticket.updateOne({ _id: child._id }, { $set: { isArchived: true } });
  assert.equal((await send(`/tickets/${child._id}/link`, 'admin', { linkedTicketId: String(parent._id) }, 'PUT')).status, 400);
});
