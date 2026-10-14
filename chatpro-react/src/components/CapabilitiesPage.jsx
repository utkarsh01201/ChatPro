import React, { useState } from 'react';
import styles from './CapabilitiesPage.module.css';

const CAPABILITIES = [
  {
    icon: '💬',
    title: 'Natural Dialogue & Reasoning',
    desc: 'Engage in natural, multi-turn discussions with context retention, emotional intelligence, and clear step-by-step explanations.',
  },
  {
    icon: '🖼️',
    title: 'Multimodal Vision Understanding',
    desc: 'Upload any image to analyze objects, decipher handwritten notes, extract text, or get detailed creative critiques.',
  },
  {
    icon: '🎨',
    title: 'Generative AI Art',
    desc: 'Synthesize high-fidelity concept art, photography, logos, and wallpapers directly from descriptive text prompts.',
  },
  {
    icon: '💻',
    title: 'Code Engineering & Debugging',
    desc: 'Generate, refactor, and troubleshoot code across Python, JavaScript, TypeScript, Go, C++, SQL, and more.',
  },
  {
    icon: '🔤',
    title: 'Unicode Typography Engine',
    desc: 'Transform plain text into over 9 distinct Unicode font styles instantly for social handles, design, and documents.',
  },
  {
    icon: '🎵',
    title: 'AI Music Streaming & Live VC Assistant',
    desc: 'Stream full-length tracks in DMs or invite the live voice assistant to sing and play crystal-clear music directly inside group Voice Chats.',
  },
  {
    icon: '⚡',
    title: 'Multi-Room Workspaces',
    desc: 'Switch between dedicated environments tailored for General Chat, Creative Studio, Code Engineering, and Typography.',
  },
];

const COMMANDS = [
  { cmd: '/start', desc: 'Initialize ChatPro AI and display interactive welcome menu' },
  { cmd: '/help', desc: 'Display full command list and usage guidelines' },
  { cmd: '/play [song]', desc: 'Stream songs, artists, or moods in group Voice Chat or private DMs' },
  { cmd: '/vplay [song]', desc: 'Direct live singing & streaming inside Telegram Voice Chat' },
  { cmd: '/pause /resume /skip', desc: 'Interactive live playback and queue controls' },
  { cmd: '/newchat', desc: 'Reset conversation context and start fresh' },
  { cmd: '/clear', desc: 'Clear current conversation history' },
  { cmd: '/imagine [prompt]', desc: 'Generate a high-resolution visual artwork' },
  { cmd: '/font [text]', desc: 'Transform text into 9+ stylized Unicode variations' },
];

export default function CapabilitiesPage() {
  const [copiedCmd, setCopiedCmd] = useState(null);

  const copy = (cmd) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.badge}>⚡ System Capabilities</div>
          <h1 className={styles.title}>What ChatPro AI Can Do</h1>
          <p className={styles.subtitle}>
            A versatile, intelligent AI workspace built to support your daily workflow, creativity, and development.
          </p>
        </div>

        {/* Feature Grid */}
        <div className={styles.grid}>
          {CAPABILITIES.map((c, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.icon}>{c.icon}</div>
              <h3 className={styles.cardTitle}>{c.title}</h3>
              <p className={styles.cardDesc}>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Commands Reference */}
        <div className={styles.commandSection}>
          <h2 className={styles.sectionTitle}>Command Reference</h2>
          <div className={styles.commandList}>
            {COMMANDS.map((c, i) => (
              <div key={i} className={styles.commandRow} onClick={() => copy(c.cmd)}>
                <div className={styles.commandCode}>
                  <code>{c.cmd}</code>
                </div>
                <div className={styles.commandDesc}>{c.desc}</div>
                <button type="button" className={styles.copyBtn}>
                  {copiedCmd === c.cmd ? '✓' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
