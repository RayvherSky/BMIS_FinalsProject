import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Modal, Select, Spin, Typography, message } from 'antd';
import { getEmployees } from '../../api/userApi';
import { assignTicket } from '../../api/ticketApi';
import { formatDate } from '../../utils/helpers';

const employeeName = account => account?.firstName ? `${account.firstName} ${account.lastName || ''}`.trim() : 'Unassigned';

export default function AssignmentPanel({ ticket, onUpdate, disabled }) {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    setOpen(false);
    setSaving(false);
    return () => { generation.current += 1; };
  }, [ticket._id]);

  const loadEmployees = async () => {
    const request = generation.current;
    setLoading(true); setError('');
    try {
      const data = await getEmployees();
      if (request === generation.current) setEmployees(data);
    } catch (err) {
      if (request === generation.current) setError(err.response?.data?.message || 'Unable to load employees');
    } finally { if (request === generation.current) setLoading(false); }
  };
  const show = () => { setSelected(ticket.assignedTo?._id || undefined); setOpen(true); loadEmployees(); };
  const save = async () => {
    const request = generation.current;
    setSaving(true); setError('');
    try {
      const updated = await assignTicket(ticket._id, selected || null);
      if (request !== generation.current) return;
      onUpdate(updated); setOpen(false);
      message.success(selected ? 'Employee assignment saved' : 'Employee assignment removed');
    } catch (err) {
      if (request === generation.current) setError(err.response?.data?.message || 'Unable to save assignment');
    } finally { if (request === generation.current) setSaving(false); }
  };
  const unchanged = (selected || null) === (ticket.assignedTo?._id || null);
  return <section className="assignment-panel" aria-label="Employee assignment">
    <div className="assignment-panel-heading"><div><Typography.Text strong>Assigned Employee</Typography.Text><div>{ticket.assignedTo ? employeeName(ticket.assignedTo) : 'Awaiting assignment'}</div></div>
      {!ticket.isArchived && <Button disabled={disabled} onClick={show}>Assign Employee</Button>}
    </div>
    {!!ticket.assignmentHistory?.length && <div className="assignment-history"><Typography.Text strong>Assignment History</Typography.Text><ol>{ticket.assignmentHistory.map((entry, index) => <li key={entry._id || index}>
      {employeeName(entry.previousEmployee)} → {employeeName(entry.newEmployee)} · {employeeName(entry.changedBy)} · {formatDate(entry.createdAt)}{entry.reason ? ` · ${entry.reason}` : ''}
    </li>)}</ol></div>}
    <Modal title="Assign Employee" open={open} onCancel={() => { if (!saving) setOpen(false); }} onOk={save} okText="Confirm Assignment" confirmLoading={saving} okButtonProps={{ disabled: loading || !!error || unchanged }} cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving}>
      <Alert type="info" showIcon message="Only the assigned employee can access this active ticket." description="Assigning a Pending ticket starts processing. Reassigning or clearing an assignment removes the previous employee's access and preserves the ticket history." style={{ marginBottom: 20 }} />
      {error && <Alert type="error" message={error} action={<Button size="small" onClick={loadEmployees}>Retry</Button>} style={{ marginBottom: 16 }} />}
      <Spin spinning={loading}><Form layout="vertical"><Form.Item label="Employee" htmlFor="assigned-employee"><Select id="assigned-employee" aria-label="Employee" showSearch optionFilterProp="label" allowClear placeholder="Unassigned" value={selected} onChange={setSelected} disabled={saving || loading} virtual={false} style={{ width: '100%' }} options={employees.map(employee => ({ value: employee._id, label: `${employeeName(employee)} (${employee.email})` }))} /></Form.Item></Form></Spin>
    </Modal>
  </section>;
}
