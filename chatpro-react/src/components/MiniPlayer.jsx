import React, { useState } from 'react';
import { useMusicPlayer } from '../MusicContext';
import styles from './MiniPlayer.module.css';

export default function MiniPlayer({ onGoToMusic }) {
  const {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, isLoop,
    setVolume, setIsMuted, setIsLoop,
    togglePlayPause, handleNext, handlePrev, seekTo, formatTime,
  } = useMusicPlayer();

  const [expanded, setExpanded] = useState(false);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`${styles.wrap} ${expanded ? styles.expanded : ''}`}>
      {/* Progress bar at very top */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.inner}>
        {/* ── Thumbnail + Track Info ── */}
        <div className={styles.trackInfo} onClick={() => setExpanded(!expanded)}>
          <div className={styles.thumbWrap}>
            <img
              src={currentTrack.imageUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80'}
              alt={currentTrack.title}
              className={styles.thumb}
            />
            {isPlaying && (
              <div className={styles.eqOverlay}>
                <span className={styles.bar} />
                <span className={styles.bar} />
                <span className={styles.bar} />
              </div>
            )}
          </div>
          <div className={styles.meta}>
            <div className={styles.title}>{currentTrack.title}</div>
            <div className={styles.artist}>{currentTrack.artist}</div>
          </div>
          <button
            className={styles.chevron}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▴'}
          </button>
        </div>

        {/* ── Compact Controls (always visible) ── */}
        <div className={styles.controls}>
          <button className={styles.ctrlBtn} onClick={handlePrev} title="Previous">⏮</button>
          <button className={styles.playBtn} onClick={togglePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className={styles.ctrlBtn} onClick={handleNext} title="Next">⏭</button>
        </div>

        {/* ── Right: Volume + Go to Music tab ── */}
        <div className={styles.right}>
          <button
            className={styles.ctrlBtn}
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
            className={styles.volSlider}
            title="Volume"
          />
          {onGoToMusic && (
            <button className={styles.goMusicBtn} onClick={onGoToMusic} title="Open Music Studio">
              🎵 Open
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded panel: full scrubber + extra controls ── */}
      {expanded && (
        <div className={styles.expandedPanel}>
          <div className={styles.scrubRow}>
            <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || currentTrack.duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className={styles.scrubber}
            />
            <span className={styles.timeLabel}>{formatTime(duration || currentTrack.duration)}</span>
          </div>
          <div className={styles.expandedExtra}>
            <button
              className={`${styles.ctrlBtn} ${isLoop ? styles.activeCtrl : ''}`}
              onClick={() => setIsLoop(!isLoop)}
              title={isLoop ? 'Loop On' : 'Loop Off'}
            >
              🔁 {isLoop ? 'Loop On' : 'Loop'}
            </button>
            <div className={styles.nowPlayingTag}>
              <span className={styles.nowDot} />
              Now Playing
            </div>
            {onGoToMusic && (
              <button className={styles.goFullBtn} onClick={onGoToMusic}>
                Full Player ↗
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
