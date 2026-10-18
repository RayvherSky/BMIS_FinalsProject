import React, { useState } from 'react';
import { Avatar, Button, Card, Descriptions, Form, Input, Modal, Spin, Tag, message } from 'antd';
import { useAuth } from '../context/AuthContext';
import { PHONE_HELP, phoneRulesFor } from '../utils/phone';
import { getRoleLabel } from '../utils/roles';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const openEditor = () => {
    form.resetFields();
    form.setFieldsValue({ firstName: user.firstName, lastName: user.lastName, phone: user.phone, address: user.address });
    setEditing(true);
  };

  const saveProfile = async (values) => {
    const { password, ...data } = values;
    if (data.phone === user.phone) delete data.phone;
    if (password) data.password = password;
    setSaving(true);
    try {
      const result = await updateProfile(data);
      // AuthContext owns the success/error toast and updates the displayed user.
      if (result.success) {
        setEditing(false);
        form.resetFields();
      }
    } catch (error) {
      message.error(error.response?.data?.message || 'Unable to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="page-title">My Profile</h1>
      <Card className="profile-card" extra={<Button type="primary" onClick={openEditor}>Edit Profile</Button>}>
        {user.role !== 'admin' && <div className="profile-summary"><Avatar size={56} style={{ background: '#0A4D68' }}>{user.firstName?.[0]}{user.lastName?.[0]}</Avatar><div><strong>{user.firstName} {user.lastName}</strong><span>{getRoleLabel(user.role)} account · Barangay Baclaran</span></div></div>}
        <Descriptions bordered column={{ xs: 1, sm: 1, md: 2 }} items={[
          { key: 'name', label: 'Name', children: `${user.firstName} ${user.lastName}` },
          { key: 'email', label: 'Email', children: user.email },
          { key: 'role', label: 'Role', children: <Tag color={user.role === 'admin' ? 'blue' : 'green'}>{getRoleLabel(user.role)}</Tag> },
          { key: 'phone', label: 'Phone', children: user.phone || 'Not provided' },
          { key: 'address', label: 'Address', children: user.address || 'Not provided', span: 2 },
        ]} />
      </Card>
      <Modal title="Edit Profile" open={editing} onCancel={() => setEditing(false)} footer={null} closable={!saving} maskClosable={!saving}>
        <Spin spinning={saving}>
          <Form form={form} layout="vertical" onFinish={saveProfile}>
            <Form.Item name="firstName" label="First Name" rules={[{ required: true, whitespace: true, message: 'Please enter your first name' }]}><Input /></Form.Item>
            <Form.Item name="lastName" label="Last Name" rules={[{ required: true, whitespace: true, message: 'Please enter your last name' }]}><Input /></Form.Item>
            <Form.Item name="phone" label="Phone" rules={phoneRulesFor(user.phone)} extra={PHONE_HELP}><Input type="tel" autoComplete="tel" /></Form.Item>
            <Form.Item name="address" label="Address"><Input /></Form.Item>
            <Form.Item name="password" label="New Password" extra="Leave blank to keep your current password." rules={[{ min: 6, message: 'Password must be at least 6 characters' }]}><Input.Password autoComplete="new-password" /></Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>Save Changes</Button>
            <Button onClick={() => setEditing(false)} disabled={saving} style={{ marginLeft: 8 }}>Cancel</Button>
          </Form>
        </Spin>
      </Modal>
    </>
  );
};

export default Profile;
