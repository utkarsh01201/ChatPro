const { GoogleGenAI } = require('@google/genai');
const { callOpenRouter } = require('./openrouter');

// ─────────────────────────────────────────────────────────────
// Gemini
// ─────────────────────────────────────────────────────────────

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// Google Search grounding
const groundingTool = {
    googleSearch: {}
};


// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────

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

REAL-TIME KNOWLEDGE:
- When a question requires current, recent, changing, or time-sensitive information, use the available web search tool.
- Examples:
  • today's news
  • latest news
  • current prices
  • current technology
  • recent announcements
  • sports results
  • current company information
  • recent government information
- Never claim something is real-time unless it was actually obtained through available search.
- If current information cannot be verified, say so instead of inventing an answer.

CONVERSATION STYLE:
- Speak naturally and clearly.
- Match the user's language.
- If the user speaks Hindi or Hinglish, respond naturally in Hindi/Hinglish.
- Be friendly and supportive.
- Keep normal answers reasonably concise unless the user asks for detail.

USER MEMORY:
- You are chatting with ${name} ${username ? `(${username})` : ''}.
- Their name is ${name}.
- Remember their name and relevant stored facts.
- If the user asks "what is my name?", answer that their name is ${name}.
${factsList ? `- Known facts about ${name}: ${factsList}` : ''}

FONT STYLING:
- If the user asks for a specific font style such as Times New Roman, serif, cursive, script, gothic, monospace, bold, bubble, or small caps, use appropriate Unicode characters.

FORMATTING:
- Do NOT use markdown symbols like **, ###, or __ unless formatting code.
- Do NOT use LaTeX formatting.
- Use normal text and simple bullet points.
- Code blocks are allowed for programming code.

IMPORTANT:
- Answer the user's actual question directly.
- Do not unnecessarily repeat the question.
- Do not mention internal AI providers, models, APIs, fallback systems, or infrastructure.
- Present yourself simply as ChatPro AI.
`;
}


// ─────────────────────────────────────────────────────────────
// NORMAL GEMINI CHAT
// ─────────────────────────────────────────────────────────────

const MODELS = [
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite'
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

                model,

                contents,

                config: {
                    systemInstruction: systemPrompt,

                    tools: [
                        groundingTool
                    ]
                }

            });

            const timeoutPromise = new Promise((_, reject) => {

                setTimeout(
                    () => reject(new Error('Gemini request timeout')),
                    20000
                );

            });

            const response = await Promise.race([
                generatePromise,
                timeoutPromise
            ]);

            if (response && response.text) {

                console.log(
                    `✅ Gemini responded using ${model}`
                );

                let answer = response.text;

                // Extract Google Search sources
                try {

                    const chunks =
                        response.candidates?.[0]
                            ?.groundingMetadata
                            ?.groundingChunks || [];

                    const sources = [];

                    for (const chunk of chunks) {

                        const web = chunk?.web;

                        if (
                            web?.uri &&
                            !sources.some(
                                source =>
                                    source.uri === web.uri
                            )
                        ) {

                            sources.push({
                                title:
                                    web.title ||
                                    'Source',

                                uri:
                                    web.uri
                            });

                        }

                    }

                    if (sources.length > 0) {

                        const sourceLines =
                            sources
                                .slice(0, 5)
                                .map(
                                    source =>
                                        `• ${source.title}\n  ${source.uri}`
                                )
                                .join('\n');

                        answer +=
                            `\n\n🌐 Sources:\n${sourceLines}`;

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

            console.log(
                `Gemini ${model} error:`,
                error.message ||
                error.status ||
                'unknown error'
            );

            continue;
        }
    }

    console.log(
        '⚠️ All Gemini models failed. Using OpenRouter fallback.'
    );

    geminiCooldownUntil =
        Date.now() + (30 * 1000);

    return null;
}


// ─────────────────────────────────────────────────────────────
// NORMAL AI RESPONSE
// ─────────────────────────────────────────────────────────────

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
            'Gemini attempt error:',
            error.message
        );

    }

    // Fallback
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

        return "I'm having a brief moment! Please try sending your message again in a few seconds.";

    }
}


// ─────────────────────────────────────────────────────────────
// 🖼️ IMAGE UNDERSTANDING
// ─────────────────────────────────────────────────────────────

async function analyzeImage(
    imageBuffer,
    mimeType = 'image/jpeg',
    userQuestion = 'Describe this image in detail.'
) {

    if (!imageBuffer) {
        throw new Error('No image data received.');
    }

    // Convert Telegram image bytes → Base64
    const base64Image =
        imageBuffer.toString('base64');

    const imageModels = [
        'gemini-3.8-flash',
        'gemini-2.5-flash-lite'
    ];

    for (const model of imageModels) {

        try {

            console.log(
                `🖼️ Sending image to Gemini: ${model}`
            );

            const response =
                await ai.models.generateContent({

                    model,

                    contents: [

                        {
                            inlineData: {
                                mimeType,
                                data: base64Image
                            }
                        },

                        {
                            text: `You are ChatPro AI's image understanding system.

Analyze the image carefully and answer the user's question.

User's question:
${userQuestion}

Instructions:
- Describe only what is actually visible.
- Do not invent objects, people, text, locations, or events.
- If something is uncertain, clearly say that it is uncertain.
- If the user asks "what is this?", identify the main subject of the image.
- If there is readable text, mention it.
- If the image contains a screenshot, explain what is shown.
- If the image contains an object, explain what the object appears to be.
- If the user asks a specific question, answer that question directly.
- Keep the response natural and useful.
`
                        }

                    ]

                });

            if (
                response &&
                response.text
            ) {

                console.log(
                    `✅ Image analyzed successfully using ${model}`
                );

                return response.text;

            }

        } catch (error) {

            console.error(
                `❌ Image analysis failed with ${model}:`,
                error.message ||
                error
            );

        }

    }

    throw new Error(
        'All Gemini image analysis models failed.'
    );
}


// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

module.exports = {

    generateAIResponse,

    analyzeImage

};
