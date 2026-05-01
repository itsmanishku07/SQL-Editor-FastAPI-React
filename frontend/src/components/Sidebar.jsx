import React, { useState, useRef, useEffect } from 'react';
import { Database, Table, Settings, FileText, X, PanelLeftClose, Eye, ChevronDown, Check, RefreshCw, History, AlertCircle, Trophy } from 'lucide-react';
import { getQueryHistory } from '../api';

const Sidebar = ({
  tables, onTableClick, schemas, selectedSchema, onSchemaChange,
  onOpenSettings, currentView, onViewChange,
  isOpen, onClose, onHide, style, onPreviewTable, onRefresh, isLoading,
  onHistoryClick
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const dropdownRef = useRef(null);

  const handleTableClick = (table) => {
    onTableClick(table);
    onClose?.(); 
  };

  const handleViewChange = (view) => {
    onViewChange(view);
    onClose?.();
  };

  const handleSchemaSelect = (schema) => {
    onSchemaChange(schema);
    setIsDropdownOpen(false);
  };

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const data = await getQueryHistory(30);
      setHistory(data.history);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (currentView === 'history') {
      fetchHistory();
    }
  }, [currentView]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} style={style}>

        <div className="sidebar-nav">
          <button
            className={`sidebar-nav-btn ${currentView === 'editor' ? 'sidebar-nav-btn--active' : ''}`}
            onClick={() => handleViewChange('editor')}
          >
            <Database size={15} /> Editor
          </button>
          <button
            className={`sidebar-nav-btn ${currentView === 'history' ? 'sidebar-nav-btn--active' : ''}`}
            onClick={() => handleViewChange('history')}
          >
            <History size={15} /> History
          </button>
          <button
            className={`sidebar-nav-btn ${currentView === 'files' ? 'sidebar-nav-btn--active' : ''}`}
            onClick={() => handleViewChange('files')}
          >
            <FileText size={15} /> Files
          </button>
        </div>

        {currentView === 'editor' && (
          <>
            <div className="schema-selector-container">
              <div className="schema-label">Schema</div>
              <div className="schema-select-wrapper" ref={dropdownRef}>
                <div 
                  className={`schema-custom-select ${isDropdownOpen ? 'active' : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span className="selected-value">{selectedSchema}</span>
                  <ChevronDown size={14} className={`schema-select-chevron ${isDropdownOpen ? 'rotate' : ''}`} />
                </div>
                
                {isDropdownOpen && (
                  <div className="schema-options-list">
                    {schemas.map(schema => (
                      <div 
                        key={schema} 
                        className={`schema-option ${selectedSchema === schema ? 'selected' : ''}`}
                        onClick={() => handleSchemaSelect(schema)}
                      >
                        <span>{schema}</span>
                        {selectedSchema === schema && <Check size={14} className="check-icon" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="tables-label">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Table size={13} /> Tables
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button 
                  className="sidebar-refresh-btn" 
                  onClick={onRefresh}
                  disabled={isLoading}
                  title="Refresh tables"
                >
                  <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
                </button>
                <span className="tables-count">{tables.length}</span>
              </div>
            </div>

            <div className="table-list">
              {tables.length === 0 ? (
                <div style={{ padding: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>
                  No tables found
                </div>
              ) : (
                tables.map((table, index) => (
                  <div
                    key={index}
                    className="table-item"
                    onClick={() => handleTableClick(table)}
                  >
                    <Table size={14} />
                    <span className="table-item-name">{table}</span>
                    <button
                      className="table-preview-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewTable?.(table);
                      }}
                      title={`Preview ${table}`}
                    >
                      <Eye size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {currentView === 'history' && (
          <div className="history-list" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="tables-label" style={{ padding: '1rem 1.25rem' }}>
               Recent Queries
               <button className="sidebar-refresh-btn" onClick={fetchHistory} disabled={isHistoryLoading}>
                 <RefreshCw size={12} className={isHistoryLoading ? 'spin' : ''} />
               </button>
            </div>
            {history.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {isHistoryLoading ? 'Loading history...' : 'No history found'}
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id} 
                  className="history-item" 
                  onClick={() => { onHistoryClick(item.query); handleViewChange('editor'); }}
                  style={{ 
                    padding: '0.75rem 1rem', 
                    borderBottom: '1px solid var(--border-color)', 
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ 
                      color: item.status === 'success' ? 'var(--success)' : 'var(--error)',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      textTransform: 'uppercase'
                    }}>
                      {item.status}
                    </span>
                    <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>{item.execution_time_ms}ms</span>
                  </div>
                  <div style={{ 
                    color: 'var(--text-primary)', 
                    fontFamily: 'Fira Code, monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: 0.8
                  }}>
                    {item.query}
                  </div>
                  {item.status === 'error' && (
                    <div style={{ color: 'var(--error)', fontSize: '0.7rem', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.error_message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
