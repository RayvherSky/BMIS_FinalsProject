import React, { useLayoutEffect, useRef, useState } from 'react';
import { Layout, Menu, Dropdown, Button, Avatar, Typography, Space } from 'antd';
import {
  DashboardOutlined,
  PlusCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  InboxOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel, normalizeRole } from '../../utils/roles';
import barangaySeal from '../../assets/Barangay_Logo.png';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

/**
 * AppLayout component providing the main application shell with
 * collapsible sidebar, header with user controls, and content area.
 * @param {Object} props
 */
const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [indicator, setIndicator] = useState(null);
  const menuContainer = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const role = normalizeRole(user?.role);
  const isAdmin = role === 'admin';

  const adminMenuItems = [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/admin/action-center',
      icon: <BellOutlined />,
      label: 'Action Center',
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
      key: '/user/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/user/submit-ticket',
      icon: <PlusCircleOutlined />,
      label: 'Submit Ticket',
    },
    {
      key: '/user/my-tickets',
      icon: <FileTextOutlined />,
      label: 'My Tickets',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
  ];

  const employeeMenuItems = [
    { key: '/employee/assigned-tickets', icon: <FileTextOutlined />, label: 'Assigned Tickets' },
    { key: '/employee/action-center', icon: <BellOutlined />, label: 'Action Center' },
    { key: '/profile', icon: <UserOutlined />, label: 'Profile' },
  ];
  const menuItems = isAdmin ? adminMenuItems : role === 'employee' ? employeeMenuItems : residentMenuItems;

  // Determine selected key based on current path
  const getSelectedKey = () => {
    const path = location.pathname;
    // Check for exact matches first
    const exactMatch = menuItems.find((item) => item.key === path);
    if (exactMatch) return [exactMatch.key];
    if (location.state?.fromActionCenter && (isAdmin || role === 'employee')) return [`/${role}/action-center`];

    // Check for prefix matches (e.g., /admin/ticket/:id -> /admin/dashboard)
    if (path.startsWith('/admin/ticket')) return [location.state?.fromArchive ? '/admin/archive' : '/admin/dashboard'];
    if (path.startsWith('/user/ticket')) return ['/user/my-tickets'];
    if (path.startsWith('/employee/ticket')) return ['/employee/assigned-tickets'];

    return [path];
  };

  const selectedKey = getSelectedKey()[0];
  const isDashboard = location.pathname === '/admin/dashboard' || location.pathname === '/user/dashboard';

  useLayoutEffect(() => {
    const container = menuContainer.current;
    const measure = () => {
      const selected = container?.querySelector('.ant-menu-item-selected');
      if (!selected) { setIndicator(null); return; }
      const item = selected.getBoundingClientRect();
      const top = item.top - container.getBoundingClientRect().top;
      setIndicator(current => current && Math.abs(current.top - top) < 0.5 && current.height === item.height
        ? current : { top, height: item.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [selectedKey, collapsed, role]);

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
    <Layout className={`app-shell role-${role}`} style={{ minHeight: '100vh' }}>
      <Sider
        id="primary-sidebar"
        collapsible
        trigger={null}
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
          {!isAdmin ? (
            <><img className="workspace-seal" src={barangaySeal} alt="Barangay Baclaran seal" />{!collapsed && <span>BMIS<small>{role === 'employee' ? 'Staff workspace' : 'Reporting portal'}</small></span>}</>
          ) : collapsed ? (
            <SafetyCertificateOutlined style={{ fontSize: 24, color: '#D4A017' }} />
          ) : (
            <>
              <SafetyCertificateOutlined style={{ marginRight: 8 }} />
              BMIS
            </>
          )}
        </div>
        <nav className="sidebar-navigation" ref={menuContainer} aria-label="Primary navigation">
          {indicator && <div className="sidebar-active-indicator" aria-hidden="true" style={{ height: indicator.height, transform: `translateY(${indicator.top}px)` }} />}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </nav>
      </Sider>

      <Layout className="app-shell-main" style={{ marginLeft: collapsed ? 80 : 250 }}>
        <Header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <Space>
            <Button
              type="text"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              aria-controls="primary-sidebar"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16 }}
            />
            <span className="header-brand">
              Barangay Baclaran Incident Reporting System
            </span>
            {!isAdmin && <span className="workspace-role">{getRoleLabel(role)}</span>}
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

        <Content className="page-content">
          <div className={isDashboard ? 'dashboard-viewport' : undefined}>
            <div className={isDashboard ? 'dashboard-page' : undefined}><Outlet /></div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
