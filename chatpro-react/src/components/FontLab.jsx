import React, { useState } from 'react';
import styles from './FontLab.module.css';

const toSerif      = t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D44E + (c.charCodeAt(0) - 97) : 0x1D434 + (c.charCodeAt(0) - 65)));
const toSerifBold  = t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D41A + (c.charCodeAt(0) - 97) : 0x1D400 + (c.charCodeAt(0) - 65)));
const toCursive    = t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D4B6 + (c.charCodeAt(0) - 97) : 0x1D49C + (c.charCodeAt(0) - 65)));
const toGothic     = t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D51E + (c.charCodeAt(0) - 97) : 0x1D504 + (c.charCodeAt(0) - 65)));
const toMono       = t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D670 + (c.charCodeAt(0) - 97) : 0x1D656 + (c.charCodeAt(0) - 65)));
const toDouble     = t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D552 + (c.charCodeAt(0) - 97) : 0x1D538 + (c.charCodeAt(0) - 65)));

const BUBBLE_MAP = 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ';
const BUBBLE_MAP_U = 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ';
const toBubble = t => t.replace(/[a-zA-Z]/g, c => c >= 'a' ? BUBBLE_MAP[c.charCodeAt(0)-97] : BUBBLE_MAP_U[c.charCodeAt(0)-65]);

const SC_MAP = {a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'};
const toSmallCaps = t => t.toLowerCase().split('').map(c => SC_MAP[c] || c).join('');

const STYLES = [
  { label: 'Serif (Times)',      fn: toSerif,      emoji: '𝑆' },
  { label: 'Serif Bold',         fn: toSerifBold,  emoji: '𝐒' },
  { label: 'Cursive / Script',   fn: toCursive,    emoji: '𝒮' },
  { label: 'Gothic / Fraktur',   fn: toGothic,     emoji: '𝔖' },
  { label: 'Monospace',          fn: toMono,       emoji: '𝚂' },
  { label: 'Double-Struck',      fn: toDouble,     emoji: '𝕊' },
  { label: 'Circled / Bubble',   fn: toBubble,     emoji: 'Ⓢ' },
  { label: 'Small Caps',         fn: toSmallCaps,  emoji: 'ꜱ' },
];

const FontLab = () => {
  const [input, setInput] = useState('Utkarsh');
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <section className={styles.section} id="fonts">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.sectionTag}>Font Generator</span>
          <h2 className={styles.sectionTitle}>
            Type it once,{' '}
            <span className={styles.gradient}>style it forever</span>
          </h2>
          <p className={styles.sectionDesc}>
            Live preview — type your name below and see all 8 Unicode styles instantly.
          </p>
        </div>

        <div className={styles.inputWrap}>
          <span className={styles.inputIcon}>🔤</span>
          <input
            type="text"
            className={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your name or any text..."
            maxLength={24}
            id="font-input"
          />
          {input && (
            <button className={styles.clearBtn} onClick={() => setInput('')} aria-label="Clear">
              ×
            </button>
          )}
        </div>

        <div className={styles.results}>
          {STYLES.map((s, i) => {
            const out = input ? s.fn(input) : s.fn('Utkarsh');
            const isCopied = copied === i;
            return (
              <div key={s.label} className={styles.row}>
                <div className={styles.rowLeft}>
                  <span className={styles.styleEmoji}>{s.emoji}</span>
                  <span className={styles.styleLabel}>{s.label}</span>
                </div>
                <span className={styles.styleText}>{out}</span>
                <button
                  className={`${styles.copyBtn} ${isCopied ? styles.copied : ''}`}
                  onClick={() => handleCopy(out, i)}
                  title="Copy"
                  id={`copy-style-${i}`}
                >
                  {isCopied ? '✓ Copied' : '⎘ Copy'}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.tip}>
          💡 Use <code>/font [text]</code> in Telegram to get all styles instantly
        </div>
      </div>
    </section>
  );
};

export default FontLab;
