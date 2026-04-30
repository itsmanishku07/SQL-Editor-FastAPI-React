import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import SQLEditor, { DRAFT_KEY } from './components/SQLEditor';
import ResultsTable from './components/ResultsTable';
import SettingsModal from './components/SettingsModal';
import SaveModal from './components/SaveModal';
import SavedFilesPage from './components/SavedFilesPage';
import TablePreviewModal from './components/TablePreviewModal';
import { getTables, getSchemas, getSchemaDetails, executeQuery } from './api';
import { Database, Settings, PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';
import './index.css';

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 280;
const RESULTS_MIN_PCT = 12;
const RESULTS_MAX_PCT = 75;
const RESULTS_DEFAULT_PCT = 38;

function App() {
  const [currentView, setCurrentView] = useState('editor');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);   // mobile drawer
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // desktop hide
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [isResultsVisible, setIsResultsVisible] = useState(false);
  const [resultsPct, setResultsPct] = useState(RESULTS_DEFAULT_PCT); // % of main height for results
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const [schemas, setSchemas] = useState(['public']);
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [tables, setTables] = useState([]);
  const [schemaDetails, setSchemaDetails] = useState({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [previewTable, setPreviewTable] = useState(null); // table name being previewed
  const [enableSuggestions, setEnableSuggestions] = useState(true);

  const mainRef = useRef(null);

  useEffect(() => {
    const savedPref = localStorage.getItem('enableSuggestions');
    if (savedPref !== null) setEnableSuggestions(savedPref === 'true');
    const sw = localStorage.getItem('sidebarWidth');
    if (sw) setSidebarWidth(Number(sw));
    const rp = localStorage.getItem('resultsPct');
    if (rp) setResultsPct(Number(rp));
    const sv = localStorage.getItem('isSidebarVisible');
    if (sv !== null) setIsSidebarVisible(sv === 'true');
    // Restore draft query
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) setQuery(draft);
  }, []);

  useEffect(() => { localStorage.setItem('enableSuggestions', enableSuggestions); }, [enableSuggestions]);
  useEffect(() => { localStorage.setItem('sidebarWidth', sidebarWidth); }, [sidebarWidth]);
  useEffect(() => { localStorage.setItem('resultsPct', resultsPct); }, [resultsPct]);
  useEffect(() => { localStorage.setItem('isSidebarVisible', isSidebarVisible); }, [isSidebarVisible]);

  useEffect(() => { fetchSchemas(); }, []);
  useEffect(() => { if (selectedSchema) fetchTables(selectedSchema); }, [selectedSchema]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') setIsSidebarOpen(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // ── Sidebar drag resize ───────────────────────────────────────────────────
  const startSidebarDrag = useCallback((e) => {
    e.preventDefault();
    setIsDraggingSidebar(true);
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (ev) => {
      const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startW + ev.clientX - startX));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      setIsDraggingSidebar(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  // ── Editor/Results split drag ─────────────────────────────────────────────
  const startSplitDrag = useCallback((e) => {
    e.preventDefault();
    setIsDraggingSplit(true);
    const startY = e.clientY;
    const startPct = resultsPct;
    const containerH = mainRef.current?.getBoundingClientRect().height ?? 600;

    const onMove = (ev) => {
      const deltaPx = startY - ev.clientY; // positive = dragging up = more results
      const deltaPct = (deltaPx / containerH) * 100;
      const newPct = Math.max(RESULTS_MIN_PCT, Math.min(RESULTS_MAX_PCT, startPct + deltaPct));
      setResultsPct(newPct);
    };
    const onUp = () => {
      setIsDraggingSplit(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [resultsPct]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchSchemas = async () => {
    try {
      const data = await getSchemas();
      setSchemas(data.schemas);
      if (data.schemas.length > 0 && !data.schemas.includes(selectedSchema)) {
        setSelectedSchema(data.schemas.includes('public') ? 'public' : data.schemas[0]);
      }
    } catch (err) { console.error('Failed to fetch schemas:', err); }
  };

  const fetchTables = async (schema) => {
    try {
      const data = await getTables(schema);
      setTables(data.tables);
      const detailsData = await getSchemaDetails(schema);
      setSchemaDetails(detailsData.schema_details);
    } catch (err) { console.error('Failed to fetch tables/schema details:', err); }
  };

  const handleExecute = async (textOverride) => {
    const toRun = typeof textOverride === 'string' ? textOverride : query;
    if (!toRun.trim()) return;
    setIsLoading(true);
    setError(null);
    setResults(null);
    setIsResultsVisible(true); // auto-show results panel
    try {
      const data = await executeQuery(toRun, selectedSchema);
      if (data.error) setError(data.error);
      else setResults(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableClick = (tableName) => setQuery(`SELECT * FROM ${tableName} LIMIT 100;`);
  const handleDbSaved = async () => { await fetchSchemas(); if (selectedSchema) await fetchTables(selectedSchema); };
  const handleLoadFromFile = (content) => { setQuery(content); setCurrentView('editor'); };

  // Computed editor height
  const editorHeightPct = isResultsVisible ? 100 - resultsPct : 100;

  return (
    <div className={`app-root ${isDraggingSidebar ? 'dragging-h' : ''} ${isDraggingSplit ? 'dragging-v' : ''}`}>

      {/* ── Persistent Global Header ────────────────────────── */}
      <header className="app-header">
        <div className="header-left">
          <Database size={24} color="#6366f1" className="header-logo" />
          <h1 className="header-title">Postgres Pro</h1>
        </div>

        <div className="header-right">
          <button className="icon-btn" onClick={() => setIsSettingsOpen(true)} title="Settings">
            <Settings size={20} />
          </button>
          
          {/* Sidebar Toggle (Desktop + Mobile) */}
          <button 
            className="icon-btn" 
            onClick={() => {
              if (window.innerWidth <= 768) setIsSidebarOpen(true);
              else setIsSidebarVisible(!isSidebarVisible);
            }} 
            title={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            {isSidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        </div>
      </header>


      <div className="app-main">
        {/* ── Sidebar ───────────────────────────────────────────────── */}
        {isSidebarVisible && (
          <Sidebar
            tables={tables}
            onTableClick={handleTableClick}
            schemas={schemas}
            selectedSchema={selectedSchema}
            onSchemaChange={setSelectedSchema}
            onOpenSettings={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }}
            currentView={currentView}
            onViewChange={setCurrentView}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onHide={() => setIsSidebarVisible(false)}
            style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
            onPreviewTable={(table) => setPreviewTable(table)}
          />
        )}

      {/* ── Sidebar Resize Handle (desktop only) ──────────────────── */}
      {isSidebarVisible && (
        <div
          className="resize-handle-v"
          onMouseDown={startSidebarDrag}
          title="Drag to resize sidebar"
        />
      )}

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="main-content" ref={mainRef}>
        {currentView === 'editor' ? (
          <>
            {/* Editor */}
            <div
              className="editor-section"
              style={{ height: `${editorHeightPct}%`, flex: 'none' }}
            >
              <SQLEditor
                query={query}
                setQuery={setQuery}
                onExecute={handleExecute}
                onSave={() => setIsSaveOpen(true)}
                isLoading={isLoading}
                schemaDetails={schemaDetails}
                enableSuggestions={enableSuggestions}
              />
            </div>

            {/* Horizontal drag handle between editor and results */}
            {isResultsVisible && (
              <div
                className="resize-handle-h"
                onMouseDown={startSplitDrag}
                title="Drag to resize"
              />
            )}

            {/* Results */}
            {isResultsVisible && (
              <div
                className="results-wrapper"
                style={{ height: `${resultsPct}%`, flex: 'none' }}
              >
                <ResultsTable
                  results={results}
                  error={error}
                  onHide={() => setIsResultsVisible(false)}
                />
              </div>
            )}
          </>
        ) : (
          <SavedFilesPage
            onBack={() => setCurrentView('editor')}
            onLoadIntoEditor={handleLoadFromFile}
          />
        )}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        <button
          className={`bottom-nav-btn ${currentView === 'editor' ? 'bottom-nav-btn--active' : ''}`}
          onClick={() => setCurrentView('editor')}
        >
          <Database size={20} />
          <span>Editor</span>
        </button>
        <button
          className={`bottom-nav-btn ${currentView === 'files' ? 'bottom-nav-btn--active' : ''}`}
          onClick={() => setCurrentView('files')}
        >
          <span style={{ fontSize: '20px' }}>📁</span>
          <span>Saved</span>
        </button>
      </nav>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} enableSuggestions={enableSuggestions} setEnableSuggestions={setEnableSuggestions} onDbSaved={handleDbSaved} />
      <SaveModal isOpen={isSaveOpen} onClose={() => setIsSaveOpen(false)} query={query} />
      {previewTable && (
        <TablePreviewModal
          tableName={previewTable}
          schema={selectedSchema}
          onClose={() => setPreviewTable(null)}
        />
      )}
    </div>
  );
}

export default App;
