import React, { useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { ReloadOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllTickets } from '../api/ticketApi';
import { CATEGORIES, STATUSES, formatDate, getPriorityColor } from '../utils/helpers';
import StatusBadge from '../components/StatusBadge/StatusBadge';

export default function EmployeeQueue() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const timer = setTimeout(async () => {
      try {
        const data = await getAllTickets({ search, category, status });
        if (active) { setRecords(data); setError(''); }
      } catch (failure) {
        if (active) { setRecords([]); setError(failure.response?.data?.message || 'Unable to load assigned tickets'); }
      } finally { if (active) setLoading(false); }
    }, search ? 180 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [search, category, status, refresh]);

  const open = ticket => navigate(`/employee/ticket/${ticket._id}`);
  const columns = [
    { title: 'Assignment', key: 'title', render: (_, ticket) => <div className="assignment-title"><small>#{ticket._id.slice(-8).toUpperCase()}</small><Button type="link" onClick={event => { event.stopPropagation(); open(ticket); }}>{ticket.title}</Button><Typography.Text type="secondary"><EnvironmentOutlined /> {ticket.location}</Typography.Text></div> },
    { title: 'Category', key: 'category', render: (_, ticket) => ticket.category === 'Others' && ticket.customCategory ? `Others (${ticket.customCategory})` : ticket.category },
    { title: 'Status', dataIndex: 'status', render: value => <StatusBadge status={value} /> },
    { title: 'Priority', dataIndex: 'priority', render: value => <Tag color={getPriorityColor(value)}>{value}</Tag> },
    { title: 'Submitted', dataIndex: 'createdAt', render: value => formatDate(value), sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt) },
    { title: 'Last update', dataIndex: 'updatedAt', render: value => formatDate(value) },
  ];

  return <section className="employee-workspace">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">STAFF OPERATIONS</span><h1 className="page-title">Assigned Tickets</h1><p>Your current assignments, progress updates, and staff coordination.</p></div><Button icon={<ReloadOutlined />} onClick={() => setRefresh(value => value + 1)} loading={loading}>Refresh assignments</Button></div>
    <div className="employee-queue-panel">
      <div className="filter-bar employee-filters">
        <Input.Search aria-label="Search assigned tickets" placeholder="Search title or full ticket ID" allowClear value={search} onChange={event => setSearch(event.target.value)} onSearch={setSearch} />
        <Select aria-label="Category filter" placeholder="All Categories" allowClear value={category} onChange={setCategory} options={CATEGORIES.map(value => ({ value, label: value }))} virtual={false} />
        <Select aria-label="Status filter" placeholder="All Statuses" allowClear value={status} onChange={setStatus} options={STATUSES.map(value => ({ value, label: value }))} virtual={false} />
      </div>
      {error && <Alert type="error" showIcon message={error} action={<Button onClick={() => setRefresh(value => value + 1)}>Retry</Button>} />}
      <Space className="employee-queue-caption"><Typography.Text role="status" aria-live="polite">{records.length} assigned {records.length === 1 ? 'ticket' : 'tickets'}</Typography.Text><Typography.Text type="secondary">Priority and final status are managed by an administrator.</Typography.Text></Space>
      <Spin spinning={loading} tip="Loading assignments...">
        <Table rowKey="_id" columns={columns} dataSource={records} scroll={{ x: 950 }} pagination={{ current: page, onChange: setPage, pageSize: 10, showSizeChanger: false }} onRow={ticket => ({ onClick: () => open(ticket), style: { cursor: 'pointer' } })} locale={{ emptyText: <Empty description={<><strong>{search || category || status ? 'No matching assignments.' : 'No tickets assigned yet.'}</strong><p>{search || category || status ? 'Try another search or filter.' : 'You will see incidents here once an administrator assigns them to you.'}</p></>} /> }} />
      </Spin>
    </div>
  </section>;
}
