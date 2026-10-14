import React from 'react';
import styles from './HeaderNav.module.css';

export default function HeaderNav({
  topTab, subTab, topTabs, subTabs,
  theme, onToggleTheme,
  onSelectTopTab, onSelectSubTab,
}) {
  return (
    <header className={styles.headerWrap}>
      {/* ── Top Bar ── */}
      <div className={styles.topBar}>
        {/* Brand with logo image */}
        <div
          className={styles.brand}
          onClick={() => { onSelectTopTab('chatpro'); onSelectSubTab('chat'); }}
        >
          <img src="/logo.png" alt="ChatPro AI" className={styles.logoImg} />
          <span className={styles.brandName}>ChatPro</span>
        </div>

        {/* Two primary tabs */}
        <nav className={styles.primaryTabs}>
          {topTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.primaryTab} ${topTab === tab.id ? styles.activePrimaryTab : ''}`}
              onClick={() => onSelectTopTab(tab.id)}
              id={`top-tab-${tab.id}`}
            >
              {tab.icon && <span className={styles.tabEmoji}>{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Right: theme toggle + status */}
        <div className={styles.headerRight}>
          <button
            className={styles.themeBtn}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className={styles.statusPill}>
            <span className={styles.statusDot} />
            <span>Live</span>
          </div>
        </div>
      </div>

      {/* ── Sub Nav (only when ChatPro AI is active) ── */}
      {topTab === 'chatpro' && (
        <div className={styles.subBar}>
          <nav className={styles.subTabs}>
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`${styles.subTab} ${subTab === tab.id ? styles.activeSubTab : ''}`}
                onClick={() => onSelectSubTab(tab.id)}
                id={`sub-tab-${tab.id}`}
              >
                <span className={styles.subIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
