# 🤖 ChatPro AI

> **Think. Create. Explore. ⚡**
> Your AI. Your space. Your possibilities.

A powerful, emotionally intelligent Telegram AI assistant powered by **Google Gemini** and **GPT-4o** with MongoDB-backed memory.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **AI Chat** | Natural conversations powered by Gemini + GPT-4o fallback |
| 🎵 **AI Music Streaming** | Natural language music playback & search via Jamendo API |
| 🧠 **Memory** | Remembers your name, facts, and conversation history |
| 🎨 **Image Generation** | `/imagine` — AI image generation via HuggingFace + Pollinations |
| 🖼️ **Image Library** | Browse your generated images with paginated gallery |
| 🔤 **Font Styles** | `/font` — 9+ Unicode font styles (Serif, Cursive, Gothic, etc.) |
| ✍️ **Image Editor** | `/text` — Overlay text on any photo with modern typography |
| ⚡ **Fast Response** | Smart caching, model fallback chain, retry with backoff |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MongoDB Atlas](https://www.mongodb.com/atlas) account
- [Telegram Bot Token](https://t.me/BotFather)
- [Jamendo Developer Account](https://devportal.jamendo.com) (Client ID)

### Installation

```bash
git clone https://github.com/utkarsh01201/ChatPro.git
cd ChatPro
npm install
```

### Configuration

Create a `.env` file in the root directory:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=your_mongodb_connection_string
OPENROUTER_API_KEY=your_openrouter_key
HUGGINGFACE_API_KEY=your_huggingface_key
JAMENDO_CLIENT_ID=your_jamendo_client_id
JAMENDO_CLIENT_SECRET=your_jamendo_client_secret
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
PORT=3000
```

### Run

```bash
node src/bot.js
```

## 🤖 Commands

| Command | Description |
|---------|-------------|
| `/start` | Launch ChatPro AI with interactive menu |
| `/help` | View all features |
| `/play [song/mood]` | Search and play track in chat with inline player controls |
| `/pause` | Pause active chat playback |
| `/resume` | Resume paused track |
| `/skip` | Skip to the next track in chat queue |
| `/stop` | Stop playback and clear current queue |
| `/queue` | View upcoming tracks in the chat queue |
| `/nowplaying` | Show details of the currently playing track |
| `/vplay [query]` | Queue music for Group Voice Chat session (Mode B) |
| `/imagine [prompt]` | Generate an AI image |
| `/font [text]` | Convert text to fancy fonts |
| `/text [name]` | Add text overlay to a photo |
| `/newchat` | Start a fresh conversation |
| `/about` | About ChatPro AI |

### 🎵 Natural Language Music Examples

ChatPro AI automatically detects music intents from conversational text:
- *"Play relaxing music for studying"*
- *"Play something energetic"*
- *"Play piano melodies"*
- *"Pause the song"* / *"Resume playback"*
- *"Skip this track"* / *"Next song"*
- *"Show my music queue"* / *"What's playing right now"*

## 🏗️ Architecture

```
User Message
    ↓
🟢 Gemini (flash-lite → 3.1-flash-lite → 3.6-flash)
    ↓ all exhausted?
🔵 OpenRouter → GPT-4o (with retry + backoff)
    ↓ if that fails too?
❌ Friendly error message
```

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Bot Framework**: grammY
- **AI**: Google Gemini AI + OpenRouter (GPT-4o)
- **Database**: MongoDB Atlas (Mongoose)
- **Image Gen**: HuggingFace (SD3 Medium) + Pollinations.ai
- **Image Edit**: Sharp (text overlay)

## 👨‍💻 Author

Created by [@Utkarsh12011](https://t.me/Utkarsh12011)

## 🌟 Community

Join us at [@shiddatXXSociety](https://t.me/shiddatXXSociety)

---

**💬 Chat • 💻 Code • 📚 Learn • 🎨 Create**

🚀 Built for what's next.
