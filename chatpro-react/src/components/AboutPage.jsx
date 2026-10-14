import React from 'react';
import styles from './AboutPage.module.css';

export default function AboutPage({ onNavigateToChat }) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarCore}>CP</div>
          </div>

          <h1 className={styles.title}>ChatPro AI</h1>
          <p className={styles.tagline}>Think • Create • Grow</p>

          <p className={styles.description}>
            ChatPro AI is an authentic, intelligent assistant designed for real-time conversation, image generation, vision understanding, and creative workflows. Created by{' '}
            <a href="https://t.me/Utkarsh12011" target="_blank" rel="noreferrer" className={styles.link}>
              @Utkarsh12011
            </a>
            , it brings together natural dialogue and specialized creative rooms in a single unified interface.
          </p>

          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statValue}>Multimodal</span>
              <span className={styles.statLabel}>Vision &amp; Image Uploads</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>4+ Rooms</span>
              <span className={styles.statLabel}>Specialized Workspaces</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>9+ Styles</span>
              <span className={styles.statLabel}>Unicode Typography</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>Instant</span>
              <span className={styles.statLabel}>Local Chat History</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onNavigateToChat}
            >
              Open AI Workspace
            </button>
            <a
              href="https://t.me/shiddatXXSociety"
              target="_blank"
              rel="noreferrer"
              className={styles.secondaryBtn}
            >
              Join Community
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
