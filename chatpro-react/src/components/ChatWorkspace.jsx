import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatWorkspace.module.css';

const ROOMS = [
  { id: 'general', name: 'General Assistant', icon: '💬', desc: 'All-round intelligent conversation, writing & problem solving' },
  { id: 'creative', name: 'Creative Studio', icon: '🎨', desc: 'Image generation, art direction & creative concepts' },
  { id: 'code', name: 'Engineering Lab', icon: '💻', desc: 'Code writing, debugging, architecture & technical guidance' },
  { id: 'fonts', name: 'Typography Lab', icon: '🔤', desc: 'Unicode font styling, aesthetic text & symbols' },
];

const ROOM_WELCOME_MESSAGES = {
  general: 'Hello! I am **ChatPro AI** — your intelligent workspace assistant. How can I assist you today? You can ask anything, upload an image for analysis, or explore concepts.',
  creative: 'Welcome to the **Creative Studio**! Ask me to generate images using `/imagine [prompt]`, design visual concepts, or brainstorm creative ideas.',
  code: 'Welcome to the **Engineering Lab**! Paste your code, ask debugging questions, or request system designs in any programming language.',
  fonts: 'Welcome to the **Typography Lab**! Type `/font [your text]` to instantly convert text into 9+ aesthetic Unicode font styles.',
};

export default function ChatWorkspace() {
  const [activeRoom, setActiveRoom] = useState('general');
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('chatpro_sessions_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    const initId = 'session-' + Date.now();
    return [
      {
        id: initId,
        title: 'New Conversation',
        room: 'general',
        createdAt: new Date().toISOString(),
        messages: [
          {
            id: 'init-1',
            role: 'assistant',
            type: 'text',
            text: ROOM_WELCOME_MESSAGES.general,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    return sessions[0]?.id || 'default';
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null); // { base64, mimeType, name }
  const [copiedId, setCopiedId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewModalImg, setPreviewModalImg] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Current session
  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem('chatpro_sessions_v2', JSON.stringify(sessions));
    } catch (e) {}
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, loading]);

  const updateCurrentSessionMessages = (updater) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === currentSession.id) {
          const nextMessages = typeof updater === 'function' ? updater(s.messages) : updater;
          // Auto-generate title from first user message if still default
          let title = s.title;
          if (title === 'New Conversation') {
            const firstUserMsg = nextMessages.find((m) => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.text.slice(0, 28) + (firstUserMsg.text.length > 28 ? '...' : '');
            }
          }
          return { ...s, messages: nextMessages, title };
        }
        return s;
      })
    );
  };

  const handleCreateNewChat = (roomId = activeRoom) => {
    const newId = 'session-' + Date.now();
    const newSession = {
      id: newId,
      title: 'New Conversation',
      room: roomId,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: 'w-' + Date.now(),
          role: 'assistant',
          type: 'text',
          text: ROOM_WELCOME_MESSAGES[roomId] || ROOM_WELCOME_MESSAGES.general,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setActiveRoom(roomId);
    setAttachedImage(null);
    setInput('');
  };

  const handleDeleteSession = (sessionId, e) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      handleCreateNewChat(activeRoom);
      return;
    }
    const filtered = sessions.filter((s) => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id || '');
    }
  };

  const handleRoomSelect = (roomId) => {
    setActiveRoom(roomId);
    // Find or create session for this room
    const existing = sessions.find((s) => s.room === roomId);
    if (existing) {
      setActiveSessionId(existing.id);
    } else {
      handleCreateNewChat(roomId);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage({
        base64: reader.result,
        mimeType: file.type,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    if ((!textToSend && !attachedImage) || loading) return;

    const userMessageId = 'u-' + Date.now();
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMessage = {
      id: userMessageId,
      role: 'user',
      type: 'text',
      text: textToSend || (attachedImage ? 'Analyze this image.' : ''),
      image: attachedImage ? attachedImage.base64 : null,
      time: timeNow,
    };

    updateCurrentSessionMessages((prev) => [...prev, newUserMessage]);
    const imageToSend = attachedImage;
    setAttachedImage(null);
    setInput('');
    setLoading(true);

    try {
      // Build history
      const historyPayload = messages.slice(-12).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        text: m.text || '',
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          image: imageToSend ? imageToSend.base64 : undefined,
          mimeType: imageToSend ? imageToSend.mimeType : undefined,
          history: historyPayload,
          userProfile: { name: 'User', room: activeRoom },
        }),
      });

      if (!res.ok) {
        throw new Error(`Server status ${res.status}`);
      }

      const data = await res.json();
      const botMsgId = 'b-' + Date.now();
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data.type === 'image') {
        updateCurrentSessionMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            role: 'assistant',
            type: 'image',
            prompt: data.prompt,
            imageUrl: data.imageUrl,
            provider: 'ChatPro Visual Engine',
            text: data.response || `Generated image for "${data.prompt}"`,
            time: botTime,
          },
        ]);
      } else if (data.type === 'fonts') {
        updateCurrentSessionMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            role: 'assistant',
            type: 'fonts',
            original: data.original,
            styles: data.styles || [],
            text: data.response || `Font variations for "${data.original}":`,
            time: botTime,
          },
        ]);
      } else {
        updateCurrentSessionMessages((prev) => [
          ...prev,
          {
            id: botMsgId,
            role: 'assistant',
            type: 'text',
            text: data.response || 'No response received.',
            time: botTime,
          },
        ]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      updateCurrentSessionMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'assistant',
          type: 'text',
          text: 'Unable to connect to assistant backend. Please ensure the backend service is running on port 3000.',
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
      handleSend();
    }
  };

  return (
    <div className={styles.workspace}>
      {/* Sidebar - Chat History & Rooms */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        {/* New Chat Button */}
        <div className={styles.sidebarTop}>
          <button
            type="button"
            className={styles.newChatBtn}
            onClick={() => handleCreateNewChat(activeRoom)}
            id="new-chat-button"
          >
            <span className={styles.plusIcon}>+</span>
            <span>New Chat</span>
          </button>
        </div>

        {/* Specialized Rooms */}
        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeading}>Rooms</div>
          <div className={styles.roomList}>
            {ROOMS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`${styles.roomBtn} ${activeRoom === r.id ? styles.activeRoomBtn : ''}`}
                onClick={() => handleRoomSelect(r.id)}
              >
                <span className={styles.roomIcon}>{r.icon}</span>
                <span className={styles.roomName}>{r.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conversation History */}
        <div className={styles.sidebarSection}>
          <div className={styles.sectionHeading}>Recent Conversations</div>
          <div className={styles.sessionList}>
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`${styles.sessionItem} ${s.id === currentSession?.id ? styles.activeSession : ''}`}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setActiveRoom(s.room || 'general');
                }}
              >
                <span className={styles.chatBubbleIcon}>💬</span>
                <span className={styles.sessionTitle} title={s.title}>
                  {s.title}
                </span>
                <button
                  type="button"
                  className={styles.deleteSessionBtn}
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  title="Delete chat"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className={styles.chatArea}>
        {/* Chat Area Header */}
        <div className={styles.chatAreaHeader}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.toggleSidebarBtn}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle sidebar"
              id="sidebar-toggle-btn"
            >
              ☰
            </button>
            <div>
              <div className={styles.headerTitle}>
                {ROOMS.find((r) => r.id === activeRoom)?.name || 'General Assistant'}
              </div>
              <div className={styles.headerSubtitle}>
                {ROOMS.find((r) => r.id === activeRoom)?.desc}
              </div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.statusIndicator}>
              <span className={styles.statusDot} />
              <span>Online</span>
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className={styles.messageStream}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
            >
              <div className={styles.msgAvatar}>
                {msg.role === 'user' ? 'U' : 'CP'}
              </div>

              <div className={styles.msgContentWrapper}>
                {/* User Image Attachment */}
                {msg.image && (
                  <div className={styles.userImageAttachment}>
                    <img
                      src={msg.image}
                      alt="Uploaded attachment"
                      className={styles.userImgThumb}
                      onClick={() => setPreviewModalImg(msg.image)}
                    />
                  </div>
                )}

                {/* Text Content */}
                {msg.type === 'text' && (
                  <div className={styles.msgText}>
                    {msg.text.split('\n').map((line, idx) => (
                      <p key={idx} className={styles.line}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}

                {/* Image Generation Payload */}
                {msg.type === 'image' && (
                  <div className={styles.imagePayload}>
                    <div className={styles.imagePrompt}>Prompt: &ldquo;{msg.prompt}&rdquo;</div>
                    <div className={styles.imageWrap}>
                      <img
                        src={msg.imageUrl}
                        alt={msg.prompt}
                        className={styles.generatedImage}
                        onClick={() => setPreviewModalImg(msg.imageUrl)}
                      />
                      <a
                        href={msg.imageUrl}
                        download={`chatpro-${Date.now()}.jpg`}
                        className={styles.imageDownloadBtn}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ⬇ Download High-Res
                      </a>
                    </div>
                  </div>
                )}

                {/* Font Styles Payload */}
                {msg.type === 'fonts' && (
                  <div className={styles.fontsPayload}>
                    <div className={styles.fontsHeader}>{msg.text}</div>
                    <div className={styles.fontsGrid}>
                      {msg.styles.map((f, i) => (
                        <div key={i} className={styles.fontCard}>
                          <div className={styles.fontLabel}>{f.name}</div>
                          <div className={styles.fontSample}>{f.styled}</div>
                          <button
                            type="button"
                            className={styles.copyFontBtn}
                            onClick={() => handleCopy(f.styled, `font-${msg.id}-${i}`)}
                          >
                            {copiedId === `font-${msg.id}-${i}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.msgMetadata}>
                  <span>{msg.time}</span>
                  {msg.type === 'text' && (
                    <button
                      type="button"
                      className={styles.copyMsgBtn}
                      onClick={() => handleCopy(msg.text, msg.id)}
                      title="Copy message"
                    >
                      {copiedId === msg.id ? '✓ Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {loading && (
            <div className={`${styles.msgRow} ${styles.msgAssistant}`}>
              <div className={styles.msgAvatar}>CP</div>
              <div className={styles.typingIndicator}>
                <div className={styles.typingDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <span>ChatPro is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className={styles.inputContainer}>
          {/* Uploaded Image Preview in Input */}
          {attachedImage && (
            <div className={styles.attachedPreview}>
              <img src={attachedImage.base64} alt="Attached" className={styles.previewThumb} />
              <div className={styles.previewInfo}>
                <span className={styles.previewName}>{attachedImage.name}</span>
                <span className={styles.previewHint}>Image attached for vision analysis</span>
              </div>
              <button
                type="button"
                className={styles.removeAttachedBtn}
                onClick={() => setAttachedImage(null)}
                title="Remove image"
              >
                ✕
              </button>
            </div>
          )}

          <div className={styles.inputBar}>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />

            {/* Image upload button */}
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Attach image for vision understanding"
              id="upload-image-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" fill="currentColor"/>
              </svg>
            </button>

            {/* Main Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              className={styles.chatInput}
              placeholder={
                activeRoom === 'creative'
                  ? 'Describe an image to create (/imagine ...) or ask creative ideas...'
                  : activeRoom === 'fonts'
                  ? 'Type /font [your text] or message to stylize...'
                  : 'Message ChatPro AI, ask questions, or attach an image...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              id="main-chat-input"
            />

            {/* Send Button */}
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={(!input.trim() && !attachedImage) || loading}
              id="main-chat-send-btn"
              title="Send message (Enter)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
              </svg>
            </button>
          </div>

          <div className={styles.inputHint}>
            ChatPro AI can analyze images, write code, and generate creative content. Shift + Enter for new line.
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {previewModalImg && (
        <div className={styles.modal} onClick={() => setPreviewModalImg(null)}>
          <div className={styles.modalInner} onClick={(e) => e.stopPropagation()}>
            <img src={previewModalImg} alt="Enlarged preview" className={styles.modalImage} />
            <button
              type="button"
              className={styles.modalCloseBtn}
              onClick={() => setPreviewModalImg(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
