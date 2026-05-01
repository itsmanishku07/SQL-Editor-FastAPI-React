import React, { useState, useEffect } from 'react';
import { Trophy, Send, RefreshCw, HelpCircle, AlertCircle, CheckCircle2, ChevronRight, BookOpen, BrainCircuit, Database } from 'lucide-react';
import { generateChallenge, verifyChallenge, executeQuery } from '../api';
import SQLEditor from './SQLEditor';
import ResultsTable from './ResultsTable';

const PracticePage = ({ tables, selectedSchema, schemaDetails, schemas = [], onSchemaChange }) => {
  const [selectedTables, setSelectedTables] = useState([]);
  const [difficulty, setDifficulty] = useState('medium');
  const [challenge, setChallenge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showSchemas, setShowSchemas] = useState(true);
  const [showExpected, setShowExpected] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isQuestionOpen, setIsQuestionOpen] = useState(true);

  const handleGenerate = async () => {
    if (selectedTables.length === 0) return;
    setIsLoading(true);
    setChallenge(null);
    setVerificationResult(null);
    setResults(null);
    setError(null);
    setShowHint(false);
    setShowExpected(false);
    setUserQuery('');
    
    try {
      const data = await generateChallenge(selectedTables, difficulty, selectedSchema);
      setChallenge(data);
      setUserQuery('-- Write your query here\n');
    } catch (err) {
      setError(err.message || 'Failed to generate challenge');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRun = async () => {
    if (!userQuery.trim()) return;
    setIsVerifying(true);
    setError(null);
    try {
      const data = await executeQuery(userQuery, selectedSchema);
      if (data.error) setError(data.error);
      else setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!userQuery.trim() || !challenge) return;
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const data = await verifyChallenge(userQuery, challenge.solution_sql, selectedSchema);
      setVerificationResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleTable = (table) => {
    if (selectedTables.includes(table)) {
      setSelectedTables(selectedTables.filter(t => t !== table));
    } else {
      setSelectedTables([...selectedTables, table]);
    }
  };

  return (
    <div className="practice-page" style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar Configuration Toggle (Floating when closed) */}
      {!isConfigOpen && (
        <button 
          onClick={() => setIsConfigOpen(true)}
          style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 100, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', padding: '0.75rem 0.25rem', cursor: 'pointer' }}
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Sidebar Configuration */}
      {isConfigOpen && (
        <div className="practice-sidebar" style={{ width: '280px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', position: 'relative' }}>
          <button 
            onClick={() => setIsConfigOpen(false)}
            style={{ position: 'absolute', right: '0.5rem', top: '1.25rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          
          <div className="sidebar-header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontWeight: 600 }}>
              <BrainCircuit size={20} />
              Config
            </div>
          </div>
          
          <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
            {/* Schema Selection */}
            <div className="settings-group">
              <label className="settings-label">1. Database Schema</label>
              <select 
                value={selectedSchema} 
                onChange={(e) => onSchemaChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  marginTop: '0.5rem',
                  outline: 'none'
                }}
              >
                {schemas.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="settings-group" style={{ marginTop: '1.5rem' }}>
              <label className="settings-label">2. Select Tables</label>
              <div className="table-selection-list" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {tables.map(table => (
                  <div 
                    key={table} 
                    className={`selection-item ${selectedTables.includes(table) ? 'active' : ''}`}
                    onClick={() => toggleTable(table)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: selectedTables.includes(table) ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: selectedTables.includes(table) ? 'var(--accent)' : 'var(--text-secondary)',
                      border: '1px solid',
                      borderColor: selectedTables.includes(table) ? 'var(--accent)' : 'transparent'
                    }}
                  >
                    <BookOpen size={14} />
                    {table}
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-group" style={{ marginTop: '2rem' }}>
              <label className="settings-label">3. Difficulty</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                {['easy', 'medium', 'hard'].map(level => (
                  <button
                    key={level}
                    className={`difficulty-btn ${difficulty === level ? 'active' : ''}`}
                    onClick={() => setDifficulty(level)}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      background: difficulty === level ? 'var(--accent)' : 'transparent',
                      color: difficulty === level ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <button 
              className="run-button" 
              style={{ width: '100%', marginTop: '2rem', padding: '0.75rem' }}
              onClick={handleGenerate}
              disabled={isLoading || selectedTables.length === 0}
            >
              {isLoading ? <RefreshCw size={16} className="spin" /> : <Trophy size={16} />}
              {challenge ? 'New Challenge' : 'Start Practice'}
            </button>
          </div>
        </div>
      )}

      {/* Main Practice Area */}
      <div className="practice-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
        {!challenge ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <BrainCircuit size={64} opacity={0.1} />
            <h2>SQL Practice Arena</h2>
            <p style={{ maxWidth: '400px', textAlign: 'center' }}>
              Select tables and difficulty, then click "Start Practice" to begin your challenge.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
            
            {/* Question Panel Toggle (Floating when closed) */}
            {!isQuestionOpen && (
              <button 
                onClick={() => setIsQuestionOpen(true)}
                style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 100, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '0 4px 4px 0', padding: '0.75rem 0.25rem', cursor: 'pointer' }}
              >
                <ChevronRight size={16} />
              </button>
            )}

            {/* Left Side: Problem & Context (Question Panel) */}
            {isQuestionOpen && (
              <div style={{ width: '45%', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-secondary)', position: 'relative' }}>
                <button 
                  onClick={() => setIsQuestionOpen(false)}
                  style={{ position: 'absolute', right: '0.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', zIndex: 10 }}
                >
                  <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>

                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span className={`difficulty-badge ${difficulty}`} style={{ 
                      fontSize: '0.65rem', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '10px', 
                      textTransform: 'uppercase',
                      fontWeight: 700
                    }}>
                      {difficulty}
                    </span>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{challenge.title}</h2>
                  </div>
                  
                  <div className="problem-description" style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '0.9rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    {challenge.description}
                  </div>

                  {/* Schemas Section */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <button 
                      className="section-toggle-btn"
                      onClick={() => setShowSchemas(!showSchemas)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', 
                        color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: '0.75rem' 
                      }}
                    >
                      <ChevronRight size={14} style={{ transform: showSchemas ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                      TABLE SCHEMAS ({selectedTables.length})
                    </button>
                    {showSchemas && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1.25rem' }}>
                        {selectedTables.map(t => (
                          <div key={t} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', backgroundColor: 'var(--bg-primary)' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Database size={12} /> {t}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                              {schemaDetails[t]?.map(col => (
                                <span key={col} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                  {col}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expected Results Section */}
                  {(challenge.expected || verificationResult?.expected) && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <button 
                        className="section-toggle-btn"
                        onClick={() => setShowExpected(!showExpected)}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', 
                          color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginBottom: '0.75rem' 
                        }}
                      >
                        <ChevronRight size={14} style={{ transform: showExpected ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                        EXPECTED OUTPUT
                      </button>
                      {showExpected && (
                        <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                          <table style={{ fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                                {(challenge.expected || verificationResult.expected).columns.map((col, i) => <th key={i} style={{ padding: '0.4rem 0.75rem', color: 'var(--success)', textAlign: 'left' }}>{col}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {(challenge.expected || verificationResult.expected).rows.map((row, ri) => (
                                <tr key={ri} style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
                                  {(challenge.expected || verificationResult.expected).columns.map((col, ci) => (
                                    <td key={ci} style={{ padding: '0.4rem 0.75rem', color: 'var(--text-primary)' }}>{String(row[ci])}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hints Section */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <button 
                      className="icon-btn" 
                      onClick={() => setShowHint(!showHint)}
                      style={{ fontSize: '0.8rem', gap: '0.5rem', color: 'var(--accent)', padding: 0 }}
                    >
                      <HelpCircle size={14} />
                      {showHint ? 'Hide Hint' : 'Show Hint'}
                    </button>
                    {showHint && (
                      <div style={{ 
                        marginTop: '0.75rem', padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px',
                        borderLeft: '4px solid var(--accent)', fontSize: '0.8rem', color: 'var(--text-secondary)'
                      }}>
                        {challenge.hint}
                      </div>
                    )}
                  </div>

                  {/* Result Feedback */}
                  {verificationResult && (
                    <div style={{ 
                      marginTop: '2rem', padding: '1.25rem', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '1rem',
                      backgroundColor: verificationResult.is_correct ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${verificationResult.is_correct ? 'var(--success)' : 'var(--error)'}`
                    }}>
                      {verificationResult.is_correct ? <CheckCircle2 size={24} color="var(--success)" /> : <AlertCircle size={24} color="var(--error)" />}
                      <div>
                        <div style={{ fontWeight: 600, color: verificationResult.is_correct ? 'var(--success)' : 'var(--error)', marginBottom: '0.25rem' }}>
                          {verificationResult.is_correct ? 'Accepted' : 'Try Again'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                          {verificationResult.message}
                          {!verificationResult.is_correct && !showExpected && (
                            <div style={{ marginTop: '0.5rem', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowExpected(true)}>
                              Reveal expected output
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right Side: Editor & Results */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <SQLEditor 
                  query={userQuery} 
                  setQuery={setUserQuery} 
                  onExecute={handleRun}
                  isLoading={isVerifying}
                  schemaDetails={schemaDetails}
                  enableSuggestions={true}
                />
                
                <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 10, display: 'flex', gap: '0.75rem' }}>
                  <button className="run-button" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} onClick={handleRun} disabled={isVerifying}>
                    Run Code
                  </button>
                  <button className="run-button" onClick={handleSubmit} disabled={isVerifying}>
                    <Send size={16} />
                    Submit
                  </button>
                </div>
              </div>
              
              <div style={{ height: '35%', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
                <ResultsTable 
                  results={results} 
                  error={error} 
                  onHide={null} 
                  query={userQuery} 
                  schema={selectedSchema}
                  expected={verificationResult?.expected}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticePage;
