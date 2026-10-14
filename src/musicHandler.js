// ============================================================
// ChatPro AI - Music Handler
// High-level controller connecting Telegram bot to Music Player,
// JioSaavn/Jamendo providers, and responsive interactive controls
// ============================================================

const { InputFile, InlineKeyboard } = require('grammy');
const { searchTracks, getTrackById, formatDuration } = require('./music');
const {
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
} = require('./musicPlayer');
const {
    getVoiceStatus,
    addVoiceQueue,
    skipVoiceTrack,
    toggleVoicePause,
    stopVoiceChat
} = require('./voiceChat');
const {
    initAssistant,
    getAssistantStatus,
    summonAssistantToGroup,
    playTrackInVoiceChat,
    pauseVoiceStream,
    resumeVoiceStream,
    stopVoiceStream,
    leaveGroupVoiceChat
} = require('./assistantLive');

/**
 * Send playable audio directly to Telegram chat with interactive player controls
 */
async function sendTrackAudio(ctx, track, altTracks = []) {
    let inputFile;

    // Show upload action in Telegram chat
    await ctx.replyWithChatAction('upload_voice').catch(() => {});

    try {
        let streamUrl = track.audioUrl;
        console.log(`🎵 [MusicHandler] Fetching full-length audio stream for "${track.title}" (${track.duration}s)...`);

        // Fetch audio buffer with user agent (30s timeout for full 3-5 min tracks)
        let res = await fetch(streamUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(30000)
        });

        // If 320kbps was not found on CDN, fallback to 160kbps full track
        if (!res.ok && streamUrl.includes('_320.mp4')) {
            const fallbackUrl = streamUrl.replace('_320.mp4', '_160.mp4');
            console.log(`🔄 [MusicHandler] 320kbps fallback to 160kbps full track: ${fallbackUrl}`);
            const fbRes = await fetch(fallbackUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(30000)
            });
            if (fbRes.ok) {
                res = fbRes;
                streamUrl = fallbackUrl;
            }
        }

        const sanitizedTitle = track.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'track';
        const fileExt = streamUrl.includes('.mp4') ? 'm4a' : 'mp3';

        if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            console.log(`✅ [MusicHandler] Full track downloaded: ${(buf.length / 1024 / 1024).toFixed(2)} MB. Sending to Telegram...`);
            inputFile = new InputFile(buf, `${sanitizedTitle}.${fileExt}`);
        } else {
            inputFile = new InputFile({ url: streamUrl });
        }
    } catch (e) {
        console.warn(`⚠️ [MusicHandler] Stream buffer fetch note: ${e.message}, falling back to stream URL`);
        inputFile = new InputFile({ url: track.audioUrl });
    }

    const keyboard = createPlayerKeyboard(track.id, false, altTracks);

    try {
        await ctx.replyWithAudio(inputFile, {
            caption: formatTrackMessage(track, true),
            title: track.title,
            performer: track.artist,
            duration: Math.round(track.duration || 0),
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } catch (err) {
        console.warn('⚠️ Audio file upload fallback to message card:', err.message);
        await ctx.reply(
            formatTrackMessage(track, true) + `\n\n🔗 [Direct Full Audio Stream](${track.audioUrl})`,
            {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            }
        );
    }
}

/**
 * Send full-length audio directly to a user's private message / DM
 */
async function sendTrackAudioToUser(ctx, userId, track) {
    let inputFile;
    let streamUrl = track.audioUrl;

    const res = await fetch(streamUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(30000)
    });

    const sanitizedTitle = track.title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'track';
    const fileExt = streamUrl.includes('.mp4') ? 'm4a' : 'mp3';

    if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        inputFile = new InputFile(buf, `${sanitizedTitle}.${fileExt}`);
    } else {
        inputFile = new InputFile({ url: streamUrl });
    }

    await ctx.api.sendAudio(userId, inputFile, {
        caption: formatTrackMessage(track, true) + '\n\n💡 *Delivered directly to your DMs!*',
        title: track.title,
        performer: track.artist,
        duration: Math.round(track.duration || 0),
        parse_mode: 'Markdown'
    });
}

/**
 * Handle explicit DM audio command (/dmplay, /playfile)
 * Delivers full-length recorded track to user's private chat
 */
async function handleDirectMessageAudio(ctx, query) {
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    const userId = ctx.from?.id;

    if (!query || !query.trim()) {
        await ctx.reply(
            '🎧 **Direct Audio Delivery**\n\n' +
            'Usage: `/dmplay [song name]` or `/playfile [song name]`\n\n' +
            'Sends the full-length studio track directly to your private messages.',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const cleanQuery = query.trim();
    const waitMsg = await ctx.reply(`🔍 Finding full studio track for "${cleanQuery}"...`);

    try {
        const tracks = await searchTracks(cleanQuery, 1);
        if (!tracks || tracks.length === 0) {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ No tracks found for "${cleanQuery}".`);
            return;
        }

        const track = tracks[0];
        await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});

        if (isGroup) {
            try {
                await sendTrackAudioToUser(ctx, userId, track);
                await ctx.reply(
                    `📩 **Sent to your private messages!**\n\n` +
                    `🎧 **${track.title}** by **${track.artist}** has been delivered to your DMs (@${ctx.from.username || ctx.from.first_name}).`,
                    { parse_mode: 'Markdown' }
                );
            } catch (dmErr) {
                await ctx.reply(
                    `⚠️ **Cannot send to your DMs yet!**\n\n` +
                    `Please start a chat with @chat_pro_robot in DMs first: [Click to Start](https://t.me/chat_pro_robot?start=music), then try again!`,
                    { parse_mode: 'Markdown' }
                );
            }
        } else {
            await sendTrackAudio(ctx, track);
        }
    } catch (err) {
        console.error('❌ [MusicHandler] dmplay error:', err);
        await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `⚠️ Error: ${err.message}`).catch(() => {});
    }
}

/**
 * Handle Play command or natural play intent
 * IN GROUP CHATS: Activates the Live Voice Chat Assistant! (No recorded files in groups)
 * IN DMs (Private): Plays full-length recorded audio directly in chat.
 */
async function handleMusicPlay(ctx, query) {
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

    // In Group Chats: ALWAYS route to Live Voice Chat Assistant!
    if (isGroup) {
        return handleVoiceChatCommand(ctx, 'vplay', query);
    }

    const chatId = ctx.chat.id.toString();

    if (!query || !query.trim()) {
        await ctx.reply(
            '🎵 **ChatPro Music**\n\n' +
            'Usage: `/play [song name, artist, or mood]`\n\n' +
            'Examples:\n' +
            '• `/play Kesariya`\n' +
            '• `/play Khaab`\n' +
            '• `/play Tere Khatir`\n' +
            '• `/play Arijit Singh`\n' +
            '• `Play relaxing music for studying`\n' +
            '• `Play something energetic`\n\n' +
            'Controls: /pause • /resume • /skip • /stop • /queue',
            { parse_mode: 'Markdown' }
        );
        return;
    }

    const cleanQuery = query.trim();
    const searchMsg = await ctx.reply(`🔍 Searching for "${cleanQuery}"...`);

    try {
        const tracks = await searchTracks(cleanQuery, 4);

        if (!tracks || tracks.length === 0) {
            await ctx.api.editMessageText(
                ctx.chat.id,
                searchMsg.message_id,
                `❌ No playable tracks found for "${cleanQuery}".\n\n` +
                `💡 Try searching for a popular song, artist name, or genre (e.g. *Khaab*, *Kesariya*, *lofi*, *relaxing*, *piano*).`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const topTrack = tracks[0];
        const altTracks = tracks.slice(1);
        const queueResult = enqueueTrack(chatId, topTrack);

        // Delete "Searching..." placeholder
        await ctx.api.deleteMessage(ctx.chat.id, searchMsg.message_id).catch(() => {});

        if (queueResult.isImmediate) {
            await sendTrackAudio(ctx, topTrack, altTracks);
        } else {
            await ctx.reply(
                `➕ **Added to Queue** (#${queueResult.position}):\n\n` +
                `🎧 **${topTrack.title}**\n` +
                `👤 **Artist:** ${topTrack.artist}\n` +
                `⏱ **Duration:** ${formatDuration(topTrack.duration)}\n\n` +
                `Use /queue to see all upcoming songs.`,
                { parse_mode: 'Markdown' }
            );
        }

    } catch (err) {
        console.error('❌ [MusicHandler] Play error:', err);
        await ctx.api.editMessageText(
            ctx.chat.id,
            searchMsg.message_id,
            `⚠️ Error retrieving track: ${err.message}`
        ).catch(() => {});
    }
}

/**
 * Handle Pause command
 */
async function handleMusicPause(ctx) {
    const chatId = ctx.chat.id.toString();
    const current = getCurrentTrack(chatId);

    if (!current) {
        await ctx.reply('ℹ️ Nothing is currently playing in this chat. Use `/play [song]` to start!');
        return;
    }

    const isPaused = togglePause(chatId);
    await ctx.reply(
        isPaused
            ? `⏸ **Playback Paused**\n🎧 ${current.title}\nUse /resume to continue.`
            : `▶️ **Playback Resumed**\n🎧 ${current.title}`,
        { parse_mode: 'Markdown' }
    );
}

/**
 * Handle Resume command
 */
async function handleMusicResume(ctx) {
    const chatId = ctx.chat.id.toString();
    const current = getCurrentTrack(chatId);

    if (!current) {
        await ctx.reply('ℹ️ No active track to resume. Use `/play [song]` to start!');
        return;
    }

    togglePause(chatId);
    await ctx.reply(`▶️ **Playback Resumed**\n🎧 ${current.title}`, { parse_mode: 'Markdown' });
}

/**
 * Handle Skip command
 */
async function handleMusicSkip(ctx) {
    const chatId = ctx.chat.id.toString();
    const next = skipTrack(chatId);

    if (!next) {
        await ctx.reply('⏭ End of playlist. Use `/play [song]` to queue more music!');
        return;
    }

    await sendTrackAudio(ctx, next);
}

/**
 * Handle Previous command
 */
async function handleMusicPrev(ctx) {
    const chatId = ctx.chat.id.toString();
    const prev = prevTrack(chatId);

    if (!prev) {
        await ctx.reply('⏮ Already at the beginning of the queue.');
        return;
    }

    await sendTrackAudio(ctx, prev);
}

/**
 * Handle Stop command
 */
async function handleMusicStop(ctx) {
    const chatId = ctx.chat.id.toString();
    const stopped = stopPlayback(chatId);
    if (stopped) {
        await ctx.reply('⏹ **Playback stopped** and queue cleared.');
    } else {
        await ctx.reply('ℹ️ Nothing was playing.');
    }
}

/**
 * Handle Queue command
 */
async function handleMusicQueue(ctx) {
    const chatId = ctx.chat.id.toString();
    const info = getQueueInfo(chatId);

    if (!info.tracks || info.tracks.length === 0) {
        await ctx.reply('📜 **Queue is empty.**\n\nUse `/play [song name]` to add music!');
        return;
    }

    let text = `📜 **Music Queue (${info.tracks.length} tracks):**\n\n`;
    info.tracks.forEach((t, i) => {
        const isCurrent = i === info.currentIndex;
        const prefix = isCurrent ? (info.isPaused ? '⏸' : '▶️') : `${i + 1}.`;
        text += `${prefix} **${t.title}** — ${t.artist} (${formatDuration(t.duration)})\n`;
    });

    text += `\nUse /skip to play next or /stop to clear.`;
    await ctx.reply(text, { parse_mode: 'Markdown' });
}

/**
 * Handle Now Playing command
 */
async function handleMusicNowPlaying(ctx) {
    const chatId = ctx.chat.id.toString();
    const current = getCurrentTrack(chatId);

    if (!current) {
        await ctx.reply('ℹ️ Nothing is currently playing. Use `/play [song]` to start!');
        return;
    }

    await ctx.reply(formatTrackMessage(current, true), {
        parse_mode: 'Markdown',
        reply_markup: createPlayerKeyboard(current.id)
    });
}

/**
 * Handle Telegram Inline Keyboard Callbacks (Interactive Button Clicks)
 */
async function handleMusicCallback(ctx) {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();

    // 1. Play / Pause Toggle
    if (data === 'm_pause') {
        const current = getCurrentTrack(chatId);
        if (!current) {
            await ctx.answerCallbackQuery({ text: 'ℹ️ No active playback session.', show_alert: false });
            return;
        }

        const isPaused = togglePause(chatId);
        await ctx.answerCallbackQuery({
            text: isPaused ? '⏸ Playback paused!' : '▶️ Playback resumed!'
        });

        await ctx.editMessageReplyMarkup({
            reply_markup: createPlayerKeyboard(current.id, isPaused)
        }).catch(() => {});
        return;
    }

    // 2. Next Track
    if (data === 'm_skip') {
        const next = skipTrack(chatId);
        if (!next) {
            await ctx.answerCallbackQuery({ text: '⏭ Reached end of queue!', show_alert: true });
            return;
        }

        await ctx.answerCallbackQuery({ text: `⏭ Playing next: ${next.title.slice(0, 20)}...` });
        await sendTrackAudio(ctx, next);
        return;
    }

    // 3. Previous Track
    if (data === 'm_prev') {
        const prev = prevTrack(chatId);
        if (!prev) {
            await ctx.answerCallbackQuery({ text: '⏮ Already at the start!', show_alert: false });
            return;
        }

        await ctx.answerCallbackQuery({ text: `⏮ Playing previous: ${prev.title.slice(0, 20)}...` });
        await sendTrackAudio(ctx, prev);
        return;
    }

    // 4. Stop & Clear Queue
    if (data === 'm_stop') {
        stopPlayback(chatId);
        await ctx.answerCallbackQuery({ text: '⏹ Playback stopped & queue cleared!' });

        await ctx.editMessageCaption({
            caption: '⏹ **Playback stopped**\nQueue has been cleared. Use `/play [song]` to start again.',
            parse_mode: 'Markdown'
        }).catch(async () => {
            await ctx.editMessageText('⏹ **Playback stopped.**', { parse_mode: 'Markdown' }).catch(() => {});
        });
        return;
    }

    // 5. Queue View
    if (data === 'm_queue') {
        await ctx.answerCallbackQuery({ text: '📜 Showing playlist queue' });
        await handleMusicQueue(ctx);
        return;
    }

    // 6. Direct track selection (Alternative versions / search results)
    if (data.startsWith('m_play_')) {
        const trackId = data.replace('m_play_', '');
        const track = await getTrackById(trackId);

        if (track) {
            const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
            if (isGroup) {
                await ctx.answerCallbackQuery({ text: `🎙️ Queuing in Voice Chat: "${track.title.slice(0, 20)}"...` });
                const res = addVoiceQueue(chatId, track);
                if (res.position === 1) {
                    await summonAssistantToGroup(ctx, chatId);
                    const streamRes = await playTrackInVoiceChat(chatId, track);
                    if (streamRes.success) {
                        await ctx.reply(`🎙️ **Voice Chat:** Now singing live: **${track.title}** — ${track.artist}\n🎧 *Listen together in group VC!*`, { parse_mode: 'Markdown' });
                    } else {
                        await ctx.reply(`⚠️ Could not stream in VC: ${streamRes.message || streamRes.error}`);
                    }
                } else {
                    await ctx.reply(`⏳ **Voice Chat:** Queued **${track.title}** (#${res.position})`, { parse_mode: 'Markdown' });
                }
                return;
            }

            await ctx.answerCallbackQuery({ text: `▶️ Loading "${track.title.slice(0, 20)}"...` });
            enqueueTrack(chatId, track);
            await sendTrackAudio(ctx, track);
        } else {
            await ctx.answerCallbackQuery({ text: '❌ Track unavailable', show_alert: true });
        }
        return;
    }

    // 7. Voice Chat Callbacks
    if (data === 'vc_pause') {
        await pauseVoiceStream(chatId);
        toggleVoicePause(chatId);
        await ctx.answerCallbackQuery({ text: '⏸ Live Voice Chat Paused' });
        return;
    }

    if (data === 'vc_resume') {
        await resumeVoiceStream(chatId);
        toggleVoicePause(chatId);
        await ctx.answerCallbackQuery({ text: '▶️ Live Voice Chat Resumed' });
        return;
    }

    if (data === 'vc_skip') {
        const next = skipVoiceTrack(chatId);
        if (next) {
            await ctx.answerCallbackQuery({ text: `⏭ Playing: ${next.title.slice(0, 20)}...` });
            await playTrackInVoiceChat(chatId, next);
            await ctx.reply(`🎙️ **Voice Chat:** Now singing live: **${next.title}** — ${next.artist}`, { parse_mode: 'Markdown' });
        } else {
            await stopVoiceStream(chatId);
            await ctx.answerCallbackQuery({ text: '⏭ VC Queue finished', show_alert: true });
        }
        return;
    }

    if (data === 'vc_stop') {
        stopVoiceChat(chatId);
        await stopVoiceStream(chatId);
        await ctx.answerCallbackQuery({ text: '⏹ Assistant left Voice Chat!' });
        await ctx.editMessageText('⏹ **Assistant disconnected from Voice Chat**\nLive playback stopped and voice queue cleared.', { parse_mode: 'Markdown' }).catch(() => {});
        return;
    }

    if (data === 'vc_queue') {
        const status = getVoiceStatus(chatId);
        await ctx.answerCallbackQuery({
            text: `📜 VC Queue: ${status.queueLength} tracks (${status.upcomingLength} upcoming)`,
            show_alert: true
        });
        return;
    }

    // Voice Chat Retry / Join button
    if (data.startsWith('vc_retry_')) {
        const trackId = data.replace('vc_retry_', '');
        const track = await getTrackById(trackId) || getVoiceStatus(chatId)?.currentTrack;

        if (!track) {
            await ctx.answerCallbackQuery({ text: '❌ Track not found. Please use /play [song] to start!', show_alert: true });
            return;
        }

        await ctx.answerCallbackQuery({ text: '🎙️ Connecting Assistant to Voice Chat...' });

        // Ensure assistant is in group
        await summonAssistantToGroup(ctx, chatId);

        // Attempt stream
        const streamResult = await playTrackInVoiceChat(chatId, track);
        if (streamResult.success) {
            const assistantHandle = process.env.ASSISTANT_USERNAME || 'Shreyash1201';
            const msg = 
                `✨  *CHATPRO LIVE MUSIC*  ✨\n` +
                `──────────────────────────────\n` +
                `🎵  *Track:*  ${track.title}\n` +
                `👤  *Artist:*  ${track.artist}\n` +
                `⏱️  *Duration:*  ${formatDuration(track.duration)}  •  📻  *Audio:* 320kbps\n` +
                `🎙️  *Performer:*  @${assistantHandle} (In VC)\n` +
                `📍  *Status:*  🔴  *Streaming Live in Voice Chat for Everyone*\n` +
                `──────────────────────────────\n` +
                `🎧  *Assistant joined the call! Listen together in Group Voice Chat.*\n` +
                `💡  *Admins: Ensure @${assistantHandle} is unmuted if you don't hear music.*`;

            const vcKeyboard = new InlineKeyboard()
                .text('⏸ Pause', 'vc_pause')
                .text('▶️ Resume', 'vc_resume')
                .text('⏭ Skip', 'vc_skip')
                .row()
                .text('📜 VC Queue', 'vc_queue')
                .text('⏹ Stop Playback', 'vc_stop')
                .row()
                .text('📥 Send Song to my DM', `vc_dm_${track.id}`);

            await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: vcKeyboard }).catch(() => {});
        } else if (streamResult.error === 'NO_VOICE_CHAT') {
            await ctx.answerCallbackQuery({
                text: '⚠️ Voice Chat is still not active! Please tap group header -> Start Voice Chat first.',
                show_alert: true
            });
        } else if (streamResult.error === 'NOT_IN_GROUP') {
            await ctx.answerCallbackQuery({
                text: '⚠️ Assistant is not in this group yet! Please add @Shreyash1201 first.',
                show_alert: true
            });
        } else {
            await ctx.answerCallbackQuery({
                text: `⚠️ Could not join VC: ${streamResult.message || streamResult.error}`,
                show_alert: true
            });
        }
        return;
    }

    // 8. Deliver track to user's DM from Live Stage
    if (data.startsWith('vc_dm_')) {
        const trackId = data.replace('vc_dm_', '');
        const track = await getTrackById(trackId) || getVoiceStatus(chatId)?.currentTrack;

        if (!track) {
            await ctx.answerCallbackQuery({ text: '❌ Track information not available.', show_alert: true });
            return;
        }

        try {
            await ctx.answerCallbackQuery({ text: '📩 Delivering track to your private DMs...' });
            await sendTrackAudioToUser(ctx, ctx.from.id, track);
        } catch (e) {
            await ctx.answerCallbackQuery({
                text: '⚠️ Please click @chat_pro_robot and start the bot in DMs first so I can send you files!',
                show_alert: true
            });
        }
        return;
    }

    // 9. Cancel
    if (data === 'm_cancel') {
        await ctx.answerCallbackQuery({ text: 'Cancelled' });
        await ctx.deleteMessage().catch(() => {});
        return;
    }

    await ctx.answerCallbackQuery().catch(() => {});
}

/**
 * Handle Group Voice Chat Live Assistant Commands (/vplay, /play live, etc.)
 */
async function handleVoiceChatCommand(ctx, command, args) {
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    const groupId = ctx.chat.id.toString();

    if (!isGroup) {
        const assistantHandle = process.env.ASSISTANT_USERNAME || 'Shreyash1201';
        const dmKeyboard = new InlineKeyboard()
            .url('➕ Add Bot to Group', 'https://t.me/chat_pro_robot?startgroup=music')
            .url(`➕ Add @${assistantHandle}`, `https://t.me/${assistantHandle}`);

        await ctx.reply(
            '🎙️ **ChatPro Live Voice Assistant**\n\n' +
            'Live voice chat singing streams audio into **Telegram Group Voice Chats** so everyone in the group can listen together!\n\n' +
            '💡 **How to use in your Group:**\n' +
            `1. Tap **➕ Add Bot to Group** (@chat_pro_robot)\n` +
            `2. Tap **➕ Add @${assistantHandle}** (our singing assistant)\n` +
            `3. Start a **Voice Chat** in your group\n` +
            `4. Type: \`/play ${args || 'song name'}\`\n\n` +
            `The assistant will join the group call and sing live for everyone! 🎶\n\n` +
            `*(In private DMs, songs are sent as high-quality audio files directly)*`,
            { parse_mode: 'Markdown', reply_markup: dmKeyboard }
        );
        return;
    }

    const cmd = command.toLowerCase();

    // Auto-delete command message if bot is admin
    await ctx.deleteMessage().catch(() => {});

    if (cmd === 'vplay') {
        if (!args || !args.trim()) {
            await ctx.reply(
                '🎙️ **ChatPro Live Voice Assistant**\n\n' +
                'Usage: `/play live [song name, lyrics, or mood]`\n' +
                'Example: `/play live Kesariya`\n' +
                'Example: `/play live Khaab`\n\n' +
                '• The Assistant joins the voice call and streams live 320kbps audio.\n' +
                '• Recorded audio files are available in DMs using `/dmplay [song]`.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const waitMsg = await ctx.reply(`🔍 *Searching & preparing "${args}"...*`, { parse_mode: 'Markdown' });
        const tracks = await searchTracks(args, 1);

        if (!tracks || tracks.length === 0) {
            await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ No tracks found for "${args}".`);
            return;
        }

        const track = tracks[0];
        const res = addVoiceQueue(groupId, track);

        // Ensure assistant is in the group chat
        const summonRes = await summonAssistantToGroup(ctx, groupId);

        // Start WebRTC live audio stream if first track in queue
        let streamResult = { success: false };
        if (res.position === 1) {
            streamResult = await playTrackInVoiceChat(groupId, track);
        } else {
            streamResult = { success: true, queued: true };
        }

        const assistantHandle = summonRes.assistantUsername || process.env.ASSISTANT_USERNAME || 'Shreyash1201';

        // Case 1: Voice Chat is not active in the group
        if (!streamResult.success && streamResult.error === 'NO_VOICE_CHAT') {
            const noVcKeyboard = new InlineKeyboard()
                .text('🎙️ Join & Sing Now', `vc_retry_${track.id}`)
                .row()
                .text('📥 Send Song to my DM', `vc_dm_${track.id}`);

            await ctx.api.editMessageText(
                ctx.chat.id,
                waitMsg.message_id,
                `🎙️ **Group Voice Chat Not Active**\n\n` +
                `No active **Voice Chat** is currently open in this group.\n\n` +
                `👉 **To start listening with everyone:**\n` +
                `1. Click the group title at the very top\n` +
                `2. Tap the three dots **(⋮)** -> **Start Voice Chat**\n` +
                `3. Tap **🎙️ Join & Sing Now** below!\n\n` +
                `The assistant (@${assistantHandle}) will connect and sing live for everyone!`,
                { parse_mode: 'Markdown', reply_markup: noVcKeyboard }
            );
            return;
        }

        // Case 2: Assistant UserBot is not in the group yet
        if (!streamResult.success && (streamResult.error === 'NOT_IN_GROUP' || !summonRes.joined)) {
            const addKeyboard = new InlineKeyboard();
            if (summonRes.inviteLink) {
                addKeyboard.url('➕ Add Assistant to Group', summonRes.inviteLink);
            } else {
                addKeyboard.url(`➕ Add @${assistantHandle}`, `https://t.me/${assistantHandle}`);
            }
            addKeyboard.row()
                .text('🎙️ Start Singing in VC', `vc_retry_${track.id}`)
                .text('📥 Send Song to my DM', `vc_dm_${track.id}`);

            await ctx.api.editMessageText(
                ctx.chat.id,
                waitMsg.message_id,
                `⚠️ **Assistant Needs to Join This Group!**\n\n` +
                `To stream live music into this group's Voice Chat for everyone, our assistant UserBot (@${assistantHandle}) must be in this group.\n\n` +
                `👉 **Quick Setup:**\n` +
                `1. Tap **➕ Add Assistant** below (or add @${assistantHandle} manually)\n` +
                `2. Make sure a **Voice Chat** is active in this group\n` +
                `3. Tap **🎙️ Start Singing in VC**!`,
                { parse_mode: 'Markdown', reply_markup: addKeyboard }
            );
            return;
        }

        // Case 3: Other streaming error
        if (!streamResult.success && res.position === 1) {
            const errKeyboard = new InlineKeyboard()
                .text('🔄 Retry VC', `vc_retry_${track.id}`)
                .text('📥 Send Song to my DM', `vc_dm_${track.id}`);

            await ctx.api.editMessageText(
                ctx.chat.id,
                waitMsg.message_id,
                `⚠️ **Voice Chat Connection Notice**\n\n` +
                `Could not start live stream: ${streamResult.message || streamResult.error}\n\n` +
                `Make sure @${assistantHandle} is in the group and a Voice Chat is open.`,
                { parse_mode: 'Markdown', reply_markup: errKeyboard }
            );
            return;
        }

        const isLiveNow = res.position === 1 && streamResult.success;
        const statusBadge = isLiveNow ? '🔴  *Streaming Live in Voice Chat for Everyone*' : `⏳  *Queued in Voice Chat (#${res.position})*`;

        // Clean, organized, modern song card
        const msg = 
            `✨  *CHATPRO LIVE MUSIC*  ✨\n` +
            `──────────────────────────────\n` +
            `🎵  *Track:*  ${track.title}\n` +
            `👤  *Artist:*  ${track.artist}\n` +
            `⏱️  *Duration:*  ${formatDuration(track.duration)}  •  📻  *Audio:* 320kbps\n` +
            `🎙️  *Performer:*  @${assistantHandle} (In VC)\n` +
            `📍  *Status:*  ${statusBadge}\n` +
            (track.aiIdentified ? `🧠  *AI Match:*  _${track.aiIdentified.originalQuery}_\n` : '') +
            `──────────────────────────────\n` +
            `🎧  *Listen together in the group Voice Chat at the top!*\n` +
            `💡  *Admins: If audio is quiet, ensure @${assistantHandle} is unmuted in VC.*`;

        const vcKeyboard = new InlineKeyboard()
            .text('⏸ Pause', 'vc_pause')
            .text('▶️ Resume', 'vc_resume')
            .text('⏭ Skip', 'vc_skip')
            .row()
            .text('📜 VC Queue', 'vc_queue')
            .text('⏹ Stop Playback', 'vc_stop')
            .row()
            .text('📥 Send Song to my DM', `vc_dm_${track.id}`);

        await ctx.api.editMessageText(
            ctx.chat.id,
            waitMsg.message_id,
            msg,
            { parse_mode: 'Markdown', reply_markup: vcKeyboard }
        );
        return;
    }

    if (cmd === 'vpause') {
        await pauseVoiceStream(groupId);
        toggleVoicePause(groupId);
        await ctx.reply('⏸ *Voice chat live stream paused.*', { parse_mode: 'Markdown' });
        return;
    }

    if (cmd === 'vresume') {
        await resumeVoiceStream(groupId);
        toggleVoicePause(groupId);
        await ctx.reply('▶️ *Voice chat live stream resumed.*', { parse_mode: 'Markdown' });
        return;
    }

    if (cmd === 'vskip') {
        const next = skipVoiceTrack(groupId);
        if (next) {
            await playTrackInVoiceChat(groupId, next);
            await ctx.reply(`⏭ *Skipped!* Now singing live: **${next.title}** — ${next.artist}`, { parse_mode: 'Markdown' });
        } else {
            await stopVoiceStream(groupId);
            await ctx.reply('⏭ *Voice chat live queue finished. Assistant left voice chat.*', { parse_mode: 'Markdown' });
        }
        return;
    }

    if (cmd === 'vstop') {
        stopVoiceChat(groupId);
        await stopVoiceStream(groupId);
        await ctx.reply('⏹ *Group voice chat playback stopped and assistant disconnected.*', { parse_mode: 'Markdown' });
        return;
    }

    if (cmd === 'vqueue' || cmd === 'vstatus') {
        const status = getVoiceStatus(groupId);
        if (status.queueLength === 0) {
            await ctx.reply('📜 Group voice chat queue is empty. Use `/play live [song]` to add music!');
            return;
        }

        let msg = `🎙 **Group Voice Chat Status**\n\n`;
        if (status.currentTrack) {
            msg += `▶️ **Now Singing Live:** ${status.currentTrack.title} — ${status.currentTrack.artist}\n\n`;
        }
        msg += `Upcoming tracks in VC: ${status.upcomingLength}\n`;
        await ctx.reply(msg, { parse_mode: 'Markdown' });
        return;
    }
}

module.exports = {
    handleMusicPlay,
    handleDirectMessageAudio,
    handleMusicPause,
    handleMusicResume,
    handleMusicSkip,
    handleMusicPrev,
    handleMusicStop,
    handleMusicQueue,
    handleMusicNowPlaying,
    handleMusicCallback,
    handleVoiceChatCommand
};
