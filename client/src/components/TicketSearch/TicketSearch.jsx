import React from 'react';
import { Input, Switch, Typography } from 'antd';

const TicketSearch = ({ value, onChange, fuzzy, onFuzzyChange, placeholder = 'Search tickets' }) => (
  <div className="ticket-search">
    <Input.Search aria-label="Search tickets" placeholder={placeholder} allowClear value={value} onChange={event => onChange(event.target.value)} onSearch={onChange} />
    <label className="ticket-search-toggle"><Switch aria-label="Fuzzy search" checked={fuzzy} onChange={onFuzzyChange} /> Fuzzy search</label>
    <Typography.Text type="secondary">Title, submitter, category, status, priority, location or date (YYYY-MM-DD).</Typography.Text>
  </div>
);

export default TicketSearch;
