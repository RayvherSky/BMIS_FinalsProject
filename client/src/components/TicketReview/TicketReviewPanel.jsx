import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Space, Tag, Typography, message } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { markTicketReviewed, submitTicketReview } from '../../api/reviewApi';
import { formatDate } from '../../utils/helpers';
import { normalizeRole } from '../../utils/roles';
import { requestErrorMessage } from '../../utils/ticketRequests';
import './TicketReview.css';

const accountName = account => [account?.firstName, account?.lastName].filter(Boolean).join(' ') || 'Staff member';

export default function TicketReviewPanel({ ticket, onUpdated, onAccessError, disabled = false }) {
  const { user } = useAuth();
  const role = normalizeRole(user.role);
  const assignment = ticket.assignedTo?._id || ticket.assignedTo || null;
  const identity = useMemo(() => ({}), [ticket._id, assignment, user._id, role]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    currentIdentity.current = identity;
    inFlight.current = false;
    setSaving(false); setError('');
    return () => { if (currentIdentity.current === identity) currentIdentity.current = null; };
  }, [identity]);

  const review = ticket.review;
  const pending = review?.status === 'pending';
  const active = !ticket.isArchived && ['Pending', 'In Progress'].includes(ticket.status);
  const canSubmit = role === 'employee' && assignment === user._id && active;
  const canMark = role === 'admin' && active && pending;
  const save = async () => {
    if (disabled || inFlight.current || (!canMark && (!canSubmit || pending))) return;
    inFlight.current = true; setSaving(true); setError('');
    try {
      const updated = await (role === 'admin' ? markTicketReviewed(ticket._id) : submitTicketReview(ticket._id));
      if (currentIdentity.current !== identity) return;
      onUpdated(updated);
      message.success(role === 'admin' ? 'Ticket review completed' : 'Ticket submitted for Admin review');
    } catch (failure) {
      if (currentIdentity.current !== identity) return;
      if ([403, 404].includes(failure.response?.status) && onAccessError) onAccessError(failure);
      else setError(requestErrorMessage(failure, 'Unable to save the ticket review'));
    } finally {
      if (currentIdentity.current === identity) { inFlight.current = false; setSaving(false); }
    }
  };

  if (!['admin', 'employee'].includes(role) || (!assignment && !review?.status)) return null;
  return <section className="ticket-review-panel" aria-label="Employee review">
    <div className="ticket-review-heading">
      <Space wrap><Typography.Title level={5}>Employee review</Typography.Title><Tag color={pending ? 'gold' : review?.status === 'reviewed' ? 'green' : 'default'}>{pending ? 'Pending Admin review' : review?.status === 'reviewed' ? 'Reviewed' : 'Awaiting Employee submission'}</Tag></Space>
      {canSubmit && <Button aria-label="Submit for Review" aria-busy={saving} onClick={save} disabled={disabled || saving || pending} loading={saving}>Submit for Review</Button>}
      {canMark && <Button aria-label="Mark Reviewed" aria-busy={saving} onClick={save} disabled={disabled || saving} loading={saving}>Mark Reviewed</Button>}
    </div>
    {review?.requestedAt && <div className="ticket-review-metadata">Submitted by <span>{accountName(review.requestedBy)}</span> · {formatDate(review.requestedAt)}</div>}
    {review?.reviewedAt && <div className="ticket-review-metadata">Reviewed by <span>{accountName(review.reviewedBy)}</span> · {formatDate(review.reviewedAt)}</div>}
    {active && <Typography.Paragraph type="secondary" className="ticket-review-explanation">
      {role === 'employee'
        ? pending ? 'Your report is in the Admin For Review queue. You can continue adding ticket notes while the review is pending.' : 'Submit when your work is ready for an Admin public update or resolution. Each completed review requires a new submission before another Admin public update or resolution.'
        : pending ? 'A public update or resolution completes this review. Mark Reviewed closes it without posting a public message.' : 'This assigned report needs an Employee submission before an Admin public update or resolution. Internal notes and triage actions remain available.'}
    </Typography.Paragraph>}
    {error && <Alert type="error" showIcon message={error} />}
  </section>;
}
