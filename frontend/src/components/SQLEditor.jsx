import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Play, Code2, Save, CheckCircle } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL, keywordCompletionSource } from '@codemirror/lang-sql';
import { autocompletion } from '@codemirror/autocomplete';

const DRAFT_KEY = 'sql_editor_draft';
const DEBOUNCE_MS = 800;

function buildColumnCompletionSource(schemaDetails) {
  const seen = new Set();
  const options = [];
  Object.values(schemaDetails || {}).forEach((columns) => {
    columns.forEach((col) => {
      if (!seen.has(col)) {
        seen.add(col);
        options.push({ label: col, type: 'property', detail: 'column' });
      }
    });
  });
  return (context) => {
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return { from: word.from, options, validFor: /^\w*$/ };
  };
}

const SQLEditor = ({ query, setQuery, onExecute, onSave, isLoading, schemaDetails, enableSuggestions }) => {
  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const flashRef = useRef(null);

  // Auto-save draft to localStorage with debounce
  const handleChange = (value) => {
    setQuery(value);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, value);
      setDraftSaved(true);
      // Hide "saved" indicator after 2s
      clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => setDraftSaved(false), 2000);
    }, DEBOUNCE_MS);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      clearTimeout(flashRef.current);
    };
  }, []);

  const handleKeyDown = (e) => {
    // Shift + R to run (Note: this will trigger on uppercase 'R')
    if (e.shiftKey && e.key === 'R') {
      e.preventDefault();
      handleRun();
    }
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
  };

  const handleRun = () => {
    const view = editorRef.current?.view;
    if (view) {
      const { state } = view;
      const sel = state.selection.main;
      if (sel.from !== sel.to) {
        const selectedText = state.sliceDoc(sel.from, sel.to).trim();
        if (selectedText) { onExecute(selectedText); return; }
      }
    }
    onExecute();
  };

  const extensions = useMemo(() => {
    const sqlLang = sql({ dialect: PostgreSQL });
    if (!enableSuggestions) return [sqlLang, autocompletion({ override: [] })];
    return [
      sqlLang,
      autocompletion({
        override: [
          keywordCompletionSource(PostgreSQL, true),
          buildColumnCompletionSource(schemaDetails),
        ],
      }),
    ];
  }, [enableSuggestions, schemaDetails]);

  return (
    <section className="editor-section" onKeyDown={handleKeyDown}>
      <div className="editor-toolbar">
        <div className="editor-title">
          <Code2 size={16} />
          SQL Editor
          <span className="editor-hint">Shift+R to run · Ctrl+S to save</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Draft saved indicator */}
          {draftSaved && (
            <span className="draft-saved-badge">
              <CheckCircle size={13} />
              Draft saved
            </span>
          )}
          <button className="icon-btn" onClick={() => onSave?.()} title="Save to DB (Ctrl+S)">
            <Save size={18} />
          </button>
          <button
            className="run-button"
            onClick={handleRun}
            disabled={isLoading || !query.trim()}
          >
            <Play size={16} fill="currentColor" />
            {isLoading ? 'Running...' : 'Run (Shift+R)'}
          </button>
        </div>
      </div>
      <div className="editor-container" style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <CodeMirror
          ref={editorRef}
          value={query}
          height="100%"
          theme="dark"
          extensions={extensions}
          onChange={handleChange}
          style={{
            fontSize: 14,
            fontFamily: "'Fira Code', monospace",
            height: '100%',
          }}
        />
      </div>
    </section>
  );
};

export { DRAFT_KEY };
export default SQLEditor;
