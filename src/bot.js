require('dotenv').config();

const {
    Bot,
    InputFile,
    InlineKeyboard,
    webhookCallback
} = require('grammy');

const http = require('http');
const path = require('path');

const {
    generateAIResponse,
    analyzeImage
} = require('./ai');

const {
    generateImage
} = require('./image');

const {
    getAllFontStyles,
    convertFont
} = require('./fonts');

const {
    overlayText
} = require('./editor');

const db = require('./db');


// ─────────────────────────────────────────────────────────────
// BOT
// ─────────────────────────────────────────────────────────────

const bot =
    new Bot(process.env.TELEGRAM_BOT_TOKEN);


// ─────────────────────────────────────────────────────────────
// 🖼️ PENDING IMAGES
// ─────────────────────────────────────────────────────────────

// Stores the most recently received photo for each chat.
//
// This allows:
//
// User:
// [photo]
//
// User:
// What is this?
//
// The bot knows that "What is this?" refers to
// the previously sent photo.

const pendingImages = new Map();


// Keep images only for 5 minutes.
const IMAGE_EXPIRY =
    5 * 60 * 1000;


// ─────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────

const startMessage = `🤖 ChatPro AI — Help

Here's what I can help you with:

💬 Chat
Have natural conversations and ask questions.

💻 Code
Get programming help, explanations and debugging assistance.

📚 Learn
Understand difficult topics in a simple way.

✍️ Create
Write, rewrite, brainstorm and improve your content.

🧠 Explore
Discuss ideas, solve problems and discover new possibilities.

🖼️ Image Understanding
Send me a photo and ask questions about it.

🎨 Image Generation
Use /imagine [prompt] to generate AI images.

🖼️ Image Editor
Send or reply to any photo with /text [your text] to stamp your name on it!

🔤 Font Styles
Use /font [text] to stylize any text.

━━━━━━━━━━━━━━━━━━

Commands:

/start — Start ChatPro AI
/help — View available features
/newchat — Start a fresh conversation
/clear — Clear current conversation
/font [text] — Generate fancy fonts
/imagine [prompt] — Generate an AI image
/text [name] — Add text to a photo
/about — About ChatPro AI

🌟 Community
👉 @shiddatXXSociety`;


const aboutMessage = `🤖 ChatPro AI

Think. Create. Explore. ⚡
Your AI. Your space. Your possibilities.

💬 Chat • 💻 Code • 📚 Learn • 🖼️ Vision • 🎨 Create

🚀 Built for what's next.

👨‍💻 @Utkarsh12011
🌟 @shiddatXXSociety`;


// ─────────────────────────────────────────────────────────────
// KEYBOARDS
// ─────────────────────────────────────────────────────────────

function buildStartKeyboard() {

    return new InlineKeyboard()

        .text("❓ Help", "btn_help")
        .text("🆕 New Chat", "btn_newchat")

        .row()

        .text("📜 History", "btn_history")
        .text("ℹ️ About", "btn_about")

        .row()

        .text("🎨 Image Library", "btn_library_0")
        .text("🔤 Fonts", "btn_fonts_info")

        .row()

        .text("🖼️ Image Editor", "btn_editor_info")
        .text("⚡ Tips", "btn_tips")

        .row()

        .text("👨‍💻 Created By", "btn_creator")
        .url(
            "🌟 Community",
            "https://t.me/shiddatXXSociety"
        );
}


function buildLibraryKeyboard(
    page,
    totalPages
) {

    const kb =
        new InlineKeyboard();

    const hasPrev =
        page > 0;

    const hasNext =
        page < totalPages - 1;

    if (hasPrev) {

        kb.text(
            "⬅️ Prev",
            `btn_library_${page - 1}`
        );

    }

    if (hasPrev && hasNext) {

        kb.text(
            `${page + 1}/${totalPages}`,
            "btn_noop"
        );

    }

    if (hasNext) {

        kb.text(
            "Next ➡️",
            `btn_library_${page + 1}`
        );

    }

    kb
        .row()
        .text(
            "🏠 Back to Menu",
            "btn_backmenu"
        );

    return kb;
}


// ─────────────────────────────────────────────────────────────
// START / HELP
// ─────────────────────────────────────────────────────────────

let cachedVideoFileId = null;


bot.command(
    ['start', 'help'],
    async (ctx) => {

        const keyboard =
            buildStartKeyboard();

        try {

            if (cachedVideoFileId) {

                await ctx.replyWithVideo(
                    cachedVideoFileId,
                    {
                        caption: startMessage,
                        reply_markup: keyboard
                    }
                );

            } else {

                const videoPath =
                    path.join(
                        __dirname,
                        '..',
                        'keep_only_last_seconds.mp4'
                    );

                const sent =
                    await ctx.replyWithVideo(
                        new InputFile(videoPath),
                        {
                            caption: startMessage,
                            reply_markup: keyboard
                        }
                    );

                cachedVideoFileId =
                    sent.video.file_id;

                console.log(
                    "✅ Video file_id cached."
                );

            }

        } catch (e) {

            console.error(
                "Failed to send video:",
                e.message
            );

            await ctx.reply(
                startMessage,
                {
                    reply_markup: keyboard
                }
            );

        }

    }
);


// ─────────────────────────────────────────────────────────────
// NEW CHAT / CLEAR
// ─────────────────────────────────────────────────────────────

bot.command(
    ['newchat', 'clear'],
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();

        await db.clearChatHistory(
            chatId
        );

        pendingImages.delete(
            chatId
        );

        await ctx.reply(
            "🧹 Conversation cleared! Let's start fresh."
        );

    }
);


// ─────────────────────────────────────────────────────────────
// ABOUT
// ─────────────────────────────────────────────────────────────

bot.command(
    'about',
    async (ctx) => {

        await ctx.reply(
            aboutMessage
        );

    }
);


// ─────────────────────────────────────────────────────────────
// 🎨 IMAGE GENERATION
// ─────────────────────────────────────────────────────────────

bot.command(
    'imagine',
    async (ctx) => {

        const prompt =
            ctx.match?.trim();

        if (!prompt) {

            return ctx.reply(
                "Please provide a prompt after /imagine\n\nExample: /imagine a futuristic city at night"
            );

        }

        const chatId =
            ctx.chat.id.toString();

        const placeholder =
            await ctx.reply(
                "🎨 Creating your image with AI, please wait..."
            );

        try {

            const {
                buffer,
                provider
            } =
                await generateImage(
                    prompt
                );

            const cleanPrompt =
                prompt.length > 200
                    ? prompt.slice(0, 197) + '...'
                    : prompt;

            const sent =
                await ctx.replyWithPhoto(
                    new InputFile(
                        buffer,
                        'generated.jpg'
                    ),
                    {
                        caption:
                            `🎨 Generated with ${provider}\n\nPrompt: "${cleanPrompt}"\n\n👨‍💻 by @Utkarsh12011`
                    }
                );

            const fileId =
                sent.photo?.[
                    sent.photo.length - 1
                ]?.file_id || '';

            if (fileId) {

                await db.saveImageToLibrary(
                    chatId,
                    prompt,
                    fileId
                );

            }

            await ctx.api
                .deleteMessage(
                    ctx.chat.id,
                    placeholder.message_id
                )
                .catch(() => {});

        } catch (e) {

            console.error(
                "Image generation error:",
                e.message
            );

            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    "Sorry, the image server is busy right now. Please try again in a moment!"
                )
                .catch(() => {});

        }

    }
);


// ─────────────────────────────────────────────────────────────
// 🔤 FONT GENERATOR
// ─────────────────────────────────────────────────────────────

bot.command(
    ['font', 'fonts'],
    async (ctx) => {

        const text =
            ctx.match?.trim();

        if (!text) {

            return ctx.reply(
                "🔤 Font Generator\n\nUsage: /font [your text]\nExample: /font Utkarsh\nExample: /font Hello World"
            );

        }

        const styles =
            getAllFontStyles(text);

        const formatted =
            styles
                .map(
                    s =>
                        `${s.name}:\n\`${s.text}\``
                )
                .join('\n\n');

        await ctx.reply(

            `🔤 *Stylized Fonts for:* "${text}"\n\n💡 _Tap any text to copy directly:_\n\n${formatted}`,

            {
                parse_mode: "Markdown"
            }

        );

    }
);


// ─────────────────────────────────────────────────────────────
// TELEGRAM PHOTO DOWNLOAD
// ─────────────────────────────────────────────────────────────

async function downloadTelegramPhoto(
    ctx,
    photos
) {

    const largest =
        photos[
            photos.length - 1
        ];

    const file =
        await ctx.api.getFile(
            largest.file_id
        );

    const url =
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const res =
        await fetch(url);

    if (!res.ok) {

        throw new Error(
            "Could not download photo from Telegram."
        );

    }

    return {
        buffer:
            Buffer.from(
                await res.arrayBuffer()
            ),

        mimeType:
            'image/jpeg'
    };

}


// ─────────────────────────────────────────────────────────────
// 🖼️ IMAGE EDITOR
// ─────────────────────────────────────────────────────────────

bot.command(
    ['text', 'name', 'addtext'],
    async (ctx) => {

        let textToOverlay =
            ctx.match?.trim();

        const replyPhoto =
            ctx.message
                .reply_to_message
                ?.photo;

        if (!replyPhoto) {

            return ctx.reply(
                "🖼️ *Image Editor*\n\nReply to any photo with:\n`/text Your Name`\n\nOr send a photo with caption `/text Your Name`",
                {
                    parse_mode: "Markdown"
                }
            );

        }

        if (!textToOverlay) {

            textToOverlay =
                "Utkarsh";

        }

        const placeholder =
            await ctx.reply(
                "✍️ Adding text to your image..."
            );

        try {

            const {
                buffer: imageBuffer
            } =
                await downloadTelegramPhoto(
                    ctx,
                    replyPhoto
                );

            const editedBuffer =
                await overlayText(
                    imageBuffer,
                    textToOverlay
                );

            await ctx.replyWithPhoto(

                new InputFile(
                    editedBuffer,
                    'edited.jpg'
                ),

                {
                    caption:
                        `✨ Edited Image with "${textToOverlay}"\n\n👨‍💻 by @Utkarsh12011`
                }

            );

            await ctx.api
                .deleteMessage(
                    ctx.chat.id,
                    placeholder.message_id
                )
                .catch(() => {});

        } catch (err) {

            console.error(
                "Edit error:",
                err.message
            );

            await ctx.api
                .editMessageText(
                    ctx.chat.id,
                    placeholder.message_id,
                    "Sorry, I couldn't edit the image. Please try again!"
                )
                .catch(() => {});

        }

    }
);


// ─────────────────────────────────────────────────────────────
// 🖼️ PHOTO HANDLER
// ─────────────────────────────────────────────────────────────
//
// Handles:
// 1. Photo + question/caption
// 2. Photo without caption
//
// If photo has no caption, it gets stored.
// The next normal text message can then ask a question
// about that image.
//
// Example:
//
// [PHOTO]
//
// What is this?
//
// → Gemini Vision analyzes the photo.
//

bot.on(
    'message:photo',
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();

        const caption =
            ctx.message.caption?.trim() || '';

        try {

            // Download photo immediately.
            const {
                buffer,
                mimeType
            } =
                await downloadTelegramPhoto(
                    ctx,
                    ctx.message.photo
                );

            // Store latest image.
            pendingImages.set(
                chatId,
                {
                    buffer,
                    mimeType,
                    timestamp: Date.now()
                }
            );

            // ─────────────────────────────────────
            // NO CAPTION
            // ─────────────────────────────────────

            if (!caption) {

                await ctx.reply(
                    "🖼️ Got the image!\n\nAsk me something about it, for example:\n\n• What is this?\n• Describe this image\n• What objects are visible?\n• Read the text in this image\n• Explain this screenshot"
                );

                return;
            }


            // ─────────────────────────────────────
            // IMAGE EDIT COMMAND
            // ─────────────────────────────────────

            const cmdMatch =
                caption.match(
                    /^\/(?:text|name|addtext|edit)(?:\s+(.*))?$/i
                );

            if (cmdMatch) {

                const textToOverlay =
                    cmdMatch[1]?.trim() ||
                    "Utkarsh";

                const placeholder =
                    await ctx.reply(
                        `✍️ Adding "${textToOverlay}" to your image...`
                    );

                try {

                    const editedBuffer =
                        await overlayText(
                            buffer,
                            textToOverlay
                        );

                    await ctx.replyWithPhoto(

                        new InputFile(
                            editedBuffer,
                            'edited.jpg'
                        ),

                        {
                            caption:
                                `✨ Added "${textToOverlay}" to your image!\n\n👨‍💻 by @Utkarsh12011`
                        }

                    );

                    await ctx.api
                        .deleteMessage(
                            ctx.chat.id,
                            placeholder.message_id
                        )
                        .catch(() => {});

                } catch (err) {

                    console.error(
                        "Photo edit error:",
                        err.message
                    );

                    await ctx.api
                        .editMessageText(
                            ctx.chat.id,
                            placeholder.message_id,
                            "Sorry, couldn't edit the image. Please try again!"
                        )
                        .catch(() => {});

                }

                return;
            }


            // ─────────────────────────────────────
            // IMAGE QUESTION
            // ─────────────────────────────────────

            const placeholder =
                await ctx.reply(
                    "🖼️ Analyzing your image..."
                );

            try {

                const answer =
                    await analyzeImage(
                        buffer,
                        mimeType,
                        caption
                    );

                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        answer
                    )
                    .catch(
                        async () => {
                            await ctx.reply(
                                answer
                            );
                        }
                    );

            } catch (error) {

                console.error(
                    "Image analysis error:",
                    error.message
                );

                await ctx.api
                    .editMessageText(
                        ctx.chat.id,
                        placeholder.message_id,
                        "❌ I couldn't analyze this image right now. Please try again."
                    )
                    .catch(() => {});

            }

        } catch (error) {

            console.error(
                "Photo download error:",
                error.message
            );

            await ctx.reply(
                "❌ I couldn't process that image. Please try sending it again."
            );

        }

    }
);


// ─────────────────────────────────────────────────────────────
// BUTTON: HELP
// ─────────────────────────────────────────────────────────────

bot.callbackQuery(
    "btn_help",
    async (ctx) => {

        await ctx.answerCallbackQuery();

        await ctx.reply(
            startMessage,
            {
                reply_markup:
                    buildStartKeyboard()
            }
        );

    }
);


// ─────────────────────────────────────────────────────────────
// BUTTON: NEW CHAT
// ─────────────────────────────────────────────────────────────

bot.callbackQuery(
    "btn_newchat",
    async (ctx) => {

        const chatId =
            ctx.chat.id.toString();

        await db.clearChatHistory(
            chatId
        );

        pendingImages.delete(
            chatId
        );

        await ctx.answerCallbackQuery(
            "Chat cleared!"
        );

        await ctx.reply(
            "🧹 Fresh start! Your conversation history has been cleared. Say something to begin!"
        );

    }
);


// ─────────────────────────────────────────────────────────────
// BUTTON: HISTORY
// ─────────────────────────────────────────────────────────────

bot.callbackQuery(
    "btn_history",
    async (ctx) => {

        await ctx.answerCallbackQuery();

        const chatId =
            ctx.chat.id.toString();

        const chatDoc =
            await db.getChatHistory(
                chatId
            );

        if (
            !chatDoc.messages ||
            chatDoc.messages.length === 0
        ) {

            return ctx.reply(
                "📜 No conversation history yet. Start chatting to build your history!"
            );

        }

        const recent =
            chatDoc.messages.slice(-10);

        const summary =
            recent
                .map(
                    m =>
                        `${m.role === 'user' ? '👤 You' : '🤖 AI'}: ${m.text.slice(0, 80)}${m.text.length > 80 ? '...' : ''}`
                )
                .join('\
