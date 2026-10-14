import React, { useState } from 'react';
import styles from './Commands.module.css';

const COMMANDS = [
  { cmd: '/start', desc: 'Launch ChatPro AI with the interactive menu and intro video', icon: '🚀', color: 'purple' },
  { cmd: '/help',  desc: 'View the full feature guide and available commands', icon: '❓', color: 'blue' },
  { cmd: '/play [song]', desc: 'Play songs, artists, or moods in group Voice Chat (VC) or DMs', icon: '🎵', color: 'cyan' },
  { cmd: '/vplay [song]', desc: 'Live Voice Chat singing and assistant playback in group VC', icon: '🎙️', color: 'purple' },
  { cmd: '/pause /resume /skip', desc: 'Control live playback, queues, and skip tracks', icon: '⏯️', color: 'blue' },
  { cmd: '/imagine [prompt]', desc: 'Generate AI images — e.g. /imagine a cyberpunk city at night', icon: '🎨', color: 'pink' },
  { cmd: '/font [text]', desc: 'Stylize text in 9+ Unicode fonts — e.g. /font Hello World', icon: '🔤', color: 'orange' },
  { cmd: '/text [name]', desc: 'Overlay your name on any photo — reply to a photo with /text Name', icon: '✏️', color: 'cyan' },
  { cmd: '/newchat', desc: 'Start a fresh conversation, clear all context and history', icon: '🔄', color: 'green' },
  { cmd: '/about',  desc: 'Learn more about ChatPro AI and its creator', icon: 'ℹ️', color: 'purple' },
];

const CommandCard = ({ cmd, desc, icon, color }) => {
  const [copied, setCopied] = useState(false);
  const base = cmd.split(' ')[0];
  const handleCopy = () => {
    navigator.clipboard.writeText(base).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className={`${styles.card} ${styles[`color_${color}`]}`}>
      <div className={styles.cardLeft}>
        <span className={styles.cardIcon}>{icon}</span>
        <div>
          <div className={styles.cmd}><code>{cmd}</code></div>
          <p className={styles.desc}>{desc}</p>
        </div>
      </div>
      <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={handleCopy} title="Copy command">
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  );
};

const Commands = () => (
  <section className={styles.section} id="commands">
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.sectionTag}>Quick Commands</span>
        <h2 className={styles.sectionTitle}>
          Simple commands, <span className={styles.gradient}>powerful results</span>
        </h2>
        <p className={styles.sectionDesc}>Click any command to copy it — then paste it in Telegram.</p>
      </div>

      <div className={styles.list}>
        {COMMANDS.map(c => <CommandCard key={c.cmd} {...c} />)}
      </div>
    </div>
  </section>
);

export default Commands;
