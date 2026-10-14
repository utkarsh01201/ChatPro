require('dotenv').config();
const { searchTracks, searchTracksByMood, formatDuration } = require('./src/music');
const { detectMusicIntent } = require('./src/musicIntent');
const { getQueue, enqueueTrack, skipTrack, prevTrack, togglePause, stopPlayback, getQueueInfo } = require('./src/musicPlayer');
const { getVoiceSession, addVoiceQueue, skipVoiceTrack, toggleVoicePause, stopVoiceChat, getVoiceStatus } = require('./src/voiceChat');

async function runTests() {
    console.log('====================================================');
    console.log('🧪 RUNNING COMPREHENSIVE MUSIC INTEGRATION TEST SUITE');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`✅ [PASS] ${testName}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${testName}`);
            failed++;
        }
    }

    // ----------------------------------------------------
    // TEST 1: Intent Detection (Deterministic & AI)
    // ----------------------------------------------------
    console.log('--- 1. Intent Detection Tests ---');
    const intentTests = [
        { text: '/play Kesariya', expectedAction: 'play', expectedQuery: 'Kesariya' },
        { text: '/play live Kesariya', expectedAction: 'vplay', expectedQuery: 'Kesariya' },
        { text: '/playlive Khaab', expectedAction: 'vplay', expectedQuery: 'Khaab' },
        { text: '/dmplay Kesariya', expectedAction: 'dmplay', expectedQuery: 'Kesariya' },
        { text: '/playfile Khaab', expectedAction: 'dmplay', expectedQuery: 'Khaab' },
        { text: 'sing Kesariya in vc', expectedAction: 'vplay' },
        { text: 'Play relaxing music for studying', expectedAction: 'play' },
        { text: 'Play something energetic', expectedAction: 'play' },
        { text: 'Pause the song', expectedAction: 'pause' },
        { text: 'Skip this track', expectedAction: 'skip' },
        { text: 'Play the next song', expectedAction: 'skip' },
        { text: 'Show my music queue', expectedAction: 'queue' },
        { text: 'stop the music', expectedAction: 'stop' },
        { text: 'resume playback', expectedAction: 'resume' },
        { text: 'Explain how photosynthesis works', expectedAction: null },
        { text: 'Generate an image of a cyber cat', expectedAction: null },
    ];

    for (const t of intentTests) {
        const res = await detectMusicIntent(t.text);
        if (t.expectedAction === null) {
            assert(res === null, `Non-music intent rejected: "${t.text}"`);
        } else {
            assert(res && res.action === t.expectedAction, `Intent action matched "${t.expectedAction}" for: "${t.text}"`);
        }
    }

    // ----------------------------------------------------
    // TEST 2: Jamendo Music Provider & Streaming
    // ----------------------------------------------------
    console.log('\n--- 2. Jamendo Music Provider Tests ---');
    try {
        const moodResults = await searchTracksByMood('relaxing study', 3);
        assert(moodResults.length > 0, `Mood search ('relaxing study') returned ${moodResults.length} tracks`);
        if (moodResults.length > 0) {
            console.log(`   Sample: "${moodResults[0].title}" by ${moodResults[0].artist} (${formatDuration(moodResults[0].duration)})`);
            assert(!!moodResults[0].audioUrl, 'Track contains playable audio URL');
        }

        const titleResults = await searchTracks('piano dream', 3);
        assert(titleResults.length > 0, `Title search ('piano dream') returned ${titleResults.length} tracks`);

        // Test audio URL fetch (HTTP HEAD/GET check)
        if (titleResults.length > 0) {
            const headRes = await fetch(titleResults[0].audioUrl, { method: 'HEAD' });
            assert(headRes.status === 200 || headRes.status === 206, `Audio stream returns HTTP ${headRes.status} OK (${headRes.headers.get('content-type')})`);
        }
    } catch (err) {
        console.error('Jamendo test error:', err.message);
        failed++;
    }

    // ----------------------------------------------------
    // TEST 3: Isolated Player Queue (Mode A: Chat Audio)
    // ----------------------------------------------------
    console.log('\n--- 3. Player Queue & Isolation Tests ---');
    const chatA = 'chat_user_111';
    const chatB = 'chat_user_222';

    const track1 = { id: 't1', title: 'Song One', artist: 'Artist A', durationFormatted: '3:00', audioUrl: 'http://example.com/1.mp3' };
    const track2 = { id: 't2', title: 'Song Two', artist: 'Artist B', durationFormatted: '3:30', audioUrl: 'http://example.com/2.mp3' };
    const track3 = { id: 't3', title: 'Song Three', artist: 'Artist C', durationFormatted: '4:00', audioUrl: 'http://example.com/3.mp3' };

    // Enqueue in Chat A
    enqueueTrack(chatA, track1);
    enqueueTrack(chatA, track2);
    // Enqueue different track in Chat B
    enqueueTrack(chatB, track3);

    const qA = getQueueInfo(chatA);
    const qB = getQueueInfo(chatB);

    assert(qA.tracks.length === 2, `Chat A queue has 2 tracks (got ${qA.tracks.length})`);
    assert(qB.tracks.length === 1, `Chat B queue has 1 track (got ${qB.tracks.length})`);
    assert(qA.tracks[0].title === 'Song One', 'Chat A current track is Song One');
    assert(qB.tracks[0].title === 'Song Three', 'Chat B isolated track is Song Three');

    // Skip in Chat A
    const nextA = skipTrack(chatA);
    assert(nextA && nextA.title === 'Song Two', `Chat A skipped to next track: ${nextA?.title}`);
    assert(getQueueInfo(chatB).currentIndex === 0, 'Chat B playback unaffected by Chat A skip');

    // Toggle pause in Chat A
    const isPaused = togglePause(chatA);
    assert(isPaused === true, 'Chat A paused successfully');

    // Stop playback
    stopPlayback(chatA);
    const qAStopped = getQueueInfo(chatA);
    assert(qAStopped.tracks.length === 0, 'Chat A queue cleared on stop');

    // ----------------------------------------------------
    // TEST 4: Voice Chat Multi-Group Isolation (Mode B)
    // ----------------------------------------------------
    console.log('\n--- 4. Voice Chat Multi-Group Isolation Tests ---');
    const group1 = '-1001234567890';
    const group2 = '-1009876543210';

    addVoiceQueue(group1, track1, 'User Alpha');
    addVoiceQueue(group1, track2, 'User Alpha');
    addVoiceQueue(group2, track3, 'User Beta');

    const status1 = getVoiceStatus(group1);
    const status2 = getVoiceStatus(group2);

    assert(status1.queueLength === 2, `Group 1 voice queue has 2 tracks (got ${status1.queueLength})`);
    assert(status2.queueLength === 1, `Group 2 voice queue has 1 track (got ${status2.queueLength})`);
    assert(status1.currentTrack.title === 'Song One', 'Group 1 current track is Song One');
    assert(status2.currentTrack.title === 'Song Three', 'Group 2 current track is Song Three');

    // Skip in Group 1
    const nextGroup1 = skipVoiceTrack(group1);
    assert(nextGroup1 && nextGroup1.title === 'Song Two', `Group 1 skipped to: ${nextGroup1?.title}`);
    assert(getVoiceStatus(group2).isPlaying === true, 'Group 2 voice queue unaffected');

    stopVoiceChat(group1);
    stopVoiceChat(group2);
    assert(getVoiceStatus(group1).queueLength === 0, 'Group 1 voice session stopped and cleared');

    console.log('\n====================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
