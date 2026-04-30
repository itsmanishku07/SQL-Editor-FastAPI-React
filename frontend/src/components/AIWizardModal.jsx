import React, { useState, useCallback } from 'react';
import { X, Sparkles, Database, Check, RefreshCw, AlertCircle, Play } from 'lucide-react';
import { aiGenerateSchema, aiGenerateData, executeQuery } from '../api';

const AIWizardModal = ({ isOpen, onClose, selectedSchema, onRefresh }) => {
  const [step, setStep] = useState(1); // 1: Prompt, 2: Review & Data
  const [prompt, setPrompt] = useState('');
  const [generatedSql, setGeneratedSql] = useState('');
  const [dataSql, setDataSql] = useState('');
  const [rowCount, setRowCount] = useState(10);
  const [includeData, setIncludeData] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleGenerateSchema = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await aiGenerateSchema(prompt);
      setGeneratedSql(data.sql);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Create Tables
      await executeQuery(generatedSql, selectedSchema);

      // 2. Generate and Insert Data if requested
      if (includeData) {
        const dataResponse = await aiGenerateData(generatedSql, rowCount);
        await executeQuery(dataResponse.sql, selectedSchema);
      }

      setSuccess('Table and data created successfully!');
      setTimeout(() => {
        onRefresh();
        onClose();
        // Reset state
        setStep(1);
        setPrompt('');
        setGeneratedSql('');
        setDataSql('');
        setSuccess(null);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content ai-wizard-modal">
        <div className="modal-header">
          <h2 id="ai-wizard-title">
            AI Table Generator
          </h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="settings-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="settings-success" style={{ marginBottom: '1rem' }}>
              <Check size={14} />
              <span>{success}</span>
            </div>
          )}

          {step === 1 && (
            <div className="ai-step">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Describe the table or system you want to create. AI will design the schema for you.
              </p>
              <textarea
                className="sql-textarea ai-prompt-input"
                style={{ height: '120px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1rem', width: '100%', padding: '1rem' }}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Table desc you wanna create!"
              />
              <button
                className="run-button"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleGenerateSchema}
                disabled={isLoading || !prompt.trim()}
              >
                {isLoading ? <RefreshCw size={18} className="spin" /> : <Sparkles size={18} />}
                Generate Schema
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="ai-step">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Review Generated SQL</span>
                <button
                  className="icon-btn"
                  style={{ fontSize: '0.75rem', gap: '0.25rem' }}
                  onClick={() => setStep(1)}
                >
                  Edit Prompt
                </button>
              </div>

              <pre className="ai-sql-preview">
                <code>{generatedSql}</code>
              </pre>

              <div className="ai-data-options" style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={16} color="var(--accent)" />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Generate Synthetic Data</span>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                {includeData && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Number of rows:</span>
                    <input
                      type="number"
                      className="settings-input"
                      style={{ width: '80px', padding: '0.25rem 0.5rem' }}
                      value={rowCount}
                      onChange={(e) => setRowCount(parseInt(e.target.value))}
                      min="1"
                      max="100"
                    />
                  </div>
                )}
              </div>

              <button
                className="run-button"
                style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}
                onClick={handleExecute}
                disabled={isLoading}
              >
                {isLoading ? <RefreshCw size={18} className="spin" /> : <Play size={18} />}
                Execute &amp; Create Everything
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWizardModal;
