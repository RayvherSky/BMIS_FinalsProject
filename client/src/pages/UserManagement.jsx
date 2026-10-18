import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select, Space, Spin, Table, Tag, message } from 'antd';
import { changeUserRole, getAllUsers, updateUser } from '../api/userApi';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { PHONE_HELP, phoneRulesFor } from '../utils/phone';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null);
  const [nextRole, setNextRole] = useState('resident');
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
    setNextRole(user.role);
    setConfirmationEmail('');
  };

  const canChangeRole = roleTarget && nextRole !== roleTarget.role
    && confirmationEmail.trim().toLowerCase() === roleTarget.email.toLowerCase();

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
    { title: 'Email', dataIndex: 'email' },
    { title: 'Role', dataIndex: 'role', render: (value) => <Tag color={value === 'admin' ? 'blue' : 'green'}>{value}</Tag> },
    { title: 'Phone', dataIndex: 'phone', render: (value) => value || 'Not provided' },
    { title: 'Address', dataIndex: 'address', render: (value) => value || 'Not provided' },
    { title: 'Registered', dataIndex: 'createdAt', render: (value) => formatDate(value) },
    { title: 'Actions', key: 'actions', render: (_, user) => (
      <Space wrap>
        <Button type="link" onClick={() => edit(user)}>Edit</Button>
        <Button type="link" danger onClick={() => openRoleChange(user)}>Change Role</Button>
      </Space>
    ) },
  ];

  return (
    <>
      <h1 className="page-title">User Management</h1>
      <div className="filter-bar"><Input.Search placeholder="Search users by name or email" allowClear onSearch={(value) => setSearch(value.trim())} style={{ maxWidth: 420 }} /></div>
      <Spin spinning={loading} tip="Loading users..."><Table rowKey="_id" columns={columns} dataSource={users} scroll={{ x: 1100 }} pagination={{ current: page, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} /></Spin>
      <Modal title="Edit User" open={!!editing} onCancel={() => setEditing(null)} footer={null} closable={!saving} maskClosable={!saving}>
        <Spin spinning={saving}>
          <Form form={form} layout="vertical" onFinish={save}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true, whitespace: true, message: 'Please enter a first name' }]}><Input /></Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true, whitespace: true, message: 'Please enter a last name' }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please enter an email' }, { type: 'email', message: 'Please enter a valid email' }]}><Input /></Form.Item>
            <Form.Item name="phone" label="Phone" rules={phoneRulesFor(editing?.phone)} extra={PHONE_HELP}><Input type="tel" autoComplete="tel" /></Form.Item>
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
            : 'Resident access cannot manage other users or reports. Changing your own role will remove your admin access.'}
          style={{ marginBottom: 20 }}
        />
        <p style={{ marginBottom: 16 }}>Account: <strong>{roleTarget?.firstName} {roleTarget?.lastName}</strong><br />{roleTarget?.email}</p>
        <Form layout="vertical">
          <Form.Item label="New Role" htmlFor="new-user-role">
            <Select id="new-user-role" aria-label="New Role" value={nextRole} onChange={setNextRole} disabled={changingRole} virtual={false} options={[{ value: 'admin', label: 'Admin' }, { value: 'resident', label: 'Resident' }]} />
          </Form.Item>
          <Form.Item label="Confirm account email" htmlFor="confirm-role-email" extra={`Type ${roleTarget?.email || 'the account email'} to confirm.`}>
            <Input id="confirm-role-email" aria-label="Confirm account email" autoComplete="off" value={confirmationEmail} onChange={event => setConfirmationEmail(event.target.value)} disabled={changingRole} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserManagement;
