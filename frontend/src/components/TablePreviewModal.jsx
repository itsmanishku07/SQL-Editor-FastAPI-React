import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, RefreshCw, Table as TableIcon, ChevronDown, AlertCircle, Check } from 'lucide-react';
import { executeQuery } from '../api';

const LIMIT_OPTIONS = [10, 20, 50, 100, 200];

const TablePreviewModal = ({ tableName, schema, onClose }) => {
  const [limit, setLimit] = useState(20);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const limitDropdownRef = useRef(null);

  const fetchData = useCallback(async (tbl, lim, sch) => {
    setIsLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await executeQuery(`SELECT * FROM "${tbl}" LIMIT ${lim}`, sch);
      if (result.error) setError(result.error);
      else setData(result);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load table data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on open and whenever limit changes
  useEffect(() => {
    if (tableName) fetchData(tableName, limit, schema);
  }, [tableName, limit, schema, fetchData]);

  // Close on Escape and handle click outside
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    const handleClickOutside = (e) => {
      if (limitDropdownRef.current && !limitDropdownRef.current.contains(e.target)) {
        setIsLimitOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!tableName) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="preview-modal">
        {/* Header */}
        <div className="preview-modal-header">
          <div className="preview-modal-title">
            <TableIcon size={18} color="var(--accent)" />
            <span>{schema}.<strong>{tableName}</strong></span>
            {data && (
              <span className="preview-row-badge">
                {data.rows.length} row{data.rows.length !== 1 ? 's' : ''}
                {data.rows.length === limit ? ` (limit ${limit})` : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Limit selector (Custom Dropdown) */}
            <div className="preview-limit-wrap" ref={limitDropdownRef}>
              <label className="preview-limit-label">Rows</label>
              <div className="schema-select-wrapper" style={{ minWidth: '80px' }}>
                <div 
                  className={`schema-custom-select ${isLimitOpen ? 'active' : ''}`}
                  onClick={() => setIsLimitOpen(!isLimitOpen)}
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                >
                  <span className="selected-value">{limit}</span>
                  <ChevronDown size={12} className={`schema-select-chevron ${isLimitOpen ? 'rotate' : ''}`} />
                </div>
                
                {isLimitOpen && (
                  <div className="schema-options-list" style={{ top: 'calc(100% + 4px)' }}>
                    {LIMIT_OPTIONS.map(n => (
                      <div 
                        key={n} 
                        className={`schema-option ${limit === n ? 'selected' : ''}`}
                        onClick={() => { setLimit(n); setIsLimitOpen(false); }}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        <span>{n}</span>
                        {limit === n && <Check size={12} className="check-icon" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Refresh */}
            <button
              className="icon-btn"
              onClick={() => fetchData(tableName, limit, schema)}
              title="Refresh"
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            </button>
            {/* Close */}
            <button className="icon-btn" onClick={onClose} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="preview-modal-body">
          {isLoading && (
            <div className="empty-state" style={{ height: '100%' }}>
              <RefreshCw size={28} className="spin" opacity={0.4} />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Loading table data…
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="error-message" style={{ margin: '1.5rem' }}>
              <AlertCircle size={18} />
              <span style={{ marginLeft: '0.5rem' }}>{error}</span>
            </div>
          )}

          {data && !isLoading && (
            <div className="preview-table-wrap">
              {data.rows.length === 0 ? (
                <div className="empty-state" style={{ height: '100%' }}>
                  <p>This table has no rows.</p>
                </div>
              ) : (
                <table className="preview-table">
                  <thead>
                    <tr>
                      {data.columns.map((col, i) => (
                        <th key={i}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, ri) => (
                      <tr key={ri}>
                        {data.columns.map((col, ci) => (
                          <td key={ci}>
                            {row[col] === null
                              ? <em className="null-cell">null</em>
                              : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TablePreviewModal;
