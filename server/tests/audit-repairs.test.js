const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { createTicket, getAllTickets, getMyTickets } = require('../controllers/ticketController');
const { getArchivedTickets } = require('../controllers/archiveController');
const { getAllUsers, updateUser } = require('../controllers/userController');
const { register, updateProfile } = require('../controllers/authController');

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const reportBody = {
  title: 'Animal welfare concern', description: 'Assistance requested near the market.',
  category: 'Others', location: 'Baclaran',
};
const residentId = '507f1f77bcf86cd799439011';

const validPhones = [undefined, '', '   ', '09171234567', '+639171234567', '0917 123 4567', '+63 917-123-4567'];
const invalidPhones = ['not-a-phone-number', '123', '08171234567', '0917123456', '091712345678', '639171234567', '+109171234567', '---', '09(17)1234567', '0917\n1234567', null, 9171234567, {}, ['09171234567']];

test('AUD-06 browser form validator accepts supported formats and rejects invalid values', async () => {
  const { phoneRules } = await import('../../client/src/utils/phone.js');
  for (const phone of validPhones) {
    await assert.doesNotReject(phoneRules[0].validator(null, phone));
  }
  for (const phone of invalidPhones) {
    await assert.rejects(phoneRules[0].validator(null, phone), /mobile/i);
  }
});

test('AUD-06 edit-form validation preserves unchanged legacy contacts but validates replacements', async () => {
  const { phoneRulesFor } = await import('../../client/src/utils/phone.js');
  const rule = phoneRulesFor('legacy contact')[0];
  await assert.doesNotReject(rule.validator(null, 'legacy contact'));
  await assert.rejects(rule.validator(null, 'another invalid contact'), /mobile/i);
  await assert.doesNotReject(rule.validator(null, '+63 917-123-4567'));
  await assert.doesNotReject(rule.validator(null, ''));
});

test('AUD-06 registration rejects invalid supplied phones before any account lookup/write', async t => {
  const lookup = t.mock.method(User.Query.prototype, 'exec', async () => null);
  const create = t.mock.method(User, 'create', async () => { throw new Error('Unexpected account write'); });
  for (const phone of invalidPhones) {
    const res = response();
    await register({ body: { firstName: 'Test', lastName: 'Phone', email: 'phone@example.com', password: 'Password123!', phone } }, res);
    assert.equal(res.statusCode, 400, `phone=${JSON.stringify(phone)}`);
    assert.match(res.body.message, /phone|mobile/i);
  }
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
});

test('AUD-06 registration accepts optional blanks and the supported mobile formats', async t => {
  t.mock.method(jwt, 'sign', () => 'unit-test-token');
  t.mock.method(User.Query.prototype, 'exec', async () => null);
  t.mock.method(User, 'create', async data => new User(data));
  for (const phone of validPhones) {
    const res = response();
    await register({ body: { firstName: 'Test', lastName: 'Phone', email: 'phone@example.com', password: 'Password123!', phone } }, res);
    assert.equal(res.statusCode, 201, `phone=${JSON.stringify(phone)}`);
    assert.equal(res.body.user.phone, phone || '');
    assert.equal(res.body.user.role, 'resident');
  }
});

for (const [name, handler] of [['profile', updateProfile], ['admin user', updateUser]]) {
  test(`AUD-06 ${name} rejects invalid phones without modifying or saving the account`, async t => {
    const account = new User({ _id: residentId, firstName: 'Test', lastName: 'Phone', email: 'phone@example.com', password: 'Password123!', phone: '09171234567' });
    t.mock.method(User.Query.prototype, 'exec', async () => account);
    const save = t.mock.method(account, 'save', async () => account);
    for (const phone of invalidPhones) {
      const res = response();
      await handler({ user: { id: residentId }, params: { id: residentId }, body: { phone, firstName: 'Unwanted change' } }, res);
      assert.equal(res.statusCode, 400, `phone=${JSON.stringify(phone)}`);
      assert.equal(account.phone, '09171234567');
      assert.equal(account.firstName, 'Test');
    }
    assert.equal(save.mock.callCount(), 0);
  });

  test(`AUD-06 ${name} accepts valid phones and supports clearing or omitting the field`, async t => {
    const account = new User({ _id: residentId, firstName: 'Test', lastName: 'Phone', email: 'phone@example.com', password: 'Password123!', phone: '09171234567' });
    t.mock.method(User.Query.prototype, 'exec', async () => account);
    t.mock.method(account, 'save', async () => account);
    for (const phone of validPhones) {
      const before = account.phone;
      const res = response();
      await handler({ user: { id: residentId }, params: { id: residentId }, body: { phone } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(account.phone, phone === undefined ? before : phone);
    }
  });

  test(`AUD-06 ${name} preserves an unchanged legacy phone when saving another field`, async t => {
    const account = new User({ _id: residentId, firstName: 'Test', lastName: 'Phone', email: 'phone@example.com', password: 'Password123!', phone: 'legacy contact' });
    t.mock.method(User.Query.prototype, 'exec', async () => account);
    t.mock.method(account, 'save', async () => account);
    const res = response();
    await handler({ user: { id: residentId }, params: { id: residentId }, body: { address: 'New address' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(account.phone, 'legacy contact');
    assert.equal(account.address, 'New address');
  });
}

test('AUD-04 Others rejects missing, blank, or non-text labels before storing a report', async t => {
  const create = t.mock.method(Ticket, 'create', async () => { throw new Error('Unexpected database write'); });
  for (const customCategory of [undefined, '', '  \t\n', null, 123, {}, ['Animal welfare']]) {
    const res = response();
    await createTicket({ body: { ...reportBody, customCategory }, user: { id: residentId } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /category/i);
  }
  assert.equal(create.mock.callCount(), 0);
});

test('AUD-04 Others stores a trimmed label and preserves report fields', async t => {
  let stored;
  t.mock.method(Ticket, 'create', async data => {
    assert.equal(new Ticket(data).validateSync(), undefined);
    stored = { ...data, _id: '507f1f77bcf86cd799439012' };
    return stored;
  });
  t.mock.method(Ticket.Query.prototype, 'exec', async () => stored);
  const res = response();
  await createTicket({ body: { ...reportBody, customCategory: '  Animal welfare  ', priority: 'High' }, user: { id: residentId }, file: { filename: 'evidence.jpg' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(stored.customCategory, 'Animal welfare');
  assert.equal(stored.submittedBy, residentId);
  // Resident submissions cannot override the administrator-assigned priority.
  assert.equal(stored.priority, 'Medium');
  assert.equal(stored.image, '/uploads/evidence.jpg');
});

test('AUD-04 standard reports discard stale custom labels and default priority', async t => {
  let stored;
  t.mock.method(Ticket, 'create', async data => { stored = data; return new Ticket(data); });
  t.mock.method(Ticket.Query.prototype, 'exec', async () => stored);
  const res = response();
  await createTicket({ body: { ...reportBody, category: 'Sanitation', customCategory: 'Stale label' }, user: { id: residentId } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(stored.customCategory, '');
  assert.equal(stored.priority, 'Medium');
});

const directories = [
  ['tickets', getAllTickets, Ticket, ['title', 'description'], { isArchived: false }],
  ['my-tickets', getMyTickets, Ticket, ['title', 'description'], { isArchived: false, submittedBy: 'resident-id' }],
  ['archive', getArchivedTickets, Ticket, ['title', 'description'], { isArchived: true }],
  ['users', getAllUsers, User, ['firstName', 'lastName', 'email'], {}],
];

for (const [name, handler, Model, fields, baseFilter] of directories) {
  test(`AUD-03 ${name} emits literal, case-insensitive search queries`, async t => {
    let query;
    t.mock.method(Model.Query.prototype, 'exec', async function () {
      query = this.getFilter();
      return [];
    });
    for (const search of ['[', '(', '.*', '+', '\\', 'pavement']) {
      const res = response();
      await handler({ query: { search }, user: { id: 'resident-id' } }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(Object.keys(query.$or[0]), [fields[0]]);
      assert.deepEqual(query.$or.map(branch => Object.keys(branch)[0]), fields);
      for (const branch of query.$or) {
        const pattern = Object.values(branch)[0];
        const regex = new RegExp(pattern.$regex, pattern.$options);
        assert.equal(regex.test(`Report ${search.toUpperCase()} detail`), true);
        assert.equal(regex.test('unrelated text'), false);
      }
      for (const [key, value] of Object.entries(baseFilter)) assert.equal(query[key], value);
    }
  });

  test(`AUD-03 ${name} rejects non-text search input before querying`, async t => {
    const exec = t.mock.method(Model.Query.prototype, 'exec', async () => []);
    for (const search of [[], ['a', 'b'], {}, 123, null]) {
      const res = response();
      await handler({ query: { search }, user: { id: 'resident-id' } }, res);
      assert.equal(res.statusCode, 400);
    }
    assert.equal(exec.mock.callCount(), 0);
  });

  test(`AUD-03 ${name} preserves an empty search and existing filters`, async t => {
    let query;
    t.mock.method(Model.Query.prototype, 'exec', async function () {
      query = this.getFilter();
      return [];
    });
    const filters = { category: 'Infrastructure', status: 'Pending', priority: 'High' };
    for (const search of [undefined, '']) {
      const res = response();
      await handler({ query: { ...filters, search }, user: { id: 'resident-id' } }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(query, name === 'users' ? {} : { ...baseFilter, ...filters });
    }
  });
}
