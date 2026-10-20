import { getHomePath } from '../utils/roles';
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Row, Col } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { REQUIRED_PHONE_HELP, requiredPhoneRules } from '../utils/phone';

const { Text } = Typography;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const { register, isAuthenticated, user } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated && user) {
    return <Navigate to={getHomePath(user.role)} replace />;
  }

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const { confirmPassword, ...data } = values;
      await register(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Card className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-header">
          <div className="gov-seal">
            <SafetyCertificateOutlined />
          </div>
          <h2>Create Account</h2>
          <p>Barangay Baclaran Incident Reporting System</p>
        </div>

        <Form
          name="register"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                rules={[{ required: true, message: 'First name required' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#0A4D68' }} />}
                  placeholder="First Name"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                rules={[{ required: true, message: 'Last name required' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#0A4D68' }} />}
                  placeholder="Last Name"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="email"
            label="Email (optional)"
            rules={[
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#0A4D68' }} />}
              placeholder="Email Address"
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="password"
                rules={[
                  { required: true, message: 'Password required' },
                  { min: 6, message: 'Minimum 6 characters' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#0A4D68' }} />}
                  placeholder="Password"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Confirm your password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#0A4D68' }} />}
                  placeholder="Confirm Password"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="phone" label="Contact Number" rules={requiredPhoneRules} extra={REQUIRED_PHONE_HELP}>
            <Input
              type="tel"
              autoComplete="tel"
              prefix={<PhoneOutlined style={{ color: '#0A4D68' }} />}
              placeholder="Phone Number"
            />
          </Form.Item>

          <Form.Item name="address">
            <Input
              prefix={<HomeOutlined style={{ color: '#0A4D68' }} />}
              placeholder="Address (optional)"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, fontWeight: 600 }}
            >
              Register
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text>
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Login
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Register;
