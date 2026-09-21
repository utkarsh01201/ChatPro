require('dotenv').config();
const { Bot, InputFile, InlineKeyboard, webhookCallback } = require('grammy');
const http = require('http');
const path = require('path');
const { generateAIResponse } = require('./ai');
const { generateImage } = require('./image');
const { getAllFontStyles, convertFont } = require('./fonts');
const { overlayText } = require('./editor');
const db = require('./db');

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// ─── Messages ────────────────────────────────────────────────────────────────

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

🎨 Image Generation
Use /imagine [prompt] to generate AI images with Hugging Face.

🖼️ Image Editor
Send or reply to any photo with /text [your text] to stamp your name on it!

🔤 Font Styles
Use /font [text] to stylize any text (Times, Cursive, Gothic, etc.).

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

💬 Chat • 💻 Code • 📚 Learn • 🎨 Create

🚀 Built for what's next.

👨‍💻 @Utkarsh12011
🌟 @shiddatXXSociety`;

// ─── Keyboards ────────────────────────────────────────────────────────────────

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
        .url("🌟 Community", "https://t.me/shiddatXXSociety");
}

function buildLibraryKeyboard(page, totalPages) {
    const kb = new InlineKeyboard();
    const hasPrev = page > 0;
    const hasNext = page < totalPages - 1;

    if (hasPrev) kb.text("⬅️ Prev", `btn_library_${page - 1}`);
    if (hasPrev && hasNext) kb.text(`${page + 1}/${totalPages}`, "btn_noop");
    if (hasNext) kb.text("Next ➡️", `btn_library_${page + 1}`);

    kb.row().text("🏠 Back to Menu", "btn_backmenu");
    return kb;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

// Cache Telegram file_id after first upload — makes /start instant after that
let cachedVideoFileId = null;

bot.command(['start', 'help'], async (ctx) => {
    const keyboard = buildStartKeyboard();

    try {
        if (cachedVideoFileId) {
            // Instant — no file upload needed!
            await ctx.replyWithVideo(cachedVideoFileId, {
                caption: startMessage,
                reply_markup: keyboard
            });
        } else {
            // First time: upload from disk and cache the file_id
            const videoPath = path.join(__dirname, '..', 'keep_only_last_seconds.mp4');
            const sent = await ctx.replyWithVideo(new InputFile(videoPath), {
                caption: startMessage,
                reply_markup: keyboard
            });
            cachedVideoFileId = sent.video.file_id;
            console.log("✅ Video file_id cached for fast future use.");
        }
    } catch (e) {
        console.error("Failed to send video:", e.message);
        await ctx.reply(startMessage, { reply_markup: keyboard });
    }
});

bot.command(['newchat', 'clear'], async (ctx) => {
    const chatId = ctx.chat.id.toString();
    await db.clearChatHistory(chatId);
    await ctx.reply("🧹 Conversation cleared! Let's start fresh.");
});

bot.command('about', async (ctx) => {
    await ctx.reply(aboutMessage);
});

// /imagine command — generate an AI image using Hugging Face (SD3 Medium)
bot.command('imagine', async (ctx) => {
    const prompt = ctx.match?.trim();
    if (!prompt) {
        return ctx.reply("Please provide a prompt after /imagine\n\nExample: /imagine a futuristic city at night");
    }

    const chatId = ctx.chat.id.toString();
    const placeholder = await ctx.reply("🎨 Creating your image with AI, please wait...");

    try {
        const { buffer, provider } = await generateImage(prompt);

        const cleanPrompt = prompt.length > 200 ? prompt.slice(0, 197) + '...' : prompt;
        const sent = await ctx.replyWithPhoto(new InputFile(buffer, 'generated.jpg'), {
            caption: `🎨 Generated with ${provider}\n\nPrompt: "${cleanPrompt}"\n\n👨‍💻 by @Utkarsh12011`
        });

        // Save Telegram file_id to library for instant gallery loads
        const fileId = sent.photo?.[sent.photo.length - 1]?.file_id || '';
        if (fileId) {
            await db.saveImageToLibrary(chatId, prompt, fileId);
        }

        await ctx.api.deleteMessage(ctx.chat.id, placeholder.message_id).catch(() => {});
    } catch (e) {
        console.error("Image generation error:", e.message);
        await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id,
            "Sorry, the image server is busy right now. Please try again in a moment!").catch(() => {});
    }
});

// /font command — convert text into beautiful stylized fonts
bot.command(['font', 'fonts'], async (ctx) => {
    const text = ctx.match?.trim();
    if (!text) {
        return ctx.reply("🔤 Font Generator\n\nUsage: /font [your text]\nExample: /font Utkarsh\nExample: /font Hello World");
    }

    const styles = getAllFontStyles(text);
    const formatted = styles.map(s => `${s.name}:\n\`${s.text}\``).join('\n\n');

    await ctx.reply(`🔤 *Stylized Fonts for:* "${text}"\n\n💡 _Tap any text to copy directly:_\n\n${formatted}`, {
        parse_mode: "Markdown"
    });
});

// Helper to download photo from Telegram
async function downloadTelegramPhoto(ctx, photos) {
    const largest = photos[photos.length - 1];
    const file = await ctx.api.getFile(largest.file_id);
    const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not download photo from Telegram.");
    return Buffer.from(await res.arrayBuffer());
}

// /text, /name, /addtext command — reply to a photo to add text onto it
bot.command(['text', 'name', 'addtext'], async (ctx) => {
    let textToOverlay = ctx.match?.trim();
    const replyPhoto = ctx.message.reply_to_message?.photo;

    if (!replyPhoto) {
        return ctx.reply("🖼️ *Image Editor*\n\nReply to any photo with:\n`/text Your Name`\n\nOr send a photo with caption `/text Your Name`", { parse_mode: "Markdown" });
    }

    if (!textToOverlay) textToOverlay = "Utkarsh";

    const placeholder = await ctx.reply("✍️ Adding text to your image...");
    try {
        const imageBuffer = await downloadTelegramPhoto(ctx, replyPhoto);
        const editedBuffer = await overlayText(imageBuffer, textToOverlay);

        await ctx.replyWithPhoto(new InputFile(editedBuffer, 'edited.jpg'), {
            caption: `✨ Edited Image with "${textToOverlay}"\n\n👨‍💻 by @Utkarsh12011`
        });
        await ctx.api.deleteMessage(ctx.chat.id, placeholder.message_id).catch(() => {});
    } catch (err) {
        console.error("Edit error:", err.message);
        await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, "Sorry, I couldn't edit the image. Please try again!").catch(() => {});
    }
});

// Photo handler: handles photos sent with captions like /text, /name, /imagine add my name, or any text instruction
bot.on('message:photo', async (ctx) => {
    const caption = ctx.message.caption?.trim() || '';
    if (!caption) {
        return ctx.reply("📸 Nice photo! To add your name or text onto it, reply to it with:\n`/text Your Name`", { parse_mode: "Markdown" });
    }

    let textToOverlay = null;

    const cmdMatch = caption.match(/^\/(?:text|name|addtext|edit)(?:\s+(.*))?$/i);
    if (cmdMatch) {
        textToOverlay = cmdMatch[1]?.trim() || "Utkarsh";
    } else if (caption.toLowerCase().includes('name') || caption.toLowerCase().includes('add my name')) {
        const nameMatch = caption.match(/name\s*(?:is|to|:)?\s*([a-zA-Z0-9_\s]+)/i);
        textToOverlay = nameMatch ? nameMatch[1].replace(/in the given img|there/i, '').trim() : "Utkarsh";
        if (!textToOverlay) textToOverlay = "Utkarsh";
    } else if (caption.startsWith('/imagine')) {
        textToOverlay = caption.replace('/imagine', '').trim();
    }

    if (textToOverlay) {
        const placeholder = await ctx.reply(`✍️ Adding "${textToOverlay}" to your image...`);
        try {
            const imageBuffer = await downloadTelegramPhoto(ctx, ctx.message.photo);
            const editedBuffer = await overlayText(imageBuffer, textToOverlay);

            await ctx.replyWithPhoto(new InputFile(editedBuffer, 'edited.jpg'), {
                caption: `✨ Added "${textToOverlay}" to your image!\n\n👨‍💻 by @Utkarsh12011`
            });
            await ctx.api.deleteMessage(ctx.chat.id, placeholder.message_id).catch(() => {});
        } catch (err) {
            console.error("Photo edit error:", err.message);
            await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, "Sorry, couldn't edit the image. Please try again!").catch(() => {});
        }
    }
});

// ─── Inline Button Callbacks ──────────────────────────────────────────────────

bot.callbackQuery("btn_help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(startMessage, { reply_markup: buildStartKeyboard() });
});

bot.callbackQuery("btn_newchat", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    await db.clearChatHistory(chatId);
    await ctx.answerCallbackQuery("Chat cleared!");
    await ctx.reply("🧹 Fresh start! Your conversation history has been cleared. Say something to begin!");
});

bot.callbackQuery("btn_history", async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat.id.toString();
    const chatDoc = await db.getChatHistory(chatId);

    if (!chatDoc.messages || chatDoc.messages.length === 0) {
        return ctx.reply("📜 No conversation history yet. Start chatting to build your history!");
    }

    const recent = chatDoc.messages.slice(-10);
    const summary = recent.map(m =>
        `${m.role === 'user' ? '👤 You' : '🤖 AI'}: ${m.text.slice(0, 80)}${m.text.length > 80 ? '...' : ''}`
    ).join('\n\n');

    await ctx.reply(`📜 Recent Conversation:\n\n${summary}`);
});

bot.callbackQuery("btn_about", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(aboutMessage);
});

bot.callbackQuery("btn_tips", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(`⚡ Tips for ChatPro AI

- Be specific in your questions for better answers.
- Use /newchat to start a fresh topic anytime.
- Use /font [text] to get your name or words in Times New Roman, cursive, or gothic.
- Use /imagine [description] to generate AI images.
- The bot remembers your full conversation, so context carries over.
- Ask for code, essays, explanations, or creative writing — it handles all!
- Type naturally — it understands context and emotion.`);
});

bot.callbackQuery("btn_fonts_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(`🔤 Fancy Font Generator

Convert any text into stylish fonts!

Usage:
/font [your text]

Example:
/font Utkarsh

Supported Styles:
• Serif / Times New Roman Style
• Serif Bold
• Cursive / Script
• Bold Cursive
• Gothic / Fraktur
• Monospace / Typewriter
• Double-Struck Outline
• Circled Bubble
• Small Caps`);
});

bot.callbackQuery("btn_editor_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(`🖼️ Image Text Editor

Add your name or custom text onto any picture!

How to use:
1. Send any photo with caption:
   /text Your Name

2. Or reply to any photo with:
   /text Your Name

The bot will cleanly overlay your name with modern typography and drop shadows!`);
});

bot.callbackQuery("btn_creator", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(`👨‍💻 Created by @Utkarsh12011\n\nFeel free to reach out for feedback, suggestions, or collaborations!`);
});

bot.callbackQuery("btn_backmenu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply("🏠 Back to main menu!", { reply_markup: buildStartKeyboard() });
});

bot.callbackQuery("btn_noop", async (ctx) => {
    await ctx.answerCallbackQuery();
});

// Image Library — paginated
bot.callbackQuery(/^btn_library_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = parseInt(ctx.match[1]);
    const chatId = ctx.chat.id.toString();

    const { images, total, pages } = await db.getImageLibrary(chatId, page, 5);

    if (total === 0) {
        return ctx.reply(
            "🖼️ Your Image Library is empty!\n\nUse /imagine [prompt] to generate your first image and it will be saved here automatically.",
            { reply_markup: new InlineKeyboard().text("🏠 Back to Menu", "btn_backmenu") }
        );
    }

    // Send images one by one from this page
    await ctx.reply(`🖼️ Your Image Library  (Page ${page + 1}/${pages}, ${total} total images)`);

    for (const img of images) {
        const date = new Date(img.createdAt).toLocaleDateString('en-IN');
        try {
            await ctx.replyWithPhoto(img.imageUrl, {
                caption: `Prompt: "${img.prompt}"\nGenerated: ${date}`
            });
        } catch {
            await ctx.reply(`Could not load image.\nPrompt: "${img.prompt}"\nDate: ${date}`);
        }
    }

    // Show navigation
    await ctx.reply("Navigate your library:", { reply_markup: buildLibraryKeyboard(page, pages) });
});

// ─── Message Handler ──────────────────────────────────────────────────────────

bot.on('message:text', async (ctx) => {
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id.toString();

    // Skip if it's a command
    if (userMessage.startsWith('/')) return;

    ctx.replyWithChatAction('typing').catch(() => {});
    const placeholder = await ctx.reply("💬 _Thinking..._", { parse_mode: "Markdown" }).catch(() => null);

    try {
        const userProfile = await db.getOrCreateUserProfile(chatId, ctx.from);

        // Check if user is introducing or stating their name
        const nameMatch = userMessage.match(/(?:my name is|call me|i am|i'm)\s+([a-zA-Z]+)/i);
        if (nameMatch && nameMatch[1]) {
            const extractedName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
            userProfile.preferredName = extractedName;
            await userProfile.save().catch(() => {});
        }

        const chatDoc = await db.getChatHistory(chatId);
        const aiResponse = await generateAIResponse(chatDoc.messages, userMessage, userProfile);

        if (placeholder) {
            try {
                await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, aiResponse);
            } catch (e) {
                await ctx.reply(aiResponse);
            }
        } else {
            await ctx.reply(aiResponse);
        }

        db.addMessages(chatId, [
            { role: 'user', text: userMessage },
            { role: 'model', text: aiResponse }
        ]);
    } catch (err) {
        console.error("Handler error:", err);
        const fallbackMsg = "Sorry, I hit a temporary snag! Please send your message again.";
        if (placeholder) {
            await ctx.api.editMessageText(ctx.chat.id, placeholder.message_id, fallbackMsg).catch(() => {});
        } else {
            await ctx.reply(fallbackMsg).catch(() => {});
        }
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function startBot() {
    const renderUrl = process.env.RENDER_EXTERNAL_URL;
    const port = parseInt(process.env.PORT) || 10000;

    if (renderUrl) {
        // ── Production: Webhook mode (Render) ──────────────────────────────────
        const webhookPath = '/webhook';
        const webhookUrl  = `${renderUrl}${webhookPath}`;

        // Register webhook with Telegram
        await bot.api.setWebhook(webhookUrl);
        console.log(`🔗 Webhook registered: ${webhookUrl}`);

        // Create HTTP server to receive Telegram updates
        const handleUpdate = webhookCallback(bot, 'http');
        const server = http.createServer(async (req, res) => {
            if (req.method === 'POST' && req.url === webhookPath) {
                await handleUpdate(req, res);
            } else if (req.url === '/health') {
                // Health-check endpoint for Render
                res.writeHead(200);
                res.end('OK');
            } else {
                res.writeHead(200);
                res.end('ChatPro AI Bot is running.');
            }
        });

        server.listen(port, '0.0.0.0', () => {
            console.log(`🤖 Bot is starting up...`);
            console.log(`✅ HTTP server listening on 0.0.0.0:${port}`);
            console.log(`🚀 Running in WEBHOOK mode on Render`);
        });

        server.on('error', (err) => {
            console.error('❌ Server error:', err);
            process.exit(1);
        });
    } else {
        // ── Development: Long-polling mode (local) ─────────────────────────────
        // Remove any previously set webhook so polling works cleanly
        await bot.api.deleteWebhook();
        console.log(`🤖 Bot is starting up...`);
        console.log(`🔄 Running in POLLING mode (local development)`);
        bot.start({
            onStart: (botInfo) => {
                console.log(`✅ Successfully connected as @${botInfo.username}`);
            }
        });
    }
}

startBot().catch((err) => {
    console.error('❌ Fatal startup error:', err);
    process.exit(1);
});
