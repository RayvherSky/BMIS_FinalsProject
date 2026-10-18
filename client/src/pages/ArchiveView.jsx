import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Select, Spin, Table, Tabs, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
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
  const [status, setStatus] = useState('all');
  const mounted = useRef(false);
  const confirmation = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; confirmation.current?.destroy(); };
  }, []);

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
    confirmation.current = Modal.confirm({
      title: 'Are you sure you want to restore this ticket?',
      content: `“${ticket.title}” will return to the active queue with status ${ticket.status}.`,
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        if (!mounted.current) return;
        setRestoring(ticket._id);
        try {
          await restoreTicket(ticket._id);
          if (!mounted.current) return;
          setTickets((current) => current.filter((item) => item._id !== ticket._id));
          message.success('Ticket restored');
        } catch (error) {
          if (!mounted.current) return;
          message.error(error.response?.data?.message || 'Unable to restore ticket');
          throw error;
        } finally {
          if (mounted.current) setRestoring(null);
        }
      },
    });
  };

  const visibleTickets = status === 'all' ? tickets : tickets.filter(ticket => ticket.status === status);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleTickets.length / 10)));
  const statusTabs = ['all', 'Resolved', 'Dismissed'].map(value => ({
    key: value,
    label: `${value === 'all' ? 'All' : value} (${value === 'all' ? tickets.length : tickets.filter(ticket => ticket.status === value).length})`,
  }));

  const columns = [
    { title: 'Title', dataIndex: 'title', render: (title, ticket) => <Button type="link" onClick={() => navigate(`/admin/ticket/${ticket._id}`, { state: { fromArchive: true } })} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>{title}</Button> },
    { title: 'Submitted By', dataIndex: 'submittedBy', render: (value) => value ? `${value.firstName} ${value.lastName}` : 'Unknown' },
    { title: 'Category', dataIndex: 'category', render: (value, ticket) => value === 'Others' && ticket.customCategory ? `Others (${ticket.customCategory})` : value },
    { title: 'Last Status', dataIndex: 'status', render: (value) => <StatusBadge status={value} /> },
    { title: 'Date Archived', key: 'archivedAt', render: (_, ticket) => formatDate(ticket.archivedAt || ticket.updatedAt) },
    { title: 'Actions', key: 'actions', render: (_, ticket) => <Button onClick={() => restore(ticket)} loading={restoring === ticket._id} disabled={!!restoring}>Restore</Button> },
  ];

  return (
    <>
      <h1 className="page-title">Archived Tickets</h1>
      <Typography.Paragraph type="secondary">Resolved reports move here automatically. Dismissed reports can be archived manually.</Typography.Paragraph>
      <Tabs activeKey={status} items={statusTabs} onChange={value => { setStatus(value); setPage(1); }} />
      <div className="filter-bar">
        <Select aria-label="Category filter" placeholder="All Categories" allowClear value={category} onChange={setCategory} options={CATEGORIES.map((value) => ({ value, label: value }))} style={{ minWidth: 200 }} virtual={false} />
        <Input.Search placeholder="Search archived tickets" allowClear onSearch={(value) => setSearch(value.trim())} style={{ maxWidth: 360 }} />
      </div>
      <Spin spinning={loading} tip="Loading archived tickets..."><Table rowKey="_id" columns={columns} dataSource={visibleTickets} scroll={{ x: 1000 }} pagination={{ current: currentPage, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} /></Spin>
    </>
  );
};

export default ArchiveView;
