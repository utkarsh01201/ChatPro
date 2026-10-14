// ============================================================
// ChatPro AI - Web API Layer
// Provides direct HTTP API endpoints so users can chat on the
// website using the exact same backend logic as the Telegram bot.
// ============================================================

const url = require('url');
const { generateAIResponse, analyzeImage } = require('./ai');
const { generateImage } = require('./image');
const { getAllFontStyles } = require('./fonts');
const { detectMusicIntentFast } = require('./musicIntent');
const { searchTracks } = require('./music');

// Helper to parse JSON body from incoming request
function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // 10MB limit
            if (body.length > 10 * 1024 * 1024) {
                reject(new Error('Request entity too large'));
            }
        });
        req.on('end', () => {
            if (!body) {
                return resolve({});
            }
            try {
                const parsed = JSON.parse(body);
                resolve(parsed);
            } catch (err) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', err => reject(err));
    });
}

// CORS headers helper
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Image request detection logic matching bot.js
function isImageGenerationRequest(text) {
    const message = String(text || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (!message) return false;

    if (message.startsWith('/imagine') || message.startsWith('/image') || message.startsWith('/draw')) {
        return true;
    }

    const explicitImageRequest =
        /\b(generate|create|make|draw|design|produce)\b[\s\S]*\b(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\b/i.test(message) ||
        /\b(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\b[\s\S]*\b(generate|create|make|draw|design|produce)\b/i.test(message);

    if (explicitImageRequest) return true;

    const hindiImageRequest =
        /\b(image|photo|picture)\b[\s\S]*\b(bana|banao|banado|bana\s+do|generate|create|make)\b/i.test(message) ||
        /\b(bana|banao|banado|bana\s+do)\b[\s\S]*\b(image|photo|picture)\b/i.test(message);

    if (hindiImageRequest) return true;

    return false;
}

function extractImagePrompt(text) {
    let prompt = String(text || '').trim();
    prompt = prompt.replace(/^\/(imagine|image|draw)\s+/i, '');
    prompt = prompt.replace(/^(please\s+)?(generate|create|make|draw|design|render|paint)\s+(the\s+)?(image|picture|photo|art|artwork|illustration|wallpaper|portrait|logo)\s*(of|showing|with|for|:)?\s*/i, '');
    prompt = prompt.replace(/^(please\s+)?(generate|create|make|draw|design|render|paint)\s+me\s+/i, '');
    prompt = prompt.replace(/^(please\s+)?(generate|create|make|draw|design|render|paint)\s+/i, '');
    prompt = prompt.replace(/^(please\s+)?(ek\s+)?(image|photo|picture)\s+(generate|create|make)\s+(karni|karna|karo|kar\s+do|do|hai)\s*/i, '');
    prompt = prompt.replace(/^(please\s+)?(ek\s+)?(image|photo|picture)\s+(bana|banao|banado|bana\s+do)\s*/i, '');
    prompt = prompt.replace(/^(please\s+)?(image|photo|picture)\s+(generate|create|make)\s*/i, '');
    prompt = prompt.replace(/\s+(karni|karna|karo|kar\s+do|bana|banao|banado|bana\s+do|do|hai)\s*$/i, '');
    prompt = prompt.trim();
    if (!prompt) {
        prompt = String(text || '').trim();
    }
    return prompt;
}

async function handleWebRequest(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

    // 1. Health check
    if (pathname === '/' || pathname === '/health' || pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'ChatPro AI Backend',
            message: 'ChatPro AI is running 🚀',
            version: '1.0.0',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // 2. Font styles endpoint: GET /api/fonts?text=Hello
    if (pathname === '/api/fonts' && req.method === 'GET') {
        const text = parsedUrl.query.text || 'ChatPro';
        const styles = getAllFontStyles(text);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            original: text,
            styles
        }));
        return;
    }

    // 2b. Music Search endpoint: GET /api/music/search?q=query&limit=12
    if (pathname === '/api/music/search' && req.method === 'GET') {
        const query = (parsedUrl.query.q || parsedUrl.query.query || '').trim();
        const limit = Math.min(Number(parsedUrl.query.limit) || 12, 25);
        if (!query) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Search query "q" is required' }));
            return;
        }
        try {
            console.log(`🎵 [Web API] Music search: "${query}" (limit: ${limit})`);
            const tracks = await searchTracks(query, limit);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                query,
                count: tracks.length,
                tracks
            }));
            return;
        } catch (err) {
            console.error('❌ [Web API] Music search error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Music search failed: ' + err.message }));
            return;
        }
    }

    // 2c. Music Trending / Featured endpoint: GET /api/music/trending
    if (pathname === '/api/music/trending' && req.method === 'GET') {
        try {
            const featuredQueries = ['Kesariya', 'Khaab', 'Dil Nu', 'Chill Lofi Study', 'Tere Khatir', 'Alan Walker', 'Arijit Singh'];
            const randomQuery = featuredQueries[Math.floor(Math.random() * featuredQueries.length)];
            console.log(`🎵 [Web API] Fetching trending music for: "${randomQuery}"`);
            const tracks = await searchTracks(randomQuery, 10);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                featuredTag: randomQuery,
                tracks
            }));
            return;
        } catch (err) {
            console.error('❌ [Web API] Trending music error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
        }
    }

    // 2d. Audio Streaming Proxy endpoint: GET or HEAD /api/music/proxy?url=...
    if (pathname === '/api/music/proxy' && (req.method === 'GET' || req.method === 'HEAD')) {
        const targetUrl = parsedUrl.query.url;
        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
        }
        try {
            const audioRes = await fetch(targetUrl, {
                method: req.method,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Range': req.headers.range || 'bytes=0-'
                }
            });
            const contentType = audioRes.headers.get('content-type') || (targetUrl.includes('.mp4') ? 'audio/mp4' : 'audio/mpeg');
            const headers = {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*'
            };
            if (audioRes.headers.get('content-range')) {
                headers['Content-Range'] = audioRes.headers.get('content-range');
            }
            if (audioRes.headers.get('content-length')) {
                headers['Content-Length'] = audioRes.headers.get('content-length');
            }
            res.writeHead(audioRes.status, headers);
            if (req.method === 'HEAD') {
                res.end();
                return;
            }
            const arrayBuf = await audioRes.arrayBuffer();
            res.end(Buffer.from(arrayBuf));
            return;
        } catch (proxyErr) {
            console.error('Proxy audio error:', proxyErr.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Audio stream proxy error' }));
            return;
        }
    }

    // 3. Direct Imagine endpoint: POST /api/imagine
    if (pathname === '/api/imagine' && req.method === 'POST') {
        try {
            const body = await parseRequestBody(req);
            const prompt = (body.prompt || '').trim();
            if (!prompt) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Prompt is required' }));
                return;
            }

            console.log(`🎨 [Web API] Generating image for prompt: "${prompt}"`);
            const imageResult = await generateImage(prompt);
            const base64Data = imageResult.buffer.toString('base64');
            const dataUrl = `data:image/jpeg;base64,${base64Data}`;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                type: 'image',
                prompt,
                imageUrl: dataUrl,
                provider: imageResult.provider || 'AI Image Generator'
            }));
            return;
        } catch (err) {
            console.error('❌ [Web API] Imagine error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: 'Image generation failed: ' + err.message
            }));
            return;
        }
    }

    // 4. Main Chat endpoint: POST /api/chat
    if (pathname === '/api/chat' && req.method === 'POST') {
        try {
            const body = await parseRequestBody(req);
            const userMessage = (body.message || '').trim();
            const history = Array.isArray(body.history) ? body.history : [];
            const userProfile = body.userProfile || { name: 'Web User' };

            if (!userMessage) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Message cannot be empty' }));
                return;
            }

            console.log(`💬 [Web API] User message: "${userMessage}"`);

            // Case A: Clear / New Chat
            if (userMessage === '/clear' || userMessage === '/newchat') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    type: 'system',
                    response: '🧹 Chat cleared! Fresh conversation started. How can I help you today?'
                }));
                return;
            }

            // Case B: /help
            if (userMessage === '/help' || userMessage === '/start') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    type: 'text',
                    response: `🤖 **ChatPro AI Assistant**\n\nI can help you with:\n• 💬 **Natural Chat & Learning**: Ask any question or concept\n• 🎵 **Music Streaming**: Type \`/play [song]\` or "play [song name]"\n• 💻 **Coding**: Write, debug, and explain code in any language\n• 🎨 **Image Generation**: Type \`/imagine [prompt]\` or ask me to draw anything\n• 🔤 **Font Styles**: Type \`/font [text]\` for Unicode styled text\n• 🧹 **Reset**: Type \`/clear\` to start fresh`
                }));
                return;
            }

            // Case B2: Music Intent Handling
            const musicIntent = detectMusicIntentFast(userMessage);
            if (musicIntent && (musicIntent.action === 'play' || musicIntent.action === 'vplay' || musicIntent.action === 'dmplay')) {
                const query = musicIntent.query || 'relaxing study';
                console.log(`🎵 [Web API] Music request: "${query}"`);
                try {
                    const tracks = await searchTracks(query, 3);
                    if (tracks && tracks.length > 0) {
                        const top = tracks[0];
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            type: 'text',
                            response: `🎵 **Track Found:**\n\n🎶 **${top.title}** by **${top.artist}**\n⏱️ Duration: ${top.durationFormatted || top.duration + 's'}\n\n🔗 [Stream Audio Track](${top.audioUrl})\n\n💡 In Telegram, type \`/play ${query}\` to listen in DMs or group Voice Chat!`
                        }));
                        return;
                    }
                } catch (musicErr) {
                    console.warn('⚠️ [Web API] Music search note:', musicErr.message);
                }
            }

            // Case C: /font or /text commands
            if (userMessage.startsWith('/font ') || userMessage.startsWith('/text ')) {
                const textToStyle = userMessage.replace(/^\/(font|text)\s+/i, '').trim();
                if (textToStyle) {
                    const styles = getAllFontStyles(textToStyle);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        type: 'fonts',
                        original: textToStyle,
                        styles,
                        response: `Here are your stylized font variations for "${textToStyle}":`
                    }));
                    return;
                }
            }

            // Case C2: Image Upload Analysis (Vision)
            if (body.image) {
                console.log('🖼️ [Web API] Image upload detected for vision analysis');
                try {
                    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    const mimeType = body.mimeType || 'image/jpeg';
                    const question = userMessage || 'Describe this image in detail and explain what you see.';
                    const analysis = await analyzeImage(imageBuffer, mimeType, question);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        type: 'text',
                        response: analysis
                    }));
                    return;
                } catch (imgAnalyzeErr) {
                    console.error('❌ [Web API] Vision analysis error:', imgAnalyzeErr.message);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        type: 'text',
                        response: 'I received your image, but had trouble analyzing it: ' + imgAnalyzeErr.message
                    }));
                    return;
                }
            }

            // Case D: Image Generation Request
            if (isImageGenerationRequest(userMessage)) {
                const prompt = extractImagePrompt(userMessage);
                console.log(`🎨 [Web API] Detected image generation request: "${prompt}"`);
                try {
                    const imageResult = await generateImage(prompt);
                    const base64Data = imageResult.buffer.toString('base64');
                    const dataUrl = `data:image/jpeg;base64,${base64Data}`;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        type: 'image',
                        prompt,
                        imageUrl: dataUrl,
                        provider: imageResult.provider || 'AI Image Generator',
                        response: `Here is your generated image for: "${prompt}"`
                    }));
                    return;
                } catch (imgErr) {
                    console.error('❌ [Web API] Image generation fallback failed:', imgErr.message);
                    // Fall back to normal AI explaining what happened
                    const fallbackAnswer = await generateAIResponse(
                        history,
                        `The user asked to generate an image with prompt "${prompt}", but the image generator service timed out or had an issue. Please apologize warmly and suggest trying a slightly different prompt.`,
                        userProfile
                    );
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        type: 'text',
                        response: fallbackAnswer
                    }));
                    return;
                }
            }

            // Case E: Normal Intelligent AI Chat using generateAIResponse
            const formattedHistory = history.map(item => ({
                role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
                text: String(item.text || item.content || '')
            }));

            const answer = await generateAIResponse(
                formattedHistory,
                userMessage,
                userProfile
            );

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'text',
                response: answer
            }));
            return;

        } catch (chatError) {
            console.error('❌ [Web API] Error generating AI response:', chatError);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'error',
                error: 'Chat processing failed: ' + chatError.message,
                response: '⚠️ Sorry, something went wrong processing your request. Please try again in a moment.'
            }));
            return;
        }
    }

    // 404 for unknown endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

module.exports = {
    handleWebRequest
};
