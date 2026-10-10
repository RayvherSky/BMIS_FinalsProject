import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Button, Avatar, Typography, Space } from 'antd';
import {
  DashboardOutlined,
  PlusCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  InboxOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * AppLayout component providing the main application shell with
 * collapsible sidebar, header with user controls, and content area.
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content to render
 */
const AppLayout = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === 'admin';

  const adminMenuItems = [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/admin/users',
      icon: <TeamOutlined />,
      label: 'Users',
    },
    {
      key: '/admin/archive',
      icon: <InboxOutlined />,
      label: 'Archive',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
  ];

  const residentMenuItems = [
    {
      key: '/resident/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/resident/submit-ticket',
      icon: <PlusCircleOutlined />,
      label: 'Submit Ticket',
    },
    {
      key: '/resident/my-tickets',
      icon: <FileTextOutlined />,
      label: 'My Tickets',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
  ];

  const menuItems = isAdmin ? adminMenuItems : residentMenuItems;

  // Determine selected key based on current path
  const getSelectedKey = () => {
    const path = location.pathname;
    // Check for exact matches first
    const exactMatch = menuItems.find((item) => item.key === path);
    if (exactMatch) return [exactMatch.key];

    // Check for prefix matches (e.g., /admin/ticket/:id -> /admin/dashboard)
    if (path.startsWith('/admin/ticket')) return ['/admin/dashboard'];
    if (path.startsWith('/resident/ticket')) return ['/resident/my-tickets'];

    return [path];
  };

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const userDropdownItems = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: 'Profile',
        onClick: () => navigate('/profile'),
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        danger: true,
        onClick: logout,
      },
    ],
  };

  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'User';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        theme="dark"
        width={250}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div className={`sidebar-logo ${collapsed ? 'collapsed' : ''}`}>
          {collapsed ? (
            <SafetyCertificateOutlined style={{ fontSize: 24, color: '#D4A017' }} />
          ) : (
            <>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              BMIS
            </>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKey()}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 250, transition: 'margin-left 0.2s' }}>
        <Header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <span className="header-brand">
              Barangay Baclaran Incident Reporting System
            </span>
          </Space>

          <div className="header-right">
            <Dropdown menu={userDropdownItems} placement="bottomRight" trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{ backgroundColor: '#0A4D68' }}
                  icon={<UserOutlined />}
                  size="small"
                />
                <Text className="header-user">{userName}</Text>
              </Space>
            </Dropdown>
          </div>
        </Header>

        <Content className="page-content">{children}</Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
