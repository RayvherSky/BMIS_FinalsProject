import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select, Typography, message } from 'antd';
import { revertTicketStatus } from '../../api/requestApi';
import { formatDate } from '../../utils/helpers';
import { requestErrorMessage } from '../../utils/ticketRequests';

export default function ReversalPanel({ ticket, onUpdate, onAccessError, disabled }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const options = ticket.reversal?.options || [];
  const save = async () => {
    if (saving || !reason.trim() || !options.includes(status)) return;
    const current = generation.current;
    setSaving(true); setError('');
    try {
      const updated = await revertTicketStatus(ticket._id, status, reason.trim());
      if (current !== generation.current) return;
      onUpdate(updated); setOpen(false); setReason(''); setStatus(undefined);
      message.success('Ticket status reverted');
    } catch (failure) {
      if (current !== generation.current) return;
      if ([403, 404].includes(failure.response?.status)) onAccessError(failure);
      else setError(requestErrorMessage(failure, 'Unable to revert the ticket status'));
    } finally { if (current === generation.current) setSaving(false); }
  };
  return <section className="ticket-reversal-panel" aria-label="Status History">
    <div className="request-panel-heading"><Typography.Title level={4}>Status History</Typography.Title>{options.length > 0 && <Button disabled={disabled} onClick={() => { setOpen(true); setError(''); }}>Revert Status</Button>}</div>
    {ticket.statusHistory?.length ? <ol className="status-history-list">{[...ticket.statusHistory].reverse().map((event, index) => <li key={event._id || index}>
      <Typography.Text strong>{event.from} → {event.to}</Typography.Text>
      <div className="request-timestamp">{String(event.kind).includes('legacy') ? 'Legacy correction' : event.kind === 'reversal' ? 'Status reversal' : 'Status change'} · {formatDate(event.createdAt)}{event.changedBy?.firstName && <> · {event.changedBy.firstName} {event.changedBy.lastName}</>}</div>
      {event.reason && <p className="request-message">{event.reason}</p>}
      {(event.previousResolvedAt || event.previousDismissedAt || event.previousIsArchived) && <div className="request-timestamp">
        {event.previousResolvedAt && <div>Former resolution: {formatDate(event.previousResolvedAt)}</div>}
        {event.previousDismissedAt && <div>Former dismissal: {formatDate(event.previousDismissedAt)}</div>}
        {event.previousIsArchived && <div>Former archive: {event.previousArchivedAt ? formatDate(event.previousArchivedAt) : 'Previously archived'}</div>}
      </div>}
    </li>)}</ol> : <Typography.Paragraph type="secondary">No recorded status changes. Older ticket history is not reconstructed.</Typography.Paragraph>}
    <Modal title="Revert Status" open={open} destroyOnClose onCancel={() => { if (!saving) setOpen(false); }} onOk={save} okText="Confirm reversal" confirmLoading={saving} okButtonProps={{ disabled: !reason.trim() || !options.includes(status) }} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving}>
      <Alert type="warning" showIcon message={ticket.reversal?.legacy ? 'Legacy correction — no earlier status was recorded.' : 'Restore the previous recorded status.'} description="A reason is required and retained in the Admin history. Reopening removes the current archive and completion markers while preserving their former values in history. An eligible assignee is retained." />
      {error && <Alert type="error" showIcon message={error} className="request-form-alert" />}
      <Form layout="vertical" className="request-form" onFinish={save}>
        <Form.Item label="Restore status" htmlFor="reversal-status" required><Select id="reversal-status" aria-label="Restore status" value={status} onChange={setStatus} placeholder="Choose status" disabled={saving} virtual={false} options={options.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item label="Reason for reversal" htmlFor="reversal-reason" required><Input.TextArea id="reversal-reason" rows={4} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} /></Form.Item>
      </Form>
    </Modal>
  </section>;
}
