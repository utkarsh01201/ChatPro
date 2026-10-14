// ============================================================
// ChatPro AI - Music Provider Integration
// Multi-Provider Architecture:
// 1. JioSaavn Engine: Bollywood, Punjabi, Pop, Regional & Global Hits (Playable Audio Streams)
// 2. Jamendo Engine: Creative Commons, Study, Lofi, Ambient & Instrumental Tracks
// ============================================================

const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || '3ed0d4c0';
const JAMENDO_BASE_URL = 'https://api.jamendo.com/v3.0';

// Global track cache for fast ID retrieval across user sessions
const trackCache = new Map();

/**
 * Common mood & activity tags mapping for Jamendo
 */
const MOOD_TAGS = {
    relaxing: ['chillout', 'ambient', 'relaxation', 'lounge'],
    studying: ['study', 'instrumental', 'ambient', 'piano', 'lofi'],
    study: ['study', 'instrumental', 'ambient', 'piano', 'lofi'],
    energetic: ['electronic', 'rock', 'dance', 'energy', 'upbeat'],
    workout: ['workout', 'fitness', 'electronic', 'rock'],
    gym: ['workout', 'fitness', 'electronic', 'rock'],
    sleep: ['sleep', 'meditation', 'ambient', 'calm'],
    meditation: ['meditation', 'calm', 'nature', 'yoga'],
    focus: ['focus', 'instrumental', 'classical', 'ambient'],
    party: ['party', 'dance', 'club', 'pop', 'house'],
    happy: ['happy', 'acoustic', 'pop', 'indie', 'feelgood'],
    sad: ['sad', 'melancholic', 'acoustic', 'ballad'],
    romantic: ['romantic', 'love', 'acoustic', 'piano'],
    lofi: ['lofi', 'chillhop', 'hiphop', 'beats'],
    coding: ['synthwave', 'cyberpunk', 'electronic', 'focus'],
    coffee: ['jazz', 'acoustic', 'coffee', 'lounge']
};

/**
 * Helper to unescape HTML entities in track metadata
 */
function unescapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

/**
 * Detect if query specifies a mood or genre
 */
function extractMoodTags(query) {
    if (!query) return null;
    const lower = query.toLowerCase();
    for (const [key, tags] of Object.entries(MOOD_TAGS)) {
        if (lower.includes(key)) {
            return tags.join(',');
        }
    }
    return null;
}

const CryptoJS = require('crypto-js');

/**
 * Decrypt JioSaavn DES-ECB encrypted media URL to get full-length 320kbps/160kbps stream
 */
function decryptMediaUrl(encryptedUrl) {
    if (!encryptedUrl) return null;
    try {
        const DES_KEY = CryptoJS.enc.Utf8.parse('38346591');
        const decrypted = CryptoJS.DES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl.trim()) },
            DES_KEY,
            { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
        );
        let url = decrypted.toString(CryptoJS.enc.Utf8);
        if (url) {
            // Upgrade any bitrate (_48.mp4, _96.mp4, _160.mp4) to full-length 320kbps Studio Master
            return url.replace(/_(?:48|96|160)\.mp4$/, '_320.mp4');
        }
    } catch (e) {
        console.warn('⚠️ Decrypt error:', e.message);
    }
    return null;
}

/**
 * Search tracks using JioSaavn Engine with Full-Length 320kbps Studio Audio
 */
async function searchSaavn(query, limit = 5) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim();

    try {
        console.log(`🎵 [JioSaavn] Full-Length search for: "${cleanQuery}"`);
        // 1. First try search.getResults for full songs
        const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(cleanQuery)}&_format=json&_marker=0&ctx=web6dot0&p=1&n=${limit}`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(6000)
        });

        let rawResults = [];
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            rawResults = searchData.results || [];
        }

        // 2. If search.getResults was empty, fallback to autocomplete.get
        if (rawResults.length === 0) {
            const autoUrl = `https://www.jiosaavn.com/api.php?__call=autocomplete.get&query=${encodeURIComponent(cleanQuery)}&_format=json&_marker=0&ctx=web6dot0`;
            const autoRes = await fetch(autoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(6000)
            });
            if (autoRes.ok) {
                const autoData = await autoRes.json();
                rawResults = autoData.songs?.data || [];
            }
        }

        if (rawResults.length === 0) return [];

        const results = [];

        for (const item of rawResults) {
            let fullAudioUrl = null;
            let duration = Number(item.duration) || 0;
            let title = unescapeHtml(item.song || item.title || 'Track');
            let artist = unescapeHtml(item.singers || item.more_info?.singers || item.music || 'Artist');
            let album = unescapeHtml(item.album || '');
            let imageUrl = item.image ? item.image.replace(/150x150|50x50/, '500x500') : null;

            // Decrypt full-length audio stream
            if (item.encrypted_media_url) {
                fullAudioUrl = decryptMediaUrl(item.encrypted_media_url);
            }

            // If not directly in search result, fetch song.getDetails to retrieve full encrypted_media_url
            if (!fullAudioUrl && item.id) {
                try {
                    const detUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${item.id}&_format=json&_marker=0&ctx=web6dot0`;
                    const detRes = await fetch(detUrl, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        signal: AbortSignal.timeout(4000)
                    });
                    if (detRes.ok) {
                        const detData = await detRes.json();
                        const songDetail = detData.songs?.[0];
                        if (songDetail) {
                            if (songDetail.encrypted_media_url) {
                                fullAudioUrl = decryptMediaUrl(songDetail.encrypted_media_url);
                            }
                            if (songDetail.duration) {
                                duration = Number(songDetail.duration) || duration;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore detail fetch error
                }
            }

            // Fallback to vlink preview if full audio decryption was not available
            const finalAudioUrl = fullAudioUrl || item.vlink || item.more_info?.vlink;
            if (!finalAudioUrl) continue;

            const track = {
                id: 'saavn_' + item.id,
                title,
                artist,
                album,
                duration: duration || (fullAudioUrl ? 210 : 30),
                audioUrl: finalAudioUrl,
                imageUrl,
                shareUrl: item.perma_url || item.url || null,
                license: fullAudioUrl ? 'Full Length Track (320kbps Studio Master)' : 'Stream Preview (JioSaavn)',
                provider: 'JioSaavn'
            };

            trackCache.set(track.id, track);
            results.push(track);
            if (results.length >= limit) break;
        }

        return results;
    } catch (err) {
        console.warn('⚠️ [JioSaavn] Search failed:', err.message);
        return [];
    }
}

/**
 * Search tracks using Jamendo API (Creative Commons & Mood Tracks)
 */
async function searchJamendo(query, moodTag, limit = 5) {
    try {
        let results = [];

        // 1. Mood tag search
        if (moodTag) {
            console.log(`🎵 [Jamendo] Searching by mood/tag: "${moodTag}"`);
            const url = `${JAMENDO_BASE_URL}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=${limit}&fuzzytags=${encodeURIComponent(moodTag)}&audioformat=mp32&include=licenses`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    results = data.results;
                }
            }
        }

        // 2. Full-text search
        if (results.length === 0) {
            console.log(`🎵 [Jamendo] Searching by keyword: "${query}"`);
            const url = `${JAMENDO_BASE_URL}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=${limit}&search=${encodeURIComponent(query)}&audioformat=mp32&include=licenses`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    results = data.results;
                }
            }
        }

        // 3. Track title search
        if (results.length === 0) {
            const url = `${JAMENDO_BASE_URL}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&limit=${limit}&namesearch=${encodeURIComponent(query)}&audioformat=mp32&include=licenses`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    results = data.results;
                }
            }
        }

        return results.map(t => {
            const track = {
                id: String(t.id),
                title: t.name || 'Unknown Track',
                artist: t.artist_name || 'Unknown Artist',
                album: t.album_name || '',
                duration: Number(t.duration) || 0,
                audioUrl: t.audio,
                imageUrl: t.image || t.album_image || null,
                shareUrl: t.shareurl || null,
                license: t.license_ccurl || 'Creative Commons',
                provider: 'Jamendo'
            };
            trackCache.set(track.id, track);
            return track;
        });
    } catch (err) {
        console.warn('⚠️ [Jamendo] Search failed:', err.message);
        return [];
    }
}

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const { callOpenRouter } = require('./openrouter');

/**
 * Intelligent AI Lyric & Global Song Resolver (Gemini + OpenRouter Fallback)
 * Identifies exact song and artist from one line of lyrics, vague descriptions,
 * or partial titles across Hindi, Punjabi, English, and worldwide libraries.
 */
async function resolveSongWithAI(query) {
    if (!query || query.trim().length < 3) return null;
    const cleanQuery = query.trim();

    const systemPrompt = `You are a World Music Expert and Lyrics Recognizer.
Identify the exact song the user wants from:
- A single line of lyrics (in Hindi, Punjabi, English, Spanish, Korean, or any language)
- A song title or partial/misspelled title
- An artist name or movie/album name
- A vague description (e.g. "interstellar soundtrack", "gym phonk")

Respond ONLY with a valid raw JSON object (no markdown, no backticks, no extra text):
{
  "songTitle": "Official Song Title",
  "artist": "Primary Artist or Singer",
  "searchQuery": "Clean search query with Song Title and Artist",
  "isLikelySong": true
}`;

    const prompt = `Identify this song: "${cleanQuery}"`;
    const timeoutPromise = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('AI Timeout')), ms));

    const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
    for (const model of models) {
        try {
            console.log(`🧠 [AI Music] Asking Gemini (${model}) to identify: "${cleanQuery}"...`);
            const geminiCall = ai.models.generateContent({
                model,
                contents: prompt,
                config: { systemInstruction: systemPrompt }
            });

            const response = await Promise.race([geminiCall, timeoutPromise(3500)]);

            if (response && response.text) {
                const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(text);
                if (parsed.songTitle) {
                    console.log(`✅ [AI Music] Identified: "${parsed.songTitle}" by ${parsed.artist}`);
                    return parsed;
                }
            }
        } catch (err) {
            console.warn(`⚠️ [AI Music] Gemini ${model} failed:`, err.message?.slice(0, 100));
        }
    }

    // Backup to OpenRouter
    try {
        console.log(`🔄 [AI Music] Trying OpenRouter fallback for: "${cleanQuery}"...`);
        const openRouterResponse = await Promise.race([
            callOpenRouter([], prompt, systemPrompt, false),
            timeoutPromise(3500)
        ]);
        if (openRouterResponse) {
            const text = openRouterResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);
            if (parsed.songTitle) {
                console.log(`✅ [AI Music] Identified via OpenRouter: "${parsed.songTitle}" by ${parsed.artist}`);
                return parsed;
            }
        }
    } catch (err) {
        console.warn('⚠️ [AI Music] OpenRouter fallback failed:', err.message);
    }

    return null;
}

/**
 * Universal Track Search across JioSaavn, Jamendo, and AI Lyric Recognizer
 */
async function searchTracks(query, limit = 5) {
    if (!query || !query.trim()) return [];
    const cleanQuery = query.trim();
    const moodTag = extractMoodTags(cleanQuery);

    // 1. If explicit mood or study/relaxing query, search Jamendo first
    if (moodTag) {
        const jamendoTracks = await searchJamendo(cleanQuery, moodTag, limit);
        if (jamendoTracks.length > 0) return jamendoTracks;
    }

    // 2. Fast direct check in JioSaavn
    let saavnTracks = await searchSaavn(cleanQuery, limit);
    if (saavnTracks.length > 0) {
        return saavnTracks;
    }

    // 3. Smart AI Lyrics & Global Song Resolver!
    // Catches songs from one line of lyrics, vague descriptions, or international titles!
    const aiRes = await resolveSongWithAI(cleanQuery);
    if (aiRes && aiRes.songTitle) {
        console.log(`🔍 [AI Music] Searching global libraries for AI resolved song: "${aiRes.songTitle}"...`);
        saavnTracks = await searchSaavn(`${aiRes.songTitle} ${aiRes.artist || ''}`, limit);
        if (saavnTracks.length === 0) {
            saavnTracks = await searchSaavn(aiRes.songTitle, limit);
        }

        if (saavnTracks.length > 0) {
            saavnTracks.forEach(t => {
                t.aiIdentified = {
                    originalQuery: cleanQuery,
                    detectedTitle: aiRes.songTitle,
                    detectedArtist: aiRes.artist
                };
            });
            return saavnTracks;
        }

        // Also check Jamendo with resolved title
        const jamendoResolved = await searchJamendo(aiRes.songTitle, null, limit);
        if (jamendoResolved.length > 0) {
            jamendoResolved.forEach(t => {
                t.aiIdentified = {
                    originalQuery: cleanQuery,
                    detectedTitle: aiRes.songTitle,
                    detectedArtist: aiRes.artist
                };
            });
            return jamendoResolved;
        }
    }

    // 4. Fallback to Jamendo keyword search
    const jamendoFallback = await searchJamendo(cleanQuery, moodTag, limit);
    if (jamendoFallback.length > 0) {
        return jamendoFallback;
    }

    return [];
}

/**
 * Get track by ID
 */
async function getTrackById(trackId) {
    if (!trackId) return null;
    const key = String(trackId);

    if (trackCache.has(key)) {
        return trackCache.get(key);
    }

    if (!key.startsWith('saavn_')) {
        try {
            const url = `${JAMENDO_BASE_URL}/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=jsonpretty&id=${encodeURIComponent(key)}&audioformat=mp32`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    const t = data.results[0];
                    const track = {
                        id: String(t.id),
                        title: t.name || 'Unknown Track',
                        artist: t.artist_name || 'Unknown Artist',
                        album: t.album_name || '',
                        duration: Number(t.duration) || 0,
                        audioUrl: t.audio,
                        imageUrl: t.image || t.album_image || null,
                        shareUrl: t.shareurl || null,
                        license: t.license_ccurl || 'Creative Commons',
                        provider: 'Jamendo'
                    };
                    trackCache.set(track.id, track);
                    return track;
                }
            }
        } catch (err) {
            console.error('❌ [Music] Get track by ID error:', err.message);
        }
    }

    return null;
}

/**
 * Format duration into mm:ss
 */
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

async function searchTracksByMood(mood, limit = 5) {
    return searchTracks(mood, limit);
}

module.exports = {
    searchTracks,
    searchTracksByMood,
    searchSaavn,
    searchJamendo,
    resolveSongWithAI,
    getTrackById,
    formatDuration,
    extractMoodTags
};
