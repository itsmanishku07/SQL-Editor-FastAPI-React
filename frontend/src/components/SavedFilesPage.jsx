import React, { useState, useEffect, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { autocompletion } from '@codemirror/autocomplete';
import {
  FileText, Trash2, Eye, Copy, ArrowLeft, Check, RefreshCw,
  Calendar, Database, AlertCircle
} from 'lucide-react';
import { listFiles, getFile, deleteFile } from '../api';

const SavedFilesPage = ({ onBack, onLoadIntoEditor }) => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listFiles();
      setFiles(data.files);
    } catch (err) {
      setError('Failed to load files. Make sure your database is connected.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = async (file) => {
    setSelectedFile(file);
    setFileContent('');
    setIsLoadingContent(true);
    try {
      const data = await getFile(file.id);
      const decoded = decodeURIComponent(escape(atob(data.content_b64)));
      setFileContent(decoded);
    } catch {
      setFileContent('-- Error: could not decode file content.');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteFile(id);
      setFiles(files.filter(f => f.id !== id));
      if (selectedFile?.id === id) { setSelectedFile(null); setFileContent(''); }
      setDeleteConfirm(null);
    } catch (err) {
      alert('Failed to delete file.');
    }
  };

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fileContent]);

  const handleLoadIntoEditor = () => {
    onLoadIntoEditor(fileContent);
    onBack();
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="saved-files-page">
      {/* Header */}
      <div className="saved-files-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="icon-btn" onClick={onBack} title="Back to Editor">
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Saved Queries</h2>
        </div>
        <button className="icon-btn" onClick={fetchFiles} title="Refresh">
          <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
        </button>
      </div>

      <div className="saved-files-body">
        {/* File List */}
        <div className="saved-files-list">
          {error && (
            <div className="error-message" style={{ margin: '1rem' }}>
              <AlertCircle size={16} />
              <span style={{ marginLeft: '0.5rem' }}>{error}</span>
            </div>
          )}

          {!isLoading && !error && files.length === 0 && (
            <div className="empty-state" style={{ height: '100%', padding: '2rem' }}>
              <FileText size={48} opacity={0.2} />
              <p>No saved queries yet.</p>
              <p style={{ fontSize: '0.75rem' }}>Save a query from the editor using Ctrl+S.</p>
            </div>
          )}

          {files.map(file => (
            <div
              key={file.id}
              className={`file-card ${selectedFile?.id === file.id ? 'file-card--active' : ''}`}
              onClick={() => handleView(file)}
            >
              <div className="file-card-icon">
                <FileText size={20} />
              </div>
              <div className="file-card-info">
                <div className="file-card-name">{file.filename}</div>
                <div className="file-card-date">
                  <Calendar size={11} />
                  {formatDate(file.created_at)}
                </div>
              </div>
              <div className="file-card-actions" onClick={e => e.stopPropagation()}>
                {deleteConfirm === file.id ? (
                  <>
                    <button
                      className="icon-btn"
                      style={{ color: 'var(--error)' }}
                      onClick={() => handleDelete(file.id)}
                      title="Confirm delete"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => setDeleteConfirm(null)}
                      title="Cancel"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    className="icon-btn"
                    onClick={() => setDeleteConfirm(file.id)}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Preview Panel */}
        <div className="saved-files-preview">
          {!selectedFile ? (
            <div className="empty-state" style={{ height: '100%' }}>
              <Eye size={48} opacity={0.2} />
              <p>Select a file to preview</p>
            </div>
          ) : (
            <>
              <div className="preview-header">
                <div className="file-card-name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={16} /> {selectedFile.filename}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="icon-btn"
                    onClick={handleCopy}
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                  </button>
                  <button
                    className="run-button"
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={handleLoadIntoEditor}
                    disabled={!fileContent}
                  >
                    <Database size={14} /> Load into Editor
                  </button>
                </div>
              </div>
              <div className="preview-body">
                {isLoadingContent ? (
                  <div className="empty-state" style={{ height: '100%' }}>
                    <RefreshCw size={24} className="spin" opacity={0.5} />
                  </div>
                ) : (
                  <CodeMirror
                    value={fileContent}
                    height="100%"
                    theme="dark"
                    extensions={[sql({ dialect: PostgreSQL }), autocompletion({ override: [] })]}
                    editable={false}
                    style={{ fontSize: 13, fontFamily: "'Fira Code', monospace", height: '100%' }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SavedFilesPage;
