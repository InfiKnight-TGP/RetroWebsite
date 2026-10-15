import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Language & Genre Mappings
const LANGUAGE_CODES: Record<string, string> = {
  English: 'en',
  Hindi: 'hi',
  Tamil: 'ta',
  Telugu: 'te',
  Kannada: 'kn',
  Malayalam: 'ml'
};

const GENRES: Record<number, string> = {
  28: 'Action',
  35: 'Comedy',
  18: 'Drama',
  10751: 'Family',
  27: 'Horror',
  10749: 'Romance',
  878: 'Science Fiction',
  16: 'Animation'
};

const TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 35: 'Comedy', 80: 'Crime', 18: 'Drama', 10751: 'Family',
  10762: 'Kids', 9648: 'Mystery', 10765: 'Sci-Fi & Fantasy', 99: 'Documentary',
  10764: 'Reality', 16: 'Animation'
};

// ============================================================================
// RANDOMNESS & SHUFFLE HELPERS
// ============================================================================
export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseExcludeIds(input: any): Set<string> {
  if (!input) return new Set();
  if (Array.isArray(input)) return new Set(input.map((item) => String(item).trim()).filter(Boolean));
  if (typeof input === 'string') {
    return new Set(input.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return new Set();
}

// In-memory pagination caches to support random page hopping
const movieTotalPagesCache = new Map<string, number>();
const animeLastPageCache = new Map<string, number>();
let tvProvidersCache: { expiresAt: number; providers: any[] } | null = null;

// Safely load JSON files
function loadJsonFile<T>(filename: string, defaultVal: T): T {
  try {
    const filePath = path.join(__dirname, '../data', filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`⚠️ Warning: Could not load data/${filename}. Using empty fallback.`);
    return defaultVal;
  }
}

const SEARCH_QUERIES = loadJsonFile<Record<string, Record<string, string[]>>>('search_queries.json', {});
const VIDEO_FALLBACKS = loadJsonFile<Record<string, Record<string, string>>>('video_fallback_videos.json', {});
const MUSIC_QUERIES = loadJsonFile<Record<string, Record<string, Record<string, string[]>>>>('music_queries.json', {});
const MUSIC_FALLBACKS = loadJsonFile<Record<string, Record<string, string>>>('music_fallback_videos.json', {});

let reqCounter = 0;
// Resilient JSON fetcher (handles Windows Node 24 TLS issues)
function fetchJson<T = any>(urlStr: string, headers: Record<string, string> = {}): Promise<T | null> {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `retro_req_${Date.now()}_${++reqCounter}.json`);
    try {
      const headerArgs = Object.entries(headers)
        .map(([k, v]) => `-H "${k}: ${v.replace(/"/g, '\\"')}"`)
        .join(' ');
      const cmd = `curl.exe -s --connect-timeout 8 ${headerArgs} -o "${tmpFile}" "${urlStr}"`;
      execSync(cmd, { stdio: 'ignore' });
      if (fs.existsSync(tmpFile)) {
        const raw = fs.readFileSync(tmpFile, 'utf-8');
        try { fs.unlinkSync(tmpFile); } catch {}
        const json = JSON.parse(raw) as T;
        return resolve(json);
      }
      return resolve(null);
    } catch {
      if (fs.existsSync(tmpFile)) {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
      fetch(urlStr, { headers })
        .then((r) => r.json() as Promise<T>)
        .then(resolve)
        .catch(() => resolve(null));
    }
  });
}

// ============================================================================
// 1. YOUTUBE VIDEO & MUSIC ENDPOINT
// ============================================================================
app.post('/api/youtube', async (req: Request, res: Response) => {
  const { type, mood, ageGroup, language, currentTopic, iterations } = req.body;
  const excludeIds = parseExcludeIds(req.body.excludeIds || req.query.excludeIds);
  const apiKey = process.env.YOUTUBE_API_KEY;

  const isMusic = type === 'music';
  const fallbackMap = isMusic ? MUSIC_FALLBACKS : VIDEO_FALLBACKS;
  const preferredFallbackId = fallbackMap?.[mood]?.[ageGroup] || 'dQw4w9WgXcQ';
  const unseenFallbackIds = Object.values(fallbackMap || {})
    .flatMap((byAge: any) => Object.values(byAge || {}))
    .map(String)
    .filter((id) => !excludeIds.has(id));
  const fallbackId = excludeIds.has(String(preferredFallbackId))
    ? unseenFallbackIds[Math.floor(Math.random() * unseenFallbackIds.length)]
    : preferredFallbackId;
  if (!fallbackId) return res.status(404).json({ error: 'No unseen fallback videos available' });

  // Determine available queries
  let queries: string[] = [];
  if (isMusic) {
    queries = MUSIC_QUERIES?.[mood]?.[ageGroup]?.[language] ||
              MUSIC_QUERIES?.[mood]?.[ageGroup]?.['English'] || [];
  } else {
    queries = SEARCH_QUERIES?.[mood]?.[ageGroup] || [];
  }

  if (!queries.length) {
    return res.json({ id: fallbackId, title: 'Recommended Video', channel: '', topic: '', iterations: 0, source: 'fallback' });
  }

  // Topic selection & iteration
  let topic = currentTopic;
  let iter = iterations || 0;

  if (!topic || iter >= 5 || Math.random() < 0.2) {
    topic = queries[Math.floor(Math.random() * queries.length)];
    iter = 1;
  } else {
    iter += 1;
  }

  let searchQuery = topic;
  if (!isMusic && language !== 'English') {
    searchQuery = `${topic} ${language}`;
  }

  if (!apiKey || apiKey === 'your_youtube_api_key_here') {
    return res.json({ id: fallbackId, title: 'Recommended Video', channel: '', topic, iterations: iter, source: 'fallback_no_key' });
  }

  try {
    // Randomly pick order from [relevance, viewCount, rating, date] (relevance weighted 50%)
    let order = 'relevance';
    const randOrder = Math.random();
    if (randOrder < 0.5) {
      order = 'relevance';
    } else if (randOrder < 0.667) {
      order = 'viewCount';
    } else if (randOrder < 0.833) {
      order = 'rating';
    } else {
      order = 'date';
    }

    // 30% of the time add publishedAfter = a random date in the last 1–5 years
    let publishedAfter: string | null = null;
    if (Math.random() < 0.3) {
      const now = Date.now();
      const oneYearMs = 365.25 * 24 * 60 * 60 * 1000;
      const randomOffsetMs = oneYearMs + Math.random() * (4 * oneYearMs);
      publishedAfter = new Date(now - randomOffsetMs).toISOString();
    }

    const buildYtUrl = (includeLang: boolean) => {
      const params = new URLSearchParams({
        part: 'snippet',
        q: searchQuery,
        maxResults: '25',
        order,
        type: 'video',
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        key: apiKey
      });
      if (publishedAfter) {
        params.append('publishedAfter', publishedAfter);
      }
      if (isMusic) {
        params.append('videoCategoryId', '10');
        params.append('videoDuration', 'medium');
      }
      if (includeLang && language !== 'English' && LANGUAGE_CODES[language]) {
        params.append('relevanceLanguage', LANGUAGE_CODES[language]);
      }
      return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    };

    let ytRes = await fetch(buildYtUrl(true));
    let data = await ytRes.json();

    // Retry without relevanceLanguage if empty
    if ((!data.items || data.items.length === 0) && language !== 'English') {
      ytRes = await fetch(buildYtUrl(false));
      data = await ytRes.json();
    }

    if (data.items && data.items.length > 0) {
      // Shuffle the items, drop excluded IDs, and return the first one
      const shuffled = shuffle(data.items);
      const nonExcluded = shuffled.filter((item: any) => !excludeIds.has(String(item.id?.videoId)));
      const picked: any = nonExcluded[0];
      if (!picked) return res.status(404).json({ error: 'No unseen YouTube results available' });

      return res.json({
        id: picked.id.videoId,
        title: picked.snippet?.title || 'Recommended Video',
        channel: picked.snippet?.channelTitle || '',
        topic,
        iterations: iter,
        source: 'youtube'
      });
    }

    return res.json({ id: fallbackId, title: 'Recommended Video', channel: '', topic, iterations: iter, source: 'fallback' });
  } catch (err) {
    return res.json({ id: fallbackId, title: 'Recommended Video', channel: '', topic, iterations: iter, source: 'fallback' });
  }
});

// ============================================================================
// 2. TMDB + OMDB MOVIE RECOMMENDATIONS ENDPOINT
// ============================================================================
app.get('/api/movies', async (req: Request, res: Response) => {
  const genreId = String(req.query.genreId || '28');
  const age = Number(req.query.age || 18);
  const language = String(req.query.language || 'English');
  const requestedPage = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const excludeIds = parseExcludeIds(req.query.excludeIds || req.body?.excludeIds);

  const tmdbBearer = process.env.TMDB_BEARER_TOKEN;
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;

  const hasTmdbBearer = tmdbBearer && tmdbBearer !== 'your_tmdb_bearer_token_here';
  const hasTmdbApiKey = tmdbApiKey && tmdbApiKey !== 'your_tmdb_api_key_here';
  const hasOmdbKey = omdbKey && omdbKey !== 'your_omdb_api_key_here';

  if (!hasTmdbBearer && !hasTmdbApiKey) {
    return res.status(500).json({ error: 'TMDB credentials missing in .env' });
  }

  const langCode = LANGUAGE_CODES[language] || 'en';
  const tmdbLanguage = language === 'English' ? 'en-US' : `${langCode}-IN`;
  const certLte = age <= 10 ? 'G' : age <= 13 ? 'PG' : age <= 16 ? 'PG-13' : 'R';

  // 30% of the time add a random decade window (primary_release_date.gte/lte)
  let decadeStart: number | null = null;
  if (Math.random() < 0.3) {
    const decades = [1970, 1980, 1990, 2000, 2010, 2020];
    decadeStart = decades[Math.floor(Math.random() * decades.length)];
  }

  // Respect the client batch page so previous/next batch controls are predictable.
  const filterKey = `${genreId}:${age}:${language}${decadeStart ? `:${decadeStart}` : ''}`;
  const selectedPage = requestedPage;

  // Randomly pick sort_by from [popularity.desc, vote_average.desc, revenue.desc, primary_release_date.desc]
  const sortOptions = ['popularity.desc', 'vote_average.desc', 'revenue.desc', 'primary_release_date.desc'];
  const pickedSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];

  const params = new URLSearchParams({
    with_genres: age <= 10 ? '16' : genreId,
    with_original_language: langCode,
    language: tmdbLanguage,
    sort_by: pickedSort,
    page: String(selectedPage),
    include_adult: 'false',
    include_video: 'false'
  });

  if (decadeStart) {
    params.set('primary_release_date.gte', `${decadeStart}-01-01`);
    params.set('primary_release_date.lte', `${decadeStart + 9}-12-31`);
  }

  // When using vote_average.desc, keep vote_count.gte as is
  if (language === 'English') {
    params.set('vote_count.gte', '100');
    params.set('vote_average.gte', '5.0');
    params.set('certification_country', 'US');
    params.set('certification.lte', certLte);
  } else if (language === 'Hindi') {
    params.set('vote_count.gte', '20');
    params.set('vote_average.gte', '4.0');
    params.set('certification_country', 'IN');
  } else {
    params.set('vote_count.gte', '20');
    params.set('vote_average.gte', '3.0');
    params.set('certification_country', 'IN');
  }

  if (hasTmdbApiKey && !hasTmdbBearer) {
    params.set('api_key', tmdbApiKey!);
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  if (hasTmdbBearer) headers['Authorization'] = `Bearer ${tmdbBearer}`;

  try {
    let discoverData = await fetchJson<any>(`https://api.themoviedb.org/3/discover/movie?${params.toString()}`, headers);
    if (!discoverData || !discoverData.results) {
      return res.status(503).json({ error: 'TMDB service unavailable' });
    }

    // Fallback to page 1 if random page had no results
    if (selectedPage > 1 && (!discoverData.results || discoverData.results.length === 0)) {
      params.set('page', '1');
      const pageOneData = await fetchJson<any>(`https://api.themoviedb.org/3/discover/movie?${params.toString()}`, headers);
      if (pageOneData && pageOneData.results && pageOneData.results.length > 0) {
        discoverData = pageOneData;
      }
    }

    if (discoverData.total_pages) {
      movieTotalPagesCache.set(filterKey, discoverData.total_pages);
    }

    const rawMovies: any[] = discoverData.results || [];

    // Filter valid movies
    let filteredMovies = rawMovies.filter(
      (m) => m.original_language === langCode && !m.adult && (age > 10 || (m.genre_ids || []).includes(16))
    );

    // Exclude seen IDs, then shuffle before enriching top 8
    const nonExcluded = filteredMovies.filter((m) => !excludeIds.has(String(m.id)));
    const candidates = shuffle(nonExcluded).slice(0, 8);

    const enrichedMovies = await Promise.all(
      candidates.map(async (movie) => {
        try {
          const authQuery = hasTmdbApiKey && !hasTmdbBearer ? `?api_key=${tmdbApiKey}` : '';
          const [details, providersData, releaseData] = await Promise.all([
            fetchJson<any>(`https://api.themoviedb.org/3/movie/${movie.id}${authQuery}`, headers),
            fetchJson<any>(`https://api.themoviedb.org/3/movie/${movie.id}/watch/providers${authQuery}`, headers),
            fetchJson<any>(`https://api.themoviedb.org/3/movie/${movie.id}/release_dates${authQuery}`, headers)
          ]);

          // Extract US or IN streaming providers
          const regionProviders = providersData?.results?.IN || providersData?.results?.US || {};
          const providers = [...(regionProviders.flatrate || []), ...(regionProviders.free || [])].slice(0, 4);

          // Extract certification
          const usRelease = (releaseData?.results || []).find((r: any) => r.iso_3166_1 === 'US');
          const inRelease = (releaseData?.results || []).find((r: any) => r.iso_3166_1 === 'IN');
          const ageRating = usRelease?.release_dates?.[0]?.certification || inRelease?.release_dates?.[0]?.certification || 'N/A';

          // Fetch OMDb metadata if IMDB ID exists
          let omdb: any = null;
          if (details?.imdb_id && hasOmdbKey) {
            const omdbJson = await fetchJson<any>(`https://www.omdbapi.com/?i=${details.imdb_id}&apikey=${omdbKey}&plot=full`);
            if (omdbJson && omdbJson.Response === 'True') {
              omdb = {
                imdb_rating: omdbJson.imdbRating || 'N/A',
                imdb_votes: omdbJson.imdbVotes || 'N/A',
                metascore: omdbJson.Metascore || 'N/A',
                runtime: omdbJson.Runtime || 'N/A',
                rated: omdbJson.Rated || 'N/A',
                awards: omdbJson.Awards || 'N/A',
                director: omdbJson.Director || 'N/A',
                actors: omdbJson.Actors || 'N/A',
                plot: omdbJson.Plot || 'N/A',
                year: omdbJson.Year || 'N/A',
                country: omdbJson.Country || 'N/A',
                box_office: omdbJson.BoxOffice || 'N/A'
              };
            }
          }

          const genreNames = (movie.genre_ids || []).map((id: number) => GENRES[id]).filter(Boolean);

          return {
            id: movie.id,
            title: movie.title,
            original_title: movie.original_title,
            overview: movie.overview,
            poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            age_rating: ageRating,
            genre_names: genreNames,
            providers,
            omdb
          };
        } catch {
          return null;
        }
      })
    );

    res.json({
      total_pages: discoverData.total_pages || 1,
      movies: enrichedMovies.filter(Boolean)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch movie recommendations' });
  }
});

// ============================================================================
// 2B. TMDB TV RECOMMENDATIONS
// ============================================================================
app.get('/api/tv/providers', async (_req: Request, res: Response) => {
  if (tvProvidersCache && tvProvidersCache.expiresAt > Date.now()) {
    return res.json({ providers: tvProvidersCache.providers });
  }
  const bearer = process.env.TMDB_BEARER_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  const hasBearer = !!bearer && bearer !== 'your_tmdb_bearer_token_here';
  const hasApiKey = !!apiKey && apiKey !== 'your_tmdb_api_key_here';
  if (!hasBearer && !hasApiKey) return res.status(500).json({ error: 'TMDB credentials missing in .env' });
  const headers: Record<string, string> = { accept: 'application/json' };
  if (hasBearer) headers.Authorization = `Bearer ${bearer}`;
  const suffix = hasApiKey && !hasBearer ? `?api_key=${apiKey}` : '';
  const data = await fetchJson<any>(`https://api.themoviedb.org/3/watch/providers/tv?watch_region=IN${suffix}`, headers);
  if (!data?.results) return res.status(503).json({ error: 'TMDB provider service unavailable' });
  const preferred = ['Netflix', 'Amazon Prime Video', 'JioHotstar', 'Disney+ Hotstar', 'SonyLIV', 'ZEE5', 'Apple TV+', 'MUBI', 'Lionsgate Play', 'aha'];
  const providers = data.results
    .filter((provider: any) => preferred.includes(provider.provider_name))
    .sort((a: any, b: any) => preferred.indexOf(a.provider_name) - preferred.indexOf(b.provider_name))
    .slice(0, 10)
    .map(({ provider_id, provider_name, logo_path }: any) => ({ id: provider_id, name: provider_name, logo_path }));
  tvProvidersCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, providers };
  res.json({ providers });
});

app.get('/api/tv', async (req: Request, res: Response) => {
  const genreId = String(req.query.genreId || '18');
  const age = Number(req.query.age || 18);
  const language = String(req.query.language || 'English');
  const mode = String(req.query.mode || 'popular');
  const provider = String(req.query.provider || '');
  const requestedPage = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const excludeIds = parseExcludeIds(req.query.excludeIds);
  const bearer = process.env.TMDB_BEARER_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;
  const hasBearer = !!bearer && bearer !== 'your_tmdb_bearer_token_here';
  const hasApiKey = !!apiKey && apiKey !== 'your_tmdb_api_key_here';
  const hasOmdbKey = !!omdbKey && omdbKey !== 'your_omdb_api_key_here';
  if (!hasBearer && !hasApiKey) return res.status(500).json({ error: 'TMDB credentials missing in .env' });

  const langCode = LANGUAGE_CODES[language] || 'en';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (hasBearer) headers.Authorization = `Bearer ${bearer}`;
  const authSuffix = hasApiKey && !hasBearer ? `?api_key=${apiKey}` : '';
  const today = new Date();
  const dateString = (date: Date) => date.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    with_original_language: langCode,
    include_adult: 'false',
    sort_by: mode === 'top' ? 'vote_average.desc' : 'popularity.desc',
    'vote_count.gte': mode === 'top' ? (['ta', 'te', 'kn', 'ml'].includes(langCode) ? '20' : '200') : (['ta', 'te', 'kn', 'ml'].includes(langCode) ? '20' : '50'),
    page: String(requestedPage)
  });
  if (age <= 10) params.set('with_genres', '10762|10751');
  else if (genreId) params.set('with_genres', genreId);
  if (provider) {
    params.set('with_watch_providers', provider);
    params.set('watch_region', 'IN');
  }
  if (mode === 'airing') {
    const week = new Date(today);
    week.setDate(week.getDate() + 7);
    params.set('first_air_date.gte', dateString(today));
    params.set('first_air_date.lte', dateString(week));
  } else if (mode === 'new') {
    const since = new Date(today);
    since.setDate(since.getDate() - 60);
    params.set('first_air_date.gte', dateString(since));
  }
  if (requestedPage === 1) {
    const key = `${genreId}:${age}:${language}:${mode}:${provider}`;
    const cachedPages = movieTotalPagesCache.get(`tv:${key}`);
    if (cachedPages && cachedPages > 1) params.set('page', String(Math.floor(Math.random() * Math.min(cachedPages, 20)) + 1));
  }

  try {
    const discoverUrl = `https://api.themoviedb.org/3/discover/tv?${params.toString()}${authSuffix ? `&api_key=${apiKey}` : ''}`;
    let discover = await fetchJson<any>(discoverUrl, headers);
    if (!discover?.results) {
      await new Promise((resolve) => setTimeout(resolve, 750));
      discover = await fetchJson<any>(discoverUrl, headers);
    }
    if (!discover?.results) return res.status(503).json({ error: 'TMDB TV service unavailable' });
    movieTotalPagesCache.set(`tv:${genreId}:${age}:${language}:${mode}:${provider}`, discover.total_pages || 1);
    const candidates = shuffle((discover.results || []).filter((show: any) => !excludeIds.has(String(show.id)))).slice(0, 16);
    const contentResults = await Promise.all(candidates.map(async (show: any) => {
      const ratings = await fetchJson<any>(`https://api.themoviedb.org/3/tv/${show.id}/content_ratings${authSuffix}`, headers);
      const usRating = ratings?.results?.find((r: any) => r.iso_3166_1 === 'US')?.rating;
      const inRating = ratings?.results?.find((r: any) => r.iso_3166_1 === 'IN')?.rating;
      const rating = usRating || inRating || '';
      const allowed = age <= 6 ? ['TV-Y', 'TV-G']
        : age <= 12 ? ['TV-Y', 'TV-G', 'TV-Y7', 'TV-PG']
        : age <= 16 ? ['TV-Y', 'TV-G', 'TV-Y7', 'TV-PG', 'TV-14']
        : ['TV-Y', 'TV-G', 'TV-Y7', 'TV-PG', 'TV-14', 'TV-MA'];
      if (!rating && age < 13) return null;
      if (rating && !allowed.includes(rating)) return null;
      return { show, rating: rating || 'Not Rated' };
    }));
    const selected = contentResults.filter(Boolean).slice(0, 8) as Array<{ show: any; rating: string }>;
    const enrichedTv = await Promise.all(selected.map(async ({ show, rating }) => {
      const [details, externalIds, providerData] = await Promise.all([
        fetchJson<any>(`https://api.themoviedb.org/3/tv/${show.id}${authSuffix}`, headers),
        fetchJson<any>(`https://api.themoviedb.org/3/tv/${show.id}/external_ids${authSuffix}`, headers),
        fetchJson<any>(`https://api.themoviedb.org/3/tv/${show.id}/watch/providers${authSuffix}`, headers)
      ]);
      const region = providerData?.results?.IN || providerData?.results?.US || {};
      const providers = [...(region.flatrate || []), ...(region.free || [])].slice(0, 5);
      let omdb: any = null;
      if (externalIds?.imdb_id && hasOmdbKey) {
        const omdbJson = await fetchJson<any>(`https://www.omdbapi.com/?i=${externalIds.imdb_id}&apikey=${omdbKey}&plot=full`);
        if (omdbJson?.Response === 'True') omdb = {
          imdb_rating: omdbJson.imdbRating || 'N/A', awards: omdbJson.Awards || 'N/A',
          actors: omdbJson.Actors || 'N/A', plot: omdbJson.Plot || 'N/A'
        };
      }
      return {
        id: show.id, name: details?.name || show.name, original_name: details?.original_name || show.original_name,
        overview: details?.overview || show.overview || '',
        poster_url: (details?.poster_path || show.poster_path) ? `https://image.tmdb.org/t/p/w500${details?.poster_path || show.poster_path}` : null,
        vote_average: details?.vote_average ?? show.vote_average ?? 0, first_air_date: details?.first_air_date || show.first_air_date || '',
        status: details?.status || 'Unknown', seasons: details?.number_of_seasons ?? null,
        episodes: details?.number_of_episodes ?? null, runtime: details?.episode_run_time?.[0] ?? null,
        networks: (details?.networks || []).map((network: any) => network.name), age_rating: rating,
        genre_names: (details?.genres || []).map((genre: any) => genre.name), providers, omdb
      };
    }));
    const tv = provider
      ? enrichedTv.filter((show: any) => show.providers.some((item: any) => String(item.provider_id) === provider))
      : enrichedTv;
    res.json({ tv });
  } catch {
    res.status(500).json({ error: 'Failed to fetch TV recommendations' });
  }
});

// ============================================================================
// 3. ANIME RECOMMENDATIONS ENDPOINT (AniList GraphQL API)
// ============================================================================
async function queryAniList(variables: Record<string, any>): Promise<any> {
  const query = `
    query ($page: Int, $perPage: Int, $genre_in: [String], $genre_not_in: [String], $season: MediaSeason, $seasonYear: Int, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          lastPage
        }
        media(
          type: ANIME
          isAdult: false
          genre_in: $genre_in
          genre_not_in: $genre_not_in
          season: $season
          seasonYear: $seasonYear
          sort: $sort
        ) {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
          }
          averageScore
          episodes
          status
          genres
          description(asHtml: false)
          siteUrl
        }
      }
    }
  `;

  const url = 'https://graphql.anilist.co';
  const postOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ query, variables })
  };

  let res = await fetch(url, postOptions);

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const delaySec = retryAfter ? parseInt(retryAfter, 10) : 1;
    const waitMs = (isNaN(delaySec) ? 1 : delaySec) * 1000;
    console.warn(`[AniList] Rate limited (429). Waiting ${waitMs}ms before retry...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    res = await fetch(url, postOptions);
  }

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`AniList returned HTTP ${res.status}: ${errorBody}`);
  }

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`AniList GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

app.get('/api/anime', async (req: Request, res: Response) => {
  const mode = String(req.query.mode || 'genre');
  const genres = String(req.query.genres || req.query.genre || '');
  const rating = String(req.query.rating || 'pg13').toLowerCase();
  const season = String(req.query.season || 'winter').toUpperCase();
  const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
  const requestedPage = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const excludeIds = parseExcludeIds(req.query.excludeIds || req.body?.excludeIds);

  const filterKey = `${mode}:${genres}:${rating}:${season}:${year}`;

  const variables: Record<string, any> = {
    perPage: 12
  };

  // Content rating replacement (genre_not_in):
  if (rating === 'g' || rating === 'pg') {
    variables.genre_not_in = ['Ecchi', 'Horror', 'Psychological'];
  } else if (rating === 'pg13') {
    variables.genre_not_in = ['Ecchi'];
  }

  if (mode === 'top') {
    // Top mode: random page 1..5, sort: SCORE_DESC
    variables.page = requestedPage;
    variables.sort = ['SCORE_DESC'];
  } else {
    // Genre / seasonal modes:
    // random sort from [POPULARITY_DESC, SCORE_DESC, TRENDING_DESC, FAVOURITES_DESC],
    // random page in 1..min(pageInfo.lastPage, 10)
    const animeSorts = ['POPULARITY_DESC', 'SCORE_DESC', 'TRENDING_DESC', 'FAVOURITES_DESC'];
    variables.sort = [animeSorts[Math.floor(Math.random() * animeSorts.length)]];

    if (animeLastPageCache.has(filterKey)) {
      const lastPage = animeLastPageCache.get(filterKey) || 1;
      const maxPage = Math.min(lastPage, 10);
      variables.page = requestedPage;
    } else {
      variables.page = 1;
    }

    if (mode === 'genre') {
      if (genres) {
        variables.genre_in = [genres];
      }
    } else if (mode === 'seasonal') {
      variables.season = season;
      variables.seasonYear = isNaN(year) ? new Date().getFullYear() : year;
    }
  }

  try {
    const data = await queryAniList(variables);

    if (data?.Page?.pageInfo?.lastPage) {
      animeLastPageCache.set(filterKey, data.Page.pageInfo.lastPage);
    }

    const rawList: any[] = data?.Page?.media || [];

    // Shuffle and exclude seen IDs
    const nonExcluded = rawList.filter((m: any) => !excludeIds.has(String(m.id)));
    const pool = nonExcluded.length > 0 ? nonExcluded : rawList;
    const shuffled = shuffle(pool);

    const anime = shuffled.map((m: any) => ({
      id: m.id,
      title: m.title?.english || m.title?.romaji || 'Unknown Title',
      image: m.coverImage?.large || null,
      score: m.averageScore != null ? Number((m.averageScore / 10).toFixed(1)) : null,
      episodes: m.episodes ?? null,
      status: m.status ?? null,
      genres: m.genres ?? [],
      synopsis: m.description ? m.description.replace(/<[^>]*>/g, '') : 'No synopsis available.',
      url: m.siteUrl || null
    }));

    res.json({ anime });
  } catch (err) {
    console.error('Error fetching anime from AniList GraphQL API:', err);
    res.status(500).json({ error: 'Failed to fetch anime recommendations from AniList API' });
  }
});

// ============================================================================
// 4. VIDEO GAMES RECOMMENDATIONS ENDPOINT (RAWG API)
// ============================================================================
app.get('/api/games', async (req: Request, res: Response) => {
  const platform = String(req.query.platform || '');
  const genre = String(req.query.genre || '');
  const age = Number(req.query.age || 18);
  const mode = String(req.query.mode || 'recommended');
  const requestedPage = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const excludeIds = parseExcludeIds(req.query.excludeIds || req.body?.excludeIds);

  const rawgApiKey = process.env.RAWG_API_KEY;
  if (!rawgApiKey || rawgApiKey === 'your_rawg_api_key_here') {
    return res.status(500).json({ error: 'RAWG_API_KEY is not configured in .env' });
  }

  // Random ordering from [-rating, -added, -metacritic, -released], random page 1..10
  const gameOrderings = ['-rating', '-added', '-metacritic', '-released'];
  const randomOrdering = gameOrderings[Math.floor(Math.random() * gameOrderings.length)];

  const params = new URLSearchParams({
    key: rawgApiKey,
    page: String(requestedPage),
    page_size: '40',
    ordering: randomOrdering
  });

  if (platform) params.set('platforms', platform);
  if (genre) params.set('genres', genre);

  if (mode === 'upcoming') {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const future = new Date(now);
    future.setMonth(future.getMonth() + 6);
    const futureStr = future.toISOString().split('T')[0];
    params.set('dates', `${todayStr},${futureStr}`);
  } else {
    params.set('metacritic', '70,100');
  }

  try {
    const rawData = await fetchJson<any>(`https://api.rawg.io/api/games?${params.toString()}`);
    if (!rawData || !rawData.results) {
      return res.status(503).json({ error: 'RAWG service unavailable' });
    }

    const results: any[] = rawData.results || [];

    // Filter by ESRB rating slug based on user age:
    // age <= 9: everyone
    // age <= 12: everyone, everyone-10-plus
    // age <= 16: everyone, everyone-10-plus, teen
    // age > 16: all except adults-only
    // Keep games with no ESRB rating only when age >= 13
    const filtered = results.filter((game: any) => {
      const esrbSlug = game.esrb_rating?.slug;
      if (!esrbSlug) {
        return age >= 13;
      }
      if (esrbSlug === 'adults-only') {
        return false;
      }
      if (age <= 9) {
        return esrbSlug === 'everyone';
      }
      if (age <= 12) {
        return esrbSlug === 'everyone' || esrbSlug === 'everyone-10-plus';
      }
      if (age <= 16) {
        return esrbSlug === 'everyone' || esrbSlug === 'everyone-10-plus' || esrbSlug === 'teen';
      }
      return true;
    });

    // Shuffle and exclude seen IDs
    const nonExcluded = filtered.filter((game: any) => !excludeIds.has(String(game.id)));
    const shuffled = shuffle(nonExcluded);

    const games = shuffled.slice(0, 12).map((g: any) => ({
      id: g.id,
      name: g.name,
      background_image: g.background_image || null,
      released: g.released || 'TBA',
      rating: g.rating || 0,
      metacritic: g.metacritic || null,
      platforms: (g.platforms || []).map((p: any) => p.platform?.name).filter(Boolean),
      genres: (g.genres || []).map((gen: any) => gen.name).filter(Boolean),
      esrb: g.esrb_rating?.name || 'Not Rated'
    }));

    res.json({ games });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch game recommendations' });
  }
});

// ============================================================================
// 5. AI-ENHANCED ENGINE ENDPOINT (Gemini Flash + Tavily Context)
// ============================================================================
const VALID_TARGETS = ['videos', 'music', 'movies', 'tv', 'anime', 'games'] as const;
const VALID_MOODS = ['Happy', 'Sad', 'Energetic', 'Relaxed', 'Stressed', 'Bored', 'Adventurous'] as const;
const VALID_LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Kannada'] as const;
const VALID_MOVIE_GENRES = ['28', '35', '18', '10751', '27', '10749', '878', '16'] as const;
const VALID_TV_GENRES = ['10759', '35', '80', '18', '10751', '10762', '9648', '10765', '99', '10764', '16'] as const;
const VALID_ANIME_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Mystery'] as const;
const VALID_GAME_GENRES = ['action', 'adventure', 'role-playing-games-rpg', 'shooter', 'puzzle', 'racing', 'sports', 'strategy', 'indie'] as const;
const VALID_GAME_PLATFORMS = ['4', '187', '18', '186', '7', '21', '3'] as const;

const GEMINI_FLASH_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
];

async function searchTavilyNews(query: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey === 'your_tavily_api_key_here') return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        topic: 'news',
        max_results: 5
      })
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return data.results.map((r: any) => `- ${r.title}: ${r.content}`).join('\n\n');
  } catch {
    return null;
  }
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is missing');
  }

  let lastError: any = null;
  for (const model of GEMINI_FLASH_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });
      const data: any = await res.json();
      if (data.error) {
        lastError = data.error;
        console.warn(`[Gemini ${model} Error]`, data.error.message?.slice(0, 100));
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err: any) {
      lastError = err;
      continue;
    }
  }
  throw new Error(lastError?.message || 'Failed to get response from Gemini Flash');
}

const AI_SYSTEM_PROMPT = `You are the R.E.T.R.O. entertainment intelligence engine.
Your task is to analyze the user's natural language request and optional cross-platform taste profile, and select the optimal entertainment recommendation parameters.
You MUST output ONLY a valid, raw JSON object (no markdown formatting, no code fences, no extra text).

JSON Schema:
{
  "target": "videos" | "music" | "movies" | "tv" | "anime" | "games",
  "mood": "Happy" | "Sad" | "Energetic" | "Relaxed" | "Stressed" | "Bored" | "Adventurous",
  "language": "English" | "Tamil" | "Hindi" | "Telugu" | "Malayalam" | "Kannada",
  "age": number | null,
  "movieGenreId": "28" | "35" | "18" | "10751" | "27" | "10749" | "878" | "16" | null,
  "tvGenreId": "10759" | "35" | "80" | "18" | "10751" | "10762" | "9648" | "10765" | "99" | "10764" | "16" | null,
  "animeGenre": "Action" | "Adventure" | "Comedy" | "Drama" | "Fantasy" | "Romance" | "Sci-Fi" | "Mystery" | null,
  "gameGenre": "action" | "adventure" | "role-playing-games-rpg" | "shooter" | "puzzle" | "racing" | "sports" | "strategy" | "indie" | null,
  "gamePlatform": "4" | "187" | "18" | "186" | "7" | "21" | "3" | null,
  "reason": string
}

Dropdown & ID Reference Rules:
- "target":
  - Music / songs / tracks / audio -> "music"
  - Movies / films / cinema / cartoons -> "movies"
  - TV shows / web series / television / binge-worthy series -> "tv"
  - Anime / Japanese animation -> "anime"
  - Video games / console / PC -> "games"
  - Videos / clips / comedy / shorts / youtube -> "videos"
  - If open-ended (e.g. "recommend something for me"), choose the best target based on their taste profile.
- "mood": Must be one of: Happy, Sad, Energetic, Relaxed, Stressed, Bored, Adventurous. If stressed or tired, map to Relaxed or Stressed.
- "language": Must be one of: English, Tamil, Hindi, Telugu, Malayalam, Kannada. If not specified, infer from taste profile or default to English.
- "age": Set to integer if mentioned (e.g. "I'm 10" -> 10), else null.
- "movieGenreId": TMDB IDs: 28=Action, 35=Comedy, 18=Drama, 10751=Family, 27=Horror, 10749=Romance, 878=Science Fiction, 16=Animation. (fun cartoon -> 16).
  - "tvGenreId": TMDB TV IDs: 10759=Action & Adventure, 35=Comedy, 80=Crime, 18=Drama, 10751=Family, 10762=Kids, 9648=Mystery, 10765=Sci-Fi & Fantasy, 99=Documentary, 10764=Reality, 16=Animation.
- "animeGenre": Action, Adventure, Comedy, Drama, Fantasy, Romance, Sci-Fi, Mystery.
- "gameGenre": action, adventure, role-playing-games-rpg, shooter, puzzle, racing, sports, strategy, indie.
- "gamePlatform": 4=PC, 187=PS5, 18=PS4, 186=Xbox Series, 7=Nintendo Switch, 21=Android, 3=iOS.
- Cross-platform learning: If the user liked sad Tamil songs, you can suggest a Tamil drama movie (target: "movies", language: "Tamil", movieGenreId: "18", mood: "Sad").
- "reason": One punchy sentence explaining your recommendation choice.`;

app.post('/api/ai/parse', async (req: Request, res: Response) => {
  const { text, tasteProfile, currentUi } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing prompt text' });
  }

  // If the text mentions new/latest/trending and TAVILY_API_KEY exists, call Tavily first
  const isTrendingQuery = /\b(new|latest|trending|recent)\b/i.test(text);
  let tavilyContext: string | null = null;
  if (isTrendingQuery) {
    tavilyContext = await searchTavilyNews(text);
  }

  const userPrompt = `${AI_SYSTEM_PROMPT}

User Prompt: "${text}"
${tasteProfile ? `User Taste Profile: ${JSON.stringify(tasteProfile)}` : 'No taste profile available.'}
${tavilyContext ? `Latest News & Trending Context:\n${tavilyContext}` : ''}`;

  try {
    const rawAiText = await callGemini(userPrompt);
    // Strip ```json fences
    const cleanJson = rawAiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      return res.status(502).json({ error: 'AI OFFLINE — USE MANUAL CONTROLS' });
    }

    // Validate every field against the allowed dropdown values
    const target = VALID_TARGETS.includes(parsed.target) ? parsed.target : (currentUi?.target || 'videos');
    const mood = VALID_MOODS.includes(parsed.mood) ? parsed.mood : (currentUi?.mood || 'Happy');
    const language = VALID_LANGUAGES.includes(parsed.language) ? parsed.language : (currentUi?.language || 'English');

    let age: number | null = null;
    if (parsed.age != null && !isNaN(Number(parsed.age))) {
      const parsedAge = Number(parsed.age);
      if (parsedAge >= 1 && parsedAge <= 100) {
        age = parsedAge;
      }
    }

    let movieGenreId: string | null = null;
    if (parsed.movieGenreId != null && VALID_MOVIE_GENRES.includes(String(parsed.movieGenreId) as any)) {
      movieGenreId = String(parsed.movieGenreId);
    }

    let tvGenreId: string | null = null;
    if (parsed.tvGenreId != null && VALID_TV_GENRES.includes(String(parsed.tvGenreId) as any)) {
      tvGenreId = String(parsed.tvGenreId);
    }

    let animeGenre: string | null = null;
    if (parsed.animeGenre && VALID_ANIME_GENRES.includes(parsed.animeGenre)) {
      animeGenre = parsed.animeGenre;
    }

    let gameGenre: string | null = null;
    if (parsed.gameGenre && VALID_GAME_GENRES.includes(parsed.gameGenre)) {
      gameGenre = parsed.gameGenre;
    }

    let gamePlatform: string | null = null;
    if (parsed.gamePlatform != null && VALID_GAME_PLATFORMS.includes(String(parsed.gamePlatform) as any)) {
      gamePlatform = String(parsed.gamePlatform);
    }

    const reason = typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
      ? parsed.reason.trim()
      : 'R.E.T.R.O. AI tailored recommendation.';

    return res.json({
      target,
      mood,
      language,
      age,
      movieGenreId,
      tvGenreId,
      animeGenre,
      gameGenre,
      gamePlatform,
      reason,
      tavilyUsed: !!tavilyContext
    });
  } catch (err: any) {
    console.error('[AI Parse Error]', err?.message || err);
    return res.status(503).json({ error: 'AI OFFLINE — USE MANUAL CONTROLS' });
  }
});

app.listen(PORT, () => {
  console.log(`🕹️ R.E.T.R.O. Server online at http://localhost:${PORT}`);
});
