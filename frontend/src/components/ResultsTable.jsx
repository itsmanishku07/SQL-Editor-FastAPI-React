import React, { useState, useEffect } from 'react';
import { Clock, LayoutGrid, AlertCircle, X, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Activity, Database, CheckCircle2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { analyzeQuery } from '../api';

const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'];

const ResultsTable = ({ results, error, onHide, query, schema, expected }) => {
  const [activeTab, setActiveTab] = useState('table');
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  useEffect(() => {
    // Reset tab when results change
    setActiveTab('table');
    setAnalysis(null);
  }, [results]);

  const handleAnalyze = async () => {
    if (!query) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const data = await analyzeQuery(query, schema);
      setAnalysis(data.plan);
    } catch (err) {
      setAnalysisError(err.response?.data?.detail || err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const Header = ({ children, extra }) => (
    <div className="results-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span>{children}</span>
        {results && !error && (
          <div className="results-tabs-mini">
            <button className={`tab-mini ${activeTab === 'table' ? 'active' : ''}`} onClick={() => setActiveTab('table')}>
              <LayoutGrid size={14} /> Table
            </button>
            {expected && (
              <button className={`tab-mini ${activeTab === 'expected' ? 'active' : ''}`} onClick={() => setActiveTab('expected')}>
                <CheckCircle2 size={14} /> Expected
              </button>
            )}
            <button className={`tab-mini ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>
              <BarChart3 size={14} /> Chart
            </button>
            <button className={`tab-mini ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => { setActiveTab('analysis'); if (!analysis) handleAnalyze(); }}>
              <Activity size={14} /> Analysis
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {extra}
        {onHide && (
          <button className="icon-btn" onClick={onHide} title="Hide results panel">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );

  if (error) {
    return (
      <section className="results-section">
        <Header><span style={{ color: 'var(--error)' }}>Execution Error</span></Header>
        <div className="results-content">
          <div className="error-message">
            <AlertCircle size={20} style={{ marginBottom: '0.5rem' }} />
            <div>{error}</div>
          </div>
        </div>
      </section>
    );
  }

  if (!results) {
    return (
      <section className="results-section">
        <Header>Results</Header>
        <div className="results-content empty-state">
          <LayoutGrid size={48} opacity={0.2} />
          <p>Execute a query to see results here</p>
        </div>
      </section>
    );
  }

  const { columns, rows, execution_time_ms } = results;

  // Auto-detect chart data
  const numericCols = columns.filter(col => rows.length > 0 && !isNaN(parseFloat(rows[0][col])) && typeof rows[0][col] !== 'boolean');
  const labelCol = columns.find(col => !numericCols.includes(col)) || columns[0];

  const chartData = rows.slice(0, 50).map(row => {
    const d = { name: row[labelCol] };
    numericCols.forEach(col => d[col] = parseFloat(row[col]));
    return d;
  });

  const renderTable = () => (
    <table>
      <thead>
        <tr>
          {columns.map((col, i) => <th key={i}>{col}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No rows returned
            </td>
          </tr>
        ) : (
          rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((col, ci) => (
                <td key={ci}>{row[col] !== null ? String(row[col]) : <em>null</em>}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  const renderChart = () => {
    if (numericCols.length === 0) {
      return (
        <div className="empty-state">
          <BarChart3 size={48} opacity={0.2} />
          <p>No numeric columns detected for visualization.</p>
        </div>
      );
    }

    return (
      <div className="chart-container" style={{ height: '100%', padding: '2rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
            <YAxis stroke="var(--text-secondary)" fontSize={12} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
              itemStyle={{ color: 'var(--text-primary)' }}
            />
            <Legend />
            {numericCols.map((col, i) => (
              <Bar key={col} dataKey={col} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderAnalysis = () => {
    if (isAnalyzing) {
      return (
        <div className="empty-state">
          <Activity size={48} className="spin" opacity={0.5} />
          <p>Analyzing query performance...</p>
        </div>
      );
    }

    if (analysisError) {
      return (
        <div className="empty-state">
          <AlertCircle size={48} color="var(--error)" opacity={0.5} />
          <p>Analysis failed: {analysisError}</p>
        </div>
      );
    }

    if (!analysis) return null;

    const plan = analysis[0].Plan;
    const stats = analysis[0];

    return (
      <div className="analysis-container" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <span className="stat-label">Total Runtime</span>
            <span className="stat-value">{stats['Actual Total Time'] || stats['Execution Time'] || '?'} ms</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Planning Time</span>
            <span className="stat-value">{stats['Planning Time']} ms</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Cost</span>
            <span className="stat-value">{plan['Total Cost']}</span>
          </div>
        </div>

        <div className="plan-tree">
          <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Execution Plan</h4>
          <PlanNode node={plan} depth={0} />
        </div>
      </div>
    );
  };

  return (
    <section className="results-section">
      <Header
        extra={
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <Clock size={13} />
            {execution_time_ms} ms
          </span>
        }
      >
        Results <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({rows.length} rows)</span>
      </Header>
      <div className="results-content" style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'table' && renderTable()}
        {activeTab === 'expected' && expected && (
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
            <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: 'var(--success)', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
              Correct Solution Data
            </div>
            <table>
              <thead>
                <tr>
                  {expected.columns.map((col, i) => <th key={i}>{col}</th>)}
                </tr>
              </thead>
              <tbody>
                {expected.rows.map((row, ri) => (
                  <tr key={ri}>
                    {expected.columns.map((col, ci) => (
                      <td key={ci}>{row[ci] !== null ? String(row[ci]) : <em>null</em>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'chart' && renderChart()}
        {activeTab === 'analysis' && renderAnalysis()}
      </div>
    </section>
  );
};

const PlanNode = ({ node, depth }) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.Plans && node.Plans.length > 0;

  return (
    <div className="plan-node" style={{ marginLeft: depth * 20, borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: hasChildren ? 'pointer' : 'default' }} onClick={() => setIsOpen(!isOpen)}>
        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{node['Node Type']}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          (cost={node['Startup Cost']}..{node['Total Cost']} rows={node['Plan Rows']} width={node['Plan Width']})
        </span>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
        {node['Relation Name'] && <span>on {node['Relation Name']}</span>}
        {node['Filter'] && <span style={{ marginLeft: '1rem', color: 'var(--error)' }}>Filter: {node['Filter']}</span>}
      </div>
      {isOpen && hasChildren && (
        <div style={{ marginTop: '0.5rem' }}>
          {node.Plans.map((p, i) => <PlanNode key={i} node={p} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
};

export default ResultsTable;
