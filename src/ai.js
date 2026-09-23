const { GoogleGenAI } = require('@google/genai');

const {
    callOpenRouter,
    analyzeImageWithOpenRouter
} = require('./openrouter');


// ============================================================
// GEMINI - PRIMARY
// ============================================================

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});


// ============================================================
// GEMINI MODELS
// ============================================================

const MODELS = [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite'
];


// ============================================================
// GEMINI GOOGLE SEARCH
// ============================================================

const groundingTool = {
    googleSearch: {}
};


// ============================================================
// GEMINI COOLDOWN
// ============================================================

let geminiCooldownUntil = 0;

const GEMINI_COOLDOWN =
    60 * 1000;


// ============================================================
// GROQ COOLDOWN
// ============================================================

let groqCooldownUntil = 0;

const GROQ_COOLDOWN =
    60 * 1000;


// ============================================================
// ADAPTIVE WEB SEARCH DETECTION
// ============================================================

function needsWebSearch(message) {

    if (!message) {
        return false;
    }

    const text =
        String(message)
            .toLowerCase()
            .trim();


    // ========================================================
    // EXPLICIT SEARCH REQUESTS
    // ========================================================

    const explicitSearchPatterns = [

        'search web',
        'search the web',
        'check web',
        'check the web',
        'browse web',
        'browse the web',
        'web search',
        'search online',
        'find online',
        'find it online',
        'look it up',
        'look this up',
        'google it',
        'search for it',
        'search this',
        'search this online',
        'verify online',
        'verify this',
        'check online',
        'check internet',
        'search internet',
        'check latest online',
        'check current information',
        'look online',
        'look on the internet'

    ];


    if (
        explicitSearchPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return true;

    }


    // ========================================================
    // CURRENT / RECENT INFORMATION
    // ========================================================

    const currentPatterns = [

        'latest',
        'recent',
        'recently',
        'currently',
        'current',
        'right now',
        'today',
        'tonight',
        'yesterday',
        'tomorrow',
        'this week',
        'this month',
        'this year',
        'breaking news',
        'recent news',
        'latest news',
        'live update',
        'live updates',
        'real time',
        'realtime',
        'as of now',
        'as of today',
        'as of this week',
        'updated information',
        'updated knowledge',
        'what is happening',
        'what happened today',
        'what happened recently',
        '2026'

    ];


    if (
        currentPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return true;

    }


    // ========================================================
    // FAST-CHANGING INFORMATION
    // ========================================================

    const changingPatterns = [

        'weather',
        'temperature',
        'forecast',
        'rain today',
        'rain tomorrow',
        'stock price',
        'share price',
        'crypto price',
        'bitcoin price',
        'ethereum price',
        'gold price',
        'silver price',
        'petrol price',
        'diesel price',
        'fuel price',
        'exchange rate',
        'usd to inr',
        'inr to usd',
        'price of',
        'cost of',
        'ticket price',
        'flight price',
        'hotel price',
        'opening hours',
        'open now',
        'closed today',
        'traffic',
        'outage',
        'server status',
        'availability',
        'available now'

    ];


    if (
        changingPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return true;

    }


    // ========================================================
    // NEWS / EVENTS / SPORTS
    // ========================================================

    const eventPatterns = [

        'news about',
        'news on',
        'news regarding',
        'news today',
        'news right now',
        'what happened',
        'happening now',
        'happening today',
        'upcoming event',
        'upcoming events',
        'event today',
        'event tomorrow',
        'match today',
        'match tomorrow',
        'live score',
        'live scores',
        'score today',
        'scores today',
        'standings',
        'election result',
        'election results',
        'results today',
        'result today',
        'match result',
        'match results'

    ];


    if (
        eventPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return true;

    }


    // ========================================================
    // CURRENT SOFTWARE / TECHNOLOGY
    // ========================================================

    const versionPatterns = [

        'latest version',
        'current version',
        'new version',
        'release notes',
        'recent update',
        'latest update',
        'current api',
        'latest api',
        'latest model',
        'current model',
        'supported model',
        'available now',
        'released today',
        'released recently',
        'new release',
        'latest release',
        'current documentation',
        'latest documentation'

    ];


    if (
        versionPatterns.some(
            pattern =>
                text.includes(pattern)
        )
    ) {

        return true;

    }


    return false;
}


// ============================================================
// TELEGRAM RESPONSE FORMATTER
// ============================================================

function formatForTelegram(text) {

    if (!text) {
        return '';
    }


    let answer =
        String(text);


    // ========================================================
    // REMOVE INTERNAL TAGS
    // ========================================================

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


    answer =
        answer.replace(
            /<analysis>[\s\S]*?<\/analysis>/gi,
            ''
        );


    // ========================================================
    // REMOVE SEARCH-WAITING GARBAGE
    // ========================================================

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


    answer =
        answer.replace(
            /waiting for (?:the )?(?:web )?search results[\s\S]*$/gi,
            ''
        );


    // ========================================================
    // PROTECT CODE BLOCKS
    // ========================================================

    const codeBlocks = [];


    answer =
        answer.replace(
            /```[\s\S]*?```/g,
            block => {

                const token =
                    `__CHATPRO_CODE_${codeBlocks.length}__`;

                codeBlocks.push(block);

                return token;
            }
        );


    // ========================================================
    // MARKDOWN HEADINGS → TELEGRAM HEADINGS
    // ========================================================

    answer =
        answer.replace(
            /^\s*#{4,}\s*/gm,
            ''
        );


    answer =
        answer.replace(
            /^\s*###\s*(.+)$/gm,
            '🔹 $1'
        );


    answer =
        answer.replace(
            /^\s*##\s*(.+)$/gm,
            '🔹 $1'
        );


    answer =
        answer.replace(
            /^\s*#\s*(.+)$/gm,
            '🎯 $1'
        );


    // ========================================================
    // BOLD / ITALIC MARKDOWN
    // ========================================================

    answer =
        answer.replace(
            /\*\*(.*?)\*\*/gs,
            '$1'
        );


    answer =
        answer.replace(
            /__(.*?)__/gs,
            '$1'
        );


    answer =
        answer.replace(
            /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
            '$1'
        );


    answer =
        answer.replace(
            /(?<!_)_([^_\n]+)_(?!_)/g,
            '$1'
        );


    // ========================================================
    // BLOCKQUOTES
    // ========================================================

    answer =
        answer.replace(
            /^\s*>\s?/gm,
            '💬 '
        );


    // ========================================================
    // HORIZONTAL LINES
    // ========================================================

    answer =
        answer.replace(
            /^\s*[-*_]{3,}\s*$/gm,
            ''
        );


    // ========================================================
    // BULLETS
    // ========================================================

    answer =
        answer.replace(
            /^\s*[-*+]\s+/gm,
            '• '
        );


    // ========================================================
    // MARKDOWN LINKS
    // ========================================================

    answer =
        answer.replace(
            /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            '$1 — $2'
        );


    // ========================================================
    // INLINE CODE
    // ========================================================

    answer =
        answer.replace(
            /`([^`\n]+)`/g,
            '$1'
        );


    // ========================================================
    // CLEAN SOURCE HEADINGS
    // ========================================================

    answer =
        answer.replace(
            /^\s*🌐\s*Sources?\s*:?\s*$/gim,
            '🌐 Sources'
        );


    answer =
        answer.replace(
            /^\s*Sources?\s*:?\s*$/gim,
            '🌐 Sources'
        );


    // ========================================================
    // REMOVE EXCESSIVE SPACING
    // ========================================================

    answer =
        answer.replace(
            /[ \t]+\n/g,
            '\n'
        );


    answer =
        answer.replace(
            /\n{4,}/g,
            '\n\n'
        );


    // ========================================================
    // REMOVE EMPTY BULLETS
    // ========================================================

    answer =
        answer.replace(
            /^\s*•\s*$/gm,
            ''
        );


    // ========================================================
    // RESTORE CODE BLOCKS
    // ========================================================

    codeBlocks.forEach(
        (block, index) => {

            answer =
                answer.replace(
                    `__CHATPRO_CODE_${index}__`,
                    block
                );

        }
    );


    return answer.trim();
}


// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt(
    userProfile,
    useWebSearch = false
) {

    const name =
        userProfile?.preferredName ||
        userProfile?.firstName ||
        'Utkarsh';


    const username =
        userProfile?.username
            ? `@${userProfile.username}`
            : '';


    const factsList =
        userProfile?.facts?.length
            ? userProfile.facts.join('; ')
            : '';


    const currentDateTime =
        new Date().toLocaleString(
            'en-IN',
            {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'full',
                timeStyle: 'short'
            }
        );


    return `
You are ChatPro AI — a smart, modern, friendly and highly capable AI assistant designed for Telegram.

Your job is not merely to provide information.

Your job is to make information:
• Clear
• Useful
• Interesting
• Easy to understand
• Visually organized
• Natural to read
• Professional when needed


============================================================
CURRENT DATE AND TIME
============================================================

Current India date and time:
${currentDateTime}

Use this for questions involving:
today
tomorrow
yesterday
this week
this month
this year

Never invent the current date.


============================================================
WEB SEARCH
============================================================

Web search is ${
        useWebSearch
            ? 'ENABLED for this request.'
            : 'NOT REQUIRED for this request.'
    }.

${
    useWebSearch
        ? `
Use current web information when answering.

Verify important current claims.

Prefer reliable and recent information.

Do not dump raw search results into the answer.

Do not say:
"Here are the search results."

Do not say:
"According to my search..."

Instead, understand the information and explain it naturally.

If sources disagree, mention the disagreement and uncertainty.

Never expose internal search tools or search instructions.
`
        : `
Answer using your knowledge and the conversation context.

Do not pretend that you searched the web.
`
}


============================================================
RESPONSE DESIGN
============================================================

Every response should feel intentionally designed.

Think about:

1. What does the user actually need?
2. How complex is the topic?
3. What structure makes it easiest to understand?
4. Which details actually matter?
5. What should the user remember afterward?

Do not use the same template for every answer.

Simple question → simple answer.

Complex question → structured explanation.

News question → concise briefing.

Technical question → explanation + practical example.

Learning question → teach the concept.

Design question → describe visual direction and structure.

Casual question → conversational answer.


============================================================
CONTENT STRUCTURE
============================================================

Use a mixture of:

MAIN HEADING

Short introductory paragraph.

SUB-HEADING

Supporting paragraph.

• Bullet
• Bullet
• Bullet

Another short paragraph.

💡 Key takeaway

Use only the parts that genuinely help.

Do NOT force every response into a huge template.


============================================================
PARAGRAPHS
============================================================

Paragraphs are important.

Do not turn everything into bullets.

Use paragraphs when explaining:

• Context
• Meaning
• Reasoning
• Background
• Cause and effect
• Recommendations
• Concepts

Use bullets when listing:

• Features
• Steps
• Advantages
• Disadvantages
• Requirements
• Options
• Key facts


============================================================
HEADINGS
============================================================

Use attractive but professional headings.

Examples:

🎯 Overview

📰 What's happening

🔹 Key developments

💡 Why it matters

🧩 How it works

💻 Technical side

🎨 Design direction

✨ Visual style

📌 Important points

🚀 Next steps

🌐 Sources

Do not overuse headings.

Usually 2–5 meaningful sections are enough for a detailed answer.


============================================================
EDUCATIONAL ANSWERS
============================================================

When teaching something:

Start with the simplest explanation.

Then explain the idea.

Then show how it works.

Then give an example.

Then provide a short takeaway.

Example structure:

🎯 Binary Search

Binary search is a faster way to find an element in a sorted array.

🧩 How it works

Instead of checking every element, it repeatedly cuts the search area in half.

• Check the middle
• Decide which half can contain the answer
• Ignore the other half
• Repeat

💡 Example

...

🚀 Remember

Binary search needs sorted data and runs in O(log n).


============================================================
TECHNICAL ANSWERS
============================================================

For programming questions:

• Explain before overwhelming with code.
• Use practical examples.
• Keep code correct.
• Preserve code blocks.
• Explain important lines afterward when useful.
• Mention common mistakes when relevant.
• Prefer real-world understanding over textbook definitions.


============================================================
NEWS / CURRENT INFORMATION
============================================================

When discussing current information:

Start with a short factual overview.

Then:

📰 What happened

Short paragraph.

🔹 Key developments

• Important development
• Important development
• Important development

📌 Context

Explain what led to the development if useful.

💡 Why it matters

Explain the practical significance.

🌐 Sources

Keep sources concise.

Never exaggerate.

Never present speculation as fact.

Clearly distinguish confirmed information from claims or reports.


============================================================
COMPARISONS
============================================================

For comparisons:

Start with the main difference in one short paragraph.

Then organize each side.

🔹 Option A

Short paragraph.

• Strength
• Limitation
• Best use

🔹 Option B

Short paragraph.

• Strength
• Limitation
• Best use

💡 Key difference

Give the practical distinction without declaring an unnecessary winner.


============================================================
PROJECT / WEBSITE / UI DESIGN
============================================================

When discussing website, application or UI design, think like a professional product designer.

Cover relevant areas such as:

🎨 Visual direction

Explain the overall visual personality.

🧩 Layout

Explain page structure and hierarchy.

🔤 Typography

Explain font style, scale and hierarchy.

🎨 Color system

Explain primary, secondary and accent colors.

✨ Micro-interactions

Mention hover effects, transitions, loading states and feedback.

📱 Responsive behavior

Mention desktop, tablet and mobile behavior.

♿ Accessibility

Mention readable contrast, keyboard navigation, labels and usable interaction where relevant.

The answer should feel like a real design specification rather than random feature ideas.


============================================================
LOGO / BRAND DESIGN
============================================================

When discussing a logo:

🎨 Concept

Explain the core visual idea.

🔷 Symbol

Explain the icon, shape or mark.

🎨 Color

Explain the color direction.

🔤 Typography

Explain the font direction.

💡 Brand meaning

Explain what the visual identity communicates.

📱 Applications

Consider:

• Website
• App
• Social media
• Profile picture
• Dark background
• Light background
• Print

Keep it professional and practical.


============================================================
CREATIVE ANSWERS
============================================================

For creative requests:

Be imaginative.

However, remain useful.

Use:

• Visual concepts
• Composition
• Mood
• Typography
• Color
• Layout
• Details
• Variations

Make ideas feel polished and production-ready.

Do not just throw random adjectives at the user.


============================================================
INTERESTING WRITING
============================================================

Write with personality.

Avoid robotic phrases such as:

"Certainly!"
"Of course!"
"Absolutely!"
"Here are the results!"
"Let's dive into this!"
"I hope this helps!"

Do not repeatedly say these.

Instead, begin naturally.

Example:

Bad:
"Certainly! Here is a comprehensive explanation of Java."

Better:
"Java becomes much easier once you understand one idea: objects combine data with the behavior that operates on that data."

Make important insights stand out naturally.

Useful phrases include:

💡 The key idea:

📌 The important part:

👉 In practice:

🚀 The takeaway:

Use these only when appropriate.


============================================================
PROFESSIONAL + ENTERTAINING
============================================================

Be professional without sounding corporate.

Be entertaining without becoming childish.

Be impressive through:

• Clarity
• Insight
• Structure
• Examples
• Good wording
• Useful details
• Strong organization

Not through:

• Excessive emojis
• Huge paragraphs
• Unnecessary headings
• Repetition
• Fake enthusiasm
• Sensational language


============================================================
TELEGRAM FORMATTING
============================================================

IMPORTANT:

The final response must be plain Telegram-friendly text.

DO NOT use:

#
##
###

DO NOT use:

**bold**

*italic*

---

___

Markdown blockquotes.

Instead use:

• bullets

1. numbered lists

Short paragraphs.

Professional emoji headings when useful.

Keep the visual hierarchy clean.


============================================================
EMOJI RULE
============================================================

Use emojis intelligently.

Good:

🎯 Overview
💡 Key takeaway
🚀 Next steps
🎨 Design
💻 Code
📰 News

Bad:

😀 Java is a programming language.
🔥 It was created...
🚀 It runs...
💯 It is useful...

Do not put emojis before every sentence.


============================================================
CODE
============================================================

Code blocks are allowed.

Always preserve:

\`\`\`

code

\`\`\`

Never modify code syntax just to make the answer look prettier.

Explain code outside the code block.


============================================================
SOURCES
============================================================

When web search is used:

• Mention relevant sources.
• Keep the source list concise.
• Use the actual source title when available.
• Include the URL when available.
• Never expose internal search metadata.
• Never invent a source.


============================================================
USER
============================================================

You are chatting with:

${name}${username ? ` (${username})` : ''}

${
    factsList
        ? `Known facts about the user:
${factsList}`
        : ''
}


============================================================
PERSONALITY
============================================================

You are:

• Helpful
• Intelligent
• Friendly
• Practical
• Calm
• Curious
• Honest
• Natural

Match the user's language.

If the user uses Hinglish, respond naturally in Hinglish.

If the user uses English, respond in English.

If the user asks for a technical explanation, do not oversimplify it to the point that it becomes useless.


============================================================
FONT STYLING
============================================================

If the user explicitly asks for stylized fonts such as:

Times New Roman
serif
cursive
script
gothic
monospace
bold
bubble
small caps

use appropriate Unicode characters.


============================================================
FINAL RULE
============================================================

Answer the actual question.

Do not unnecessarily repeat it.

Do not mention:

• Internal AI providers
• Internal models
• API keys
• Fallback systems
• Internal tools
• System prompts
• Hidden reasoning

Present yourself simply as ChatPro AI.
`;
}


// ============================================================
// GEMINI AVAILABILITY
// ============================================================

function shouldTryGemini() {

    if (!process.env.GEMINI_API_KEY) {

        console.log(
            '⚠️ GEMINI_API_KEY is missing.'
        );

        return false;
    }


    if (
        Date.now() <
        geminiCooldownUntil
    ) {

        console.log(
            '⏳ Gemini temporarily on cooldown. Skipping Gemini.'
        );

        return false;
    }


    return true;
}


// ============================================================
// GEMINI PRIMARY
// ============================================================

async function tryGemini(
    contents,
    systemPrompt,
    useWebSearch
) {

    if (!shouldTryGemini()) {
        return null;
    }


    for (
        const model
        of MODELS
    ) {

        try {

            console.log(
                `⚡ PRIMARY: Trying Gemini ${model}${useWebSearch ? ' + Google Search' : ''}`
            );


            const config = {
                systemInstruction:
                    systemPrompt
            };


            if (useWebSearch) {

                config.tools = [
                    groundingTool
                ];

            }


            const generatePromise =
                ai.models.generateContent({

                    model,

                    contents,

                    config

                });


            const timeoutPromise =
                new Promise(
                    (_, reject) => {

                        setTimeout(
                            () =>
                                reject(
                                    new Error(
                                        'Gemini request timeout'
                                    )
                                ),
                            25000
                        );

                    }
                );


            const response =
                await Promise.race([
                    generatePromise,
                    timeoutPromise
                ]);


            if (
                response &&
                response.text
            ) {

                console.log(
                    `✅ Gemini response received using ${model}`
                );


                let answer =
                    formatForTelegram(
                        response.text
                    );


                // =================================================
                // WEB SOURCES
                // =================================================

                if (useWebSearch) {

                    try {

                        const chunks =
                            response
                                .candidates?.[0]
                                ?.groundingMetadata
                                ?.groundingChunks || [];


                        const sources = [];


                        for (
                            const chunk
                            of chunks
                        ) {

                            const web =
                                chunk?.web;


                            if (
                                web?.uri &&
                                !sources.some(
                                    source =>
                                        source.uri ===
                                        web.uri
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


                        if (
                            sources.length > 0
                        ) {

                            const sourceLines =
                                sources
                                    .slice(0, 5)
                                    .map(
                                        source =>
                                            `• ${source.title}\n  ${source.uri}`
                                    )
                                    .join('\n');


                            answer +=
                                `\n\n🌐 Sources\n\n${sourceLines}`;

                        }

                    } catch (error) {

                        console.log(
                            'Source extraction skipped:',
                            error.message
                        );

                    }

                }


                return formatForTelegram(
                    answer
                );

            }

        } catch (error) {

            const errorMessage =
                error?.message ||
                error?.status ||
                'unknown error';


            console.error(
                `❌ Gemini ${model} failed:`,
                errorMessage
            );


            const lowerError =
                String(
                    errorMessage
                ).toLowerCase();


            const quotaError =
                lowerError.includes('429') ||
                lowerError.includes('quota') ||
                lowerError.includes('resource exhausted') ||
                lowerError.includes('rate limit') ||
                lowerError.includes('too many requests');


            if (quotaError) {

                console.log(
                    '🚨 Gemini quota/rate limit detected.'
                );


                geminiCooldownUntil =
                    Date.now() +
                    GEMINI_COOLDOWN;


                break;

            }

        }

    }


    console.log(
        '⚠️ Gemini unavailable. Switching to Groq.'
    );


    return null;
}


// ============================================================
// GROQ FALLBACK
// ============================================================

function shouldTryGroq() {

    if (!process.env.GROQ_API_KEY) {

        console.log(
            '⚠️ GROQ_API_KEY is missing.'
        );

        return false;
    }


    if (
        Date.now() <
        groqCooldownUntil
    ) {

        console.log(
            '⏳ Groq temporarily on cooldown. Skipping Groq.'
        );

        return false;
    }


    return true;
}


// ============================================================
// GROQ TEXT RESPONSE
// ============================================================

async function tryGroq(
    history,
    newMessage,
    systemPrompt
) {

    if (!shouldTryGroq()) {
        return null;
    }


    try {

        console.log(
            '⚡ FALLBACK: Trying Groq openai/gpt-oss-20b'
        );


        const messages = [

            {
                role: 'system',
                content: systemPrompt
            }

        ];


        for (
            const message
            of (history || [])
        ) {

            let role = 'user';


            if (
                message.role === 'model' ||
                message.role === 'assistant'
            ) {

                role = 'assistant';

            }


            if (
                message.text &&
                String(
                    message.text
                ).trim()
            ) {

                messages.push({

                    role,

                    content:
                        String(
                            message.text
                        )

                });

            }

        }


        messages.push({

            role: 'user',

            content:
                String(
                    newMessage || ''
                )

        });


        const response =
            await fetch(
                'https://api.groq.com/openai/v1/chat/completions',
                {

                    method: 'POST',

                    headers: {

                        'Authorization':
                            `Bearer ${process.env.GROQ_API_KEY}`,

                        'Content-Type':
                            'application/json'

                    },

                    body:
                        JSON.stringify({

                            model:
                                'openai/gpt-oss-20b',

                            messages,

                            temperature:
                                0.7,

                            max_completion_tokens:
                                2048

                        }),

                    signal:
                        AbortSignal.timeout(
                            25000
                        )

                }
            );


        const raw =
            await response.text();


        let data = null;


        try {

            data =
                JSON.parse(
                    raw
                );

        } catch {

            data = null;

        }


        if (!response.ok) {

            const errorMessage =
                data?.error?.message ||
                raw.slice(0, 500) ||
                `HTTP ${response.status}`;


            console.error(
                `❌ Groq HTTP ${response.status}: ${errorMessage}`
            );


            const lowerError =
                String(
                    errorMessage
                ).toLowerCase();


            const quotaError =
                response.status === 429 ||
                lowerError.includes(
                    'rate limit'
                ) ||
                lowerError.includes(
                    'quota'
                ) ||
                lowerError.includes(
                    'too many requests'
                );


            if (quotaError) {

                groqCooldownUntil =
                    Date.now() +
                    GROQ_COOLDOWN;

            }


            return null;
        }


        const answer =
            data?.choices?.[0]?.message?.content;


        if (
            !answer ||
            !String(
                answer
            ).trim()
        ) {

            console.error(
                '❌ Groq returned an empty response.'
            );

            return null;
        }


        console.log(
            '✅ Groq response received.'
        );


        return formatForTelegram(
            String(
                answer
            )
        );


    } catch (error) {

        console.error(
            '❌ Groq fallback error:',
            error.message || error
        );


        return null;
    }
}


// ============================================================
// NORMAL AI RESPONSE
// ============================================================

async function generateAIResponse(
    history,
    newMessage,
    userProfile = null
) {

    const useWebSearch =
        needsWebSearch(
            newMessage
        );


    console.log(
        `🌐 Web search: ${useWebSearch ? 'ENABLED' : 'SKIPPED'}`
    );


    const systemPrompt =
        buildSystemPrompt(
            userProfile,
            useWebSearch
        );


    const contents =
        history.map(
            message => ({

                role:
                    message.role === 'model'
                        ? 'model'
                        : 'user',

                parts: [
                    {
                        text:
                            message.text
                    }
                ]

            })
        );


    contents.push({

        role: 'user',

        parts: [
            {
                text:
                    newMessage
            }
        ]

    });


    // ========================================================
    // GEMINI PRIMARY
    // ========================================================

    try {

        const geminiResult =
            await tryGemini(
                contents,
                systemPrompt,
                useWebSearch
            );


        if (geminiResult) {

            return formatForTelegram(
                geminiResult
            );

        }

    } catch (error) {

        console.error(
            'Gemini primary error:',
            error.message || error
        );

    }


    // ========================================================
    // GROQ BACKUP
    // ========================================================

    try {

        const groqResult =
            await tryGroq(
                history,
                newMessage,
                systemPrompt
            );


        if (groqResult) {

            return formatForTelegram(
                groqResult
            );

        }

    } catch (error) {

        console.error(
            'Groq backup error:',
            error.message || error
        );

    }


    // ========================================================
    // OPENROUTER BACKUP
    // ========================================================

    try {

        console.log(
            `🔄 BACKUP: OpenRouter${useWebSearch ? ' + Web Search' : ''}`
        );


        const answer =
            await callOpenRouter(
                history,
                newMessage,
                systemPrompt,
                useWebSearch
            );


        return formatForTelegram(
            answer
        );

    } catch (error) {

        console.error(
            '❌ OpenRouter backup error:',
            error.message || error
        );


        return "I'm having a brief moment right now. Please try sending your message again in a few seconds.";
    }
}


// ============================================================
// IMAGE / STICKER UNDERSTANDING
// ============================================================

async function analyzeImage(
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


    const base64Image =
        imageBuffer.toString(
            'base64'
        );


    // ========================================================
    // GEMINI IMAGE PRIMARY
    // ========================================================

    if (
        shouldTryGemini()
    ) {

        for (
            const model
            of MODELS
        ) {

            try {

                console.log(
                    `🖼️ PRIMARY: Gemini ${model} image analysis`
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
                                text: `
You are ChatPro AI's visual understanding system.

Study the image carefully and answer the user's request.

USER REQUEST:
${userQuestion}


============================================================
VISUAL ANALYSIS
============================================================

Pay attention to:

• Main subject
• Characters / people / animals
• Facial expression
• Emotion
• Pose or action
• Objects
• Clothing
• Colors
• Background
• Visible text
• Logos
• Symbols
• UI elements
• Overall mood


============================================================
STICKER ANALYSIS
============================================================

If the image is a Telegram sticker:

Explain:

🎭 What is shown

🙂 What expression or emotion is visible

💭 What the sticker appears to communicate

💬 How someone might naturally use it in a conversation

🎨 Important visual details

If it is an animated or video sticker and only a preview
frame is available, analyze only what is visible.

Do NOT claim that you observed movement that is not visible.


============================================================
SCREENSHOT ANALYSIS
============================================================

If it is a screenshot:

• Identify the application or interface if clearly visible.
• Explain important visible elements.
• Read visible text when possible.
• Identify errors or UI elements when relevant.
• Do not invent information outside the screenshot.


============================================================
ACCURACY
============================================================

Describe only what is actually visible.

Do not invent:

• People
• Objects
• Text
• Locations
• Events
• Brands

If something is uncertain, say that it is uncertain.

Answer the user's specific question first.

Keep the response natural, useful and interesting.

Use paragraphs for explanations.

Use bullets for lists.

Use a few relevant emoji headings when helpful.

Do not use Markdown headings.

Do not use:

**
*
#
##
###

Do not use horizontal separators.

Never output internal tags.
`
                            }

                        ]

                    });


                if (
                    response &&
                    response.text
                ) {

                    console.log(
                        `✅ Gemini image analysis successful using ${model}`
                    );


                    return formatForTelegram(
                        response.text
                    );

                }

            } catch (error) {

                const errorMessage =
                    error?.message ||
                    'unknown error';


                console.error(
                    `❌ Gemini image ${model} failed:`,
                    errorMessage
                );


                const lowerError =
                    String(
                        errorMessage
                    ).toLowerCase();


                const quotaError =
                    lowerError.includes('429') ||
                    lowerError.includes('quota') ||
                    lowerError.includes('resource exhausted') ||
                    lowerError.includes('rate limit') ||
                    lowerError.includes('too many requests');


                if (quotaError) {

                    geminiCooldownUntil =
                        Date.now() +
                        GEMINI_COOLDOWN;


                    break;

                }

            }

        }

    }


    // ========================================================
    // OPENROUTER IMAGE BACKUP
    // ========================================================

    console.log(
        '🔄 BACKUP: OpenRouter image analysis'
    );


    const answer =
        await analyzeImageWithOpenRouter(
            imageBuffer,
            mimeType,
            userQuestion
        );


    return formatForTelegram(
        answer
    );
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    generateAIResponse,
    analyzeImage
};
