const { GoogleGenAI } = require('@google/genai');
const { callOpenRouter } = require('./openrouter');

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function buildSystemPrompt(userProfile) {
    const name = userProfile?.preferredName || userProfile?.firstName || 'Utkarsh';
    const username = userProfile?.username ? `@${userProfile.username}` : '';
    const factsList = userProfile?.facts?.length ? userProfile.facts.join('; ') : '';

    return `You are ChatPro AI, a highly emotionally intelligent and empathetic AI assistant on Telegram. Speak clearly, naturally, and warmly. You must sync with the user's feelings—if they are happy, be enthusiastic; if they are sad or frustrated, be comforting and supportive. Pay close attention to the emotional context of previous messages so the conversation feels deeply connected and human.

PERMANENT USER MEMORY (CRITICAL):
- You are chatting with ${name} ${username ? `(${username})` : ''}.
- Their name is ${name}. You ALWAYS remember who you are speaking to, even across new chats, cleared conversations, or fresh sessions!
- If the user asks "what is my name?", "do you know me?", or tests your memory, IMMEDIATELY tell them their name is ${name} with confidence and warmth!
- NEVER say you don't know their name or that you haven't been properly introduced.
${factsList ? `- Known facts about ${name}: ${factsList}` : ''}

FONT STYLING:
If the user asks to write text or their name in a specific font (e.g., Times New Roman, serif, cursive, script, gothic, monospace, bold, bubble, small caps), you CAN and SHOULD write it out using Unicode characters (e.g. 𝑈𝑡𝑘𝑎𝑟𝑠ℎ for Times New Roman / Serif, 𝒰𝓉𝓀𝒶𝓇𝓈𝒽 for Cursive, 𝔘𝔱𝔨𝔞𝔯𝔰𝔥 for Gothic, 𝚄𝚝𝑘𝑎𝚛𝚜𝚑 for Monospace). Never say you cannot change fonts on Telegram.

IMPORTANT: Do NOT use markdown symbols like **, ###, or __ unless formatting code. Do NOT use LaTeX math formatting. Use plain text, standard punctuation, and simple bullet points.`;
}

// Verified active models in order of speed and available quota
const MODELS = [
    'models/gemini-flash-lite-latest',
    'models/gemini-3.1-flash-lite',
    'models/gemini-3.6-flash'
];

let geminiCooldownUntil = 0;

async function tryGemini(contents, systemPrompt) {
    if (Date.now() < geminiCooldownUntil) {
        return null;
    }

    for (const model of MODELS) {
        try {
            // Enforce 8-second timeout per model so bot never hangs
            const generatePromise = ai.models.generateContent({
                model: model,
                contents: contents,
                config: { systemInstruction: systemPrompt }
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 8000)
            );

            const response = await Promise.race([generatePromise, timeoutPromise]);

            if (response && response.text) {
                return response.text;
            }
        } catch (error) {
            const status = error.status || 0;
            console.log(`Gemini ${model} error: ${error.message || status}`);
            // If quota error (429) or overloaded (503), try next model
            continue;
        }
    }
    // If all Gemini models failed, put on 3-minute cooldown and route to OpenRouter
    geminiCooldownUntil = Date.now() + (3 * 60 * 1000);
    return null;
}

async function generateAIResponse(history, newMessage, userProfile = null) {
    const systemPrompt = buildSystemPrompt(userProfile);

    const contents = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    contents.push({
        role: 'user',
        parts: [{ text: newMessage }]
    });

    // 1. Try Gemini models (ultra-fast primary)
    try {
        const geminiResult = await tryGemini(contents, systemPrompt);
        if (geminiResult) return geminiResult;
    } catch (e) {
        console.log("Gemini attempt error:", e.message);
    }

    // 2. Secondary fallback: OpenRouter GPT-4o
    try {
        console.log("⚡ Routing to OpenRouter GPT-4o...");
        return await callOpenRouter(history, newMessage, systemPrompt);
    } catch (openRouterError) {
        console.error("OpenRouter Error:", openRouterError.message || openRouterError);
        return "I'm having a brief moment! Both AI engines are currently busy. Please send your message again in a few seconds.";
    }
}

module.exports = {
    generateAIResponse
};
