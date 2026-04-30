import React from 'react';
import { Clock, LayoutGrid, AlertCircle, X } from 'lucide-react';

const ResultsTable = ({ results, error, onHide }) => {
  const Header = ({ children, extra }) => (
    <div className="results-header">
      <span>{children}</span>
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
      <div className="results-content">
        {rows.length === 0 ? (
          <div className="empty-state">
            <p>Query executed successfully. No rows returned.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((col, i) => <th key={i}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {columns.map((col, ci) => (
                    <td key={ci}>{row[col] !== null ? String(row[col]) : <em>null</em>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default ResultsTable;
