require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { callOpenRouter } = require('./src/openrouter');

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

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

    // 1. Try Gemini Models
    const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];
    for (const model of models) {
        try {
            console.log(`🧠 [AI Music] Asking Gemini (${model}) to identify: "${cleanQuery}"...`);
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt
                }
            });

            if (response && response.text) {
                const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(text);
                if (parsed.songTitle) {
                    console.log(`✅ [AI Music] Identified: "${parsed.songTitle}" by ${parsed.artist} [Search: "${parsed.searchQuery}"]`);
                    return parsed;
                }
            }
        } catch (err) {
            console.warn(`⚠️ [AI Music] Gemini ${model} failed:`, err.message?.slice(0, 100));
        }
    }

    // 2. Fallback to OpenRouter
    try {
        console.log(`🔄 [AI Music] Trying OpenRouter fallback for: "${cleanQuery}"...`);
        const openRouterResponse = await callOpenRouter([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ]);
        if (openRouterResponse) {
            const text = openRouterResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);
            if (parsed.songTitle) {
                return parsed;
            }
        }
    } catch (err) {
        console.warn('⚠️ [AI Music] OpenRouter failed:', err.message);
    }

    return null;
}

async function test() {
    const samples = [
        'kehte hain khuda ne iss jahan mein',
        'tu aake dekhle',
        'somebody once told me the world is gonna roll me'
    ];

    for (const s of samples) {
        const res = await resolveSongWithAI(s);
        console.log('Result for:', s, '->', res, '\n');
    }
}

test();
