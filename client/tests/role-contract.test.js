import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRole, getHomePath, getTicketBasePath, getRoleLabel } from '../src/utils/roles.js';

test('ROLE legacy and canonical standard users share User permissions and destinations', () => {
  for (const role of ['user', 'resident']) {
    assert.equal(normalizeRole(role), 'user');
    assert.equal(getHomePath(role), '/user/dashboard');
    assert.equal(getTicketBasePath(role), '/user');
    assert.equal(getRoleLabel(role), 'User');
  }
});

test('ROLE Employees enter their own queue and Admin destinations stay unchanged', () => {
  assert.equal(getHomePath('employee'), '/employee/assigned-tickets');
  assert.equal(getTicketBasePath('employee'), '/employee');
  assert.equal(getRoleLabel('employee'), 'Employee');
  assert.equal(getHomePath('admin'), '/admin/dashboard');
  assert.equal(getTicketBasePath('admin'), '/admin');
  assert.equal(getRoleLabel('admin'), 'Admin');
});

test('ROLE unknown or missing roles do not inherit a standard-user destination', () => {
  for (const role of [undefined, null, '', 'owner', 'EMPLOYEE']) {
    assert.equal(normalizeRole(role), null);
    assert.equal(getHomePath(role), '/login');
    assert.equal(getTicketBasePath(role), null);
  }
});
