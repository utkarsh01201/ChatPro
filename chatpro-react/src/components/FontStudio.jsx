import React, { useState } from 'react';
import styles from './FontStudio.module.css';

const FONTS_PRESETS = [
  { id: 'serif', name: 'Serif Classic', transform: t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D44E + (c.charCodeAt(0) - 97) : 0x1D434 + (c.charCodeAt(0) - 65))) },
  { id: 'serifBold', name: 'Serif Bold', transform: t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D41A + (c.charCodeAt(0) - 97) : 0x1D400 + (c.charCodeAt(0) - 65))) },
  { id: 'script', name: 'Cursive / Script', transform: t => t.replace(/[A-Za-z]/g, c => ({ e: 'ℯ', g: 'ℊ', o: 'ℴ', B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ' }[c] || String.fromCodePoint(c >= 'a' ? 0x1D4B6 + (c.charCodeAt(0) - 97) : 0x1D49C + (c.charCodeAt(0) - 65)))) },
  { id: 'boldScript', name: 'Bold Script', transform: t => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c >= 'a' ? 0x1D4EA + (c.charCodeAt(0) - 97) : 0x1D4D0 + (c.charCodeAt(0) - 65))) },
  { id: 'gothic', name: 'Gothic Fraktur', transform: t => t.replace(/[A-Za-z]/g, c => ({ C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }[c] || String.fromCodePoint(c >= 'a' ? 0x1D51E + (c.charCodeAt(0) - 97) : 0x1D504 + (c.charCodeAt(0) - 65)))) },
  { id: 'monospace', name: 'Monospace Typewriter', transform: t => t.replace(/[A-Za-z0-9]/g, c => c >= '0' && c <= '9' ? String.fromCodePoint(0x1D7F6 + (c.charCodeAt(0) - 48)) : String.fromCodePoint(c >= 'a' ? 0x1D68A + (c.charCodeAt(0) - 97) : 0x1D670 + (c.charCodeAt(0) - 65))) },
  { id: 'doubleStruck', name: 'Double-Struck Outline', transform: t => t.replace(/[A-Za-z0-9]/g, c => ({ C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }[c] || (c >= '0' && c <= '9' ? String.fromCodePoint(0x1D7D8 + (c.charCodeAt(0) - 48)) : String.fromCodePoint(c >= 'a' ? 0x1D552 + (c.charCodeAt(0) - 97) : 0x1D538 + (c.charCodeAt(0) - 65))))) },
  { id: 'sansBold', name: 'Sans-Serif Bold', transform: t => t.replace(/[A-Za-z0-9]/g, c => c >= '0' && c <= '9' ? String.fromCodePoint(0x1D7EC + (c.charCodeAt(0) - 48)) : String.fromCodePoint(c >= 'a' ? 0x1D5EE + (c.charCodeAt(0) - 97) : 0x1D5D4 + (c.charCodeAt(0) - 65))) },
];

export default function FontStudio() {
  const [text, setText] = useState('ChatPro AI Aesthetic');
  const [copiedId, setCopiedId] = useState(null);

  const copy = (val, id) => {
    navigator.clipboard.writeText(val);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={styles.studio}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.badge}>🔤 Typography &amp; Text Studio</div>
          <h1 className={styles.title}>Unicode Font Generator</h1>
          <p className={styles.subtitle}>
            Instantly format plain text into elegant Unicode mathematical styles for social bios, messages, and titles.
          </p>
        </div>

        <div className={styles.inputCard}>
          <input
            type="text"
            className={styles.input}
            placeholder="Type your message here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className={styles.grid}>
          {FONTS_PRESETS.map((f) => {
            const transformed = text ? f.transform(text) : f.name;
            return (
              <div key={f.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.fontName}>{f.name}</span>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copy(transformed, f.id)}
                  >
                    {copiedId === f.id ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className={styles.cardPreview}>{transformed}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
