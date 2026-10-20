const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { createTestDatabase } = require('./helpers/testDatabase');
const User = require('../models/User');

let database, server, base, admin;
const password = 'AccountPassword123!';
before(async () => {
  process.env.JWT_SECRET = 'isolated-account-contact-tests';
  database = await createTestDatabase('account_contacts');
  await mongoose.connect(database.getUri('account_contacts'));
  await User.init();
  const app = express(); app.use(express.json());
  app.use('/api/auth', require('../routes/authRoutes'));
  app.use('/api/users', require('../routes/userRoutes'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(async () => {
  await User.deleteMany({});
  admin = await User.create({ firstName: 'Admin', lastName: 'Contact', email: 'admin@example.test', phone: '09991234567', password, role: 'admin' });
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await mongoose.disconnect(); if (database) await database.stop();
});
async function send(path, body, account, method = 'POST') {
  const token = account && jwt.sign({ id: String(account._id) }, process.env.JWT_SECRET);
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
const register = fields => send('/auth/register', { firstName: 'Phone', lastName: 'User', password, ...fields });

test('registration requires a valid mobile number and accepts multiple accounts without email', async () => {
  for (const phone of [undefined, '', ' ', null, 9171234567, '123', '09\n171234567']) {
    assert.equal((await register({ phone, email: 'new@example.test' })).status, 400);
  }
  for (const phone of ['09171234567', '+63 918-123-4567']) {
    const result = await register({ phone, role: 'admin', isActive: false });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.user.role, 'user');
    assert.equal(result.body.user.email, undefined);
    assert.equal(result.body.user.phoneNormalized, undefined);
    assert.equal(result.body.user.isActive, true);
  }
});

test('login supports normalized phone, optional email and the legacy email/password API', async () => {
  const created = await register({ phone: '09171234567', email: ' Person@Example.Test ' });
  assert.equal(created.status, 201);
  for (const fields of [{ identifier: '+63 917-123-4567' }, { phone: '0917 123 4567' }, { identifier: 'PERSON@example.test' }, { email: ' person@example.test ' }]) {
    const result = await send('/auth/login', { ...fields, password });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.user._id, created.body.user._id);
  }
  for (const fields of [{ identifier: {} }, { identifier: '123' }, { email: 'missing@example.test' }]) {
    assert.ok([400, 401].includes((await send('/auth/login', { ...fields, password })).status));
  }
  await User.updateOne({ _id: created.body.user._id }, { $set: { isActive: false } });
  assert.equal((await send('/auth/login', { phone: '09171234567', password })).status, 401);
});

test('equivalent phone formats and email collisions remain unique under concurrent registration', async () => {
  const results = await Promise.all([register({ phone: '09171234567' }), register({ phone: '+639171234567' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
  assert.equal((await register({ phone: '09181234567', email: 'ADMIN@example.test' })).status, 400);
  assert.equal((await register({ phone: '09191234567', email: 'invalid-email' })).status, 400);
  assert.equal((await register({ phone: '09191234567', email: {} })).status, 400);
});

test('legacy email logins and unchanged legacy contacts remain editable without rewriting stored values', async () => {
  const legacy = await User.create({ firstName: 'Legacy', lastName: 'Contact', email: 'legacy@example.test', password, phone: 'old contact' });
  assert.equal((await send('/auth/login', { email: legacy.email, password })).status, 200);
  const result = await send('/auth/profile', { firstName: 'Updated', phone: 'old contact' }, legacy, 'PUT');
  assert.equal(result.status, 200);
  assert.equal(result.body.phone, 'old contact');
  assert.equal((await User.findById(legacy._id)).phone, 'old contact');
  assert.equal((await send(`/users/${legacy._id}`, { address: 'Updated', phone: 'old contact' }, admin, 'PUT')).status, 200);
});

test('legacy valid phones can log in and cannot be claimed by a new account; ambiguous phones cannot authenticate', async () => {
  const hash = admin.password;
  const legacy = { firstName: 'Legacy', lastName: 'Phone', email: 'legacy@example.test', password: hash, role: 'user', phone: '+63 917-123-4567' };
  await User.collection.insertOne(legacy);
  assert.equal((await send('/auth/login', { identifier: '09171234567', password })).status, 200);
  assert.equal((await register({ phone: '09171234567' })).status, 400);
  await User.collection.insertOne({ ...legacy, _id: new mongoose.Types.ObjectId(), email: 'duplicate@example.test', phone: '0917 123 4567' });
  assert.equal((await send('/auth/login', { identifier: '09171234567', password })).status, 401);
  assert.equal((await send('/auth/login', { email: legacy.email, password })).status, 200);
});

test('profile and Admin contact updates validate replacements, preserve identifier access and prevent phone collisions', async () => {
  const created = await register({ phone: '09171234567' });
  const user = await User.findById(created.body.user._id);
  assert.equal((await send('/auth/profile', { phone: '+639991234567' }, user, 'PUT')).status, 400);
  assert.equal((await send('/auth/profile', { phone: '' }, user, 'PUT')).status, 400);
  assert.equal((await send(`/users/${user._id}`, { email: '', phone: '' }, admin, 'PUT')).status, 400);
  const changed = await send('/auth/profile', { phone: '+63 918-123-4567', email: 'added@example.test', role: 'admin' }, user, 'PUT');
  assert.equal(changed.status, 200); assert.equal(changed.body.role, 'user');
  assert.equal((await send('/auth/login', { identifier: '09181234567', password })).status, 200);
  assert.equal((await send('/auth/login', { identifier: '09171234567', password })).status, 401);
  assert.equal((await send(`/users/${user._id}`, { email: '' }, admin, 'PUT')).status, 200);
  assert.equal((await User.findById(user._id)).email, undefined);
  assert.equal((await send('/auth/me', undefined, user, 'GET')).body.phoneNormalized, undefined);
});

test('phone-only Admin account confirmation requires the exact account identity and keeps permission guards', async () => {
  const created = await register({ phone: '09171234567' });
  const user = await User.findById(created.body.user._id);
  assert.equal((await send(`/users/${user._id}/role`, { role: 'employee', confirmationIdentifier: '09181234567' }, admin, 'PATCH')).status, 400);
  assert.equal((await send(`/users/${user._id}/role`, { role: 'employee', confirmationIdentifier: '+639171234567' }, user, 'PATCH')).status, 403);
  assert.equal((await send(`/users/${user._id}/role`, { role: 'employee', confirmationIdentifier: '+639171234567' }, admin, 'PATCH')).status, 200);
  assert.equal((await send(`/users/${user._id}/active`, { isActive: false, confirmationIdentifier: '09171234567' }, admin, 'PATCH')).status, 200);
  assert.equal((await send(`/users/${user._id}`, { role: 'admin' }, admin, 'PUT')).status, 400);
});

test('phone-only password recovery uses the existing local demo token and permits a real password reset', async () => {
  assert.equal((await register({ phone: '09171234567' })).status, 201);
  const recovery = await send('/auth/forgot-password', { identifier: '+639171234567' });
  assert.equal(recovery.status, 200); assert.ok(recovery.body.resetToken);
  assert.equal((await send(`/auth/reset-password/${recovery.body.resetToken}`, { password: 'ChangedPassword123!' })).status, 200);
  assert.equal((await send('/auth/login', { identifier: '09171234567', password: 'ChangedPassword123!' })).status, 200);
  assert.equal((await send('/auth/forgot-password', { email: admin.email })).status, 200);
});

test('optional-email index migration preserves documents and uniqueness while allowing absent emails', async () => {
  const { migrateAccountIndexes } = require('../scripts/migrate-account-indexes');
  const migrationDatabase = await createTestDatabase('account_indexes');
  const client = new mongoose.mongo.MongoClient(migrationDatabase.getUri('account_indexes'));
  try {
    await client.connect(); const db = client.db(); const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.insertMany([{ email: 'legacy@example.test', phone: 'old contact' }, { firstName: 'No email' }]);
    const previous = await users.find().toArray();
    const preview = await migrateAccountIndexes(db);
    assert.equal(preview.applied, false);
    assert.ok((await users.listIndexes().toArray()).some(index => index.name === 'email_1'));
    await migrateAccountIndexes(db, { apply: true });
    assert.deepEqual(await users.find().toArray(), previous);
    await users.insertMany([{ phone: '09171234567' }, { phone: '09181234567' }]);
    await assert.rejects(users.insertOne({ email: 'legacy@example.test' }), { code: 11000 });
    await migrateAccountIndexes(db, { apply: true });
    assert.ok(!(await users.listIndexes().toArray()).some(index => index.name === 'email_1'));
  } finally { await client.close(); await migrationDatabase.stop(); }
});

test('legacy international phone separators match the same login and registration identity', async () => {
  const legacy = await User.create({ firstName: 'Legacy', lastName: 'Spaced', email: 'spaced@example.test', password });
  await User.collection.updateOne({ _id: legacy._id }, { $set: { phone: '+ 63 917-123-4567' }, $unset: { phoneNormalized: '' } });
  const login = await send('/auth/login', { identifier: '09171234567', password });
  assert.equal(login.status, 200); assert.equal(login.body.user._id, String(legacy._id));
  assert.equal((await register({ phone: '09171234567' })).status, 400);
});

test('email cannot be removed while an unchanged legacy phone has ambiguous ownership', async () => {
  const first = await User.create({ firstName: 'Legacy', lastName: 'First', email: 'first-legacy@example.test', password });
  const second = await User.create({ firstName: 'Legacy', lastName: 'Second', email: 'second-legacy@example.test', password });
  await User.collection.updateOne({ _id: first._id }, { $set: { phone: '09171234567' } });
  await User.collection.updateOne({ _id: second._id }, { $set: { phone: '+63 917-123-4567' } });
  const result = await send('/auth/profile', { email: '' }, first, 'PUT');
  assert.equal(result.status, 400);
  assert.equal((await User.findById(first._id)).email, 'first-legacy@example.test');
  const login = await send('/auth/login', { email: 'first-legacy@example.test', password });
  assert.equal(login.status, 200);
});
