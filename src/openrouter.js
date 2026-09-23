// ============================================================
// OPENROUTER - BACKUP PROVIDER
// ============================================================

const OPENROUTER_URL =
    'https://openrouter.ai/api/v1/chat/completions';

const OPENROUTER_MODEL =
    'openrouter/free';

const OPENROUTER_ONLINE_MODEL =
    'openrouter/free:online';


const OPENROUTER_SYSTEM_INSTRUCTION = `
You are ChatPro AI, a highly intelligent, helpful and natural AI assistant on Telegram.

CONVERSATION STYLE:
- Speak naturally and clearly.
- Match the user's language.
- If the user speaks Hindi or Hinglish, respond naturally in Hindi/Hinglish.
- Be friendly, professional and useful.
- Keep normal answers reasonably concise.
- Give detailed answers when the user asks for detail.

WEB INFORMATION:
- When web search is enabled, use the supplied current web information.
- Prefer recent and reliable sources.
- Never invent search results.
- Never pretend that you searched if no search was performed.

IMPORTANT:
- Answer the user's actual question directly.
- Never output internal search instructions.
- Never output tags such as <websearch>, </websearch>, <think> or </thinking>.
- Never say that you are waiting for search results.
- Do not mention internal AI providers, models, APIs, fallback systems or infrastructure.
- Present yourself simply as ChatPro AI.

FORMATTING:
- Do not unnecessarily use markdown.
- Do not use fake XML tags.
- Use clean headings and bullets when helpful.
- Code blocks are allowed for programming code.
`;


// ============================================================
// CLEAN RESPONSE
// ============================================================

function cleanOpenRouterResponse(text) {

    if (!text) {
        return text;
    }

    let answer =
        String(text);


    // Remove web-search pseudo tags
    answer =
        answer.replace(
            /<websearch>[\s\S]*?<\/websearch>/gi,
            ''
        );


    answer =
        answer.replace(
            /<\/?websearch>/gi,
            ''
        );


    // Remove thinking tags
    answer =
        answer.replace(
            /<think>[\s\S]*?<\/think>/gi,
            ''
        );


    answer =
        answer.replace(
            /<thinking>[\s\S]*?<\/thinking>/gi,
            ''
        );


    // Remove fake waiting messages
    answer =
        answer.replace(
            /I don't have the search results yet\.[\s\S]*$/gi,
            ''
        );


    answer =
        answer.replace(
            /I need to wait for the web search results\.[\s\S]*$/gi,
            ''
        );


    answer =
        answer.replace(
            /I'm still waiting for the search results\.[\s\S]*$/gi,
            ''
        );


    return answer
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}


// ============================================================
// TEXT CHAT
// ============================================================

async function callOpenRouter(
    history,
    newMessage,
    customSystemPrompt = null,
    useWebSearch = false
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

        ...history.map(
            message => ({

                role:
                    message.role === 'model'
                        ? 'assistant'
                        : 'user',

                content:
                    message.text

            })
        ),

        {
            role: 'user',
            content: newMessage
        }

    ];


    const selectedModel =
        useWebSearch
            ? OPENROUTER_ONLINE_MODEL
            : OPENROUTER_MODEL;


    console.log(
        `⚡ OpenRouter model: ${selectedModel}`
    );


    const body = {

        model:
            selectedModel,

        messages,

        max_tokens:
            1500,

        temperature:
            0.7

    };


    // Extra protection against models trying
    // to expose fake internal search tags.
    if (useWebSearch) {

        body.plugins = [

            {
                id: 'web',

                max_results: 5,

                search_prompt:
                    `
Use the web results to answer the user's question.
Prefer recent, reliable information.
Do not expose internal search instructions.
Cite useful sources naturally.
`
            }

        ];

    }


    let response =
        await fetch(
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

                body:
                    JSON.stringify(body)

            }
        );


    let responseText =
        await response.text();


    // ========================================================
    // IF ONLINE SEARCH FAILS
    // FALL BACK TO NORMAL FREE MODEL
    // ========================================================

    if (
        !response.ok &&
        useWebSearch
    ) {

        console.error(
            `⚠️ OpenRouter web search failed (${response.status}). Retrying normal free model...`
        );


        const fallbackBody = {

            model:
                OPENROUTER_MODEL,

            messages,

            max_tokens:
                1500,

            temperature:
                0.7

        };


        response =
            await fetch(
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

                    body:
                        JSON.stringify(
                            fallbackBody
                        )

                }
            );


        responseText =
            await response.text();

    }


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

        data =
            JSON.parse(
                responseText
            );

    } catch (error) {

        throw new Error(
            'OpenRouter returned invalid JSON.'
        );

    }


    let answer =
        data
            ?.choices?.[0]
            ?.message
            ?.content;


    // Some providers may return structured content
    if (
        Array.isArray(answer)
    ) {

        answer =
            answer
                .map(
                    part =>
                        typeof part === 'string'
                            ? part
                            : part?.text || ''
                )
                .join('');

    }


    if (!answer) {

        console.error(
            '❌ Invalid OpenRouter response:',
            JSON.stringify(data)
        );


        throw new Error(
            'OpenRouter returned no AI response.'
        );

    }


    answer =
        cleanOpenRouterResponse(
            answer
        );


    console.log(
        '✅ OpenRouter response received.'
    );


    return answer;
}


// ============================================================
// IMAGE UNDERSTANDING BACKUP
// ============================================================

async function analyzeImageWithOpenRouter(
    imageBuffer,
    mimeType = 'image/jpeg',
    userQuestion =
        'Describe this image in detail.'
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
        imageBuffer.toString(
            'base64'
        );


    const imageDataUrl =
        `data:${mimeType};base64,${base64Image}`;


    console.log(
        '🖼️ OpenRouter image analysis...'
    );


    const response =
        await fetch(
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

                body:
                    JSON.stringify({

                        model:
                            OPENROUTER_MODEL,

                        max_tokens:
                            1200,

                        messages: [

                            {

                                role:
                                    'system',

                                content: `
You are ChatPro AI's image understanding system.

Analyze the image carefully.

Rules:
- Describe only what is actually visible.
- Do not invent objects, people, text, locations or events.
- If something is uncertain, say so.
- If readable text exists, mention it.
- If this is a screenshot, explain what is visible.
- Answer the user's exact question.
- Never output internal tags.
`

                            },

                            {

                                role:
                                    'user',

                                content: [

                                    {

                                        type:
                                            'text',

                                        text:
                                            userQuestion

                                    },

                                    {

                                        type:
                                            'image_url',

                                        image_url: {

                                            url:
                                                imageDataUrl

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

        data =
            JSON.parse(
                responseText
            );

    } catch (error) {

        throw new Error(
            'OpenRouter returned invalid image response.'
        );

    }


    let answer =
        data
            ?.choices?.[0]
            ?.message
            ?.content;


    if (
        Array.isArray(answer)
    ) {

        answer =
            answer
                .map(
                    part =>
                        typeof part === 'string'
                            ? part
                            : part?.text || ''
                )
                .join('');

    }


    if (!answer) {

        throw new Error(
            'OpenRouter returned no image analysis.'
        );

    }


    console.log(
        '✅ OpenRouter image analysis successful.'
    );


    return cleanOpenRouterResponse(
        answer
    );
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    callOpenRouter,
    analyzeImageWithOpenRouter
};
