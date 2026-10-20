import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select, Space, Spin, Table, Tag, message } from 'antd';
import { changeUserRole, getAllUsers, setUserActive, updateUser } from '../api/userApi';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { PHONE_HELP, REQUIRED_PHONE_HELP, normalizePhone, phoneRulesFor } from '../utils/phone';
import { getRoleLabel, normalizeRole, ROLE_OPTIONS } from '../utils/roles';
const identityFor = account => account?.email || normalizePhone(account?.phone) || '';
const confirmationLabel = account => `Confirm account ${account?.email ? 'email' : 'phone'}`;
const confirms = (account, value) => !!identityFor(account) && (account?.email
  ? value.trim().toLowerCase() === account.email.toLowerCase()
  : normalizePhone(value) === normalizePhone(account?.phone));

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null);
  const [nextRole, setNextRole] = useState('user');
  const [activeTarget, setActiveTarget] = useState(null);
  const [activeEmail, setActiveEmail] = useState('');
  const [changingActive, setChangingActive] = useState(false);
  const [roleFilter, setRoleFilter] = useState();
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [changingRole, setChangingRole] = useState(false);
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const load = async () => {
      try {
        const data = await getAllUsers({ search });
        if (active) setUsers(data);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load users');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [search, reload]);

  const edit = (user) => {
    form.setFieldsValue({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, address: user.address });
    setEditing(user);
  };

  const openRoleChange = (user) => {
    setRoleTarget(user);
    setNextRole(normalizeRole(user.role));
    setConfirmationEmail('');
  };

  const canChangeRole = roleTarget && nextRole !== normalizeRole(roleTarget.role)
    && confirms(roleTarget, confirmationEmail);

  const saveRole = async () => {
    if (!canChangeRole || changingRole) return;
    setChangingRole(true);
    try {
      const updated = await changeUserRole(roleTarget._id, nextRole, confirmationEmail);
      message.success('User role updated');
      setRoleTarget(null);
      setReload(value => value + 1);
      if (updated._id === currentUser._id) window.location.reload();
    } catch (error) {
      message.error(error.response?.data?.message || 'Unable to change user role');
    } finally {
      setChangingRole(false);
    }
  };

  const canChangeActive = activeTarget && confirms(activeTarget, activeEmail);
  const saveActive = async () => {
    if (!canChangeActive || changingActive) return;
    setChangingActive(true);
    try {
      await setUserActive(activeTarget._id, activeTarget.isActive === false, activeEmail);
      message.success(activeTarget.isActive === false ? 'Account activated' : 'Account deactivated');
      setActiveTarget(null); setReload(value => value + 1);
    } catch (error) { message.error(error.response?.data?.message || 'Unable to update account status'); }
    finally { setChangingActive(false); }
  };

  const save = async (values) => {
    const data = { ...values };
    if (data.phone === editing.phone) delete data.phone;
    setSaving(true);
    try {
      const updated = await updateUser(editing._id, data);
      message.success('User updated');
      setEditing(null);
      form.resetFields();
      setReload((value) => value + 1);
      if (updated._id === currentUser._id) {
        // Refresh the header after editing the current account's contact details.
        window.location.reload();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Unable to update user');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'Name', key: 'name', render: (_, user) => `${user.firstName} ${user.lastName}` },
    { title: 'Email', dataIndex: 'email', render: value => value || 'Not provided' },
    { title: 'Role', dataIndex: 'role', render: (value) => <Tag color={value === 'admin' ? 'blue' : value === 'employee' ? 'cyan' : 'green'}>{getRoleLabel(value)}</Tag> },
    { title: 'Account', dataIndex: 'isActive', render: value => <Tag color={value === false ? 'default' : 'success'}>{value === false ? 'Inactive' : 'Active'}</Tag> },
    { title: 'Phone', dataIndex: 'phone', render: (value) => value || 'Not provided' },
    { title: 'Address', dataIndex: 'address', render: (value) => value || 'Not provided' },
    { title: 'Registered', dataIndex: 'createdAt', render: (value) => formatDate(value) },
    { title: 'Actions', key: 'actions', render: (_, user) => (
      <Space wrap>
        <Button type="link" onClick={() => edit(user)}>Edit</Button>
        <Button type="link" danger onClick={() => openRoleChange(user)}>Change Role</Button>
        <Button type="link" danger={user.isActive !== false} disabled={user._id === currentUser._id} onClick={() => { setActiveTarget(user); setActiveEmail(''); }}>{user.isActive === false ? 'Activate' : 'Deactivate'}</Button>
      </Space>
    ) },
  ];

  return (
    <>
      <h1 className="page-title">User Management</h1>
      <div className="filter-bar"><Input.Search placeholder="Search users by name, email or phone" allowClear onSearch={(value) => setSearch(value.trim())} style={{ maxWidth: 420 }} /><Select aria-label="Account role filter" placeholder="All roles" allowClear value={roleFilter} onChange={value => { setRoleFilter(value); setPage(1); }} options={ROLE_OPTIONS} style={{ minWidth: 160 }} virtual={false} /></div>
      <Spin spinning={loading} tip="Loading users..."><Table rowKey="_id" columns={columns} dataSource={roleFilter ? users.filter(user => normalizeRole(user.role) === roleFilter) : users} scroll={{ x: 1200 }} pagination={{ current: page, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} /></Spin>
      <Modal title="Edit User" open={!!editing} onCancel={() => setEditing(null)} footer={null} closable={!saving} maskClosable={!saving}>
        <Spin spinning={saving}>
          <Form form={form} layout="vertical" onFinish={save}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true, whitespace: true, message: 'Please enter a first name' }]}><Input /></Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true, whitespace: true, message: 'Please enter a last name' }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Please enter a valid email' }]} extra="Optional"><Input /></Form.Item>
            <Form.Item name="phone" label="Phone" rules={phoneRulesFor(editing?.phone)} extra={normalizePhone(editing?.phone) ? REQUIRED_PHONE_HELP : PHONE_HELP}><Input type="tel" autoComplete="tel" /></Form.Item>
            <Form.Item name="address" label="Address"><Input /></Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>Save Changes</Button>
            <Button disabled={saving} onClick={() => setEditing(null)} style={{ marginLeft: 8 }}>Cancel</Button>
          </Form>
        </Spin>
      </Modal>
      <Modal
        title="Change User Role"
        open={!!roleTarget}
        onCancel={() => { if (!changingRole) setRoleTarget(null); }}
        onOk={saveRole}
        okText="Confirm Role Change"
        okButtonProps={{ danger: true, disabled: !canChangeRole }}
        confirmLoading={changingRole}
        cancelButtonProps={{ disabled: changingRole }}
        closable={!changingRole}
        maskClosable={!changingRole}
      >
        <Alert
          type="warning"
          showIcon
          message="This changes account permissions"
          description={nextRole === 'admin'
            ? 'Admins can manage all reports and users. Grant this access only to authorized staff.'
            : nextRole === 'employee'
              ? 'Employees can view and update only their assigned active tickets. They cannot change ticket status, priority, assignments or other accounts.'
              : 'Users can submit and follow their own reports. Changing your own role will remove your admin access.'}
          style={{ marginBottom: 20 }}
        />
        {normalizeRole(roleTarget?.role) === 'employee' && nextRole !== 'employee' && <Alert type="warning" message="All active assignments for this employee will be cleared. Ticket status and history will be preserved." style={{ marginBottom: 16 }} />}
        <p style={{ marginBottom: 16 }}>Account: <strong>{roleTarget?.firstName} {roleTarget?.lastName}</strong><br />{identityFor(roleTarget)}</p>
        <Form layout="vertical">
          <Form.Item label="New Role" htmlFor="new-user-role">
            <Select id="new-user-role" aria-label="New Role" value={nextRole} onChange={setNextRole} disabled={changingRole} virtual={false} options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label={confirmationLabel(roleTarget)} htmlFor="confirm-role-email" extra={`Type ${identityFor(roleTarget) || 'the account identity'} to confirm.`}>
            <Input id="confirm-role-email" aria-label={confirmationLabel(roleTarget)} autoComplete="off" value={confirmationEmail} onChange={event => setConfirmationEmail(event.target.value)} disabled={changingRole} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title={activeTarget?.isActive === false ? 'Activate Account' : 'Deactivate Account'} open={!!activeTarget} onCancel={() => { if (!changingActive) setActiveTarget(null); }} onOk={saveActive} okText="Confirm Account Status" confirmLoading={changingActive} okButtonProps={{ danger: activeTarget?.isActive !== false, disabled: !canChangeActive }} cancelButtonProps={{ disabled: changingActive }} closable={!changingActive} maskClosable={!changingActive}>
        <Alert type="warning" showIcon message={activeTarget?.isActive === false ? 'This account will be able to sign in again.' : 'This account will lose access immediately.'} description={normalizeRole(activeTarget?.role) === 'employee' ? 'Deactivation clears active assignments and preserves ticket history. Reactivation does not restore old assignments.' : undefined} style={{ marginBottom: 20 }} />
        <p>{activeTarget?.firstName} {activeTarget?.lastName} · {identityFor(activeTarget)}</p>
        <Form layout="vertical"><Form.Item label={confirmationLabel(activeTarget)} htmlFor="confirm-active-email" extra={`Type ${identityFor(activeTarget) || 'the account identity'} to confirm.`}><Input id="confirm-active-email" value={activeEmail} onChange={event => setActiveEmail(event.target.value)} autoComplete="off" disabled={changingActive} /></Form.Item></Form>
      </Modal>
    </>
  );
};

export default UserManagement;
