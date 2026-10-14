// ============================================================
// ChatPro AI - Music Intent Recognition
// Identifies music requests from natural user messages
// ============================================================

/**
 * Fast deterministic intent detection using regex patterns
 * Ensures 100% uptime even if AI providers are unreachable
 */
function detectMusicIntentFast(text) {
    if (!text || typeof text !== 'string') return null;
    const msg = text.trim();
    const lower = msg.toLowerCase().trim();

    // 1. Explicit Slash Commands
    if (lower.startsWith('/play live ') || lower.startsWith('/playlive ') || lower.startsWith('/live ')) {
        const query = msg.replace(/^\/(play\s+live|playlive|live)\s+/i, '').trim();
        return { action: 'vplay', query, isLive: true };
    }
    if (lower.startsWith('/vplay ')) {
        const query = msg.replace(/^\/vplay\s+/i, '').trim();
        return { action: 'vplay', query, isLive: true };
    }
    if (lower.startsWith('/dmplay ') || lower.startsWith('/playfile ')) {
        const query = msg.replace(/^\/(dmplay|playfile)\s+/i, '').trim();
        return { action: 'dmplay', query };
    }
    if (lower.startsWith('/play ') || lower.startsWith('/music ')) {
        const query = msg.replace(/^\/(play|music)\s+/i, '').trim();
        if (/^live\s+/i.test(query)) {
            return { action: 'vplay', query: query.replace(/^live\s+/i, '').trim(), isLive: true };
        }
        return { action: 'play', query };
    }
    if (lower === '/play' || lower === '/music' || lower === '/vplay' || lower === '/playlive') {
        return { action: 'help' };
    }
    if (lower === '/pause') return { action: 'pause' };
    if (lower === '/resume') return { action: 'resume' };
    if (lower === '/skip' || lower === '/next') return { action: 'skip' };
    if (lower === '/prev' || lower === '/previous') return { action: 'prev' };
    if (lower === '/stop') return { action: 'stop' };
    if (lower === '/queue' || lower === '/q') return { action: 'queue' };
    if (lower === '/nowplaying' || lower === '/np') return { action: 'nowplaying' };

    // 2. Natural language playback controls
    if (/^(pause(\s+(the|this))?(\s+(song|music|track|playback))?)$/i.test(lower)) {
        return { action: 'pause' };
    }
    if (/^(resume(\s+(the|this))?(\s+(song|music|track|playback))?|unpause)$/i.test(lower)) {
        return { action: 'resume' };
    }
    if (/^(skip(\s+(the|this))?(\s+(song|track))?|next(\s+(song|track))?|play(\s+the)?\s+next\s+(song|track))$/i.test(lower)) {
        return { action: 'skip' };
    }
    if (/^(previous(\s+(song|track))?|play(\s+the)?\s+previous\s+(song|track))$/i.test(lower)) {
        return { action: 'prev' };
    }
    if (/^(stop(\s+(the|this))?(\s+(song|music|track|playback))?)$/i.test(lower)) {
        return { action: 'stop' };
    }
    if (/^(show(\s+me)?\s+(the|my)?\s*(music\s+)?queue|what('s|\s+is)\s+in\s+(the\s+)?queue|show\s+queue)$/i.test(lower)) {
        return { action: 'queue' };
    }
    if (/^(what('s|\s+is)\s+playing|now\s+playing|current\s+song)$/i.test(lower)) {
        return { action: 'nowplaying' };
    }

    // Live Singing & Voice Chat / VC requests
    // e.g. "sing Kesariya", "assistant sing live", "sing in vc", "play live Kesariya"
    if (/^(please\s+)?(assistant\s+)?(sing|sing\s+live)\s+(.+)$/i.test(lower) ||
        /\b(in\s+(the\s+)?(vc|voice\s*chat)|on\s+(the\s+)?(vc|voice\s*chat)|live\s+in\s+vc)\b/i.test(lower) ||
        /^(please\s+)?play\s+live\s+(.+)$/i.test(lower)) {
        let vcQuery = msg
            .replace(/\b(in\s+(the\s+)?(vc|voice\s*chat)|on\s+(the\s+)?(vc|voice\s*chat)|live\s+in\s+vc)\b/gi, '')
            .replace(/^(please\s+)?(assistant\s+)?(sing|sing\s+live|play\s+live|play|listen to|put on|start)\s+(me\s+)?/i, '')
            .replace(/[?.!]+$/, '')
            .trim();
        if (vcQuery) {
            return { action: 'vplay', query: vcQuery, isLive: true };
        }
    }

    // 3. Natural language play requests
    // e.g. "play Kesariya", "play relaxing music for studying", "play something energetic"
    const playMatch = lower.match(/^(please\s+)?(play|listen to|put on|start)\s+(me\s+)?(.+)$/i);
    if (playMatch) {
        let query = msg.substring(msg.indexOf(playMatch[4])).trim();
        // Remove trailing punctuation or filler words
        query = query.replace(/[?.!]+$/, '').trim();
        if (query && !/^(game|football|cricket|video)$/i.test(query)) {
            return { action: 'play', query };
        }
    }

    // Hindi/Hinglish patterns: "gana bajao", "song play karo"
    const hindiMatch = lower.match(/^(.+?)\s*(gana|song|music|gaana)\s*(bajao|chalao|lagao|play\s*karo)/i);
    if (hindiMatch) {
        const query = hindiMatch[1].trim();
        if (query) return { action: 'play', query };
    }

    return null;
}

/**
 * Master intent detector (Fast parser + AI fallback)
 */
async function detectMusicIntent(text, aiHelper = null) {
    const fastIntent = detectMusicIntentFast(text);
    if (fastIntent) {
        return fastIntent;
    }

    // If AI helper is provided and message seems musical, use structured classification
    if (aiHelper && typeof aiHelper === 'function') {
        const lower = String(text || '').toLowerCase();
        if (lower.includes('song') || lower.includes('music') || lower.includes('track') || lower.includes('artist')) {
            try {
                const aiResult = await aiHelper(text);
                if (aiResult && aiResult.action) {
                    return aiResult;
                }
            } catch (e) {
                // Ignore AI error and fall back to regular chat
            }
        }
    }

    return null;
}

module.exports = {
    detectMusicIntentFast,
    detectMusicIntent
};
