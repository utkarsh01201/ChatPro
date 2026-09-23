// ─────────────────────────────────────────────────────────────
// OpenRouter AI - BACKUP PROVIDER
// ─────────────────────────────────────────────────────────────

const OPENROUTER_URL =
    'https://openrouter.ai/api/v1/chat/completions';

const OPENROUTER_MODEL =
    'openrouter/free';

const OPENROUTER_SYSTEM_INSTRUCTION = `
You are ChatPro AI, a highly intelligent, helpful and natural AI assistant on Telegram.

CONVERSATION STYLE:
- Speak naturally and clearly.
- Match the user's language.
- If the user speaks Hindi or Hinglish, respond naturally in Hindi/Hinglish.
- Be friendly and supportive.
- Keep normal answers reasonably concise unless the user asks for detail.

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
- Do not mention internal AI providers, models, APIs, fallback systems or infrastructure.
- Present yourself simply as ChatPro AI.
`;


// ─────────────────────────────────────────────────────────────
// TEXT CHAT
// ─────────────────────────────────────────────────────────────

async function callOpenRouter(
    history,
    newMessage,
    customSystemPrompt = null
) {

    const apiKey =
        process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error(
            'OPENROUTER_API_KEY is missing from environment variables.'
        );
    }

    const systemPrompt =
        customSystemPrompt ||
        OPENROUTER_SYSTEM_INSTRUCTION;

    const messages = [
        {
            role: 'system',
            content: systemPrompt
        },

        ...history.map(message => ({
            role:
                message.role === 'model'
                    ? 'assistant'
                    : 'user',
            content: message.text
        })),

        {
            role: 'user',
            content: newMessage
        }
    ];

    console.log(
        `⚡ Using OpenRouter backup: ${OPENROUTER_MODEL}`
    );

    const response = await fetch(
        OPENROUTER_URL,
        {
            method: 'POST',

            headers: {
                'Authorization':
                    `Bearer ${apiKey}`,

                'Content-Type':
                    'application/json',

                'HTTP-Referer':
                    'https://t.me/chat_pro_robot',

                'X-Title':
                    'ChatPro AI'
            },

            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages,
                max_tokens: 1000,
                temperature: 0.7
            })
        }
    );

    const responseText =
        await response.text();

    if (!response.ok) {

        console.error(
            `❌ OpenRouter HTTP ${response.status}:`,
            responseText
        );

        throw new Error(
            `OpenRouter HTTP ${response.status}: ${responseText}`
        );
    }

    let data;

    try {
        data = JSON.parse(responseText);
    } catch (error) {
        throw new Error(
            'OpenRouter returned invalid JSON.'
        );
    }

    const answer =
        data?.choices?.[0]?.message?.content;

    if (!answer) {

        console.error(
            '❌ Invalid OpenRouter response:',
            JSON.stringify(data)
        );

        throw new Error(
            'OpenRouter returned no AI response.'
        );
    }

    console.log(
        '✅ OpenRouter backup response received.'
    );

    return answer;
}


// ─────────────────────────────────────────────────────────────
// IMAGE UNDERSTANDING BACKUP
// ─────────────────────────────────────────────────────────────

async function analyzeImageWithOpenRouter(
    imageBuffer,
    mimeType = 'image/jpeg',
    userQuestion = 'Describe this image in detail.'
) {

    if (!imageBuffer) {
        throw new Error(
            'No image data received.'
        );
    }

    const apiKey =
        process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error(
            'OPENROUTER_API_KEY is missing from environment variables.'
        );
    }

    const base64Image =
        imageBuffer.toString('base64');

    const imageDataUrl =
        `data:${mimeType};base64,${base64Image}`;

    console.log(
        '🖼️ Using OpenRouter backup for image analysis...'
    );

    const response = await fetch(
        OPENROUTER_URL,
        {
            method: 'POST',

            headers: {
                'Authorization':
                    `Bearer ${apiKey}`,

                'Content-Type':
                    'application/json',

                'HTTP-Referer':
                    'https://t.me/chat_pro_robot',

                'X-Title':
                    'ChatPro AI'
            },

            body: JSON.stringify({

                model:
                    OPENROUTER_MODEL,

                max_tokens:
                    1000,

                messages: [

                    {
                        role: 'system',

                        content: `
You are ChatPro AI's image understanding system.

Analyze the image carefully and answer the user's question.

Rules:
- Describe only what is actually visible.
- Do not invent objects, people, text, locations or events.
- If something is uncertain, clearly say that it is uncertain.
- If the user asks "what is this?", identify the main subject.
- If there is readable text, mention it.
- If the image contains a screenshot, explain what is shown.
- If the image contains an object, explain what the object appears to be.
- Answer the user's specific question directly.
- Keep the response natural and useful.
`
                    },

                    {
                        role: 'user',

                        content: [

                            {
                                type: 'text',
                                text: userQuestion
                            },

                            {
                                type: 'image_url',

                                image_url: {
                                    url: imageDataUrl
                                }
                            }

                        ]
                    }

                ]

            })
        }
    );

    const responseText =
        await response.text();

    if (!response.ok) {

        console.error(
            `❌ OpenRouter image HTTP ${response.status}:`,
            responseText
        );

        throw new Error(
            `OpenRouter image HTTP ${response.status}: ${responseText}`
        );
    }

    let data;

    try {
        data = JSON.parse(responseText);
    } catch (error) {
        throw new Error(
            'OpenRouter returned invalid image response.'
        );
    }

    const answer =
        data?.choices?.[0]?.message?.content;

    if (!answer) {
        throw new Error(
            'OpenRouter returned no image analysis.'
        );
    }

    console.log(
        '✅ OpenRouter image analysis successful.'
    );

    return answer;
}


// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

module.exports = {
    callOpenRouter,
    analyzeImageWithOpenRouter
};
