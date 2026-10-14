// MusicContext.jsx — Global music player state shared across all tabs
// The audio element lives here so it never unmounts when switching tabs.

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const MusicContext = createContext(null);

export function MusicProvider({ children }) {
  // ── Playback state ──
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [queue, setQueue] = useState([]);
  // Tracks list needed so prev/next work across tab switches
  const [tracks, setTracks] = useState([]);

  const audioRef = useRef(null);
  const isPlayingRef = useRef(false);
  const keepAliveRef = useRef(null);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── Service Worker ──
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/audio-worker.js').catch(() => {});
    }
  }, []);

  // ── Volume sync ──
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // ── Media Session API (OS lock screen controls) ──
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title || 'Unknown',
      artist: currentTrack.artist || 'Unknown',
      album: currentTrack.album || 'ChatPro Music',
      artwork: currentTrack.imageUrl
        ? [{ src: currentTrack.imageUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
    navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (audioRef.current && d.seekTime != null) {
        audioRef.current.currentTime = d.seekTime;
        setCurrentTime(d.seekTime);
      }
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTrack, isPlaying]); // eslint-disable-line

  // ── Visibility change: resume if browser throttled/paused tab ──
  useEffect(() => {
    const resume = () => {
      if (
        document.visibilityState === 'visible' &&
        audioRef.current &&
        isPlayingRef.current &&
        audioRef.current.paused
      ) {
        audioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, []);

  // ── Keepalive ping ──
  useEffect(() => {
    if (!isPlaying) { clearInterval(keepAliveRef.current); return; }
    keepAliveRef.current = setInterval(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'KEEP_ALIVE' });
      }
    }, 20000);
    return () => clearInterval(keepAliveRef.current);
  }, [isPlaying]);

  // ── Core playback functions ──
  const playTrack = (track) => {
    if (currentTrack && currentTrack.id === track.id) {
      togglePlayPause();
      return;
    }
    setCurrentTrack(track);
    setIsPlaying(true);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.src = track.audioUrl;
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('Direct stream issue, trying proxy:', err.message);
          const proxyUrl = `/api/music/proxy?url=${encodeURIComponent(track.audioUrl)}`;
          audioRef.current.src = proxyUrl;
          audioRef.current.play().catch((e) => console.error('Audio error:', e));
        });
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleNext = () => {
    if (queue.length > 0) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      playTrack(next);
      return;
    }
    if (tracks.length > 0 && currentTrack) {
      const idx = tracks.findIndex((t) => t.id === currentTrack.id);
      playTrack(tracks[idx >= 0 && idx < tracks.length - 1 ? idx + 1 : 0]);
    }
  };

  const handlePrev = () => {
    if (currentTime > 4 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (tracks.length > 0 && currentTrack) {
      const idx = tracks.findIndex((t) => t.id === currentTrack.id);
      playTrack(tracks[idx > 0 ? idx - 1 : tracks.length - 1]);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime || 0);
      setDuration(audioRef.current.duration || currentTrack?.duration || 0);
    }
  };

  const seekTo = (time) => {
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const handleAudioEnded = () => {
    if (isLoop && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }
    handleNext();
  };

  const addToQueue = (track) => setQueue((prev) => [...prev, track]);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const value = {
    currentTrack, isPlaying, currentTime, duration,
    volume, isMuted, isLoop, queue, tracks,
    setTracks, setVolume, setIsMuted, setIsLoop, addToQueue,
    playTrack, togglePlayPause, handleNext, handlePrev, seekTo, formatTime,
  };

  return (
    <MusicContext.Provider value={value}>
      {/* Single persistent audio element — never unmounts */}
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleAudioEnded}
        onError={() => {
          if (currentTrack && audioRef.current && !audioRef.current.src.includes('/api/music/proxy')) {
            audioRef.current.src = `/api/music/proxy?url=${encodeURIComponent(currentTrack.audioUrl)}`;
            audioRef.current.play().catch(() => {});
          }
        }}
        style={{ display: 'none' }}
      />
      {children}
    </MusicContext.Provider>
  );
}

export const useMusicPlayer = () => {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusicPlayer must be used inside MusicProvider');
  return ctx;
};
