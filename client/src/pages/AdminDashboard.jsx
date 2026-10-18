import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Button, Card, Col, Row, Select, Spin, Statistic, Table, Tag, message, Divider, Typography } from 'antd';
import { FileTextOutlined, InboxOutlined, ClockCircleOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge/StatusBadge';
import { getAllTickets } from '../api/ticketApi';
import { getArchivedTickets } from '../api/archiveApi';
import { CATEGORIES, STATUSES, PRIORITIES, formatDate, getPriorityColor } from '../utils/helpers';
import TicketSearch from '../components/TicketSearch/TicketSearch';
import { filterTickets } from '../utils/ticketSearch';

const { Text } = Typography;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [totals, setTotals] = useState([]);
  const [archiveTotals, setArchiveTotals] = useState([]);
  const [archiveError, setArchiveError] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [category, setCategory] = useState();
  const [status, setStatus] = useState();
  const [priority, setPriority] = useState();
  const [search, setSearch] = useState('');
  const [fuzzy, setFuzzy] = useState(false);
  const [scope, setScope] = useState('active');
  const [page, setPage] = useState(1);
  const directory = useRef(null);

  useEffect(() => {
    let active = true;
    const loadTotals = async () => {
      try {
        const data = await getAllTickets();
        if (active) setTotals(data);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load dashboard statistics');
      } finally {
        if (active) setStatsLoading(false);
      }
    };
    loadTotals();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getArchivedTickets().then(data => { if (active) setArchiveTotals(data); }).catch(() => {
      if (active) setArchiveError(true);
    }).finally(() => { if (active) setArchiveLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(1);
    setTickets([]);
    const loadTickets = async () => {
      try {
        const filters = { category, status, priority };
        const data = scope === 'archived' ? await getArchivedTickets(filters)
          : scope === 'all' ? (await Promise.all([getAllTickets(filters), getArchivedTickets(filters)])).flat()
          : await getAllTickets(filters);
        if (active) setTickets([...new Map(data.map(ticket => [ticket._id, ticket])).values()]);
      } catch (error) {
        if (active) message.error(error.response?.data?.message || 'Unable to load tickets');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadTickets();
    return () => { active = false; };
  }, [category, status, priority, scope]);

  const allTotals = [...new Map([...totals, ...archiveTotals].map(ticket => [ticket._id, ticket])).values()];
  const visibleTickets = filterTickets(tickets, search, fuzzy);
  const selectTile = stat => {
    setScope(stat.scope);
    setStatus(stat.status);
    setCategory(undefined);
    setPriority(undefined);
    setSearch('');
    setPage(1);
    directory.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const stats = [
    { title: 'Total Active Tickets', scope: 'active', value: totals.length, icon: <FileTextOutlined />, color: '#0A4D68' },
    { title: 'Archived Tickets', scope: 'archived', value: archiveError ? 'Unavailable' : archiveTotals.length, icon: <InboxOutlined />, color: '#666' },
    ...[
      { title: 'Pending', icon: <ClockCircleOutlined />, color: '#D4A017' },
      { title: 'In Progress', icon: <SyncOutlined />, color: '#1890FF' },
      { title: 'Resolved', icon: <CheckCircleOutlined />, color: '#2D6A4F' },
      { title: 'Dismissed', icon: <CloseCircleOutlined />, color: '#FF4D4F' },
    ].map(stat => ({ ...stat, scope: 'all', status: stat.title, value: archiveError ? 'Unavailable' : allTotals.filter(ticket => ticket.status === stat.title).length })),
  ];

  // NATIVE ANALYTICS CALCULATIONS (No external libraries)
  const { statusPieData, categoryBarData, maxCategoryCount } = useMemo(() => {
    const totalCount = totals.length || 1; // Prevent division by zero

    // 1. Process data for the Pie Chart
    const rawStatus = [
      { name: 'Pending', value: totals.filter(t => t.status === 'Pending').length, color: '#D4A017' },
      { name: 'In Progress', value: totals.filter(t => t.status === 'In Progress').length, color: '#1890FF' },
      { name: 'Resolved', value: totals.filter(t => t.status === 'Resolved').length, color: '#2D6A4F' },
      { name: 'Dismissed', value: totals.filter(t => t.status === 'Dismissed').length, color: '#FF4D4F' }
    ].filter(item => item.value > 0);

    let cumulativePercent = 0;
    const statusPieData = rawStatus.map(item => {
      const percentage = (item.value / totalCount) * 100;
      const start = cumulativePercent;
      const end = cumulativePercent + percentage;
      cumulativePercent += percentage;
      return { ...item, percentage, start, end };
    });

    // 2. Process data for the Bar Chart
    const categoryCounts = totals.reduce((acc, ticket) => {
      const catName = ticket.category === 'Others' && ticket.customCategory 
        ? `Others (${ticket.customCategory})` 
        : ticket.category;
      acc[catName] = (acc[catName] || 0) + 1;
      return acc;
    }, {});

    const categoryBarData = Object.keys(categoryCounts)
      .map(key => ({ name: key, count: categoryCounts[key] }))
      .sort((a, b) => b.count - a.count);

    const maxCategoryCount = Math.max(...categoryBarData.map(d => d.count), 1);

    return { statusPieData, categoryBarData, maxCategoryCount };
  }, [totals]);

  // Generate CSS conic-gradient string for the Pie Chart
  const pieGradient = statusPieData
    .map(segment => `${segment.color} ${segment.start}% ${segment.end}%`)
    .join(', ');

  const columns = [
    { title: 'Title', dataIndex: 'title' },
    { title: 'Submitted By', dataIndex: 'submittedBy', render: (value) => value ? `${value.firstName} ${value.lastName}` : 'Unknown' },
    { title: 'Category', dataIndex: 'category', render: (val, ticket) => val === 'Others' && ticket.customCategory ? `Others (${ticket.customCategory})` : val },
    { title: 'Status', dataIndex: 'status', render: (value) => <StatusBadge status={value} /> },
    { title: 'Priority', dataIndex: 'priority', render: (value) => <Tag color={getPriorityColor(value)}>{value}</Tag> },
    { title: 'Location', dataIndex: 'location' },
    { title: 'Date', dataIndex: 'createdAt', render: (value) => formatDate(value), sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt), defaultSortOrder: 'descend' },
    { title: 'Actions', key: 'actions', render: (_, ticket) => <Button type="link" onClick={() => navigate(`/admin/ticket/${ticket._id}`)}>View</Button> },
  ];

  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      
      <Spin spinning={statsLoading || archiveLoading}>
        <Row gutter={[16, 16]} className="stats-row">
          {stats.map((stat) => (
            <Col xs={24} sm={12} lg={8} xl={{ flex: '1 1 0' }} key={stat.title}>
              <Card className="stat-card" role="button" tabIndex={0} aria-label={`Show ${stat.title}`} onClick={() => selectTile(stat)} onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectTile(stat); }
              }}>
                <Statistic title={stat.title} value={stat.value} prefix={stat.icon} valueStyle={{ color: stat.color }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Typography.Paragraph type={archiveError ? 'danger' : 'secondary'}>{archiveError ? 'Archived totals could not load. Reload to retry.' : 'Status tiles include active and archived reports. Charts summarize the active queue.'}</Typography.Paragraph>

        {/* NATIVE ANALYTICS SECTION (Built with CSS) */}
        {totals.length > 0 && (
          <>
            <Divider orientation="left" style={{ borderColor: '#0A4D68', color: '#0A4D68', fontSize: '18px' }}>
              System Analytics
            </Divider>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              
              {/* CSS PIE CHART */}
              <Col xs={24} lg={10}>
                <Card title="Status Distribution" className="stat-card" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'center', alignItems: 'center' }}>
                    {/* The Pie Circle */}
                    <div 
                      title="Tickets by Status"
                      style={{
                        width: '180px',
                        height: '180px',
                        borderRadius: '50%',
                        background: `conic-gradient(${pieGradient})`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    {/* The Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {statusPieData.map(stat => (
                        <div key={stat.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', backgroundColor: stat.color }} />
                          <Text>{stat.name}: <strong style={{color: stat.color}}>{stat.value}</strong> ({stat.percentage.toFixed(0)}%)</Text>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </Col>

              {/* CSS BAR CHART */}
              <Col xs={24} lg={14}>
                <Card title="Tickets by Category" className="stat-card" style={{ height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '220px', gap: '12px', paddingBottom: '40px', overflowX: 'auto', paddingTop: '20px' }}>
                    {categoryBarData.map(cat => {
                      const barHeightPercent = (cat.count / maxCategoryCount) * 100;
                      return (
                        <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '40px', height: '100%', justifyContent: 'flex-end', position: 'relative' }}>
                          {/* Count Label Above Bar */}
                          <Text style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>{cat.count}</Text>
                          {/* The Bar */}
                          <div 
                            title={`${cat.name}: ${cat.count} tickets`}
                            style={{
                              width: '100%',
                              maxWidth: '50px',
                              height: `${barHeightPercent}%`,
                              backgroundColor: '#0A4D68',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.5s ease-out'
                            }} 
                          />
                          {/* Category Label Below Bar (Rotated) */}
                          <div style={{ position: 'absolute', bottom: '-40px', width: '100px', textAlign: 'center', transform: 'rotate(-45deg)', transformOrigin: 'top center' }}>
                            <Text ellipsis style={{ fontSize: '11px', width: '100px', display: 'block' }} title={cat.name}>
                              {cat.name}
                            </Text>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </Col>
              
            </Row>
          </>
        )}
      </Spin>

      <div ref={directory} style={{ scrollMarginTop: 80 }} />
      <Divider orientation="left" style={{ borderColor: '#0A4D68', color: '#0A4D68', fontSize: '18px' }}>
        Ticket Directory
      </Divider>
      
      <div className="filter-bar">
        <Select aria-label="Ticket scope" value={scope} onChange={setScope} options={[{ value: 'active', label: 'Active Tickets' }, { value: 'archived', label: 'Archived Tickets' }, { value: 'all', label: 'Active and Archived' }]} style={{ minWidth: 190 }} virtual={false} />
        <Select aria-label="Category filter" placeholder="All Categories" allowClear value={category} onChange={setCategory} options={CATEGORIES.map((value) => ({ value, label: value }))} style={{ minWidth: 200 }} virtual={false} />
        <Select aria-label="Status filter" placeholder="All Statuses" allowClear value={status} onChange={setStatus} options={STATUSES.map((value) => ({ value, label: value }))} style={{ minWidth: 170 }} virtual={false} />
        <Select aria-label="Priority filter" placeholder="All Priorities" allowClear value={priority} onChange={setPriority} options={PRIORITIES.map((value) => ({ value, label: value }))} style={{ minWidth: 160 }} virtual={false} />
        <TicketSearch value={search} onChange={value => { setSearch(value); setPage(1); }} fuzzy={fuzzy} onFuzzyChange={value => { setFuzzy(value); setPage(1); }} />
      </div>
      <Typography.Paragraph role="status" aria-live="polite">{visibleTickets.length} matching tickets</Typography.Paragraph>

      <Spin spinning={loading} tip="Loading tickets...">
        <Table rowKey="_id" columns={columns} dataSource={visibleTickets} scroll={{ x: 1200 }} pagination={{ current: page, onChange: setPage, defaultPageSize: 10, showSizeChanger: false }} />
      </Spin>
    </>
  );
};

export default AdminDashboard;
