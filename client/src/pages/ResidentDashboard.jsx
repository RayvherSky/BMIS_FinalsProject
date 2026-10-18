import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Empty, Row, Spin, Statistic, Typography, message } from 'antd';
import { FileTextOutlined, ClockCircleOutlined, SyncOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TicketCard from '../components/TicketCard/TicketCard';
import { useAuth } from '../context/AuthContext';
import { getMyTickets } from '../api/ticketApi';

const ResidentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getMyTickets();
        if (active) setTickets(data);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load your tickets');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const stats = [
    { title: 'Total Tickets', value: tickets.length, icon: <FileTextOutlined />, color: '#0A4D68' },
    { title: 'Pending', value: tickets.filter((ticket) => ticket.status === 'Pending').length, icon: <ClockCircleOutlined />, color: '#D4A017' },
    { title: 'In Progress', value: tickets.filter((ticket) => ticket.status === 'In Progress').length, icon: <SyncOutlined />, color: '#1890FF' },
    { title: 'Resolved', value: tickets.filter((ticket) => ticket.status === 'Resolved').length, icon: <CheckCircleOutlined />, color: '#2D6A4F' },
  ];
  const recent = [...tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <>
      <div className="welcome-section">
        <h1>Welcome, {user.firstName}!</h1>
        <p>Report non-emergency issues in Barangay Baclaran and follow their progress.</p>
        <div className="dashboard-actions">
          <Button size="large" type="primary" className="dashboard-report-action" icon={<PlusOutlined />} onClick={() => navigate('/resident/submit-ticket')}>Report New Incident</Button>
          <Button size="large" className="dashboard-tickets-action" icon={<FileTextOutlined />} onClick={() => navigate('/resident/my-tickets')}>View all tickets</Button>
        </div>
      </div>
      <Spin spinning={loading} tip="Loading tickets...">
        <Row gutter={[16, 16]} className="stats-row">
          {stats.map((stat) => <Col xs={24} sm={12} xl={6} key={stat.title}><Card className="stat-card"><Statistic title={stat.title} value={stat.value} prefix={stat.icon} valueStyle={{ color: stat.color }} /></Card></Col>)}
        </Row>
        <Card title="Recent Tickets" className="dashboard-recent">
          {!loading && recent.length === 0 ? <Empty description="No tickets yet" /> : recent.map((ticket) => <TicketCard ticket={ticket} key={ticket._id} />)}
        </Card>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>Your dashboard shows tickets currently in the active queue.</Typography.Paragraph>
      </Spin>
    </>
  );
};

export default ResidentDashboard;
