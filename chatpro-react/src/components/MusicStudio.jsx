import React, { useState, useEffect, useRef } from 'react';
import styles from './MusicStudio.module.css';
import { useMusicPlayer } from '../MusicContext';

const QUICK_CATEGORIES = [
  { id: 'trending', label: '🔥 Trending', query: 'Kesariya' },
  { id: 'bollywood', label: '✨ Bollywood', query: 'Arijit Singh' },
  { id: 'punjabi', label: '🚀 Punjabi Hits', query: 'Khaab Akhil' },
  { id: 'lofi', label: '🎧 Lo-Fi & Study', query: 'lofi study relaxing' },
  { id: 'edm', label: '⚡ EDM & Dance', query: 'electronic dance party' },
  { id: 'acoustic', label: '🎹 Piano & Chill', query: 'piano relaxation ambient' },
  { id: 'indie', label: '🎸 Indie Hits', query: 'Dil Nu' },
];

export default function MusicStudio() {
  const {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, isLoop, queue,
    tracks, setTracks,
    setVolume, setIsMuted, setIsLoop, addToQueue,
    playTrack, togglePlayPause, handleNext, handlePrev, seekTo, formatTime,
  } = useMusicPlayer();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('trending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const latestQueryRef = useRef('');
  const debounceTimerRef = useRef(null);

  // Initial load
  useEffect(() => { fetchTracks('Kesariya'); }, []);

  // Real-time search debounce
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => fetchTracks(trimmed), 300);
    return () => clearTimeout(debounceTimerRef.current);
  }, [query]);

  const fetchTracks = async (searchQuery) => {
    const q = searchQuery.trim();
    if (!q) return;
    latestQueryRef.current = q;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}&limit=16`);
      if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (latestQueryRef.current === q) {
        setTracks(data.tracks || []);
      }
    } catch (err) {
      console.error('Music search error:', err);
      if (latestQueryRef.current === q) setError(err.message || 'Failed to retrieve music.');
    } finally {
      if (latestQueryRef.current === q) setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setActiveCategory(null);
    fetchTracks(query);
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat.id);
    setQuery(cat.query);
    fetchTracks(cat.query);
  };

  const handleClear = () => {
    setQuery('');
    setActiveCategory('trending');
    fetchTracks('Kesariya');
  };

  const handleScrubberChange = (e) => seekTo(Number(e.target.value));

  const copyTgCommand = (track, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`/play ${track.title}`);
    setCopiedId(track.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={styles.studio}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.badge}>🎵 Real-Time Music Player</div>
          <h1 className={styles.title}>
            ChatPro <span className={styles.gradientText}>Music Studio</span>
          </h1>
          <p className={styles.subtitle}>
            Search any song in real time and click to listen in 320kbps full studio sound.
          </p>
        </div>

        {/* Search */}
        <div className={styles.searchSection}>
          <form onSubmit={handleSearchSubmit} className={styles.searchBarWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Type any song, artist, lyrics (e.g. tere khatir, kesariya, khaab)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              id="music-search-input"
              autoComplete="off"
            />
            {loading && (
              <span className={styles.liveIndicator}>
                <span className={styles.liveDot} />
                <span>Searching live...</span>
              </span>
            )}
            {query && (
              <button type="button" className={styles.clearBtn} onClick={handleClear} title="Clear">✕</button>
            )}
            <button type="submit" className={styles.searchBtn} id="music-search-btn">Search</button>
          </form>

          <div className={styles.pillsList}>
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.pill} ${activeCategory === cat.id ? styles.activePill : ''}`}
                onClick={() => handleCategoryClick(cat)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tracks grid */}
        <div className={styles.sectionTitleRow}>
          <div>
            <h3 className={styles.sectionTitle}>
              {query ? `Results for "${query}"` : 'Popular & Trending Music'}
            </h3>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
              Click any song below to play it in real time
            </div>
          </div>
          <span className={styles.trackCount}>{tracks.length} tracks available</span>
        </div>

        {loading && tracks.length === 0 ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Retrieving high-fidelity audio streams in real time...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}><p>⚠️ {error}</p></div>
        ) : tracks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No tracks found for "{query}". Try another song name, artist, or mood.</p>
          </div>
        ) : (
          <div className={styles.tracksGrid}>
            {tracks.map((track) => {
              const isThisPlaying = currentTrack?.id === track.id && isPlaying;
              const isThisSelected = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`${styles.trackCard} ${isThisSelected ? styles.activeTrackCard : ''}`}
                  onClick={() => playTrack(track)}
                >
                  <div className={styles.cardImageWrapper}>
                    <img
                      src={track.imageUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'}
                      alt={track.title}
                      className={styles.cardImage}
                      loading="lazy"
                    />
                    <div className={`${styles.cardPlayOverlay} ${isThisSelected ? styles.cardPlayOverlayActive : ''}`}>
                      <button
                        type="button"
                        className={styles.cardOverlayBtn}
                        onClick={(e) => { e.stopPropagation(); playTrack(track); }}
                      >
                        {isThisPlaying ? '⏸' : '▶'}
                      </button>
                    </div>
                    {isThisPlaying && (
                      <div className={styles.cardLiveBadge}>
                        <div className={styles.equalizer}>
                          <span className={styles.bar} />
                          <span className={styles.bar} />
                          <span className={styles.bar} />
                          <span className={styles.bar} />
                        </div>
                        <span>Playing</span>
                      </div>
                    )}
                    <span className={styles.cardDuration}>{formatTime(track.duration)}</span>
                  </div>
                  <div className={styles.cardTitle} title={track.title}>{track.title}</div>
                  <div className={styles.cardArtist} title={track.artist}>
                    {track.artist}{track.album ? ` • ${track.album}` : ''}
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.cardProvider}>{track.provider || 'STUDIO 320K'}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className={styles.cardActionIcon}
                        onClick={(e) => { e.stopPropagation(); addToQueue(track); }}
                        title="Add to queue"
                      >➕</button>
                      <button
                        type="button"
                        className={styles.cardActionIcon}
                        onClick={(e) => copyTgCommand(track, e)}
                        title="Copy /play command for Telegram"
                      >
                        {copiedId === track.id ? '✓' : '✈️'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-page floating player (only shown inside Music tab) */}
      {currentTrack && (
        <div className={styles.floatingPlayer}>
          <div className={styles.floatingPlayerInner}>
            <div className={styles.floatingTrackInfo}>
              <img
                src={currentTrack.imageUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100'}
                alt={currentTrack.title}
                className={styles.floatingThumb}
              />
              <div className={styles.floatingDetails}>
                <div className={styles.floatingTitle}>{currentTrack.title}</div>
                <div className={styles.floatingArtist}>{currentTrack.artist}</div>
              </div>
            </div>

            <div className={styles.floatingCenter}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '2px' }}>
                <button type="button" className={styles.controlBtn} onClick={handlePrev} title="Previous">⏮</button>
                <button
                  type="button"
                  style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}
                  className={styles.playPauseBtn}
                  onClick={togglePlayPause}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button type="button" className={styles.controlBtn} onClick={handleNext} title="Next">⏭</button>
                <button
                  type="button"
                  className={`${styles.controlBtn} ${isLoop ? styles.activeToggle : ''}`}
                  onClick={() => setIsLoop(!isLoop)}
                  title={isLoop ? 'Loop On' : 'Loop Off'}
                  style={{ fontSize: '1rem' }}
                >🔁</button>
              </div>
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || currentTrack.duration || 100}
                  value={currentTime}
                  onChange={handleScrubberChange}
                  className={styles.scrubber}
                />
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                  {formatTime(duration || currentTrack.duration)}
                </span>
              </div>
            </div>

            <div className={styles.extraControls}>
              <div className={styles.volumeContainer}>
                <button type="button" className={styles.controlBtn} onClick={() => setIsMuted(!isMuted)}>
                  {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
                  className={styles.volumeSlider}
                />
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={(e) => copyTgCommand(currentTrack, e)}
              >
                {copiedId === currentTrack.id ? '✓ Copied' : '✈️ Telegram'}
              </button>
              {currentTrack.audioUrl && (
                <a
                  href={currentTrack.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`${currentTrack.title}.m4a`}
                  className={styles.actionBtn}
                >⬇️</a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
