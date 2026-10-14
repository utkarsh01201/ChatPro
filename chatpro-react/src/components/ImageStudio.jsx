import React, { useState } from 'react';
import styles from './ImageStudio.module.css';

const SAMPLE_PROMPTS = [
  'Futuristic architectural villa overlooking misty mountain peaks at golden hour, hyper-detailed',
  'Cyberpunk samurai standing in neon rain alley, Tokyo night aesthetic, cinematic lighting',
  'Minimalist 3D isometric workspace with holographic computer screens, soft pastel tones',
  'Ethereal mythical crystal dragon soaring above celestial clouds, digital concept art',
  'Macro photograph of bioluminescent iridescent jellyfish in deep ocean, 8k resolution',
];

export default function ImageStudio() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [gallery, setGallery] = useState(() => {
    try {
      const saved = localStorage.getItem('chatpro_art_gallery');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [error, setError] = useState(null);

  const handleGenerate = async (targetPrompt) => {
    const p = (targetPrompt || prompt).trim();
    if (!p || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/imagine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      });

      if (!res.ok) {
        throw new Error(`Generation error: ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newItem = {
        id: 'img-' + Date.now(),
        prompt: p,
        url: data.imageUrl,
        date: new Date().toLocaleDateString(),
      };

      setCurrentImage(newItem);
      const updatedGallery = [newItem, ...gallery.slice(0, 19)];
      setGallery(updatedGallery);
      try {
        localStorage.setItem('chatpro_art_gallery', JSON.stringify(updatedGallery));
      } catch (e) {}
    } catch (err) {
      console.error(err);
      setError('Image generation failed. Please try a different prompt or wait a few seconds.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.studio}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.badge}>🎨 Creative Visual Studio</div>
          <h1 className={styles.title}>AI Image Generation</h1>
          <p className={styles.subtitle}>
            Turn text concepts into striking visuals. Enter a detailed prompt or pick from creative inspirations below.
          </p>
        </div>

        {/* Prompt Input Box */}
        <div className={styles.promptCard}>
          <textarea
            className={styles.promptInput}
            rows={3}
            placeholder="Describe what you want to visualize in vivid detail..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
          />

          <div className={styles.promptActions}>
            <div className={styles.inspirations}>
              <span className={styles.inspireLabel}>Inspirations:</span>
              <div className={styles.inspireList}>
                {SAMPLE_PROMPTS.map((sp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={styles.inspireChip}
                    onClick={() => {
                      setPrompt(sp);
                      handleGenerate(sp);
                    }}
                    disabled={loading}
                  >
                    {sp.slice(0, 32)}...
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className={styles.generateBtn}
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <span>Generate Art</span>
                  <span>✨</span>
                </>
              )}
            </button>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}
        </div>

        {/* Current Result Showcase */}
        {currentImage && (
          <div className={styles.showcaseCard}>
            <div className={styles.showcaseImageWrap}>
              <img src={currentImage.url} alt={currentImage.prompt} className={styles.showcaseImg} />
            </div>
            <div className={styles.showcaseMeta}>
              <div className={styles.metaPrompt}>&ldquo;{currentImage.prompt}&rdquo;</div>
              <div className={styles.metaActions}>
                <a
                  href={currentImage.url}
                  download={`chatpro-${Date.now()}.jpg`}
                  className={styles.downloadBtn}
                  target="_blank"
                  rel="noreferrer"
                >
                  ⬇ Download High-Resolution
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Recent Gallery */}
        {gallery.length > 0 && (
          <div className={styles.gallerySection}>
            <h2 className={styles.galleryTitle}>Recent Studio Creations</h2>
            <div className={styles.galleryGrid}>
              {gallery.map((item) => (
                <div key={item.id} className={styles.galleryCard} onClick={() => setCurrentImage(item)}>
                  <img src={item.url} alt={item.prompt} className={styles.galleryImg} />
                  <div className={styles.galleryOverlay}>
                    <p className={styles.galleryPrompt}>{item.prompt}</p>
                    <a
                      href={item.url}
                      download={`chatpro-${item.id}.jpg`}
                      className={styles.galleryDownload}
                      onClick={(e) => e.stopPropagation()}
                    >
                      ⬇
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
