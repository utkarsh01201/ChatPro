import React from 'react';
import styles from './TechStack.module.css';

const CHAIN = [
  {
    icon: '🟢',
    label: 'Google Gemini',
    sub: 'gemini-3.8-flash → gemini-3.5-flash-lite',
    badge: 'Primary',
    badgeColor: 'green',
  },
  {
    icon: '⚡',
    label: 'Groq LLaMA',
    sub: 'Ultra-fast inference fallback',
    badge: 'Fast Fallback',
    badgeColor: 'orange',
  },
  {
    icon: '🔵',
    label: 'OpenRouter → GPT-4o',
    sub: 'Retry with exponential backoff',
    badge: 'Secondary',
    badgeColor: 'blue',
  },
  {
    icon: '✅',
    label: 'Friendly Error',
    sub: 'Helpful message — never a cold crash',
    badge: 'Graceful',
    badgeColor: 'purple',
  },
];

const TECH_PILLS = [
  { label: 'Node.js', icon: '⚙️' },
  { label: 'grammY', icon: '🤖' },
  { label: 'Google Gemini', icon: '🌟' },
  { label: 'GPT-4o', icon: '💡' },
  { label: 'Groq LLaMA', icon: '⚡' },
  { label: 'Cloudflare FLUX', icon: '☁️' },
  { label: 'MongoDB Atlas', icon: '🗄️' },
  { label: 'HuggingFace SD3', icon: '🎨' },
  { label: 'Sharp', icon: '✂️' },
  { label: 'Render', icon: '🚀' },
];

const TechStack = () => (
  <section className={styles.section} id="tech">
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.sectionTag}>Architecture</span>
        <h2 className={styles.sectionTitle}>
          Never fails.{' '}
          <span className={styles.gradient}>Always responds.</span>
        </h2>
        <p className={styles.sectionDesc}>
          Multi-model fallback chain ensures you always get an answer — even under heavy load.
        </p>
      </div>

      {/* Fallback Chain */}
      <div className={styles.chain}>
        {CHAIN.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className={`${styles.step} ${styles[`badge_${step.badgeColor}`]}`} id={`chain-${i}`}>
              <span className={styles.stepIcon}>{step.icon}</span>
              <div className={styles.stepInfo}>
                <h4 className={styles.stepLabel}>{step.label}</h4>
                <p className={styles.stepSub}>{step.sub}</p>
              </div>
              <span className={`${styles.badge} ${styles[`badgeColor_${step.badgeColor}`]}`}>
                {step.badge}
              </span>
            </div>
            {i < CHAIN.length - 1 && (
              <div className={styles.arrow}>
                <div className={styles.arrowLine} />
                <span>↓ if exhausted</span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Tech pills */}
      <div className={styles.pillsWrap}>
        <p className={styles.pillsTitle}>Built with</p>
        <div className={styles.pills}>
          {TECH_PILLS.map(p => (
            <div key={p.label} className={styles.pill}>
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default TechStack;
