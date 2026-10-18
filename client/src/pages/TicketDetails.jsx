import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
// ADDED: Checkbox to Ant Design imports
import { Button, Card, Descriptions, Grid, Image, Modal, Result, Select, Space, Spin, Tag, Typography, message, List, Divider, Input, Checkbox } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { getAllTickets, getTicketById, linkTicket, unlinkTicket, updateTicketStatus, updateTicketPriority, addTicketNote } from '../api/ticketApi';
import { archiveTicket } from '../api/archiveApi';
import { formatDate, getPriorityColor, PRIORITIES } from '../utils/helpers';

const TicketDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user.role === 'admin';
  const base = isAdmin ? '/admin' : '/resident';
  
  const [ticket, setTicket] = useState(null);
  const backPath = isAdmin ? (ticket?.isArchived || location.state?.fromArchive ? '/admin/archive' : '/admin/dashboard') : '/resident/my-tickets';
  const [otherTickets, setOtherTickets] = useState([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  
  const [noteText, setNoteText] = useState('');
  const [isPrivateNote, setIsPrivateNote] = useState(false); // ADDED: state for checkbox
  const [submittingNote, setSubmittingNote] = useState(false);
  
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
    setNoteText('');
    setIsPrivateNote(false);
    
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
      content: status === 'Resolved'
        ? 'This will resolve the report and move it to Archive immediately.'
        : 'The resident will see the updated status on their ticket.',
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        if (currentView.current !== view) return;
        setWorking(true);
        try {
          const updated = await updateTicketStatus(id, status);
          if (currentView.current !== view) return;
          setTicket(updated);
          message.success(status === 'Resolved' ? 'Ticket resolved and moved to Archive' : `Ticket marked ${status}`);
        } catch (err) {
          if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to update ticket status');
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
          if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to update ticket priority');
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
          if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to archive ticket');
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
      await Promise.all(selectedDuplicates.map(targetId => linkTicket(targetId, id)));
      if (currentView.current !== view) return;
      
      const updated = await getTicketById(id);
      if (currentView.current !== view) return;
      setTicket(updated);
      setSelectedDuplicates([]);
      
      const data = await getAllTickets();
      if (currentView.current !== view) return;
      setOtherTickets(data.filter((item) => item._id !== id));
      message.success('Duplicate tickets linked successfully');
    } catch (err) {
      if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to link duplicate tickets');
    } finally {
      if (currentView.current === view) setWorking(false);
    }
  };

  const handleUnlink = (targetIdToUnlink) => {
    confirmation.current = Modal.confirm({
      title: 'Unlink this ticket?',
      content: 'This will remove the duplicate relationship between these tickets.',
      okText: 'Unlink',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        if (currentView.current !== view) return;
        setWorking(true);
        try {
          await unlinkTicket(targetIdToUnlink);
          if (currentView.current !== view) return;
          const updated = await getTicketById(id);
          if (currentView.current !== view) return;
          setTicket(updated);
          const data = await getAllTickets();
          if (currentView.current !== view) return;
          setOtherTickets(data.filter((item) => item._id !== id));
          message.success('Ticket unlinked successfully');
        } catch (err) {
          if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to unlink ticket');
        } finally {
          if (currentView.current === view) setWorking(false);
        }
      },
    });
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || currentView.current !== view) return;
    setSubmittingNote(true);
    try {
      // Pass the isPrivateNote status to the API
      const updated = await addTicketNote(id, noteText, isPrivateNote);
      if (currentView.current !== view) return;
      setTicket(updated);
      setNoteText('');
      setIsPrivateNote(false); // reset toggle
      message.success(isPrivateNote ? 'Private internal note saved' : 'Update added successfully');
    } catch (err) {
      if (currentView.current === view) message.error(err.response?.data?.message || 'Unable to add note');
    } finally {
      if (currentView.current === view) setSubmittingNote(false);
    }
  };

  const linkedToThis = otherTickets.filter(t => {
    if (!t.linkedTicket) return false;
    const linkedId = typeof t.linkedTicket === 'object' ? t.linkedTicket._id : t.linkedTicket;
    return linkedId === id;
  });

  const items = ticket ? [
    { key: 'title', label: 'Title', children: ticket.title, span: 2 },
    { key: 'description', label: 'Description', children: <span style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</span>, span: 2 },
    { key: 'category', label: 'Category', children: ticket.category === 'Others' && ticket.customCategory ? `Others (${ticket.customCategory})` : ticket.category },
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
    ...(ticket.linkedTicket ? [{ 
      key: 'linked_master', 
      label: 'Duplicate Of', 
      children: (
        <Space wrap>
          <Link to={`${base}/ticket/${ticket.linkedTicket._id}`}>{ticket.linkedTicket.title || 'View master ticket'}</Link>
          {isAdmin && !ticket.isArchived && (
            <Button type="text" danger size="small" onClick={() => handleUnlink(ticket._id)}>Unlink</Button>
          )}
        </Space>
      ), 
      span: 2 
    }] : []),
    ...(linkedToThis.length > 0 ? [{ 
      key: 'linked_list', 
      label: 'Linked Tickets', 
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {linkedToThis.map(dup => (
            <div key={dup._id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link to={`${base}/ticket/${dup._id}`}>• {dup.title}</Link>
              <Tag style={{ marginLeft: 8, fontSize: '10px' }}>{dup.status}</Tag>
              {isAdmin && !ticket.isArchived && (
                <Button type="text" danger size="small" style={{ padding: '0 4px', height: 'auto', fontSize: '12px' }} onClick={() => handleUnlink(dup._id)}>Unlink</Button>
              )}
            </div>
          ))}
        </div>
      ), 
      span: 2 
    }] : []),
  ] : [];
  
  const imageUrl = ticket?.image ? (ticket.image.startsWith('/uploads/') ? ticket.image : `/uploads/${ticket.image}`) : '';

  const duplicateOptions = ticket ? otherTickets
    .filter((item) => item.category === ticket.category && !item.linkedTicket)
    .map((item) => ({ value: item._id, label: `${item.title} (${item.status})` })) 
    : [];

  return (
    <>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)} style={{ marginBottom: 20 }}>Back to tickets</Button>
      <Spin spinning={loading} tip="Loading ticket...">
        {error ? <Result status="warning" title={error} /> : ticket && (
          <Card className="detail-card" title={<h1 style={{ fontSize: 22, color: '#0A4D68', margin: 0 }}>Ticket Details</h1>}>
            <Descriptions bordered layout={screens.sm ? 'horizontal' : 'vertical'} column={{ xs: 1, sm: 1, md: 2 }} items={items} />
            {imageUrl && <div style={{ marginTop: 24 }}><Typography.Title level={5}>Evidence Photo</Typography.Title><Image className="detail-image" src={imageUrl} alt={`Evidence for ${ticket.title}`} style={{ maxHeight: 400, objectFit: 'contain' }} /></div>}
            
            <Divider orientation="left" style={{ marginTop: 32 }}>Updates & Notes</Divider>
            <List
              itemLayout="horizontal"
              dataSource={ticket.notes || []}
              locale={{ emptyText: 'No updates yet.' }}
              renderItem={(note) => (
                // ADDED: distinct styling for private notes
                <List.Item style={{ backgroundColor: note.isPrivate ? '#fffbe6' : 'transparent', padding: '12px', borderRadius: '6px', marginBottom: '8px' }}>
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Text strong>{`${note.addedBy?.firstName || 'Unknown'} ${note.addedBy?.lastName || ''} (${note.addedBy?.role || 'User'}) - ${formatDate(note.createdAt)}`}</Text>
                        {note.isPrivate && <Tag color="warning">Internal Private Note</Tag>}
                      </Space>
                    }
                    description={<span style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{note.text}</span>}
                  />
                </List.Item>
              )}
            />
            {!ticket.isArchived && (
              <div style={{ marginTop: 16 }}>
                <Input.TextArea
                  rows={3}
                  placeholder="Add a new update or note to this ticket..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  disabled={submittingNote || working}
                />
                
                {/* ADDED: Checkbox toggle for Admins */}
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                  <Button
                    type="primary"
                    onClick={handleAddNote}
                    loading={submittingNote}
                    disabled={!noteText.trim()}
                  >
                    Post Update
                  </Button>
                  
                  {isAdmin && (
                    <Checkbox 
                      checked={isPrivateNote} 
                      onChange={(e) => setIsPrivateNote(e.target.checked)}
                      disabled={submittingNote || working}
                    >
                      Private Internal Note (Hidden from resident)
                    </Checkbox>
                  )}
                </div>
              </div>
            )}

            {isAdmin && !ticket.isArchived && (
              <>
                <Divider style={{ marginTop: 32 }} />
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
                  
                  <Space.Compact direction={screens.sm ? 'horizontal' : 'vertical'} style={{ width: '100%', maxWidth: 600 }}>
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
                      style={{ width: '100%', minWidth: 0 }}
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
    </>
  );
};

const { Text } = Typography;

export default TicketDetails;
