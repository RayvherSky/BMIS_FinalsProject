const { test } = require('node:test');
const assert = require('node:assert/strict');
const searchModule = import('../../client/src/utils/ticketSearch.js');
const report = {
  _id: 'one', title: 'Blocked drainage', description: 'Water beside the market',
  submittedBy: { firstName: 'Ana', lastName: 'Reyes', email: 'ana@example.com' },
  category: 'Sanitation', status: 'Pending', priority: 'High', location: 'Quirino Avenue',
  createdAt: '2026-10-18T09:00:00Z', archivedAt: '2026-10-20T09:00:00Z',
  notes: [{ text: 'Secret internal wording', isPrivate: true }],
  linkedTicket: { title: 'Foreign private report' },
};

test('SEARCH every requested column, custom labels and displayed/ISO dates are searchable', async () => {
  const { filterTickets } = await searchModule;
  for (const query of ['drainage', 'ANA REYES', 'ana@example.com', 'Sanitation', 'Pending', 'High', 'Quirino', '2026-10-18', 'Oct 18 2026', '2026-10-20']) {
    assert.deepEqual(filterTickets([report], query), [report], query);
  }
  assert.equal(filterTickets([{ ...report, category: 'Others', customCategory: 'Animal welfare' }], 'animal').length, 1);
  assert.equal(filterTickets([{ ...report, isArchived: true, archivedAt: null, updatedAt: '2026-10-21T09:00:00Z' }], '2026-10-21').length, 1);
  assert.equal(filterTickets([report], 'not present').length, 0);
});

test('SEARCH returns multiple matching reports and combines terms across columns', async () => {
  const { filterTickets } = await searchModule;
  const second = { ...report, _id: 'two', title: 'Drainage repair', priority: 'Low' };
  assert.equal(filterTickets([report, second], 'drainage').length, 2);
  assert.deepEqual(filterTickets([report, second], 'Ana sanitation high'), [report]);
  assert.equal(filterTickets([report, second], '').length, 2);
});

test('SEARCH fuzzy toggle tolerates typing errors without changing literal mode', async () => {
  const { filterTickets } = await searchModule;
  for (const typo of ['sanitaton', 'draingae', 'pendign']) {
    assert.equal(filterTickets([report], typo, false).length, 0, typo);
    assert.equal(filterTickets([report], typo, true).length, 1, typo);
  }
  assert.equal(filterTickets([report], 'unrelated', true).length, 0);
  assert.equal(filterTickets([report], '2026-10-19', true).length, 0);
});

test('SEARCH treats regex characters literally and excludes notes and linked-report data', async () => {
  const { filterTickets } = await searchModule;
  for (const query of ['[', '.*', '+', '\\']) assert.equal(filterTickets([report], query).length, 0);
  assert.equal(filterTickets([{ ...report, title: 'Drainage [north]' }], '[').length, 1);
  assert.equal(filterTickets([report], 'Secret internal').length, 0);
  assert.equal(filterTickets([report], 'Foreign private').length, 0);
  assert.equal(filterTickets([{ _id: 'missing', submittedBy: null, createdAt: 'invalid' }], 'anything', true).length, 0);
});
