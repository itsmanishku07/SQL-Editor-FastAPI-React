import React, { useState } from 'react';
import { Save, X, Check, AlertCircle } from 'lucide-react';
import { saveFile } from '../api';

const SaveModal = ({ isOpen, onClose, query }) => {
  const [filename, setFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!filename.trim()) return;
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const contentB64 = btoa(unescape(encodeURIComponent(query)));
      const data = await saveFile(filename.trim(), contentB64);
      setMessage(data.message);
      setFilename('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save the file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFilename('');
    setMessage(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-content" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Save size={18} /> Save Query
          </h2>
          <button className="icon-btn" onClick={handleClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="settings-group">
            <label className="settings-label" htmlFor="filename-input">File Name</label>
            <div className="settings-input-wrapper">
              <input
                id="filename-input"
                type="text"
                className="settings-input"
                value={filename}
                onChange={(e) => { setFilename(e.target.value); setError(null); setMessage(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="my_query"
                autoFocus
              />
              <span style={{
                position: 'absolute', right: '0.75rem',
                color: 'var(--text-secondary)', fontSize: '0.75rem', pointerEvents: 'none'
              }}>.sql</span>
            </div>
            {error && <div className="settings-error"><AlertCircle size={14} /> {error}</div>}
            {message && <div className="settings-success"><Check size={14} /> {message}</div>}
          </div>
          <button
            className="run-button settings-save-btn"
            onClick={handleSave}
            disabled={isLoading || !filename.trim()}
          >
            {isLoading ? 'Saving...' : 'Save File'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveModal;
