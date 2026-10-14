import React, { useState, useEffect } from 'react';
import styles from './Navbar.module.css';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { href: '#chat', label: '💬 Live Chat' },
    { href: '#features', label: 'Features' },
    { href: '#commands', label: 'Commands' },
    { href: '#fonts', label: 'Font Lab' },
    { href: '#tech', label: 'Tech Stack' },
    { href: '#about', label: 'About' },
  ];

  const handleNavClick = (e, href) => {
    e.preventDefault();
    setMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    if (href === '#chat') {
      setTimeout(() => document.getElementById('web-chat-input')?.focus(), 400);
    }
  };

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`} id="navbar">
      <div className={styles.container}>
        <a href="#" className={styles.logo} onClick={e => handleNavClick(e, '#home')}>
          <div className={styles.logoIcon}>
            <span>CP</span>
          </div>
          <span className={styles.logoText}>ChatPro <span className={styles.ai}>AI</span></span>
        </a>

        <ul className={styles.links}>
          {navLinks.map(l => (
            <li key={l.href}>
              <a href={l.href} className={styles.link} onClick={e => handleNavClick(e, l.href)}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a href="#chat" className={styles.cta} id="nav-cta" onClick={e => handleNavClick(e, '#chat')}>
          <span>Chat Online</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </a>

        <button
          className={`${styles.hamburger} ${menuOpen ? styles.open : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          id="hamburger"
        >
          <span /><span /><span />
        </button>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} className={styles.mobileLink} onClick={e => handleNavClick(e, l.href)}>
              {l.label}
            </a>
          ))}
          <a href="https://t.me/chat_pro_robot" target="_blank" rel="noreferrer" className={styles.mobileCta}>
            Open in Telegram ↗
          </a>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
