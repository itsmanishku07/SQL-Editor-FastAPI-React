import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Database, Sparkles, AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { getDbUrl, updateDbUrl, getAiSettings, updateAiSettings } from '../api';

const SettingsModal = ({ isOpen, onClose, enableSuggestions, setEnableSuggestions, onDbSaved }) => {
  const [dbUrl, setDbUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [aiHost, setAiHost] = useState('');
  const [aiToken, setAiToken] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      setError(null);
      setAiMessage(null);
      fetchDbUrl();
      fetchAiSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const fetchDbUrl = async () => {
    try {
      const data = await getDbUrl();
      setDbUrl(data.db_url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!dbUrl.trim()) return;
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      await updateDbUrl(dbUrl);
      setMessage('Connected! Tables and schemas will refresh now.');
      onDbSaved(); // trigger parent to reload schemas/tables
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to connect to the database. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAiSettings = async () => {
    try {
      const data = await getAiSettings();
      setAiHost(data.host || '');
      setAiToken(data.token || '');
      setAiModel(data.model || '');
    } catch (err) {
      console.error('Failed to fetch AI settings:', err);
    }
  };

  const handleSaveAi = async () => {
    setIsAiLoading(true);
    setAiMessage(null);
    try {
      await updateAiSettings({ host: aiHost, token: aiToken, model: aiModel });
      setAiMessage('AI settings updated!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Close when clicking backdrop
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* DB URL Section */}
          <div className="settings-group">
            <label className="settings-label" htmlFor="db-url-input">
              <Database size={16} />
              Database Connection URL
            </label>
            <div className="settings-input-wrapper">
              <input
                id="db-url-input"
                type={showUrl ? 'text' : 'password'}
                className="settings-input settings-input-with-btn"
                value={dbUrl}
                onChange={(e) => { setDbUrl(e.target.value); setError(null); setMessage(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="postgresql://user:pass@localhost:5432/db"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                className="input-action-btn"
                onClick={() => setShowUrl(!showUrl)}
                title={showUrl ? 'Hide URL' : 'Show URL'}
                aria-label={showUrl ? 'Hide URL' : 'Show URL'}
                type="button"
              >
                {showUrl ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <div className="settings-error">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className="settings-success">
                <Check size={14} />
                <span>{message}</span>
              </div>
            )}
            <button
              className="run-button settings-save-btn"
              onClick={handleSave}
              disabled={isLoading || !dbUrl.trim()}
            >
              {isLoading ? (
                <><RefreshCw size={16} className="spin" /> Testing connection...</>
              ) : (
                <><Check size={16} /> Save &amp; Connect</>
              )}
            </button>
          </div>

          <div className="settings-divider" />

          {/* AI Settings Section */}
          <div className="settings-group">
            <label className="settings-label">
              Databricks AI Assistant
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Databricks Host URL</div>
                <input
                  type="text"
                  className="settings-input"
                  value={aiHost}
                  onChange={(e) => setAiHost(e.target.value)}
                  placeholder="https://adb-xxx.x.azuredatabricks.net"
                />
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Personal Access Token</div>
                <div className="settings-input-wrapper">
                  <input
                    type={showToken ? 'text' : 'password'}
                    className="settings-input settings-input-with-btn"
                    value={aiToken}
                    onChange={(e) => setAiToken(e.target.value)}
                    placeholder="dapi..."
                  />
                  <button
                    className="input-action-btn"
                    onClick={() => setShowToken(!showToken)}
                    type="button"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Model Endpoint Name</div>
                <input
                  type="text"
                  className="settings-input"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="databricks-meta-llama-3-70b-instruct"
                />
              </div>

              {aiMessage && (
                <div className="settings-success" style={{ marginTop: 0 }}>
                  <Check size={14} />
                  <span>{aiMessage}</span>
                </div>
              )}

              <button
                className="run-button settings-save-btn"
                onClick={handleSaveAi}
                disabled={isAiLoading}
              >
                {isAiLoading ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}
                Update AI Configuration
              </button>
            </div>
          </div>

          <div className="settings-divider" />

          <div className="settings-group">
            <div className="settings-toggle-row">
              <div className="settings-label">
                Intelligent Autocomplete
              </div>
              <label className="toggle-switch" aria-label="Toggle autocomplete">
                <input
                  type="checkbox"
                  checked={enableSuggestions}
                  onChange={(e) => setEnableSuggestions(e.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
            <div className="settings-hint">
              {enableSuggestions
                ? '✓ Enabled — SQL keywords, table names, and column names are suggested as you type.'
                : '✗ Disabled — Editor works as a plain text input.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
