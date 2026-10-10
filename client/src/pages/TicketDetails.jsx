import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Image, Modal, Result, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import AppLayout from '../components/Layout/AppLayout';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { getAllTickets, getTicketById, linkTicket, updateTicketStatus } from '../api/ticketApi';
import { archiveTicket } from '../api/archiveApi';
import { formatDate, getPriorityColor } from '../utils/helpers';

const TicketDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const base = isAdmin ? '/admin' : '/resident';
  const backPath = isAdmin ? '/admin/dashboard' : '/resident/my-tickets';
  const [ticket, setTicket] = useState(null);
  const [otherTickets, setOtherTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  // A new visit gets a distinct identity, even when navigating A -> B -> A.
  const view = useMemo(() => ({ id }), [id, isAdmin]);
  const currentView = useRef(view);
  const confirmation = useRef(null);
  currentView.current = view;

  useEffect(() => {
    let active = true;
    currentView.current = view;
    setLoading(true);
    setWorking(false);
    setTicket(null);
    setError('');
    setOtherTickets([]);
    const loadTicket = async () => {
      try {
        const data = await getTicketById(id);
        if (active) setTicket(data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load ticket');
      } finally {
        if (active) setLoading(false);
      }
    };
    const loadCandidates = async () => {
      try {
        const data = await getAllTickets();
        if (active) setOtherTickets(data.filter((item) => item._id !== id));
      } catch (err) {
        if (active) message.error(err.response?.data?.message || 'Unable to load duplicate candidates');
      }
    };
    loadTicket();
    if (isAdmin) loadCandidates();
    return () => {
      active = false;
      if (currentView.current === view) currentView.current = null;
      confirmation.current?.destroy();
      confirmation.current = null;
    };
  }, [id, isAdmin, view]);

  const confirmStatus = (status) => {
    confirmation.current = Modal.confirm({
      title: `Change status to ${status}?`,
      content: 'The resident will see the updated status on their ticket.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        if (currentView.current !== view) return;
        setWorking(true);
        try {
          const updated = await updateTicketStatus(id, status);
          if (currentView.current !== view) return;
          setTicket(updated);
          message.success(`Ticket marked ${status}`);
        } catch (err) {
          if (currentView.current === view) {
            message.error(err.response?.data?.message || 'Unable to update ticket status');
            throw err;
          }
        } finally {
          if (currentView.current === view) setWorking(false);
        }
      },
    });
  };

  const confirmArchive = () => {
    confirmation.current = Modal.confirm({
      title: 'Archive this ticket?',
      content: 'It will move from the active dashboard to Archived Tickets.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        if (currentView.current !== view) return;
        setWorking(true);
        try {
          await archiveTicket(id);
          if (currentView.current !== view) return;
          message.success('Ticket archived');
          navigate('/admin/dashboard');
        } catch (err) {
          if (currentView.current === view) {
            message.error(err.response?.data?.message || 'Unable to archive ticket');
            throw err;
          }
        } finally {
          if (currentView.current === view) setWorking(false);
        }
      },
    });
  };

  const selectDuplicate = async (targetId) => {
    if (currentView.current !== view) return;
    setWorking(true);
    try {
      const updated = await linkTicket(id, targetId);
      if (currentView.current !== view) return;
      setTicket(updated);
      message.success('Duplicate ticket linked');
    } catch (err) {
      if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to link duplicate ticket');
    } finally {
      if (currentView.current === view) setWorking(false);
    }
  };

  const items = ticket ? [
    { key: 'title', label: 'Title', children: ticket.title, span: 2 },
    { key: 'description', label: 'Description', children: <span style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</span>, span: 2 },
    { key: 'category', label: 'Category', children: ticket.category },
    { key: 'status', label: 'Status', children: <Space wrap><StatusBadge status={ticket.status} />{ticket.isArchived && <Tag>Archived</Tag>}</Space> },
    { key: 'priority', label: 'Priority', children: <Tag color={getPriorityColor(ticket.priority)}>{ticket.priority}</Tag> },
    { key: 'location', label: 'Location', children: ticket.location },
    { key: 'submitter', label: 'Submitted By', children: ticket.submittedBy ? `${ticket.submittedBy.firstName} ${ticket.submittedBy.lastName} (${ticket.submittedBy.email})` : 'Unknown', span: 2 },
    { key: 'created', label: 'Date Submitted', children: formatDate(ticket.createdAt), span: 2 },
    ...(ticket.resolvedAt ? [{ key: 'resolved', label: 'Resolved At', children: formatDate(ticket.resolvedAt), span: 2 }] : []),
    ...(ticket.dismissedAt ? [{ key: 'dismissed', label: 'Dismissed At', children: formatDate(ticket.dismissedAt), span: 2 }] : []),
    ...(ticket.linkedTicket ? [{ key: 'linked', label: 'Linked Ticket', children: <Link to={`${base}/ticket/${ticket.linkedTicket._id}`}>{ticket.linkedTicket.title || 'View linked ticket'}</Link>, span: 2 }] : []),
  ] : [];
  const imageUrl = ticket?.image ? (ticket.image.startsWith('/uploads/') ? ticket.image : `/uploads/${ticket.image}`) : '';

  return (
    <AppLayout>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)} style={{ marginBottom: 20 }}>Back to tickets</Button>
      <Spin spinning={loading} tip="Loading ticket...">
        {error ? <Result status="warning" title={error} /> : ticket && (
          <Card className="detail-card" title={<h1 style={{ fontSize: 22, color: '#0A4D68', margin: 0 }}>Ticket Details</h1>}>
            <Descriptions bordered column={{ xs: 1, sm: 1, md: 2 }} items={items} />
            {imageUrl && <div style={{ marginTop: 24 }}><Typography.Title level={5}>Evidence Photo</Typography.Title><Image className="detail-image" src={imageUrl} alt={`Evidence for ${ticket.title}`} style={{ maxHeight: 400, objectFit: 'contain' }} /></div>}
            {isAdmin && !ticket.isArchived && (
              <>
                <div className="admin-actions">
                  {ticket.status === 'Pending' && <Button type="primary" disabled={working} onClick={() => confirmStatus('In Progress')}>Start Processing</Button>}
                  {ticket.status === 'In Progress' && <Button type="primary" disabled={working} onClick={() => confirmStatus('Resolved')}>Mark Resolved</Button>}
                  {['Pending', 'In Progress'].includes(ticket.status) && <Button danger disabled={working} onClick={() => confirmStatus('Dismissed')}>Dismiss</Button>}
                  {['Resolved', 'Dismissed'].includes(ticket.status) && <Button type="primary" disabled={working} onClick={confirmArchive}>Archive Ticket</Button>}
                </div>
                <div style={{ marginTop: 24 }}>
                  <Typography.Title level={5}>Link to Duplicate</Typography.Title>
                  <Select aria-label="Link to Duplicate" showSearch optionFilterProp="label" placeholder="Search other active tickets" value={ticket.linkedTicket?._id} onChange={selectDuplicate} disabled={working} style={{ width: '100%', maxWidth: 600 }} options={otherTickets.map((item) => ({ value: item._id, label: item.title }))} virtual={false} />
                </div>
              </>
            )}
            {isAdmin && ticket.isArchived && <Button onClick={() => navigate('/admin/archive')} style={{ marginTop: 24 }}>Go to Archived Tickets</Button>}
          </Card>
        )}
      </Spin>
    </AppLayout>
  );
};

export default TicketDetails;
