# 👾 R.E.T.R.O. v2.0 | Entertainment Recommender

> **Recommendation Engine for Tailored Recreation & Online-content**

A personalized entertainment recommendation system built with **HTML5, CSS3, TypeScript, and Node.js (Express)**. R.E.T.R.O. curates content across YouTube videos, music, cinema, and anime based on your emotional state, age, and preferred language — all styled in an immersive Retro Arcade / CRT aesthetic.

---

## 🎯 Active Modules

- **📺 Video Discovery**: Mood-based YouTube search with a smart 5-topic rotation engine, age filtering, 6 Indian & global languages, and offline fallback databases.
- **🎵 Music Synthesizer**: Mood & language-matched music recommendations categorized through YouTube Music, featuring embedded playback decks.
- **🎬 Cinema Archive**: Dual TMDB + OMDb API engine featuring US & Indian regional certifications, streaming provider logos (Netflix, Prime, Sun Nxt, etc.), IMDb scores, Metascores, runtime, director, cast, and zero-repeat session batching.
- **⛩️ Anime Archive**: Multi-mode anime explorer featuring Genre & Content Rating filtering, Seasonal time-machine (winter/spring/summer/fall + year), and Top Ranked leaderboard.
- **🎮 Game Recommenders**: RAWG API integration with Recommended (top-rated & Metacritic 70-100) and Upcoming Releases modes (next 6 months), platform selection, genre filters, and server-side ESRB age rating filtering.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, TypeScript, Custom CRT & Neon CSS3 (scanlines, pixel fonts, responsive grid)
- **Bundler**: [esbuild](https://esbuild.github.io/) (ultra-fast client TS bundle generation)
- **Backend**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) with TypeScript
- **Runtime / Watcher**: [tsx](https://github.com/privatenumber/tsx) for zero-config TypeScript execution and hot reloading
- **APIs**:
  - [YouTube Data API v3](https://developers.google.com/youtube/v3)
  - [TMDB API](https://developer.themoviedb.org/docs)
  - [OMDb API](https://www.omdbapi.com/)
  - [RAWG Video Games Database API](https://rawg.io/apidocs)
  - [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs/)

---

## 📋 Prerequisites

- **Node.js** (v18.0.0 or higher; Node 20+ recommended)
- **npm** (v9.0.0 or higher)
- API Keys:
  - **YouTube Data API v3 Key**
  - **TMDB API Key** and/or **TMDB Bearer Token**
  - **OMDb API Key**
  - **RAWG API Key**

---

## 🚀 Setup & Installation

### 1. Clone Repository & Navigate

```bash
git clone <repository-url>
cd RetroWebsite
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
YOUTUBE_API_KEY=your_youtube_api_key_here
TMDB_API_KEY=your_tmdb_api_key_here
TMDB_BEARER_TOKEN=your_tmdb_bearer_token_here
OMDB_API_KEY=your_omdb_api_key_here
RAWG_API_KEY=your_rawg_api_key_here
```

> [!SECURITY NOTE]
> Never commit your `.env` file to version control. The repository's `.gitignore` automatically excludes `.env` and `node_modules`.

### 4. Build Client & Start Development Server

```bash
npm run dev
```

The app will compile the client TypeScript bundle to `public/dist/app.js` and launch the server at:
**[http://localhost:3000](http://localhost:3000)**

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Bundles frontend with esbuild and starts backend with `tsx watch` for auto-reloading |
| `npm run build:client` | Bundles `src/client/app.ts` into `public/dist/app.js` using esbuild |
| `npm start` | Bundles frontend and starts backend in standard production mode |

---

## 📂 Project Structure

```text
RetroWebsite/
├── .env                          # Local API keys (never commit!)
├── .gitignore                    # Git exclusions (.env, node_modules, public/dist)
├── package.json                  # Dependencies & npm scripts
├── tsconfig.json                 # TypeScript compiler configuration
├── README.md                     # Documentation
├── data/                         # Predefined fallback databases & search queries
│   ├── music_fallback_videos.json
│   ├── music_queries.json
│   ├── search_queries.json
│   └── video_fallback_videos.json
├── public/                       # Static web assets served by Express
│   ├── dist/
│   │   └── app.js                # Compiled frontend JavaScript bundle
│   ├── index.html                # Retro Arcade SPA shell
│   └── styles.css                # CRT scanline overlay, neon glows & pixel UI
└── src/
    ├── client/
    │   └── app.ts                # Client-side UI controller, state & event logic
    └── server.ts                 # Express API server (YouTube, TMDB, OMDb, Anime)
```

---

## 🎮 How to Use

1. **Select View**: Use the top navigation bar to choose between **Home**, **YT Videos**, **YT Music**, **Movies**, and **Anime**.
2. **Set Preferences**:
   - **Videos & Music**: Select your current **Emotional State (Mood)**, adjust the **Age Slider** (`KIDS`, `TEENS`, `ADULTS`), and choose your preferred language.
   - **Movies**: Select a **Genre**, **Player Age**, and **Audio / Subtitle Language**. Click **Generate** to retrieve enriched movie cards with streaming providers and IMDb ratings. Click again to cycle through movies in the current batch.
   - **Anime**: Switch between **Genre & Rating**, **Seasonal Anime** (choose season and year), or **Top Ranked**.
3. **Reset Memory**: Click **↺ RESET MEMORY** at any time to clear cached topic iterations and queued results.

---

## 🔒 Security & Best Practices

- All API requests to external services (YouTube, TMDB, OMDb) originate server-side to keep secrets hidden from the browser.
- External API calls use secure HTTPS endpoints.
- If TMDB credentials are missing or invalid, friendly retro terminal notices are rendered without crashing the UI.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
