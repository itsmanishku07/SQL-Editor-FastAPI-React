import React, { useState, useRef, useEffect } from 'react';
import { Database, Table, Settings, FileText, X, PanelLeftClose, Eye, ChevronDown, Check, RefreshCw } from 'lucide-react';

const Sidebar = ({
  tables, onTableClick, schemas, selectedSchema, onSchemaChange,
  onOpenSettings, currentView, onViewChange,
  isOpen, onClose, onHide, style, onPreviewTable, onRefresh, isLoading,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleTableClick = (table) => {
    onTableClick(table);
    onClose?.(); // close drawer on mobile after picking a table
  };

  const handleViewChange = (view) => {
    onViewChange(view);
    onClose?.(); // close drawer on mobile after switching view
  };

  const handleSchemaSelect = (schema) => {
    onSchemaChange(schema);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
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
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`} style={style}>

        {/* Nav Tabs */}
        <div className="sidebar-nav">
          <button
            className={`sidebar-nav-btn ${currentView === 'editor' ? 'sidebar-nav-btn--active' : ''}`}
            onClick={() => handleViewChange('editor')}
          >
            <Database size={15} /> Editor
          </button>
          <button
            className={`sidebar-nav-btn ${currentView === 'files' ? 'sidebar-nav-btn--active' : ''}`}
            onClick={() => handleViewChange('files')}
          >
            <FileText size={15} /> Saved Files
          </button>
        </div>

        {/* Schema + Tables (only in editor view) */}
        {currentView === 'editor' && (
          <>
            {/* Schema Label + Selector */}
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

            {/* Tables Header */}
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

            {/* Table List */}
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
                        e.stopPropagation(); // don't trigger the SELECT * click
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
      </aside>
    </>
  );
};

export default Sidebar;
