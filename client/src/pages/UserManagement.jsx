import React, { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Spin, Table, Tag, message } from 'antd';
import AppLayout from '../components/Layout/AppLayout';
import { getAllUsers, updateUser } from '../api/userApi';
import { formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
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
    form.setFieldsValue({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, address: user.address, role: user.role });
    setEditing(user);
  };

  const save = async (values) => {
    setSaving(true);
    try {
      const updated = await updateUser(editing._id, values);
      message.success('User updated');
      setEditing(null);
      form.resetFields();
      setReload((value) => value + 1);
      if (updated._id === currentUser._id) {
        // Reload /me so the header and role guard immediately reflect self-edits.
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
    { title: 'Actions', key: 'actions', render: (_, user) => <Button type="link" onClick={() => edit(user)}>Edit</Button> },
  ];

  return (
    <AppLayout>
      <h1 className="page-title">User Management</h1>
      <div className="filter-bar"><Input.Search placeholder="Search users by name or email" allowClear onSearch={(value) => setSearch(value.trim())} style={{ maxWidth: 420 }} /></div>
      <Spin spinning={loading} tip="Loading users..."><Table rowKey="_id" columns={columns} dataSource={users} scroll={{ x: 1100 }} pagination={{ current: page, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} /></Spin>
      <Modal title="Edit User" open={!!editing} onCancel={() => setEditing(null)} footer={null} closable={!saving} maskClosable={!saving}>
        <Spin spinning={saving}>
          <Form form={form} layout="vertical" onFinish={save}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true, whitespace: true, message: 'Please enter a first name' }]}><Input /></Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true, whitespace: true, message: 'Please enter a last name' }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please enter an email' }, { type: 'email', message: 'Please enter a valid email' }]}><Input /></Form.Item>
            <Form.Item name="phone" label="Phone"><Input /></Form.Item>
            <Form.Item name="address" label="Address"><Input /></Form.Item>
            <Form.Item name="role" label="Role" rules={[{ required: true }]}><Select aria-label="Role" options={[{ value: 'admin', label: 'Admin' }, { value: 'resident', label: 'Resident' }]} virtual={false} /></Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>Save Changes</Button>
            <Button disabled={saving} onClick={() => setEditing(null)} style={{ marginLeft: 8 }}>Cancel</Button>
          </Form>
        </Spin>
      </Modal>
    </AppLayout>
  );
};

export default UserManagement;
