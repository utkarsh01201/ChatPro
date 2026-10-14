require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function identifySongWithAI(query) {
    const prompt = `The user is searching for a music track. The query could be:
1. A single line of lyrics (in English, Hindi, Punjabi, Spanish, etc.)
2. A vague description (e.g. "that song from interstellar", "fast phonk gym music")
3. A misspelled song name
4. An artist and partial title

User Query: "${query}"

Return ONLY a JSON object:
{
  "songTitle": "Official Song Title",
  "artist": "Primary Artist or Singer",
  "searchQuery": "clean search query (Song Title + Artist)",
  "language": "Hindi / English / Punjabi / etc.",
  "isLyrics": true/false
}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text);
    } catch (e) {
        console.error('AI Error:', e.message);
        return null;
    }
}

async function run() {
    const queries = [
        'kehte hain khuda ne iss jahan mein',
        'tu aake dekhle',
        'somebody once told me the world is gonna roll me',
        'chad ke na jaa mainu tu',
        'interstellar organ music theme'
    ];

    for (const q of queries) {
        const res = await identifySongWithAI(q);
        console.log(`Query: "${q}"\n-> Detected: "${res?.songTitle}" by "${res?.artist}" [Search: "${res?.searchQuery}"]\n`);
    }
}

run();
