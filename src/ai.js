const { GoogleGenAI } = require('@google/genai');
const { callOpenRouter } = require('./openrouter');

// Initialize the Gemini client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

function buildSystemPrompt(userProfile) {
    const name = userProfile?.preferredName || userProfile?.firstName || 'Utkarsh';
    const username = userProfile?.username ? `@${userProfile.username}` : '';
    const factsList = userProfile?.facts?.length
        ? userProfile.facts.join('; ')
        : '';

    // Always calculate the current date/time dynamically
    const currentDateTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
    });

    return `You are ChatPro AI, a highly emotionally intelligent and empathetic AI assistant on Telegram.

CURRENT DATE AND TIME:
- The current date and time is ${currentDateTime}.
- The user is in India unless their context indicates otherwise.
- Always use this date and time when answering questions about today, tomorrow, yesterday, this week, this month, or the current time.
- Never invent, guess, or assume an old current date.
- If the user asks for today's date, use the CURRENT DATE AND TIME above.

CONVERSATION STYLE:
Speak clearly, naturally, and warmly.
Match the user's language and style.
If the user speaks Hindi/Hinglish, you may naturally respond in Hindi/Hinglish.
If they are happy, be enthusiastic.
If they are sad or frustrated, be comforting and supportive.
Do not overreact to casual messages.
Keep normal answers reasonably concise unless the user asks for detail.

PERMANENT USER MEMORY:
- You are chatting with ${name} ${username ? `(${username})` : ''}.
- Their name is ${name}.
- You ALWAYS remember who you are speaking to, even across new chats, cleared conversations, or fresh sessions.
- If the user asks "what is my name?", "do you know me?", or tests your memory, tell them their name is ${name} with confidence and warmth.
- NEVER say you don't know their name or that you haven't been properly introduced.
${factsList ? `- Known facts about ${name}: ${factsList}` : ''}

FONT STYLING:
If the user asks to write text or their name in a specific font such as Times New Roman, serif, cursive, script, gothic, monospace, bold, bubble, or small caps, write it using appropriate Unicode characters when possible.
Never say you cannot change fonts on Telegram.

IMPORTANT FORMATTING:
- Do NOT use markdown symbols like **, ###, or __ unless formatting code.
- Do NOT use LaTeX math formatting.
- Use plain text, standard punctuation, and simple bullet points.
- For programming code, use code blocks when appropriate.

ANSWER QUALITY:
- Answer the user's actual question directly.
- Do not unnecessarily repeat the user's question.
- Do not mention internal AI providers, models, APIs, fallback systems, or infrastructure.
- Present yourself simply as ChatPro AI.
`;
}

// Fast models first
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
            console.log(`⚡ Trying Gemini model: ${model}`);

            const generatePromise = ai.models.generateContent({
                model: model,
                contents: contents,
                config: {
                    systemInstruction: systemPrompt
                }
            });

            // Maximum 8 seconds per Gemini model
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Gemini request timeout')), 8000)
            );

            const response = await Promise.race([
                generatePromise,
                timeoutPromise
            ]);

            if (response && response.text) {
                console.log(`✅ Gemini responded using ${model}`);
                return response.text;
            }

        } catch (error) {
            const status = error.status || 0;

            console.log(
                `Gemini ${model} error: ${error.message || status}`
            );

            // Try the next model
            continue;
        }
    }

    // All Gemini models failed
    console.log('⚠️ All Gemini models failed. Using OpenRouter fallback.');

    // Short cooldown instead of waiting several minutes
    geminiCooldownUntil = Date.now() + (30 * 1000);

    return null;
}

async function generateAIResponse(
    history,
    newMessage,
    userProfile = null
) {
    const systemPrompt = buildSystemPrompt(userProfile);

    const contents = history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [
            {
                text: msg.text
            }
        ]
    }));

    contents.push({
        role: 'user',
        parts: [
            {
                text: newMessage
            }
        ]
    });

    // ─────────────────────────────────────────────
    // 1. Primary AI
    // ─────────────────────────────────────────────

    try {
        const geminiResult = await tryGemini(
            contents,
            systemPrompt
        );

        if (geminiResult) {
            return geminiResult;
        }

    } catch (error) {
        console.log(
            'Gemini attempt error:',
            error.message
        );
    }

    // ─────────────────────────────────────────────
    // 2. Fallback AI
    // ─────────────────────────────────────────────

    try {
        console.log('⚡ Routing to fallback AI...');

        return await callOpenRouter(
            history,
            newMessage,
            systemPrompt
        );

    } catch (openRouterError) {

        console.error(
            'Fallback AI error:',
            openRouterError.message || openRouterError
        );

        return "I'm having a brief moment! Please try sending your message again in a few seconds.";
    }
}

module.exports = {
    generateAIResponse
};
