import React, { useRef, useEffect } from 'react';
import styles from './Features.module.css';

const FEATURES = [
  {
    id: 'feature-chat',
    icon: '💬',
    title: 'Emotionally Intelligent Chat',
    desc: 'Natural, mood-aware conversations powered by Google Gemini with GPT-4o fallback. The bot syncs with your emotions.',
    tag: 'Gemini + GPT-4o',
    large: true,
    color: 'purple',
  },
  {
    id: 'feature-vision',
    icon: '🖼️',
    title: 'Vision & Image Understanding',
    desc: 'Send any photo or sticker and ask questions. ChatPro sees and understands images with multimodal AI.',
    tag: 'Multimodal AI',
    color: 'cyan',
  },
  {
    id: 'feature-memory',
    icon: '🧠',
    title: 'Long-Term Memory',
    desc: 'Remembers your name, preferences, and past conversations across sessions — every chat picks up where you left off.',
    tag: 'MongoDB Backed',
    color: 'pink',
  },
  {
    id: 'feature-image-gen',
    icon: '🎨',
    title: 'AI Image Generation',
    desc: 'Just say "make an image of..." and ChatPro generates stunning art via Cloudflare FLUX, HuggingFace SD3, or Pollinations.',
    tag: 'FLUX • SD3 • Pollinations',
    color: 'orange',
  },
  {
    id: 'feature-editor',
    icon: '✏️',
    title: 'AI Image Editing',
    desc: 'Reply to any photo with an editing instruction — add people, change backgrounds, remove objects. Powered by Gemini.',
    tag: 'AI-Powered Editing',
    color: 'green',
  },
  {
    id: 'feature-search',
    icon: '🌐',
    title: 'Real-Time Web Search',
    desc: 'Ask about live events, latest news, stock prices, or anything current — ChatPro searches the web for fresh answers.',
    tag: 'Google Search Grounding',
    large: true,
    color: 'blue',
  },
  {
    id: 'feature-fonts',
    icon: '🔤',
    title: 'Font Styles',
    desc: 'Transform any text into 9+ Unicode styles — Serif, Cursive, Gothic, Monospace, Bubble, Double-Struck and more.',
    tag: '9+ Styles',
    color: 'purple',
  },
  {
    id: 'feature-library',
    icon: '📚',
    title: 'Image Library',
    desc: 'All AI-generated images auto-saved in a paginated gallery inside Telegram. Browse anytime.',
    tag: 'Paginated Gallery',
    color: 'cyan',
  },
];

const FeatureCard = ({ feature }) => {
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
    card.style.transform = `perspective(600px) rotateY(${x}deg) rotateX(${-y}deg) translateZ(10px)`;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (card) card.style.transform = 'perspective(600px) rotateY(0) rotateX(0) translateZ(0)';
  };

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${feature.large ? styles.cardLarge : ''} ${styles[`color_${feature.color}`]}`}
      id={feature.id}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.cardGlow} />
      <div className={styles.iconWrap}>
        <span className={styles.icon}>{feature.icon}</span>
      </div>
      <h3 className={styles.cardTitle}>{feature.title}</h3>
      <p className={styles.cardDesc}>{feature.desc}</p>
      <span className={styles.tag}>{feature.tag}</span>
    </div>
  );
};

const Features = () => {
  return (
    <section className={styles.section} id="features">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.sectionTag}>What I Can Do</span>
          <h2 className={styles.sectionTitle}>
            Everything you need,{' '}
            <span className={styles.gradient}>one bot</span>
          </h2>
          <p className={styles.sectionDesc}>
            From deep conversations to creative tools — ChatPro AI has it all inside Telegram.
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.map(f => <FeatureCard key={f.id} feature={f} />)}
        </div>
      </div>
    </section>
  );
};

export default Features;
