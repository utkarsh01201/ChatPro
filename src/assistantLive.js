// ============================================================
// ChatPro AI - Telegram Assistant Live Voice Chat Service
// Integrates Telegram MTProto Client (GramJS) & NTgCalls (WebRTC)
// Streams live high-definition 320kbps audio into Group Voice Chats
// ============================================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl');
const { NTgCalls, MediaSource, StreamMode } = require('ntgcalls');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const API_ID = Number(process.env.TELEGRAM_API_ID || 0);
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION_STRING = process.env.ASSISTANT_SESSION_STRING || process.env.TELEGRAM_SESSION_STRING || '';

const TEMP_MUSIC_DIR = path.join(__dirname, '../temp_music');
if (!fs.existsSync(TEMP_MUSIC_DIR)) {
    try {
        fs.mkdirSync(TEMP_MUSIC_DIR, { recursive: true });
    } catch (e) {}
}

let client = null;
let assistantUser = null;
let isConnecting = false;
let ntg = null;

// Map of active calls: groupId -> { inputCall, chatIdBigInt, track, filePath }
const activeVoiceCalls = new Map();

/**
 * Get or initialize the NTgCalls WebRTC singleton instance
 */
function getNtgInstance() {
    if (!ntg) {
        ntg = new NTgCalls();

        // Listen for when audio track finishes streaming in VC
        ntg.onStreamEnd(async (chatIdBigInt) => {
            console.log(`🔔 [AssistantLive] Track stream ended for VC call: ${chatIdBigInt}`);
            for (const [groupId, session] of activeVoiceCalls.entries()) {
                if (String(session.chatIdBigInt) === String(chatIdBigInt)) {
                    try {
                        const { skipVoiceTrack } = require('./voiceChat');
                        const nextTrack = skipVoiceTrack(groupId);
                        if (nextTrack) {
                            console.log(`⏭ [AssistantLive] Auto-playing next track: ${nextTrack.title}`);
                            await playTrackInVoiceChat(groupId, nextTrack);
                        } else {
                            console.log(`⏹ [AssistantLive] Queue finished for group ${groupId}. Leaving VC.`);
                            await stopVoiceStream(groupId);
                        }
                    } catch (err) {
                        console.error('⚠️ [AssistantLive] Error handling onStreamEnd:', err);
                    }
                    break;
                }
            }
        });
    }
    return ntg;
}

/**
 * Convert Telegram group ID to positive BigInt for NTgCalls
 */
function getBigIntChatId(groupId) {
    return BigInt(String(groupId).replace('-100', '').replace('-', ''));
}

/**
 * Download audio track to local file for NTgCalls WebRTC engine
 */
async function downloadTrackAudio(track) {
    const safeId = (track.id || 'stream_' + Date.now()).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = track.audioUrl.endsWith('.mp3') ? '.mp3' : '.mp4';
    const filePath = path.join(TEMP_MUSIC_DIR, `track_${safeId}${ext}`);

    // Return cached file if exists and valid
    if (fs.existsSync(filePath)) {
        try {
            const stat = fs.statSync(filePath);
            if (stat.size > 100000) {
                return filePath;
            }
        } catch (e) {}
    }

    const downloadWithRedirect = (targetUrl, outPath) => {
        return new Promise((resolve, reject) => {
            const protocol = targetUrl.startsWith('https') ? https : http;
            const req = protocol.get(targetUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return downloadWithRedirect(res.headers.location, outPath).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode} from audio CDN`));
                }
                const fileStream = fs.createWriteStream(outPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(outPath);
                });
                fileStream.on('error', (err) => {
                    fs.unlink(outPath, () => {});
                    reject(err);
                });
            });
            req.on('error', (err) => {
                fs.unlink(outPath, () => {});
                reject(err);
            });
        });
    };

    try {
        console.log(`📥 [AssistantLive] Downloading full track "${track.title}" from: ${track.audioUrl}`);
        await downloadWithRedirect(track.audioUrl, filePath);
        return filePath;
    } catch (err) {
        // Fallback to 160kbps if 320kbps fails
        if (track.audioUrl.includes('_320.mp4')) {
            const fallbackUrl = track.audioUrl.replace('_320.mp4', '_160.mp4');
            console.log(`🔄 [AssistantLive] Fallback downloading 160kbps: ${fallbackUrl}`);
            await downloadWithRedirect(fallbackUrl, filePath);
            return filePath;
        }
        throw err;
    }
}

/**
 * Transcode audio file to raw 48000Hz 16-bit stereo PCM (s16le) for NTgCalls WebRTC engine.
 * Passing compressed .mp4 / .mp3 to MediaSource.FILE causes loud buzzing because NTgCalls
 * reads raw PCM frames without decoding.
 */
async function getDecodedPcmAudio(track) {
    const safeId = (track.id || 'stream_' + Date.now()).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
    const pcmPath = path.join(TEMP_MUSIC_DIR, `track_${safeId}_48k.raw`);

    // Return cached PCM file if exists and valid (>200KB)
    if (fs.existsSync(pcmPath)) {
        try {
            const stat = fs.statSync(pcmPath);
            if (stat.size > 200000) {
                return pcmPath;
            }
        } catch (e) {}
    }

    // 1. Download source compressed audio container (.mp4 / .mp3)
    const inputPath = await downloadTrackAudio(track);

    // 2. Transcode to raw 16-bit signed little-endian PCM, stereo (2ch), 48000Hz
    console.log(`🎙️ [AssistantLive] Transcoding "${track.title}" to raw 48kHz stereo PCM via FFmpeg...`);
    await new Promise((resolve, reject) => {
        execFile(ffmpegPath, [
            '-y',
            '-i', inputPath,
            '-f', 's16le',
            '-ac', '2',
            '-ar', '48000',
            '-acodec', 'pcm_s16le',
            pcmPath
        ], (err, stdout, stderr) => {
            if (err) {
                console.error('❌ [AssistantLive] FFmpeg decoding error:', err.message);
                return reject(err);
            }
            resolve(pcmPath);
        });
    });

    const stat = fs.statSync(pcmPath);
    console.log(`✨ [AssistantLive] Successfully decoded PCM audio: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    return pcmPath;
}

/**
 * Initialize MTProto Assistant client if credentials exist
 */
async function initAssistant() {
    if (!API_ID || !API_HASH) {
        console.log('ℹ️ [Assistant] TELEGRAM_API_ID or TELEGRAM_API_HASH not configured');
        return null;
    }

    if (!SESSION_STRING) {
        console.log('ℹ️ [Assistant] ASSISTANT_SESSION_STRING is not set in .env.');
        return null;
    }

    if (client && client.connected) {
        return client;
    }

    if (isConnecting) return null;
    isConnecting = true;

    try {
        console.log('🔌 [Assistant] Connecting Assistant UserBot via GramJS...');
        const stringSession = new StringSession(SESSION_STRING);
        client = new TelegramClient(stringSession, API_ID, API_HASH, {
            connectionRetries: 5
        });

        await client.connect();
        assistantUser = await client.getMe();
        console.log(`✅ [Assistant] Connected as: ${assistantUser.firstName} (@${assistantUser.username || 'no_username'}) [ID: ${assistantUser.id}]`);
        getNtgInstance(); // Initialize WebRTC instance
        return client;
    } catch (err) {
        console.warn('⚠️ [Assistant] Failed to connect MTProto client:', err.message);
        client = null;
        return null;
    } finally {
        isConnecting = false;
    }
}

/**
 * Get current assistant status
 */
function getAssistantStatus() {
    return {
        hasCredentials: Boolean(API_ID && API_HASH),
        hasSession: Boolean(SESSION_STRING),
        isConnected: Boolean(client && client.connected),
        user: assistantUser ? {
            id: assistantUser.id?.toString(),
            firstName: assistantUser.firstName,
            username: assistantUser.username
        } : null
    };
}

/**
 * Robust peer resolution for Telegram MTProto client
 * Handles string IDs, BigInt, channel prefix differences (-100...), and dialog cache
 */
async function resolveGroupPeer(client, groupId) {
    if (!client || !client.connected) return null;
    const rawIdStr = String(groupId);
    const cleanId = rawIdStr.replace(/^-100/, '').replace(/^-/, '');

    // 1. Try direct resolution with various candidate representations
    const candidates = [
        rawIdStr,
        BigInt(rawIdStr),
        `-100${cleanId}`,
        BigInt(`-100${cleanId}`),
        `-${cleanId}`,
        BigInt(`-${cleanId}`),
        cleanId,
        BigInt(cleanId)
    ];

    for (const cand of candidates) {
        try {
            const peer = await client.getInputEntity(cand);
            if (peer) return peer;
        } catch (e) {}
    }

    // 2. Scan dialogs with normalized IDs
    try {
        const dialogs = await client.getDialogs({ limit: 150 });
        for (const d of dialogs) {
            const dIdStr = String(d.id?.value ?? d.id ?? '').replace(/^-100/, '').replace(/^-/, '');
            const entIdStr = String(d.entity?.id?.value ?? d.entity?.id ?? '').replace(/^-100/, '').replace(/^-/, '');
            if (dIdStr === cleanId || entIdStr === cleanId) {
                if (d.inputEntity) return d.inputEntity;
                if (d.entity) {
                    try {
                        const ent = await client.getInputEntity(d.entity);
                        if (ent) return ent;
                    } catch (e) {}
                }
                try {
                    return await client.getInputEntity(d.id);
                } catch (e) {}
            }
        }
    } catch (dErr) {
        console.warn('⚠️ [AssistantLive] Dialogs scan error:', dErr.message);
    }

    return null;
}

/**
 * Play a track live in Telegram Group Voice Chat via NTgCalls WebRTC
 */
async function playTrackInVoiceChat(groupId, track) {
    if (!client || !client.connected) {
        await initAssistant();
    }
    if (!client || !client.connected) {
        return { success: false, error: 'NO_CLIENT', message: 'Assistant client not connected.' };
    }

    const n = getNtgInstance();
    const chatIdBigInt = getBigIntChatId(groupId);
    const key = String(groupId);

    try {
        // 1. Download and decode audio to raw 48000Hz stereo PCM
        const filePath = await getDecodedPcmAudio(track);

        // 2. Resolve Group Peer with multi-format matcher
        let peer = await resolveGroupPeer(client, groupId);

        if (!peer) {
            console.warn(`⚠️ [AssistantLive] Group entity ${groupId} not found in assistant dialogs.`);
            return {
                success: false,
                error: 'NOT_IN_GROUP',
                message: 'Assistant @Shreyash1201 is not a member of this group. Please add @Shreyash1201 to the group.'
            };
        }

        let fullChat;
        if (peer.className === 'InputPeerChannel') {
            fullChat = await client.invoke(new Api.channels.GetFullChannel({ channel: peer }));
        } else {
            fullChat = await client.invoke(new Api.messages.GetFullChat({ chatId: peer.chatId || groupId }));
        }

        const callData = fullChat.fullChat?.call;
        if (!callData) {
            return {
                success: false,
                error: 'NO_VOICE_CHAT',
                message: 'No active Voice Chat found in this group. Please start a Voice Chat first.'
            };
        }

        const inputCall = new Api.InputGroupCall({
            id: callData.id,
            accessHash: callData.accessHash
        });

        // 3. Connect NTgCalls WebRTC if not already connected for this chat
        const activeCalls = await n.calls();
        if (!activeCalls.has(chatIdBigInt)) {
            console.log(`🎙️ [AssistantLive] Initializing WebRTC call for ${groupId}...`);
            const offerParams = await n.createCall(chatIdBigInt);

            const joinRes = await client.invoke(new Api.phone.JoinGroupCall({
                call: inputCall,
                joinAs: new Api.InputPeerSelf(),
                params: new Api.DataJSON({ data: offerParams }),
                muted: false
            }));

            let connectionData = null;
            for (const u of joinRes.updates || []) {
                if (u.params?.data) {
                    connectionData = u.params.data;
                    break;
                }
            }

            if (!connectionData) {
                throw new Error('Telegram did not return WebRTC connection params.');
            }

            await n.connect(chatIdBigInt, connectionData, false);
            console.log(`🎉 [AssistantLive] NTgCalls connected to Telegram WebRTC for ${groupId}!`);
        }

        // 4. Stream local decoded audio into the call
        console.log(`🎶 [AssistantLive] Streaming audio into VC: "${track.title}" from ${filePath}`);
        await n.setStreamSources(chatIdBigInt, StreamMode.CAPTURE, {
            microphone: {
                mediaSource: MediaSource.FILE,
                sampleRate: 48000,
                channelCount: 2,
                input: filePath,
                keepOpen: false
            }
        });

        activeVoiceCalls.set(key, {
            inputCall,
            chatIdBigInt,
            track,
            filePath,
            startedAt: Date.now()
        });

        console.log(`🎉🎉🎉 [AssistantLive] "${track.title}" is now SINGING LIVE in Group Voice Chat!`);
        return { success: true };
    } catch (err) {
        console.error('❌ [AssistantLive] Error streaming track in VC:', err);
        return { success: false, error: 'STREAM_ERROR', message: err.message };
    }
}

/**
 * Pause voice stream
 */
async function pauseVoiceStream(groupId) {
    const chatIdBigInt = getBigIntChatId(groupId);
    const n = getNtgInstance();
    try {
        await n.pause(chatIdBigInt);
        console.log(`⏸ [AssistantLive] Paused stream for ${groupId}`);
        return true;
    } catch (e) {
        console.warn(`⚠️ [AssistantLive] pause error:`, e.message);
        return false;
    }
}

/**
 * Resume voice stream
 */
async function resumeVoiceStream(groupId) {
    const chatIdBigInt = getBigIntChatId(groupId);
    const n = getNtgInstance();
    try {
        await n.resume(chatIdBigInt);
        console.log(`▶️ [AssistantLive] Resumed stream for ${groupId}`);
        return true;
    } catch (e) {
        console.warn(`⚠️ [AssistantLive] resume error:`, e.message);
        return false;
    }
}

/**
 * Stop voice stream & leave group voice call
 */
async function stopVoiceStream(groupId) {
    const key = String(groupId);
    const chatIdBigInt = getBigIntChatId(groupId);
    const n = getNtgInstance();

    try {
        await n.stop(chatIdBigInt).catch(() => {});
    } catch (e) {}

    if (activeVoiceCalls.has(key)) {
        try {
            const { inputCall } = activeVoiceCalls.get(key);
            if (inputCall && client && client.connected) {
                await client.invoke(new Api.phone.LeaveGroupCall({
                    call: inputCall,
                    source: 0
                })).catch(() => {});
            }
        } catch (e) {}
        activeVoiceCalls.delete(key);
    }
    console.log(`⏹ [AssistantLive] Stopped stream and left VC for ${groupId}`);
    return true;
}

/**
 * Summon Assistant to join the group text chat (if not already member)
 */
async function summonAssistantToGroup(ctx, groupId) {
    const status = getAssistantStatus();
    const assistantHandle = assistantUser?.username || process.env.ASSISTANT_USERNAME || 'Shreyash1201';
    const result = {
        joined: false,
        inviteLink: null,
        assistantUsername: assistantHandle,
        message: ''
    };

    try {
        // 1. Check if assistant is already a member via Telegram Bot API
        if (assistantUser && assistantUser.id) {
            try {
                const member = await ctx.api.getChatMember(ctx.chat.id, Number(assistantUser.id));
                if (member && ['creator', 'administrator', 'member', 'restricted'].includes(member.status)) {
                    result.joined = true;
                    console.log(`✅ [AssistantLive] Assistant is already a participant (${member.status}) in group ${groupId}`);
                    return result;
                }
            } catch (mErr) {
                // Not a participant or cannot query member status directly
            }
        }

        // 2. If client is connected and group has a public username, join directly
        if (client && client.connected && ctx.chat?.username) {
            try {
                await client.invoke(new Api.channels.JoinChannel({ channel: ctx.chat.username }));
                result.joined = true;
                console.log(`✅ [AssistantLive] Assistant joined public channel @${ctx.chat.username}`);
                return result;
            } catch (chErr) {
                if (chErr.message?.includes('USER_ALREADY_PARTICIPANT')) {
                    result.joined = true;
                    return result;
                }
            }
        }

        // 3. Attempt to generate an invite link using bot privileges
        let inviteLink = null;
        try {
            const linkObj = await ctx.api.createChatInviteLink(ctx.chat.id, {
                creates_join_request: false,
                name: 'ChatPro Music Assistant'
            });
            inviteLink = linkObj.invite_link;
        } catch (e) {
            try {
                inviteLink = await ctx.api.exportChatInviteLink(ctx.chat.id);
            } catch (err) {}
        }
        result.inviteLink = inviteLink;

        // 4. If invite link obtained, have assistant join via MTProto ImportChatInvite
        if (client && client.connected && inviteLink) {
            try {
                const match = inviteLink.match(/(?:\+|\/joinchat\/)([a-zA-Z0-9_-]+)/);
                const hash = match ? match[1] : inviteLink.split('/').pop().replace(/^[+]/, '').split('?')[0];
                await client.invoke(new Api.messages.ImportChatInvite({ hash }));
                result.joined = true;
                console.log(`🎉 [AssistantLive] Assistant successfully joined group via invite link!`);
            } catch (joinErr) {
                if (joinErr.message?.includes('USER_ALREADY_PARTICIPANT')) {
                    result.joined = true;
                } else {
                    console.warn('⚠️ [AssistantLive] ImportChatInvite error:', joinErr.message);
                }
            }
        }

        return result;
    } catch (err) {
        console.warn('⚠️ [AssistantLive] summonAssistantToGroup error:', err.message);
        return result;
    }
}

module.exports = {
    initAssistant,
    getAssistantStatus,
    summonAssistantToGroup,
    playTrackInVoiceChat,
    pauseVoiceStream,
    resumeVoiceStream,
    stopVoiceStream,
    leaveGroupVoiceChat: stopVoiceStream
};
