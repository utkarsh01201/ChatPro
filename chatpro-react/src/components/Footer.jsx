import React from 'react';
import styles from './Footer.module.css';

const Footer = () => (
  <footer className={styles.footer}>
    <div className={styles.topLine} />
    <div className={styles.container}>
      <div className={styles.brand}>
        <div className={styles.logo}>CP</div>
        <span className={styles.brandName}>ChatPro <span className={styles.ai}>AI</span></span>
      </div>
      <p className={styles.tagline}>Think • Chat • Grow ⚡</p>
      <div className={styles.links}>
        <a href="https://t.me/chat_pro_robot"     target="_blank" rel="noreferrer" id="footer-bot">@chat_pro_robot</a>
        <span className={styles.dot}>·</span>
        <a href="https://t.me/Utkarsh12011"        target="_blank" rel="noreferrer" id="footer-creator">@Utkarsh12011</a>
        <span className={styles.dot}>·</span>
        <a href="https://t.me/shiddatXXSociety"   target="_blank" rel="noreferrer" id="footer-community">@shiddatXXSociety</a>
      </div>
      <p className={styles.copy}>© 2025 ChatPro AI. Built for what's next. 🚀</p>
    </div>
  </footer>
);

export default Footer;
