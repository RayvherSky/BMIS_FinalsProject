import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Alert, Result } from 'antd';
import { MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import api from '../api/axios';

const { Text, Paragraph } = Typography;

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [resetInfo, setResetInfo] = useState(null);
  const [error, setError] = useState(null);

  const onFinish = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/auth/forgot-password', {
        email: values.email,
      });
      setResetInfo(response.data);
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || 'Failed to process request. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Card className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-header">
          <div className="gov-seal">
            <SafetyCertificateOutlined />
          </div>
          <h2>Forgot Password</h2>
          <p>Enter your email to receive a reset link</p>
        </div>

        {resetInfo ? (
          <div>
            <Result
              status="success"
              title="Reset Link Generated"
              subTitle="In production, this link would be sent to your email."
            />
            <Alert
              type="info"
              showIcon
              message="Password Reset Link (Demo)"
              description={
                <div>
                  <Paragraph copyable style={{ marginBottom: 8 }}>
                    {resetInfo.resetUrl ||
                      `${window.location.origin}/reset-password/${resetInfo.resetToken || resetInfo.token}`}
                  </Paragraph>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    This link is displayed here for demo purposes only. In a production
                    environment, it would be sent via email.
                  </Text>
                </div>
              }
              style={{ marginBottom: 24 }}
            />
            <div style={{ textAlign: 'center' }}>
              <Link to="/login">
                <Button type="primary">Back to Login</Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <Alert
                type="error"
                message={error}
                showIcon
                closable
                style={{ marginBottom: 16 }}
                onClose={() => setError(null)}
              />
            )}

            <Form
              name="forgot-password"
              onFinish={onFinish}
              layout="vertical"
              size="large"
            >
              <Form.Item
                name="email"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#0A4D68' }} />}
                  placeholder="Email Address"
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
                  Send Reset Link
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
              <Link to="/login">Back to Login</Link>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default ForgotPassword;
