import React from 'react';
import { Tag } from 'antd';
import {
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined,
} from '@ant-design/icons';

/**
 * StatusBadge component that displays a ticket status as a colored Ant Design Tag.
 * @param {Object} props
 * @param {string} props.status - The ticket status
 */
const StatusBadge = ({ status }) => {
  const statusConfig = {
    Pending: {
      color: 'gold',
      icon: <ClockCircleOutlined />,
    },
    'In Progress': {
      color: 'blue',
      icon: <SyncOutlined spin />,
    },
    Resolved: {
      color: 'green',
      icon: <CheckCircleOutlined />,
    },
    Dismissed: {
      color: 'red',
      icon: <CloseCircleOutlined />,
    },
    Archived: {
      color: 'default',
      icon: <InboxOutlined />,
    },
  };

  const config = statusConfig[status] || { color: 'default', icon: null };

  return (
    <Tag color={config.color} icon={config.icon}>
      {status || 'Unknown'}
    </Tag>
  );
};

export default StatusBadge;
