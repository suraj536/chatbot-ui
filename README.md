# AdCraft AI 🚀
<p align="center">

<img width="1920" height="848" alt="1" src="https://github.com/user-attachments/assets/70feb092-4224-4896-9a5e-c41811c1395a" />

</p>

**AI-Powered Text Ad Generation Platform**

AdCraft AI is an open-source chat-based platform for generating professional advertising copy using Google Gemini and Stability AI. Built for marketers, copywriters, and businesses who want to create high-quality ads in seconds.

---

## ✨ Features

- 🤖 **AI Text Ad Generation** — Generate compelling ad copy for Google Ads, Facebook Ads, Instagram, and more
- 🎨 **Image Generation** — Create stunning ad visuals using Stability AI
- 🔄 **Multi-Model Support** — Switch between Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 2.5 Pro
- 💬 **Chat Interface** — Intuitive chat-based workflow for ad creation
- 📁 **Workspace Management** — Organize your ad campaigns in separate workspaces
- 📝 **Prompt Library** — Save and reuse your best ad generation prompts
- 🌙 **Dark/Light Mode** — Clean UI for any environment
- 🔐 **Secure Auth** — Supabase authentication and data storage

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **AI Models**: Google Gemini 2.0/2.5, Stability AI
- **Deployment**: Vercel

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/adcraft-ai.git
cd adcraft-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# Stability AI
STABILITY_API_KEY=your_stability_api_key
```

### 4. Run locally
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## ☁️ Deploy on Vercel

1. Push your code to GitHub
2. Go to [https://vercel.com](https://vercel.com) and import your repo
3. Add environment variables in Vercel project settings
4. Click **Deploy**

---

## 🔑 API Keys

| Service | Link | Free Tier |
|---|---|---|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | ✅ Yes |
| Stability AI | [platform.stability.ai](https://platform.stability.ai/account/keys) | ✅ 25 credits |
| Supabase | [supabase.com](https://supabase.com) | ✅ Yes |

---

## 💡 How to Use

1. **Sign up** and create your workspace
2. **Select a model** — Gemini for text ads, Stability AI for images
3. **Describe your ad** with product, audience, platform and tone
4. **Generate** multiple ad variations instantly
5. **Refine** by chatting with the AI
6. **Save** your best prompts for reuse

### Example Prompts
```
Write 3 Google Ads headlines for a fitness app targeting busy professionals aged 25-40.
Tone: motivational. Character limit: 30 per headline.
```
