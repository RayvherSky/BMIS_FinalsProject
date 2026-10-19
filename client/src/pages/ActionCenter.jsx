import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, Modal, Pagination, Select, Space, Spin, Tag, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTicketRequests, handleTicketRequest } from '../api/requestApi';
import { getTicketBasePath, normalizeRole } from '../utils/roles';
import { formatDate } from '../utils/helpers';
import { REQUEST_LABELS, REQUEST_STATES, requestErrorMessage } from '../utils/ticketRequests';
import { RequestRecord } from '../components/TicketRequests/RequestHistory';
import StatusBadge from '../components/StatusBadge/StatusBadge';

const emptyResults = { items: [], total: 0, page: 1, pages: 1, counts: { outstanding: 0, unread: 0 } };

export default function ActionCenter() {
  const { user } = useAuth();
  const role = normalizeRole(user.role);
  const isAdmin = role === 'admin';
  const base = getTicketBasePath(role);
  const identity = useMemo(() => ({}), [user._id, role]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const [result, setResult] = useState(emptyResults);
  const [type, setType] = useState();
  const [state, setState] = useState();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const currentSelection = useRef(selected);
  currentSelection.current = selected;
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [text, setText] = useState('');
  const [decision, setDecision] = useState();
  const [status, setStatus] = useState();
  const listGeneration = useRef(0);
  const selectionGeneration = useRef(0);

  useEffect(() => {
    currentIdentity.current = identity;
    return () => {
      if (currentIdentity.current === identity) currentIdentity.current = null;
      listGeneration.current += 1;
      selectionGeneration.current += 1;
    };
  }, [identity]);

  useEffect(() => {
    const current = ++listGeneration.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getTicketRequests({ type, state, search: search.trim() || undefined, page, limit: 10 });
        if (currentIdentity.current !== identity || current !== listGeneration.current) return;
        if (data.pages > 0 && page > data.pages) { setPage(data.pages); return; }
        setResult(data);
        const selection = currentSelection.current;
        if (selection?.ticket && !data.items.some(item => item._id === selection.item._id)) {
          // A filter/page change can hide a permitted request. Revalidate through
          // the protected detail action instead of treating absence as access.
          const selectionVersion = selectionGeneration.current;
          try {
            const ticket = await handleTicketRequest(selection.item.ticketId, selection.item._id, { action: 'view' });
            if (currentIdentity.current !== identity || current !== listGeneration.current || selectionVersion !== selectionGeneration.current) return;
            const request = ticket.requests?.find(record => record._id === selection.item._id);
            if (request) setSelected({ item: selection.item, ticket, request });
            else clearSelection();
          } catch (failure) {
            if (currentIdentity.current === identity && current === listGeneration.current && selectionVersion === selectionGeneration.current) handleFailure(failure);
          }
        }
      } catch (failure) {
        if (currentIdentity.current !== identity || current !== listGeneration.current) return;
        setResult(emptyResults); setError(requestErrorMessage(failure, 'Unable to load requests'));
        if ([403, 404].includes(failure.response?.status)) clearSelection();
      } finally {
        if (currentIdentity.current === identity && current === listGeneration.current) setLoading(false);
      }
    }, search ? 200 : 0);
    return () => { clearTimeout(timer); if (current === listGeneration.current) listGeneration.current += 1; };
  }, [type, state, search, page, refresh, identity]);

  const clearSelection = () => {
    selectionGeneration.current += 1;
    setSelected(null); setDetailLoading(false); setSaving(false); setText(''); setDecision(undefined); setStatus(undefined); setDetailError('');
  };
  const reload = () => { setError(''); setRefresh(value => value + 1); };
  const handleFailure = failure => {
    const explanation = requestErrorMessage(failure, 'Unable to update this request');
    if ([403, 404].includes(failure.response?.status)) {
      clearSelection();
      // Invalidate already-started reads so they cannot restore revoked content.
      listGeneration.current += 1;
      setResult(emptyResults); setError(explanation); setRefresh(value => value + 1);
    } else setDetailError(explanation);
  };
  const selectRequest = async item => {
    clearSelection();
    const current = selectionGeneration.current;
    setSelected({ item, ticket: null, request: null }); setDetailLoading(true);
    try {
      const ticket = await handleTicketRequest(item.ticketId, item._id, { action: 'view' });
      if (currentIdentity.current !== identity || current !== selectionGeneration.current) return;
      const request = ticket.requests?.find(record => record._id === item._id);
      if (!request) { clearSelection(); reload(); return; }
      setSelected({ item, ticket, request }); setRefresh(value => value + 1);
    } catch (failure) {
      if (currentIdentity.current === identity && current === selectionGeneration.current) handleFailure(failure);
    } finally {
      if (currentIdentity.current === identity && current === selectionGeneration.current) setDetailLoading(false);
    }
  };
  const submit = async action => {
    if (saving || !selected?.request || selected.request.state === 'completed') return;
    const current = selectionGeneration.current;
    const { item } = selected;
    const payload = action === 'respond' ? { action, text: text.trim() }
      : action === 'decide' ? { action, text: text.trim(), decision, ...(decision === 'accepted' ? { status } : {}) }
      : { action };
    if (action === 'respond' && !text.trim()) return;
    if (action === 'decide' && (!text.trim() || !decision || (decision === 'accepted' && !selected.ticket.reversal?.options?.includes(status)))) return;
    setSaving(true); setDetailError('');
    try {
      const ticket = await handleTicketRequest(item.ticketId, item._id, payload);
      if (currentIdentity.current !== identity || current !== selectionGeneration.current) return;
      const request = ticket.requests?.find(record => record._id === item._id);
      if (action === 'acknowledge' && request) setSelected({ item, ticket, request });
      else clearSelection();
      setRefresh(value => value + 1);
      message.success(action === 'acknowledge' ? 'Request acknowledged' : action === 'decide' ? 'Appeal decision recorded' : 'Public response sent and request completed');
    } catch (failure) {
      if (currentIdentity.current === identity && current === selectionGeneration.current) handleFailure(failure);
    } finally {
      if (currentIdentity.current === identity && current === selectionGeneration.current) setSaving(false);
    }
  };

  const request = selected?.request;
  const isAppeal = request?.type === 'appeal';
  const canHandle = request && request.state !== 'completed';
  const reopeningOptions = selected?.ticket?.reversal?.options || [];
  const changeFilter = setter => value => { setter(value); setPage(1); setError(''); };

  return <section className="action-center">
    <div className="workspace-heading">
      <div><span className="workspace-eyebrow">STAFF OPERATIONS</span><h1 className="page-title">Action Center</h1><p>{isAdmin ? 'Review follow-ups, progress requests, and dismissal appeals.' : 'Handle follow-ups and progress requests for your current active assignments.'}</p></div>
      <Button icon={<ReloadOutlined />} loading={loading} onClick={reload}>Refresh requests</Button>
    </div>
    <div className="request-counts" role="status" aria-label="Request counts" aria-live="polite"><span><strong>{result.counts.outstanding}</strong> outstanding</span><span><strong>{result.counts.unread}</strong> unread</span></div>
    <Typography.Paragraph type="secondary">Unread tracks viewing. Outstanding requests need a public response or an appeal decision. Counts include all requests you can access.</Typography.Paragraph>
    <div className="filter-bar request-filters">
      <Input type="search" aria-label="Search requests" placeholder="Search title or ticket ID" value={search} onChange={event => changeFilter(setSearch)(event.target.value)} allowClear />
      <Select aria-label="Request type" placeholder="All request types" allowClear value={type} onChange={changeFilter(setType)} virtual={false} options={Object.entries(REQUEST_LABELS).filter(([key]) => isAdmin || key !== 'appeal').map(([value, label]) => ({ value, label }))} />
      <Select aria-label="Request state" placeholder="All request states" allowClear value={state} onChange={changeFilter(setState)} virtual={false} options={Object.entries(REQUEST_STATES).map(([value, label]) => ({ value, label }))} />
    </div>
    {error && <Alert type="error" showIcon message={error} className="request-form-alert" />}
    <Spin spinning={loading} tip="Loading requests...">
      <div className="request-list">{result.items.map(item => <Card key={item._id} className={`request-inbox-card${item.read ? '' : ' request-unread'}`}>
        <div className="request-panel-heading"><Space wrap><Tag>{REQUEST_LABELS[item.type]}</Tag><Tag color={item.state === 'completed' ? 'green' : 'gold'}>{REQUEST_STATES[item.state]}</Tag>{!item.read && <Tag color="blue">Unread</Tag>}</Space><span className="request-timestamp">{formatDate(item.createdAt)}</span></div>
        <h2>{item.title}</h2>
        <Space wrap><StatusBadge status={item.ticketStatus} />{item.isArchived && <Tag>Archived</Tag>}<Typography.Text type="secondary">{item.requester?.firstName} {item.requester?.lastName}</Typography.Text></Space>
        {item.message && <p className="request-message">{item.message}</p>}
        <Button onClick={() => selectRequest(item)}>Review request</Button>
      </Card>)}</div>
      {!loading && result.items.length === 0 && <Empty description="No matching requests" />}
      <div className="request-pagination"><Pagination current={page} total={result.total} pageSize={10} showSizeChanger={false} hideOnSinglePage onChange={setPage} /></div>
    </Spin>
    <Modal title="Review request" open={!!selected} destroyOnClose onCancel={() => { if (!saving) clearSelection(); }} footer={<Button disabled={saving} onClick={clearSelection}>Close</Button>} closable={!saving} maskClosable={!saving} width={640}>
      <Spin spinning={detailLoading} tip="Loading request...">
        <div className="request-review-body">
        {detailError && <Alert type="error" showIcon message={detailError} className="request-form-alert" />}
        {!detailLoading && !request && selected && <Button onClick={() => selectRequest(selected.item)}>Retry request</Button>}
        {request && <>
          <Typography.Title level={5}>{selected.ticket.title}</Typography.Title>
          <Link to={`${base}/ticket/${selected.item.ticketId}`} state={{ fromActionCenter: true }}>Open ticket and evidence</Link>
          <div className="request-review-record"><RequestRecord request={request} /></div>
          {canHandle && <>
            {request.state === 'pending' && <Button loading={saving} onClick={() => submit('acknowledge')}>Acknowledge</Button>}
            {(!isAppeal || isAdmin) && <Form layout="vertical" className="request-form" onFinish={() => submit(isAppeal ? 'decide' : 'respond')}>
              {isAppeal && <>
                <Alert type="info" showIcon message="Review the ticket’s existing evidence before deciding." description="Accepting saves the public decision and reopens the ticket together. Rejecting keeps the dismissal." />
                <Form.Item label="Appeal decision" htmlFor="appeal-decision" required><Select id="appeal-decision" aria-label="Appeal decision" value={decision} onChange={value => { setDecision(value); setStatus(undefined); }} placeholder="Choose a decision" disabled={saving} virtual={false} options={[{ value: 'accepted', label: 'Accept and reopen' }, { value: 'rejected', label: 'Reject appeal' }]} /></Form.Item>
                {decision === 'accepted' && <>
                  {selected.ticket.reversal?.legacy && <Typography.Paragraph type="secondary">Legacy correction: no earlier status was recorded.</Typography.Paragraph>}
                  <Form.Item label="Reopen status" htmlFor="appeal-status" required><Select id="appeal-status" aria-label="Reopen status" value={status} onChange={setStatus} placeholder="Choose reopening status" disabled={saving} virtual={false} options={reopeningOptions.map(value => ({ value, label: value }))} /></Form.Item>
                  {!reopeningOptions.length && <Alert type="warning" message="No eligible reopening status is currently available. Refresh the request before deciding." />}
                </>}
              </>}
              <Form.Item label={isAppeal ? 'Public decision reason' : 'Public response'} htmlFor="request-public-response" required><Input.TextArea id="request-public-response" rows={4} value={text} onChange={event => setText(event.target.value)} disabled={saving} /></Form.Item>
              <Typography.Paragraph type="secondary">This response is visible to the reporting user and completes this request.</Typography.Paragraph>
              <Button type="primary" htmlType="submit" loading={saving} disabled={!text.trim() || (isAppeal && (!decision || (decision === 'accepted' && !reopeningOptions.includes(status))))}>{isAppeal ? 'Submit decision' : 'Send response and complete'}</Button>
            </Form>}
          </>}
        </>}
        </div>
      </Spin>
    </Modal>
  </section>;
}
