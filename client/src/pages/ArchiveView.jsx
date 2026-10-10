import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Spin, Table, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout/AppLayout';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { getArchivedTickets, restoreTicket } from '../api/archiveApi';
import { CATEGORIES, formatDate } from '../utils/helpers';

const ArchiveView = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [category, setCategory] = useState();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const load = async () => {
      try {
        const data = await getArchivedTickets({ category, search });
        if (active) setTickets(data);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load archived tickets');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [category, search]);

  const restore = (ticket) => {
    Modal.confirm({
      title: 'Are you sure you want to restore this ticket?',
      content: `“${ticket.title}” will return to the active queue with status ${ticket.status}.`,
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        setRestoring(ticket._id);
        try {
          await restoreTicket(ticket._id);
          setTickets((current) => current.filter((item) => item._id !== ticket._id));
          setPage((current) => Math.min(current, Math.max(1, Math.ceil((tickets.length - 1) / 10))));
          message.success('Ticket restored');
        } catch (error) {
          message.error(error.response?.data?.message || 'Unable to restore ticket');
          throw error;
        } finally {
          setRestoring(null);
        }
      },
    });
  };

  const columns = [
    { title: 'Title', dataIndex: 'title', render: (title, ticket) => <Button type="link" onClick={() => navigate(`/admin/ticket/${ticket._id}`)} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>{title}</Button> },
    { title: 'Submitted By', dataIndex: 'submittedBy', render: (value) => value ? `${value.firstName} ${value.lastName}` : 'Unknown' },
    { title: 'Category', dataIndex: 'category' },
    { title: 'Last Status', dataIndex: 'status', render: (value) => <StatusBadge status={value} /> },
    { title: 'Date Archived', dataIndex: 'updatedAt', render: (value) => formatDate(value) },
    { title: 'Actions', key: 'actions', render: (_, ticket) => <Button onClick={() => restore(ticket)} loading={restoring === ticket._id} disabled={!!restoring}>Restore</Button> },
  ];

  return (
    <AppLayout>
      <h1 className="page-title">Archived Tickets</h1>
      <div className="filter-bar">
        <Select aria-label="Category filter" placeholder="All Categories" allowClear value={category} onChange={setCategory} options={CATEGORIES.map((value) => ({ value, label: value }))} style={{ minWidth: 200 }} virtual={false} />
        <Input.Search placeholder="Search archived tickets" allowClear onSearch={(value) => setSearch(value.trim())} style={{ maxWidth: 360 }} />
      </div>
      <Spin spinning={loading} tip="Loading archived tickets..."><Table rowKey="_id" columns={columns} dataSource={tickets} scroll={{ x: 1000 }} pagination={{ current: page, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} /></Spin>
    </AppLayout>
  );
};

export default ArchiveView;
