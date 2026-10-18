import { getHomePath } from '../utils/roles';
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Form, Input, Button } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import barangayLogo from '../assets/Barangay_Logo.png';
import cityHallPhoto from '../assets/Login_Screen_DefPhoto.jpeg';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();

  // Redirect if already authenticated
  if (isAuthenticated && user) {
    return <Navigate to={getHomePath(user.role)} replace />;
  }

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-left-panel" aria-label="Barangay Baclaran, Parañaque City">
        <img className="login-photo" src={cityHallPhoto} alt="Parañaque City Hall" />
        <div className="login-vignette" aria-hidden="true" />
        <p className="login-location">Parañaque City <span aria-hidden="true">/</span> Metro Manila</p>
        <div className="login-logo-overlay">
          <h2>Barangay Baclaran</h2>
          <p>Parañaque City</p>
        </div>
        <div className="login-community-copy">
          <span className="login-gold-rule" aria-hidden="true" />
          <p>A better barangay,<br />together.</p>
          <span>Report a concern. Follow its progress.</span>
        </div>
      </section>

      <div className="login-right-wrapper">
        <section className="login-right-panel" aria-labelledby="login-heading">
          <div className="login-right-inner">
            <div className="login-form-brand">
              <div><strong>Barangay Baclaran</strong><span>Parañaque City</span></div>
              <img className="login-form-logo" src={barangayLogo} alt="Barangay Baclaran seal" width="80" height="80" />
            </div>
            <header className="login-form-header">
              <p className="login-eyebrow">Incident &amp; Hazard Reporting System</p>
              <h1 id="login-heading">Welcome Back</h1>
              <p className="login-subtitle">Sign in to your account</p>
            </header>

            <Form
              name="login"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                label="Email Address"
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input
                  prefix={<MailOutlined aria-hidden="true" />}
                  placeholder="Email Address"
                  autoComplete="username"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password
                  prefix={<LockOutlined aria-hidden="true" />}
                  placeholder="Password"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item className="login-submit">
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Login
                </Button>
              </Form.Item>
            </Form>

            <div className="login-links">
              <p>Don&apos;t have an account? <Link to="/register">Register</Link></p>
              <Link to="/forgot-password">Forgot Password?</Link>
            </div>
            <p className="login-service-note">For non-emergency community concerns.</p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Login;
