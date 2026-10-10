import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Input, Row, Select, Spin, Statistic, Table, Tag, message } from 'antd';
import { FileTextOutlined, ClockCircleOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { getAllTickets } from '../api/ticketApi';
import { CATEGORIES, STATUSES, PRIORITIES, formatDate, getPriorityColor } from '../utils/helpers';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();
  const [priority, setPriority] = useState();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    const loadTotals = async () => {
      try {
        const data = await getAllTickets();
        if (active) setTotals(data);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load dashboard statistics');
      } finally {
        if (active) setStatsLoading(false);
      }
    };
    loadTotals();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const loadTickets = async () => {
      try {
        const data = await getAllTickets({ category, status, priority, search });
        if (active) setTickets(data);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load tickets');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadTickets();
    return () => { active = false; };
  }, [category, status, priority, search]);

  const stats = [
    { title: 'Total Active Tickets', value: totals.length, icon: <FileTextOutlined />, color: '#0A4D68' },
    { title: 'Pending', value: totals.filter((ticket) => ticket.status === 'Pending').length, icon: <ClockCircleOutlined />, color: '#D4A017' },
    { title: 'In Progress', value: totals.filter((ticket) => ticket.status === 'In Progress').length, icon: <SyncOutlined />, color: '#1890FF' },
    { title: 'Resolved', value: totals.filter((ticket) => ticket.status === 'Resolved').length, icon: <CheckCircleOutlined />, color: '#2D6A4F' },
    { title: 'Dismissed', value: totals.filter((ticket) => ticket.status === 'Dismissed').length, icon: <CloseCircleOutlined />, color: '#FF4D4F' },
  ];
  const columns = [
    { title: 'Title', dataIndex: 'title' },
    { title: 'Submitted By', dataIndex: 'submittedBy', render: (value) => value ? `${value.firstName} ${value.lastName}` : 'Unknown' },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Status', dataIndex: 'status', render: (value) => <StatusBadge status={value} /> },
    { title: 'Priority', dataIndex: 'priority', render: (value) => <Tag color={getPriorityColor(value)}>{value}</Tag> },
    { title: 'Location', dataIndex: 'location' },
    { title: 'Date', dataIndex: 'createdAt', render: (value) => formatDate(value), sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt), defaultSortOrder: 'descend' },
    { title: 'Actions', key: 'actions', render: (_, ticket) => <Button type="link" onClick={() => navigate(`/admin/ticket/${ticket._id}`)}>View</Button> },
  ];

  return (
    <AppLayout>
      <h1 className="page-title">Dashboard</h1>
      <Spin spinning={statsLoading}>
        <Row gutter={[16, 16]} className="stats-row">
          {stats.map((stat) => <Col xs={24} sm={12} lg={8} xl={{ flex: '1 1 0' }} key={stat.title}><Card className="stat-card"><Statistic title={stat.title} value={stat.value} prefix={stat.icon} valueStyle={{ color: stat.color }} /></Card></Col>)}
        </Row>
      </Spin>
      <div className="filter-bar">
        <Select aria-label="Category filter" placeholder="All Categories" allowClear value={category} onChange={setCategory} options={CATEGORIES.map((value) => ({ value, label: value }))} style={{ minWidth: 200 }} virtual={false} />
        <Select aria-label="Status filter" placeholder="All Statuses" allowClear value={status} onChange={setStatus} options={STATUSES.map((value) => ({ value, label: value }))} style={{ minWidth: 170 }} virtual={false} />
        <Select aria-label="Priority filter" placeholder="All Priorities" allowClear value={priority} onChange={setPriority} options={PRIORITIES.map((value) => ({ value, label: value }))} style={{ minWidth: 160 }} virtual={false} />
        <Input.Search placeholder="Search tickets" allowClear onSearch={(value) => setSearch(value.trim())} style={{ maxWidth: 320 }} />
      </div>
      <Spin spinning={loading} tip="Loading tickets...">
        <Table rowKey="_id" columns={columns} dataSource={tickets} scroll={{ x: 1200 }} pagination={{ current: page, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} />
      </Spin>
    </AppLayout>
  );
};

export default AdminDashboard;
