const { GoogleGenAI } = require('@google/genai');
const { callOpenRouter } = require('./openrouter');

// Initialize Gemini
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Google Search grounding
// Gemini automatically decides when web search is useful.
const groundingTool = {
    googleSearch: {}
};

function buildSystemPrompt(userProfile) {
    const name =
        userProfile?.preferredName ||
        userProfile?.firstName ||
        'Utkarsh';

    const username = userProfile?.username
        ? `@${userProfile.username}`
        : '';

    const factsList = userProfile?.facts?.length
        ? userProfile.facts.join('; ')
        : '';

    // Current India date/time
    const currentDateTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'short'
    });

    return `You are ChatPro AI, a highly intelligent, helpful and natural AI assistant on Telegram.

CURRENT DATE AND TIME:
- The current date and time in India is ${currentDateTime}.
- Use this date and time when answering questions about today, tomorrow, yesterday, this week, this month, or the current time.
- Never invent or guess the current date.
- Knowing the current date does NOT mean you automatically know current events.

REAL-TIME KNOWLEDGE:
- You have access to Google Search when the search tool is available.
- When a question requires current, recent, changing, or time-sensitive information, use Google Search.
- Examples include:
  • today's news
  • latest news
  • current events
  • current prices
  • stock or crypto prices
  • current weather
  • recent software versions
  • latest technology
  • recent political or government information
  • sports results
  • current company information
  • recent announcements
  • anything that may have changed after your training knowledge
- For stable/general questions that do not require fresh information, answer directly without unnecessary searching.
- Never claim that information is real-time unless you actually obtained it through the available search tool.
- When web search results are available, base time-sensitive claims on those results.
- If current information cannot be verified, clearly say so instead of inventing an answer.

CONVERSATION STYLE:
- Speak naturally and clearly.
- Match the user's language.
- If the user speaks Hindi or Hinglish, respond naturally in Hindi/Hinglish.
- Be friendly but do not overreact.
- Keep simple answers concise.
- Give detailed explanations when the user asks for them.

USER MEMORY:
- You are chatting with ${name} ${username ? `(${username})` : ''}.
- Their name is ${name}.
- Remember their name and relevant stored facts.
- If the user asks "what is my name?" or tests your memory, confidently tell them their name is ${name}.
${factsList ? `- Known facts about ${name}: ${factsList}` : ''}

FONT STYLING:
If the user asks for text in a particular font style such as serif, Times New Roman, cursive, script, gothic, monospace, bold, bubble, or small caps, use appropriate Unicode characters when possible.

FORMATTING:
- Do NOT use markdown symbols like **, ###, or __ unless formatting code.
- Do NOT use LaTeX formatting.
- Use normal text and simple bullet points.
- For programming code, code blocks are allowed.

IMPORTANT:
- Answer the user's actual question directly.
- Do not unnecessarily repeat the question.
- Do not mention Gemini, OpenRouter, Google Search, APIs, models, fallback systems, or internal infrastructure to the user.
- Present yourself simply as ChatPro AI.
`;
}

// Models
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
            console.log(`⚡ Trying Gemini: ${model}`);

            const generatePromise = ai.models.generateContent({
                model: model,
                contents: contents,

                config: {
                    systemInstruction: systemPrompt,

                    // Enable Google Search grounding
                    tools: [groundingTool]
                }
            });

            /*
             * Web searches can take longer than a normal AI response,
             * so allow up to 20 seconds.
             */
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error('AI request timeout')),
                    20000
                )
            );

            const response = await Promise.race([
                generatePromise,
                timeoutPromise
            ]);

            if (response && response.text) {
                console.log(`✅ Gemini responded using ${model}`);

                let answer = response.text;

                /*
                 * If Google Search was used, Gemini returns
                 * grounding metadata containing web sources.
                 *
                 * We add a small Sources section to the Telegram
                 * response so users can see where current info came from.
                 */
                try {
                    const metadata =
                        response.candidates?.[0]?.groundingMetadata;

                    const chunks =
                        metadata?.groundingChunks || [];

                    const sources = [];

                    for (const chunk of chunks) {
                        const web = chunk?.web;

                        if (
                            web?.uri &&
                            !sources.some(
                                source => source.uri === web.uri
                            )
                        ) {
                            sources.push({
                                title: web.title || 'Source',
                                uri: web.uri
                            });
                        }
                    }

                    if (sources.length > 0) {
                        const sourceLines = sources
                            .slice(0, 5)
                            .map(
                                source =>
                                    `• ${source.title}\n  ${source.uri}`
                            )
                            .join('\n');

                        answer += `\n\n🌐 Sources:\n${sourceLines}`;
                    }

                } catch (sourceError) {
                    console.log(
                        'Source extraction skipped:',
                        sourceError.message
                    );
                }

                return answer;
            }

        } catch (error) {
            const status = error.status || 0;

            console.log(
                `Gemini ${model} error: ${error.message || status}`
            );

            // Try next model
            continue;
        }
    }

    console.log(
        '⚠️ Gemini models unavailable. Using fallback.'
    );

    // Short cooldown
    geminiCooldownUntil =
        Date.now() + (30 * 1000);

    return null;
}

async function generateAIResponse(
    history,
    newMessage,
    userProfile = null
) {
    const systemPrompt =
        buildSystemPrompt(userProfile);

    const contents = history.map(msg => ({
        role:
            msg.role === 'model'
                ? 'model'
                : 'user',

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
    // PRIMARY AI + WEB SEARCH
    // ─────────────────────────────────────────────

    try {
        const geminiResult =
            await tryGemini(
                contents,
                systemPrompt
            );

        if (geminiResult) {
            return geminiResult;
        }

    } catch (error) {
        console.log(
            'Gemini error:',
            error.message
        );
    }

    // ─────────────────────────────────────────────
    // FALLBACK
    // ─────────────────────────────────────────────

    try {
        console.log(
            '⚡ Routing to fallback AI...'
        );

        return await callOpenRouter(
            history,
            newMessage,
            systemPrompt
        );

    } catch (error) {

        console.error(
            'Fallback AI error:',
            error.message || error
        );

        return "I'm having a brief moment! Please send your message again in a few seconds.";
    }
}

module.exports = {
    generateAIResponse
};If they are sad or frustrated, be comforting and supportive.
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
