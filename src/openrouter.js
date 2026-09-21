const OPENROUTER_SYSTEM_INSTRUCTION = "You are ChatPro AI, a highly emotionally intelligent and empathetic AI assistant on Telegram. Speak clearly, naturally, and warmly. You must sync with the user's feelings—if they are happy, be enthusiastic; if they are sad or frustrated, be comforting and supportive. Pay close attention to the emotional context of previous messages so the conversation feels deeply connected and human. FONT STYLING: If the user asks to write text or their name in a specific font (e.g., Times New Roman, serif, cursive, script, gothic, monospace, bold, bubble, small caps), you CAN and SHOULD write it out using Unicode characters (e.g. 𝑈𝑡𝑘𝑎𝑟𝑠ℎ for Times New Roman / Serif, 𝒰𝓉𝓀𝒶𝓇𝓈𝒽 for Cursive, 𝔘𝔱𝔨𝔞𝔯𝔰𝔥 for Gothic, 𝚄𝚝𝚔α𝚛𝚜𝚑 for Monospace). Never say you cannot change fonts on Telegram. Do NOT use markdown symbols like **, ###, or __ unless formatting code blocks. Do NOT use LaTeX math formatting. Use plain text, standard punctuation, and simple bullet points.";

async function callOpenRouter(history, newMessage, customSystemPrompt = null) {
    const systemPrompt = customSystemPrompt || OPENROUTER_SYSTEM_INSTRUCTION;
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.text
        })),
        { role: 'user', content: newMessage }
    ];

    const maxRetries = 2;
    const baseDelay = 500;
    let attempt = 0;
    let response;

    while (attempt < maxRetries) {
        try {
            response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://t.me/chat_pro_robot',
                    'X-Title': 'ChatPro AI',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o',
                    max_tokens: 1000,
                    messages: messages
                })
            });

            if (response.ok) break;

            if (response.status === 429) {
                const wait = baseDelay * Math.pow(2, attempt);
                console.warn(`OpenRouter rate limited, retry ${attempt + 1}/${maxRetries} after ${wait}ms`);
                await new Promise(r => setTimeout(r, wait));
                attempt++;
                continue;
            }
            break;
        } catch (netErr) {
            console.warn(`OpenRouter network error:`, netErr.message);
            attempt++;
            if (attempt >= maxRetries) throw netErr;
            await new Promise(r => setTimeout(r, 500));
        }
    }

    if (!response || !response.ok) {
        const errText = response ? await response.text() : 'No response';
        throw new Error(`OpenRouter Error ${response ? response.status : 500}: ${errText}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid response format from OpenRouter");
    }
    return data.choices[0].message.content;
}

module.exports = { callOpenRouter };
