# 🤖 ChatPro AI

> **Think. Create. Explore. ⚡**
> Your AI. Your space. Your possibilities.

A powerful, emotionally intelligent Telegram AI assistant powered by **Google Gemini** and **GPT-4o** with MongoDB-backed memory.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 💬 **AI Chat** | Natural conversations powered by Gemini + GPT-4o fallback |
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
| `/imagine [prompt]` | Generate an AI image |
| `/font [text]` | Convert text to fancy fonts |
| `/text [name]` | Add text overlay to a photo |
| `/newchat` | Start a fresh conversation |
| `/about` | About ChatPro AI |

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
