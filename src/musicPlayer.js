// ============================================================
// ChatPro AI - Music Player & Queue Manager
// Handles isolated playback queues per chat/group
// Generates interactive Telegram inline control keyboards
// ============================================================

const { InlineKeyboard } = require('grammy');
const { formatDuration } = require('./music');

// Map of chatId -> PlaybackSession
const playbackSessions = new Map();

/**
 * Get or create isolated playback session for a chat/group
 */
function getSession(chatId) {
    const key = String(chatId);
    if (!playbackSessions.has(key)) {
        playbackSessions.set(key, {
            chatId: key,
            queue: [],
            currentIndex: -1,
            isPaused: false,
            messageId: null, // message containing current player UI
            updatedAt: Date.now()
        });
    }
    return playbackSessions.get(key);
}

/**
 * Add track to chat's queue
 */
function enqueueTrack(chatId, track) {
    const session = getSession(chatId);
    session.queue.push(track);
    if (session.currentIndex === -1) {
        session.currentIndex = 0;
    }
    session.updatedAt = Date.now();
    return {
        session,
        position: session.queue.length,
        isImmediate: session.currentIndex === session.queue.length - 1
    };
}

/**
 * Get current track for a chat
 */
function getCurrentTrack(chatId) {
    const session = getSession(chatId);
    if (session.currentIndex >= 0 && session.currentIndex < session.queue.length) {
        return session.queue[session.currentIndex];
    }
    return null;
}

/**
 * Skip to next track in queue
 */
function skipTrack(chatId) {
    const session = getSession(chatId);
    if (session.currentIndex + 1 < session.queue.length) {
        session.currentIndex += 1;
        session.isPaused = false;
        session.updatedAt = Date.now();
        return session.queue[session.currentIndex];
    }
    return null;
}

/**
 * Move to previous track
 */
function prevTrack(chatId) {
    const session = getSession(chatId);
    if (session.currentIndex > 0) {
        session.currentIndex -= 1;
        session.isPaused = false;
        session.updatedAt = Date.now();
        return session.queue[session.currentIndex];
    }
    return null;
}

/**
 * Toggle pause / resume
 */
function togglePause(chatId) {
    const session = getSession(chatId);
    session.isPaused = !session.isPaused;
    session.updatedAt = Date.now();
    return session.isPaused;
}

/**
 * Stop playback and clear queue
 */
function stopPlayback(chatId) {
    const key = String(chatId);
    if (playbackSessions.has(key)) {
        playbackSessions.delete(key);
        return true;
    }
    return false;
}

/**
 * Get formatted queue list
 */
function getQueueInfo(chatId) {
    const session = getSession(chatId);
    return {
        tracks: session.queue,
        currentIndex: session.currentIndex,
        isPaused: session.isPaused,
        total: session.queue.length
    };
}

/**
 * Create Telegram Player Controls Inline Keyboard
 */
function createPlayerKeyboard(trackId, isPaused = false, altTracks = []) {
    const kb = new InlineKeyboard()
        .text('⏮ Prev', 'm_prev')
        .text(isPaused ? '▶️ Resume' : '⏸ Pause', 'm_pause')
        .text('⏭ Next', 'm_skip')
        .row()
        .text('📜 Queue', 'm_queue')
        .text('❌ Stop', 'm_stop');

    if (altTracks && altTracks.length > 0) {
        altTracks.slice(0, 2).forEach(alt => {
            const shortName = (alt.title || 'Alt').slice(0, 24);
            kb.row().text(`🔀 ${shortName}`, `m_play_${alt.id}`);
        });
    }

    return kb;
}

/**
 * Create Track Search Results Selection Keyboard
 */
function createSearchResultsKeyboard(tracks) {
    const keyboard = new InlineKeyboard();
    tracks.slice(0, 5).forEach((t, i) => {
        const titleShort = (t.title || 'Track').slice(0, 24);
        keyboard.text(`▶️ ${i + 1}. ${titleShort}`, `m_play_${t.id}`).row();
    });
    keyboard.text('❌ Cancel', 'm_cancel');
    return keyboard;
}

/**
 * Format Track Display Card for Telegram
 */
function formatTrackMessage(track, isNowPlaying = true) {
    const status = isNowPlaying ? '▶️ Now Playing' : '🎵 Track Details';
    const durationStr = formatDuration(track.duration);
    
    let text = `${status}:\n\n`;
    if (track.aiIdentified) {
        text += `🧠 **AI Lyric Match:** _"${track.aiIdentified.originalQuery}"_\n\n`;
    }
    text += `🎧 **${track.title}**\n` +
           `👤 **Artist:** ${track.artist}\n` +
           (track.album ? `💿 **Album:** ${track.album}\n` : '') +
           `⏱ **Duration:** ${durationStr}\n` +
           `📜 **Source:** ${track.license || 'Global Catalog'}\n\n` +
           `⚡ *Streamed via ChatPro Music*`;
    return text;
}

module.exports = {
    getSession,
    getQueue: getSession,
    enqueueTrack,
    getCurrentTrack,
    skipTrack,
    prevTrack,
    togglePause,
    stopPlayback,
    getQueueInfo,
    createPlayerKeyboard,
    createSearchResultsKeyboard,
    formatTrackMessage
};
