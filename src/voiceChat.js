// ============================================================
// ChatPro AI - Group Voice Chat Streaming Service (Mode B)
// ============================================================
// NOTE ON TELEGRAM VOICE CHATS:
// The official Telegram Bot API (api.telegram.org) only supports
// messages, audio files, and webhooks. It does NOT allow bots to
// directly join and stream live WebRTC/VoIP into group voice chats.
//
// Streaming audio into Group Voice Chats requires an MTProto Client
// (UserBot or PyTgCalls / GramJS WebRTC service) configured with:
// - TELEGRAM_API_ID
// - TELEGRAM_API_HASH
// - TELEGRAM_SESSION_STRING (or phone login)
// - Native FFmpeg binary
//
// This module provides the group voice chat session controller,
// isolated per-group queue management, and ready-to-wire client hooks.
// ============================================================

const groupVoiceSessions = new Map();

/**
 * Get or create isolated voice chat session for a group
 */
function getGroupVoiceSession(groupId) {
    const key = String(groupId);
    if (!groupVoiceSessions.has(key)) {
        groupVoiceSessions.set(key, {
            groupId: key,
            queue: [],
            currentTrack: null,
            isPlaying: false,
            isPaused: false,
            voiceClientConnected: false,
            updatedAt: Date.now()
        });
    }
    return groupVoiceSessions.get(key);
}

/**
 * Add track to group voice chat queue
 */
function addVoiceQueue(groupId, track) {
    const session = getGroupVoiceSession(groupId);
    if (!session.currentTrack) {
        session.currentTrack = track;
        session.isPlaying = true;
    } else {
        session.queue.push(track);
    }
    session.updatedAt = Date.now();
    return {
        position: session.queue.length + (session.currentTrack ? 1 : 0),
        session
    };
}

/**
 * Skip track in group voice chat
 */
function skipVoiceTrack(groupId) {
    const session = getGroupVoiceSession(groupId);
    if (session.queue.length > 0) {
        session.currentTrack = session.queue.shift();
        session.isPlaying = true;
        session.isPaused = false;
        session.updatedAt = Date.now();
        return session.currentTrack;
    }
    session.currentTrack = null;
    session.isPlaying = false;
    return null;
}

/**
 * Pause / resume voice chat
 */
function toggleVoicePause(groupId) {
    const session = getGroupVoiceSession(groupId);
    session.isPaused = !session.isPaused;
    session.updatedAt = Date.now();
    return session.isPaused;
}

/**
 * Stop group voice chat playback
 */
function stopVoiceChat(groupId) {
    const key = String(groupId);
    if (groupVoiceSessions.has(key)) {
        groupVoiceSessions.delete(key);
        return true;
    }
    return false;
}

/**
 * Get group voice chat status
 */
function getVoiceStatus(groupId) {
    const session = getGroupVoiceSession(groupId);
    return {
        groupId: session.groupId,
        isPlaying: session.isPlaying,
        isPaused: session.isPaused,
        currentTrack: session.currentTrack,
        queueLength: session.queue.length + (session.currentTrack ? 1 : 0),
        upcomingLength: session.queue.length,
        queue: session.queue
    };
}

module.exports = {
    getGroupVoiceSession,
    addVoiceQueue,
    skipVoiceTrack,
    toggleVoicePause,
    stopVoiceChat,
    getVoiceStatus
};
