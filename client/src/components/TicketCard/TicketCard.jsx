import React from 'react';
import { Card, Tag, Typography, Space } from 'antd';
import {
  EnvironmentOutlined,
  CalendarOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../StatusBadge/StatusBadge';
import { formatDate, getPriorityColor, getCategoryColor } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const { Text, Title } = Typography;

/**
 * TicketCard component displaying a summary of a ticket.
 * Clickable to navigate to ticket details.
 * @param {Object} props
 * @param {Object} props.ticket - The ticket object
 */
const TicketCard = ({ ticket }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = () => {
    if (user?.role === 'admin') {
      navigate(`/admin/ticket/${ticket._id}`);
    } else {
      navigate(`/resident/ticket/${ticket._id}`);
    }
  };

  const submitterName = ticket.submittedBy
    ? `${ticket.submittedBy.firstName || ''} ${ticket.submittedBy.lastName || ''}`.trim()
    : 'Unknown';

  return (
    <Card
      className="ticket-card"
      hoverable
      onClick={handleClick}
      size="small"
      style={{
        borderLeftColor: getPriorityColor(ticket.priority) === 'green'
          ? '#52C41A'
          : getPriorityColor(ticket.priority) === 'blue'
            ? '#1890FF'
            : getPriorityColor(ticket.priority) === 'orange'
              ? '#FA8C16'
              : getPriorityColor(ticket.priority) === 'red'
                ? '#FF4D4F'
                : '#0A4D68',
      }}
    >
      <Title level={5} style={{ marginBottom: 4, marginTop: 0 }}>
        {ticket.title}
      </Title>

      <div className="ticket-meta">
        <Tag color={getCategoryColor(ticket.category)}>{ticket.category}</Tag>
        <StatusBadge status={ticket.status} />
        <Tag color={getPriorityColor(ticket.priority)}>{ticket.priority}</Tag>
      </div>

      <Space
        direction="horizontal"
        style={{ marginTop: 10, flexWrap: 'wrap' }}
        size="middle"
      >
        {ticket.location && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            <EnvironmentOutlined /> {ticket.location}
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          <CalendarOutlined /> {formatDate(ticket.createdAt, 'MMM D, YYYY')}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <UserOutlined /> {submitterName}
        </Text>
      </Space>
    </Card>
  );
};

export default TicketCard;
