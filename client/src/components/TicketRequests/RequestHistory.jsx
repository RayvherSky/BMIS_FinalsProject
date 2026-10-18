import React from 'react';
import { Empty, List, Space, Tag, Typography } from 'antd';
import { formatDate } from '../../utils/helpers';
import { REQUEST_LABELS, REQUEST_STATES } from '../../utils/ticketRequests';

export function RequestRecord({ request }) {
  const response = request.decisionReason || request.responseText;
  return <div className="request-record">
    <Space wrap><Typography.Text strong>{REQUEST_LABELS[request.type] || 'Request'}</Typography.Text><Tag color={request.state === 'completed' ? 'green' : request.state === 'acknowledged' ? 'blue' : 'gold'}>{REQUEST_STATES[request.state] || request.state}</Tag></Space>
    <div className="request-timestamp">Submitted {formatDate(request.createdAt)}</div>
    {request.message && <p className="request-message">{request.message}</p>}
    {request.acknowledgedAt && <div className="request-timestamp">Acknowledged {formatDate(request.acknowledgedAt)}</div>}
    {request.decision && <Typography.Text strong>Appeal {request.decision === 'accepted' ? 'accepted' : 'rejected'}</Typography.Text>}
    {response && <div className="request-response"><Typography.Text strong>Public response</Typography.Text><p className="request-message">{response}</p></div>}
    {request.completedAt && <div className="request-timestamp">Completed {formatDate(request.completedAt)}</div>}
  </div>;
}

export default function RequestHistory({ requests = [] }) {
  return <section aria-label="Request history" className="request-history">
    <Typography.Title level={5}>Request history</Typography.Title>
    <List dataSource={[...requests].reverse()} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No requests submitted yet." /> }} renderItem={request => <List.Item key={request._id}><RequestRecord request={request} /></List.Item>} />
  </section>;
}
