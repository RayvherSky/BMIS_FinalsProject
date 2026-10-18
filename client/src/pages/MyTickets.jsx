import React, { useEffect, useState } from 'react';
import { Button, Card, Empty, Pagination, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { getMyTickets } from '../api/ticketApi';
import { CATEGORIES, STATUSES, formatDate, getPriorityColor } from '../utils/helpers';
import TicketSearch from '../components/TicketSearch/TicketSearch';
import { filterTickets } from '../utils/ticketSearch';

const MyTickets = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState();
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : undefined;
  const setStatus = value => setParams(current => {
    const next = new URLSearchParams(current);
    if (value) next.set('status', value); else next.delete('status');
    return next;
  });
  const [search, setSearch] = useState('');
  const [fuzzy, setFuzzy] = useState(false);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('newest');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    const load = async () => {
      try {
        const data = await getMyTickets({ category, status });
        if (active) setTickets(data);
      } catch (error) {
        if (active) { setTickets([]); message.error(error.response?.data?.message || 'Unable to load your tickets'); }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [category, status]);

  const visibleTickets = [...filterTickets(tickets, search, fuzzy)].sort((a, b) =>
    (new Date(b.createdAt) - new Date(a.createdAt)) * (sortOrder === 'newest' ? 1 : -1));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleTickets.length / 10)));

  return (
    <>
      <div className="workspace-heading">
        <div><span className="workspace-eyebrow">YOUR REPORTS</span><h1 className="page-title">My Tickets</h1><p>Follow your reports and keep the conversation with barangay staff in one place.</p></div>
        <Button type="primary" onClick={() => navigate('/user/submit-ticket')}>Submit a Ticket</Button>
      </div>
      <div className="user-list-controls"><div className="filter-bar">
        <Select aria-label="Category filter" placeholder="All Categories" allowClear value={category} onChange={setCategory} options={CATEGORIES.map((value) => ({ value, label: value }))} style={{ minWidth: 200 }} virtual={false} />
        <Select aria-label="Status filter" placeholder="All Statuses" allowClear value={status} onChange={setStatus} options={STATUSES.map((value) => ({ value, label: value }))} style={{ minWidth: 180 }} virtual={false} />
        <TicketSearch value={search} onChange={value => { setSearch(value); setPage(1); }} fuzzy={fuzzy} onFuzzyChange={value => { setFuzzy(value); setPage(1); }} />
        <Select aria-label="Sort reports" value={sortOrder} onChange={value => { setSortOrder(value); setPage(1); }} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} style={{ minWidth: 150 }} virtual={false} />
      </div></div>
      <Typography.Paragraph role="status" aria-live="polite">{visibleTickets.length} matching tickets</Typography.Paragraph>
      <Spin spinning={loading} tip="Loading tickets...">
        {visibleTickets.length ? <div className="user-report-list">
          {visibleTickets.slice((currentPage - 1) * 10, currentPage * 10).map(ticket => <Card key={ticket._id} className="user-report-card">
            <Space wrap><span className="user-report-reference">#{ticket._id.slice(-8).toUpperCase()}</span><StatusBadge status={ticket.status} />{ticket.isArchived && <Tag>Archived</Tag>}</Space>
            <h2><Button type="link" onClick={() => navigate(`/user/ticket/${ticket._id}`)}>{ticket.title}</Button></h2>
            <Space wrap><Tag>{ticket.category === 'Others' && ticket.customCategory ? `Others (${ticket.customCategory})` : ticket.category}</Tag><Tag color={getPriorityColor(ticket.priority)}>{ticket.priority} priority</Tag></Space>
            <div className="report-metadata"><span>{ticket.location}</span><span>{formatDate(ticket.createdAt)}</span></div>
            <div className="report-metadata"><span>Assigned employee: {ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Awaiting assignment'}</span></div>
          </Card>)}
        </div> : !loading && <Empty description="No matching tickets" />}
        <div className="user-list-pagination"><Pagination current={currentPage} onChange={setPage} total={visibleTickets.length} pageSize={10} showSizeChanger={false} hideOnSinglePage /></div>
      </Spin>
    </>
  );
};

export default MyTickets;
