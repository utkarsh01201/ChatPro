import React, { useEffect, useRef } from 'react';
import styles from './Hero.module.css';

const TelegramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.469c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.873.752z" fill="#fff"/>
  </svg>
);

const BUBBLES = [
  { icon: '🎨', text: 'Generate a cyberpunk city at night', delay: '0s' },
  { icon: '💬', text: 'Explain quantum computing simply', delay: '1.5s' },
  { icon: '🔤', text: '/font Utkarsh → 𝒰𝓉𝓀𝒶𝓇𝓈𝒽', delay: '3s' },
  { icon: '🖼️', text: 'Add my name to this photo', delay: '4.5s' },
];

const STATS = [
  { num: '9+', label: 'Font Styles' },
  { num: 'AI', label: 'Image Gen' },
  { num: '∞', label: 'Memory' },
  { num: 'Free', label: 'Forever' },
];

const Hero = () => {
  const orb1Ref = useRef(null);
  const orb2Ref = useRef(null);

  useEffect(() => {
    const move = (e) => {
      const { clientX: x, clientY: y } = e;
      const W = window.innerWidth, H = window.innerHeight;
      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate(${(x / W - 0.5) * 40}px, ${(y / H - 0.5) * 40}px)`;
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate(${(x / W - 0.5) * -30}px, ${(y / H - 0.5) * -30}px)`;
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <section className={styles.hero} id="home">
      {/* Background orbs */}
      <div className={styles.orb1} ref={orb1Ref} />
      <div className={styles.orb2} ref={orb2Ref} />
      <div className={styles.orb3} />

      <div className={styles.content}>
        {/* Badge */}
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          <span>Live Online AI Web Chat</span>
        </div>

        {/* Headline */}
        <h1 className={styles.title}>
          Think.{' '}
          <span className={styles.gradientText}>Chat.</span>{' '}
          Grow.
        </h1>

        <p className={styles.subtitle}>
          Your emotionally intelligent AI companion — powered by{' '}
          <strong>Gemini</strong> &amp; <strong>Multi-Model AI</strong> — with memory,
          image generation, vision, and font magic. Chat right here on this website!
        </p>

        {/* CTAs */}
        <div className={styles.actions}>
          <a
            href="#chat"
            className={styles.btnPrimary}
            id="hero-cta-primary"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' });
              setTimeout(() => {
                document.getElementById('web-chat-input')?.focus();
              }, 400);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor"/>
            </svg>
            Start Chatting Online Now
          </a>
          <a href="#features" className={styles.btnGhost} id="hero-cta-secondary">
            Explore Features
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          {STATS.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <div className={styles.statDivider} />}
              <div className={styles.stat}>
                <span className={styles.statNum}>{s.num}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Visual */}
      <div className={styles.visual}>
        <div className={styles.logoRing}>
          <div className={styles.ring1} />
          <div className={styles.ring2} />
          <div className={styles.ring3} />
          <div className={styles.logoCore}>
            <span>CP</span>
          </div>
        </div>

        {/* Floating chat bubbles */}
        {BUBBLES.map((b, i) => (
          <div key={i} className={`${styles.bubble} ${styles[`bubble${i + 1}`]}`} style={{ animationDelay: b.delay }}>
            <span className={styles.bubbleIcon}>{b.icon}</span>
            <span>{b.text}</span>
          </div>
        ))}
      </div>

      {/* Scroll hint */}
      <div className={styles.scrollHint}>
        <span>Scroll to explore</span>
        <div className={styles.scrollArrow}>
          <div className={styles.scrollDot} />
        </div>
      </div>
    </section>
  );
};

export default Hero;
