# 👾 R.E.T.R.O.

**Recommendation Engine for Tailored Recreation & Online-content**

R.E.T.R.O. helps you find something to watch, listen to, or play based on your mood, age, language, and taste. It recommends YouTube videos and music, movies, TV shows, anime, and games. Its Gemini Flash assistant understands natural-language prompts, chooses a matching category and filters, and can use your taste profile to personalize recommendations.

## Features

- **Gemini Flash AI:** Ask for what you want in plain language, use suggestion chips, or choose **For You** for a personalized pick. The parser can use your saved likes and dislikes to guide recommendations.
- **Videos and music:** Mood-based YouTube recommendations with language and age preferences.
- **Movies and TV shows:** TMDB discovery with genres, modes, age-aware filtering, streaming information, and OMDb ratings and details when available.
- **Anime:** Search by genre and rating, browse seasonal releases, or explore top-ranked series through AniList.
- **Games:** Discover recommended or upcoming games by platform and genre, with age filtering through RAWG.
- **Taste profile:** Like or dislike recommendations to build your profile. Disliked items are excluded from future picks.
- **Retro arcade interface:** CRT effects and optional sound effects, with the sound preference saved between visits.

Gemini Flash handles natural-language requests such as “binge-worthy crime thriller series.” When configured, Tavily can supply current context for prompts about new or trending content.

## Technology and services

- TypeScript, Node.js, Express, HTML, and CSS
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [TMDB](https://developer.themoviedb.org/docs) and [OMDb](https://www.omdbapi.com/)
- [AniList](https://anilist.gitbook.io/anilist-apiv2-docs/) and [RAWG](https://rawg.io/apidocs)
- Gemini Flash via the [Google Generative Language API](https://ai.google.dev/gemini-api/docs)
- Optional [Tavily Search API](https://docs.tavily.com/)

## Setup

Requirements: Node.js 18 or newer and npm.

```bash
npm install
```

Create a `.env` file in the project root and add the keys for the services you want to use:

```env
PORT=3000
YOUTUBE_API_KEY=your_youtube_api_key
TMDB_API_KEY=your_tmdb_api_key
TMDB_BEARER_TOKEN=your_tmdb_bearer_token
OMDB_API_KEY=your_omdb_api_key
RAWG_API_KEY=your_rawg_api_key
GEMINI_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
```

Gemini powers the AI prompt and **For You** features. Tavily is optional and is used for prompts about recent or trending content. Keep `.env` private; it is excluded from Git.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Build the client and run the server with watch mode |
| `npm run build:client` | Bundle the TypeScript client into `public/dist/app.js` |
| `npm start` | Build the client and start the server |

## Project structure

```text
data/             YouTube search queries and fallback recommendations
public/           App shell, styles, and generated client bundle
src/client/app.ts TypeScript interface and recommendation flows
src/server.ts     Express API routes and external service integrations
```
