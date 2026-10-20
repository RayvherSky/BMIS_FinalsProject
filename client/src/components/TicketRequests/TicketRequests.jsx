import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Typography, message } from 'antd';
import { createTicketRequest } from '../../api/requestApi';
import { formatDate } from '../../utils/helpers';
import { requestErrorMessage } from '../../utils/ticketRequests';
import RequestHistory from './RequestHistory';

const actions = {
  follow_up: 'Request follow-up', progress_update: 'Request progress update', appeal: 'Appeal dismissal',
};

export default function TicketRequests({ ticket, onUpdate, onAccessError, disabled }) {
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const type = ticket.status === 'Dismissed' ? 'appeal' : !ticket.isArchived && ticket.status === 'Pending' ? 'follow_up' : !ticket.isArchived && ticket.status === 'In Progress' ? 'progress_update' : null;
  const eligibility = type && ticket.requestEligibility?.[type];
  const requestType = open || type;
  const isAppeal = requestType === 'appeal';
  const allowed = requestType === type && eligibility?.allowed;

  const submit = async () => {
    if (saving || !allowed || (isAppeal && !text.trim())) return;
    const current = generation.current;
    setSaving(true); setError('');
    try {
      const updated = await createTicketRequest(ticket._id, requestType, text.trim());
      if (current !== generation.current) return;
      onUpdate(updated); setOpen(null); setText('');
      message.success(isAppeal ? 'Appeal submitted' : 'Request submitted');
    } catch (failure) {
      if (current !== generation.current) return;
      if ([403, 404].includes(failure.response?.status)) onAccessError(failure);
      else setError(requestErrorMessage(failure, 'Unable to submit your request'));
    } finally { if (current === generation.current) setSaving(false); }
  };

  return <section className="ticket-request-panel" aria-label="Ticket requests">
    <Typography.Title level={4}>Requests & appeals</Typography.Title>
    {type && <div className="request-action">
      <Button disabled={disabled || !eligibility?.allowed} onClick={() => { setOpen(type); setError(''); }}>{actions[type]}</Button>
      <Typography.Paragraph type="secondary">{isAppeal ? 'One appeal is available for each dismissal. An administrator reviews your explanation and the existing evidence.' : 'One request of this type per Manila calendar day. An earlier request must be completed before another can be sent.'}</Typography.Paragraph>
      {!eligibility?.allowed && <Typography.Paragraph role="status">{eligibility?.reason || 'This request is not currently available.'}{eligibility?.nextAllowedAt && <> Next eligible time: {formatDate(eligibility.nextAllowedAt)}.</>}</Typography.Paragraph>}
    </div>}
    <RequestHistory requests={ticket.requests} />
    <Modal title={actions[requestType] || 'Ticket request'} open={!!open} destroyOnClose onCancel={() => { if (!saving) setOpen(null); }} onOk={submit} okText={isAppeal ? 'Submit appeal' : 'Send request'} confirmLoading={saving} okButtonProps={{ 'aria-label': isAppeal ? 'Submit appeal' : 'Send request', 'aria-busy': saving, disabled: saving || !allowed || (isAppeal && !text.trim()) }} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving}>
      <Typography.Paragraph className="request-message"><strong>{ticket.title}</strong><br />Ticket #{ticket._id}</Typography.Paragraph>
      {isAppeal && <Alert type="info" showIcon message="Your appeal uses the ticket’s existing evidence." description="Explain why the dismissal should be reviewed. An administrator will provide a public decision. No new attachments are needed." />}
      {error && <Alert type="error" showIcon message={error} className="request-form-alert" />}
      {!allowed && <Alert type="warning" message="This request is no longer available. Close this dialog and refresh the ticket details." className="request-form-alert" />}
      <Form layout="vertical" className="request-form" onFinish={submit}>
        <Form.Item label={isAppeal ? 'Appeal explanation' : 'Message (optional)'} htmlFor="ticket-request-message" required={isAppeal}>
          <Input.TextArea id="ticket-request-message" rows={4} value={text} onChange={event => setText(event.target.value)} disabled={saving} />
        </Form.Item>
      </Form>
    </Modal>
  </section>;
}
