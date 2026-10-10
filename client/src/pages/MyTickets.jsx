import React, { useEffect, useState } from 'react';
import { Button, Input, Select, Spin, Table, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { getMyTickets } from '../api/ticketApi';
import { CATEGORIES, STATUSES, formatDate, getPriorityColor } from '../utils/helpers';

const MyTickets = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const load = async () => {
      try {
        const data = await getMyTickets({ category, status, search });
        if (active) setTickets(data);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load your tickets');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [category, status, search]);

  const columns = [
    { title: 'Title', dataIndex: 'title', render: (title, ticket) => <Button type="link" onClick={(event) => { event.stopPropagation(); navigate(`/resident/ticket/${ticket._id}`); }} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>{title}</Button> },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Status', dataIndex: 'status', render: (value) => <StatusBadge status={value} /> },
    { title: 'Priority', dataIndex: 'priority', render: (value) => <Tag color={getPriorityColor(value)}>{value}</Tag> },
    { title: 'Location', dataIndex: 'location' },
    { title: 'Date', dataIndex: 'createdAt', render: (value) => formatDate(value), sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt), defaultSortOrder: 'descend' },
  ];

  return (
    <AppLayout>
      <h1 className="page-title">My Tickets</h1>
      <div className="filter-bar">
        <Select aria-label="Category filter" placeholder="All Categories" allowClear value={category} onChange={setCategory} options={CATEGORIES.map((value) => ({ value, label: value }))} style={{ minWidth: 200 }} virtual={false} />
        <Select aria-label="Status filter" placeholder="All Statuses" allowClear value={status} onChange={setStatus} options={STATUSES.map((value) => ({ value, label: value }))} style={{ minWidth: 180 }} virtual={false} />
        <Input.Search placeholder="Search tickets" allowClear onSearch={(value) => setSearch(value.trim())} style={{ maxWidth: 360 }} />
      </div>
      <Spin spinning={loading} tip="Loading tickets...">
        <Table rowKey="_id" columns={columns} dataSource={tickets} scroll={{ x: 1000 }} pagination={{ current: page, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} onRow={(ticket) => ({ onClick: () => navigate(`/resident/ticket/${ticket._id}`), style: { cursor: 'pointer' } })} />
      </Spin>
    </AppLayout>
  );
};

export default MyTickets;
