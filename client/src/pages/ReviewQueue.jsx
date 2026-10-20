import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Pagination, Space, Spin, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTicketReviews } from '../api/reviewApi';
import { formatDate, getPriorityColor } from '../utils/helpers';
import { requestErrorMessage } from '../utils/ticketRequests';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import '../components/TicketReview/TicketReview.css';

const name = account => [account?.firstName, account?.lastName].filter(Boolean).join(' ') || 'Staff member';

export default function ReviewQueue() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setTickets([]);
    const load = async () => {
      try {
        const data = await getTicketReviews({ status: 'pending', search: search.trim(), page, limit: 10 });
        if (active) {
          setTickets(data.items.filter(ticket => ticket.review?.status === 'pending' && !ticket.isArchived));
          setTotal(data.total);
          if (data.page && data.page !== page) setPage(data.page);
        }
      } catch (failure) {
        if (active) { setTickets([]); setTotal(0); setError(requestErrorMessage(failure, 'Unable to load ticket reviews')); }
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [refresh, page, search]);
  return <section className="review-queue">
    <div className="workspace-heading"><div><span className="workspace-eyebrow">EMPLOYEE SUBMISSIONS</span><h1 className="page-title">For Review</h1><p>Review work submitted by assigned Employees before posting a public update or resolving a report.</p></div><Button icon={<ReloadOutlined aria-hidden="true" />} loading={loading} onClick={() => setRefresh(value => value + 1)}>Refresh reviews</Button></div>
    <div className="review-queue-controls"><Input.Search aria-label="Search ticket reviews" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search title or full ticket ID" allowClear /></div>
    <Typography.Paragraph role="status" aria-live="polite">{total} {total === 1 ? 'ticket' : 'tickets'} awaiting review</Typography.Paragraph>
    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
    <Spin spinning={loading} tip="Loading ticket reviews...">
      <div className="review-queue-list">{tickets.map(ticket => <Card key={ticket._id} className="review-queue-card">
        <Space wrap><Tag color="gold">Pending Admin review</Tag><StatusBadge status={ticket.status} /><Tag color={getPriorityColor(ticket.priority)}>{ticket.priority} priority</Tag></Space>
        <h2>{ticket.title}</h2>
        <Typography.Paragraph type="secondary">{ticket.category === 'Others' && ticket.customCategory ? `Others (${ticket.customCategory})` : ticket.category} · {ticket.location}</Typography.Paragraph>
        <Typography.Paragraph>Submitted for review by {name(ticket.review.requestedBy)} · {formatDate(ticket.review.requestedAt)}</Typography.Paragraph>
        <Button onClick={() => navigate(`/admin/ticket/${ticket._id}`, { state: { fromReview: true } })}>Review ticket</Button>
      </Card>)}</div>
      {!loading && !error && tickets.length === 0 && <Empty description={search.trim() ? 'No matching reviews.' : 'No tickets awaiting review.'} />}
      <div className="review-queue-pagination"><Pagination current={page} total={total} pageSize={10} onChange={setPage} showSizeChanger={false} hideOnSinglePage /></div>
    </Spin>
  </section>;
}
