import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Image, Modal, Result, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import AppLayout from '../components/Layout/AppLayout';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { getAllTickets, getTicketById, linkTicket, updateTicketStatus, updateTicketPriority } from '../api/ticketApi';
import { archiveTicket } from '../api/archiveApi';
import { formatDate, getPriorityColor, PRIORITIES } from '../utils/helpers';

const TicketDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const base = isAdmin ? '/admin' : '/resident';
  const backPath = isAdmin ? '/admin/dashboard' : '/resident/my-tickets';
  
  const [ticket, setTicket] = useState(null);
  const [otherTickets, setOtherTickets] = useState([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  
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
    setSelectedDuplicates([]); 
    
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

  const confirmPriority = (newPriority) => {
    if (newPriority === ticket.priority) return;
    
    confirmation.current = Modal.confirm({
      title: `Change priority to ${newPriority}?`,
      content: 'This will update the urgency level of this ticket.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        if (currentView.current !== view) return;
        setWorking(true);
        try {
          const updated = await updateTicketPriority(id, newPriority);
          if (currentView.current !== view) return;
          setTicket(updated);
          message.success(`Ticket priority changed to ${newPriority}`);
        } catch (err) {
          if (currentView.current === view) {
            message.error(err.response?.data?.message || 'Unable to update ticket priority');
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

  const handleLinkMultipleDuplicates = async () => {
    if (currentView.current !== view || selectedDuplicates.length === 0) return;
    setWorking(true);
    try {
      // FIX: We update the SELECTED tickets to point to THIS master ticket.
      await Promise.all(selectedDuplicates.map(targetId => linkTicket(targetId, id)));
      
      if (currentView.current !== view) return;
      message.success('Duplicate tickets linked successfully');
      
      const updated = await getTicketById(id);
      setTicket(updated);
      setSelectedDuplicates([]);
      
      const data = await getAllTickets();
      setOtherTickets(data.filter((item) => item._id !== id));
    } catch (err) {
      if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to link duplicate tickets');
    } finally {
      if (currentView.current === view) setWorking(false);
    }
  };

  // Find all tickets from the database that are currently linked to THIS ticket
  const linkedToThis = otherTickets.filter(t => {
    if (!t.linkedTicket) return false;
    const linkedId = typeof t.linkedTicket === 'object' ? t.linkedTicket._id : t.linkedTicket;
    return linkedId === id;
  });

  const items = ticket ? [
    { key: 'title', label: 'Title', children: ticket.title, span: 2 },
    { key: 'description', label: 'Description', children: <span style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</span>, span: 2 },
    { key: 'category', label: 'Category', children: ticket.category },
    { key: 'status', label: 'Status', children: <Space wrap><StatusBadge status={ticket.status} />{ticket.isArchived && <Tag>Archived</Tag>}</Space> },
    { 
      key: 'priority', 
      label: 'Priority', 
      children: (isAdmin && !ticket.isArchived) ? (
        <Select 
          value={ticket.priority} 
          onChange={confirmPriority} 
          disabled={working}
          options={PRIORITIES.map(p => ({ value: p, label: p }))}
          style={{ width: 120 }}
        />
      ) : (
        <Tag color={getPriorityColor(ticket.priority)}>{ticket.priority}</Tag>
      )
    },
    { key: 'location', label: 'Location', children: ticket.location },
    { key: 'submitter', label: 'Submitted By', children: ticket.submittedBy ? `${ticket.submittedBy.firstName} ${ticket.submittedBy.lastName} (${ticket.submittedBy.email})` : 'Unknown', span: 2 },
    { key: 'created', label: 'Date Submitted', children: formatDate(ticket.createdAt), span: 2 },
    ...(ticket.resolvedAt ? [{ key: 'resolved', label: 'Resolved At', children: formatDate(ticket.resolvedAt), span: 2 }] : []),
    ...(ticket.dismissedAt ? [{ key: 'dismissed', label: 'Dismissed At', children: formatDate(ticket.dismissedAt), span: 2 }] : []),
    
    // IF THIS TICKET POINTS TO A MASTER (Duplicate)
    ...(ticket.linkedTicket ? [{ 
      key: 'linked_master', 
      label: 'Duplicate Of', 
      children: <Link to={`${base}/ticket/${ticket.linkedTicket._id}`}>{ticket.linkedTicket.title || 'View master ticket'}</Link>, 
      span: 2 
    }] : []),
    
    // IF THIS TICKET HAS MULTIPLE DUPLICATES POINTING TO IT (Master)
    ...(linkedToThis.length > 0 ? [{ 
      key: 'linked_list', 
      label: 'Linked Tickets', 
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {linkedToThis.map(dup => (
            <div key={dup._id}>
              <Link to={`${base}/ticket/${dup._id}`}>• {dup.title}</Link>
              <Tag style={{ marginLeft: 8, fontSize: '10px' }}>{dup.status}</Tag>
            </div>
          ))}
        </div>
      ), 
      span: 2 
    }] : []),
  ] : [];
  
  const imageUrl = ticket?.image ? (ticket.image.startsWith('/uploads/') ? ticket.image : `/uploads/${ticket.image}`) : '';

  // Only show tickets in the dropdown that are in the same category AND are not already linked to a master
  const duplicateOptions = ticket ? otherTickets
    .filter((item) => item.category === ticket.category && !item.linkedTicket)
    .map((item) => ({ value: item._id, label: `${item.title} (${item.status})` })) 
    : [];

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
                
                <div style={{ marginTop: 24, padding: '16px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                  <Typography.Title level={5}>Link Multiple Duplicates (Category: {ticket.category})</Typography.Title>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: '12px' }}>
                    Select other active tickets in the same category to link and clear them as duplicates of this ticket.
                  </Typography.Text>
                  
                  <Space.Compact style={{ width: '100%', maxWidth: 600 }}>
                    <Select 
                      mode="multiple"
                      allowClear
                      aria-label="Link to Duplicate" 
                      showSearch 
                      optionFilterProp="label" 
                      placeholder="Search to select tickets..." 
                      value={selectedDuplicates}
                      onChange={setSelectedDuplicates} 
                      disabled={working} 
                      style={{ width: '100%' }} 
                      options={duplicateOptions} 
                      virtual={false} 
                    />
                    <Button 
                      type="primary" 
                      onClick={handleLinkMultipleDuplicates} 
                      disabled={working || selectedDuplicates.length === 0}
                    >
                      Link Selected
                    </Button>
                  </Space.Compact>
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