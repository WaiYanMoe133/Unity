# Moe Workforce — Universal AI Workforce Platform

Interactive desktop/cross-platform PWA and Technical Blueprint v2.0 command center featuring:

- **Universal Task IR v1.0 Planner**: Gemini-powered semantic task planning with Human Approval Gate and risk classification (`LOW` / `MEDIUM` / `HIGH` / `CRITICAL`).
- **Live 2026 Web Research**: Multi-provider search (`Tavily`, `Serper`, `Brave`, or Gemini Search Grounding) paired with bilingual English + Burmese report synthesis.
- **3-Sheet `.xlsx` Export**: Client-side OOXML Excel generation (`Comparison_EN_MM`, `Bilingual_Report`, `Verified_Sources`).
- **Real Gmail Dispatch**: Client-side Firebase Google OAuth (`gmail.send`) + backend MIME RFC 2822 `.xlsx` attachment delivery.
- **Cross-Platform Installable PWA**: Installable as a standalone app on Windows, macOS, Linux, Android, and iOS Safari.

## Environment Variables

Copy `.env.example` to `.env` and configure your server-side API keys (never expose these in frontend code):

```bash
cp .env.example .env
```

- `GEMINI_API_KEY` — Required for AI Task Planning and bilingual report synthesis.
- `TAVILY_API_KEY` / `SERPER_API_KEY` / `BRAVE_SEARCH_API_KEY` — Recommended for fast live web search on Gemini Free Tier.
- `PORT` — Optional server port (default `3000`).

## Local Development & Production Build

```bash
npm install
npm run dev      # Development server with Express API + Vite middleware on port 3000
npm run build    # Builds Vite + PWA bundle into dist/
npm start        # Starts production server via server.ts
```

## Deploying to Your Own Domain / Cloud Host

1. Deploy this repository as a Node.js web service (`npm install && npm run build`, start command `npm start`) on Google Cloud Run, Render, Railway, or Fly.io.
2. Add `GEMINI_API_KEY` and `TAVILY_API_KEY` (or `SERPER_API_KEY`) in the host's Environment Variables / Secrets panel.
3. For Gmail Sign-In on a custom domain, add your deployed domain under **Firebase Console -> Authentication -> Settings -> Authorized domains** and configure your **Google Cloud OAuth Consent Screen** test users / publishing status.
