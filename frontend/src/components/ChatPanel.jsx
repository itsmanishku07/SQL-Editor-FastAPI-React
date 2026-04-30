import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Trash2, Bot, User, RefreshCw, MessageSquare, Copy, Check } from 'lucide-react';
import { aiChat, getAiChatHistory, clearAiChatHistory } from '../api';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="chat-copy-btn" onClick={handleCopy} title="Copy code">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const ChatPanel = ({ isOpen, onClose, style }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const data = await getAiChatHistory();
      setMessages(data.history || []);
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const data = await aiChat(userMsg);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please check your AI settings.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearAiChatHistory();
      setMessages([]);
      setIsConfirmOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const renderContent = (content) => {
    // 1. Split by code blocks first
    const parts = content.split(/(```sql[\s\S]*?```|```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```sql|```/g, '').trim();
        return (
          <div key={index} className="chat-code-wrapper">
            <pre className="chat-code-block">
              <code>{code}</code>
            </pre>
            <CopyButton text={code} />
          </div>
        );
      }

      // 2. Handle Tables
      if (part.includes('|') && part.includes('\n|')) {
        const lines = part.trim().split('\n');
        const tableLines = lines.filter(l => l.trim().startsWith('|'));
        if (tableLines.length >= 2) {
          const rows = tableLines.map(line => 
            line.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim())
          );
          
          return (
            <div key={index} className="chat-table-wrapper">
              <table className="chat-table">
                <thead>
                  <tr>{rows[0].map((cell, i) => <th key={i}>{cell}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(2).map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }

      // 3. Simple Markdown (Bold, Lists)
      let text = part;
      // Bold
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Lists
      const lines = text.split('\n').map((line, i) => {
        if (line.trim().startsWith('* ')) {
          return <li key={i}>{line.trim().substring(2)}</li>;
        }
        if (line.trim().startsWith('- ')) {
          return <li key={i}>{line.trim().substring(2)}</li>;
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: line }} /> ;
      });

      return <div key={index} className="text-content">{lines}</div>;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="chat-panel" style={style}>
      <div className="chat-header">
        <div className="chat-title">
          <MessageSquare size={18} />
          <span>SQL Expert Chat</span>
        </div>
        <div className="chat-actions">
          <button className="icon-btn" onClick={() => setIsConfirmOpen(true)} title="Clear history">
            <Trash2 size={16} />
          </button>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="chat-confirm-overlay">
          <div className="chat-confirm-modal">
            <Trash2 size={24} color="var(--error)" />
            <h3>Clear History?</h3>
            <p>This will permanently delete all chat messages from the storage.</p>
            <div className="chat-confirm-buttons">
              <button className="confirm-cancel" onClick={() => setIsConfirmOpen(false)}>Cancel</button>
              <button className="confirm-delete" onClick={handleClear}>Clear Now</button>
            </div>
          </div>
        </div>
      )}

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <Bot size={40} opacity={0.2} />
            <p>Ask me anything about SQL, schemas, or query optimization!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="message-icon">
              {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
            </div>
            <div className="message-content">
              {renderContent(msg.content)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-icon">
              <RefreshCw size={14} className="spin" />
            </div>
            <div className="message-content">Thinking...</div>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
              e.target.style.height = 'auto';
            }
          }}
          placeholder="Ask an SQL question..."
          rows={1}
        />
        <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isLoading}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
