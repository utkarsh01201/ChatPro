import React from 'react';
import styles from './About.module.css';

const About = () => (
  <section className={styles.section} id="about">
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.glow} />

        <div className={styles.logoWrap}>
          <div className={styles.logo}>CP</div>
          <div className={styles.logoRing} />
        </div>

        <h2 className={styles.title}>
          Meet <span className={styles.gradient}>ChatPro AI</span>
        </h2>
        <p className={styles.tagline}>Think • Chat • Grow ⚡</p>
        <p className={styles.desc}>
          Built with love by{' '}
          <a href="https://t.me/Utkarsh12011" target="_blank" rel="noreferrer" className={styles.creatorLink}>
            @Utkarsh12011
          </a>
          . ChatPro AI is a fully-featured, emotionally intelligent Telegram bot — designed to understand you,
          help you create, and grow with you every single day. With multimodal vision, web search, image
          generation &amp; editing, font magic, and persistent memory — it's your AI companion, always on.
        </p>

        <div className={styles.actions}>
          <a
            href="#chat"
            className={styles.btnPrimary}
            id="about-cta"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' });
              setTimeout(() => {
                document.getElementById('web-chat-input')?.focus();
              }, 400);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
            </svg>
            Chat Online Now
          </a>
          <a href="https://t.me/shiddatXXSociety" target="_blank" rel="noreferrer" className={styles.btnOutline} id="community-cta">
            🌟 Join Community
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default About;
