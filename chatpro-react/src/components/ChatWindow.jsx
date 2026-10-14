import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatWindow.module.css';

const DEFAULT_MESSAGES = [
  {
    id: 'welcome-1',
    role: 'assistant',
    type: 'text',
    text: '👋 Hey there! I am **ChatPro AI** — your intelligent AI companion.\n\nYou can chat with me directly right here on the website! Ask questions, generate stunning images with `/imagine [prompt]`, or transform text into aesthetic fonts with `/font [text]`. What would you like to explore today?',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
];

const SUGGESTIONS = [
  { label: '🎨 Generate Cyberpunk Cat', prompt: '/imagine futuristic neon cyberpunk cat in Tokyo rain' },
  { label: '💡 Explain Quantum Computing', prompt: 'Explain quantum computing in simple terms with an analogy' },
  { label: '💻 React Code Example', prompt: 'Write a clean React countdown timer hook with explanation' },
  { label: '🔤 Stylize Name', prompt: '/font Utkarsh Vatshayan' },
];

export default function ChatWindow() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('chatpro_web_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_MESSAGES;
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('chatpro_web_messages', JSON.stringify(messages));
    } catch (e) {}
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages(DEFAULT_MESSAGES);
    try {
      localStorage.removeItem('chatpro_web_messages');
    } catch (e) {}
  };

  const sendMessage = async (customPrompt) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || loading) return;

    const userMsgId = 'u-' + Date.now();
    const userMsg = {
      id: userMsgId,
      role: 'user',
      type: 'text',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setLoading(true);

    try {
      // Format history for the backend
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text || (m.type === 'image' ? `Image: ${m.prompt}` : ''),
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: historyPayload,
          userProfile: { name: 'Web Visitor' },
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const botMsgId = 'b-' + Date.now();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data.type === 'image') {
        setMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            role: 'assistant',
            type: 'image',
            prompt: data.prompt,
            imageUrl: data.imageUrl,
            provider: data.provider || 'AI FLUX Image Engine',
            text: data.response || `Generated image for "${data.prompt}"`,
            time: timeStr,
          },
        ]);
      } else if (data.type === 'fonts') {
        setMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            role: 'assistant',
            type: 'fonts',
            original: data.original,
            styles: data.styles || [],
            text: data.response || `Font variations for "${data.original}":`,
            time: timeStr,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            role: 'assistant',
            type: 'text',
            text: data.response || 'No response from assistant',
            time: timeStr,
          },
        ]);
      }
    } catch (err) {
      console.error('Chat send error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          type: 'text',
          text: '⚠️ Unable to connect to backend right now. Please ensure the backend server is running on port 3000.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <section className={styles.section} id="chat">
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.sectionHeader}>
          <div className={styles.badge}>
            <span className={styles.pulseDot} />
            <span>Live Interactive Chat</span>
          </div>
          <h2 className={styles.title}>
            Chat with <span className={styles.gradientText}>ChatPro AI</span> Online
          </h2>
          <p className={styles.subtitle}>
            Experience the same powerful backend right here in your browser — zero redirection needed!
          </p>
        </div>

        {/* Chat Card */}
        <div className={styles.chatCard}>
          {/* Header */}
          <div className={styles.chatHeader}>
            <div className={styles.botInfo}>
              <div className={styles.avatarWrap}>
                <div className={styles.avatarCore}>CP</div>
                <div className={styles.onlineDot} />
              </div>
              <div>
                <div className={styles.botName}>ChatPro AI Assistant</div>
                <div className={styles.botStatus}>
                  Online • Multi-Model Intelligence (Gemini + FLUX + Fonts)
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={handleClear}
                title="Clear current conversation"
                id="clear-chat-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Clear
              </button>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                type="button"
                className={styles.suggestionChip}
                onClick={() => sendMessage(s.prompt)}
                disabled={loading}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className={styles.messagesBox}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : styles.botRow}`}
              >
                {msg.role === 'assistant' && (
                  <div className={styles.msgAvatar}>CP</div>
                )}

                <div className={styles.msgBubble}>
                  {/* Text Message */}
                  {msg.type === 'text' && (
                    <div className={styles.msgText}>
                      {msg.text.split('\n').map((line, idx) => (
                        <p key={idx} className={styles.textLine}>
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Image Generation Result */}
                  {msg.type === 'image' && (
                    <div className={styles.imagePayload}>
                      <p className={styles.imagePrompt}>🎨 &ldquo;{msg.prompt}&rdquo;</p>
                      <div className={styles.imageContainer}>
                        <img
                          src={msg.imageUrl}
                          alt={msg.prompt}
                          className={styles.generatedImg}
                          onClick={() => setPreviewImage(msg.imageUrl)}
                        />
                        <div className={styles.imageOverlay}>
                          <a
                            href={msg.imageUrl}
                            download={`chatpro-${Date.now()}.jpg`}
                            className={styles.downloadBtn}
                            target="_blank"
                            rel="noreferrer"
                          >
                            ⬇ Download
                          </a>
                        </div>
                      </div>
                      <div className={styles.providerBadge}>
                        ⚡ Powered by {msg.provider}
                      </div>
                    </div>
                  )}

                  {/* Fonts Result */}
                  {msg.type === 'fonts' && (
                    <div className={styles.fontsPayload}>
                      <div className={styles.fontsIntro}>{msg.text}</div>
                      <div className={styles.fontsGrid}>
                        {msg.styles.map((f, fIdx) => (
                          <div key={fIdx} className={styles.fontItem}>
                            <div className={styles.fontName}>{f.name}</div>
                            <div className={styles.fontText}>{f.styled}</div>
                            <button
                              type="button"
                              className={styles.copyFontBtn}
                              onClick={() => copyText(f.styled, `font-${msg.id}-${fIdx}`)}
                            >
                              {copiedId === `font-${msg.id}-${fIdx}` ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.msgFooter}>
                    <span className={styles.msgTime}>{msg.time}</span>
                    {msg.type === 'text' && (
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={() => copyText(msg.text, msg.id)}
                        title="Copy message"
                      >
                        {copiedId === msg.id ? '✓' : '❐'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Thinking / Typing Indicator */}
            {loading && (
              <div className={`${styles.messageRow} ${styles.botRow}`}>
                <div className={styles.msgAvatar}>CP</div>
                <div className={`${styles.msgBubble} ${styles.typingBubble}`}>
                  <div className={styles.dots}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className={styles.typingText}>ChatPro is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className={styles.inputArea}>
            <textarea
              ref={inputRef}
              rows={1}
              className={styles.textInput}
              placeholder="Ask anything, type /imagine [prompt] for images, or /font [text]..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              id="web-chat-input"
            />
            <button
              type="button"
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              id="web-chat-send-btn"
              title="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Modal for previewing images */}
        {previewImage && (
          <div className={styles.modal} onClick={() => setPreviewImage(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <img src={previewImage} alt="Preview" className={styles.modalImg} />
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setPreviewImage(null)}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
