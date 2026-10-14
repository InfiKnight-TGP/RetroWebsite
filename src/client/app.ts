type ViewName = 'home' | 'videos' | 'music' | 'movies' | 'anime' | 'games';

interface GameItem {
  id: number;
  name: string;
  background_image: string | null;
  released: string;
  rating: number;
  metacritic: number | null;
  platforms: string[];
  genres: string[];
  esrb: string;
}

interface YouTubeResponse {
  id: string;
  title?: string;
  channel?: string;
  topic: string;
  iterations: number;
  source: string;
}

interface OmdbDetails {
  imdb_rating: string;
  imdb_votes: string;
  metascore: string;
  runtime: string;
  rated: string;
  awards: string;
  director: string;
  actors: string;
  plot: string;
  year: string;
  country: string;
  box_office: string;
}

interface MovieItem {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_url: string | null;
  vote_average: number;
  vote_count: number;
  age_rating: string;
  genre_names: string[];
  providers: Array<{ provider_name: string; logo_path?: string }>;
  omdb: OmdbDetails | null;
}

interface AnimeItem {
  id: number;
  title: string;
  image: string | null;
  score: number | null;
  episodes: number | null;
  status: string | null;
  genres: string[];
  synopsis: string;
  url: string | null;
}

interface FeedbackItem {
  type: 'videos' | 'music' | 'movies' | 'anime' | 'games';
  id: string | number;
  title: string;
  mood?: string;
  language?: string;
  genre?: string | string[];
  liked: boolean;
  timestamp: number;
}

// Client State (Replaces st.session_state)
const state = {
  currentView: 'home' as ViewName,
  videoIterations: {} as Record<string, number>,
  videoTopics: {} as Record<string, string>,
  musicIterations: {} as Record<string, number>,
  musicTopics: {} as Record<string, string>,
  moviesQueue: [] as MovieItem[],
  movieIndex: 0,
  moviePage: 1,
  gamesQueue: [] as GameItem[],
  gameIndex: 0,
  gamePage: 1,
  animeQueue: [] as AnimeItem[],
  animeIndex: 0,
  animePage: 1,
  lastAiReason: '' as string,
  lastAiReasonIsError: false as boolean
};

// DOM Elements
const outlet = document.getElementById('view-outlet') as HTMLElement;
const prefPanel = document.getElementById('preferences-panel') as HTMLElement;

// Control Groups
const moodGroup = document.getElementById('mood-group') as HTMLElement;
const genreGroup = document.getElementById('genre-group') as HTMLElement;
const animeModeGroup = document.getElementById('anime-mode-group') as HTMLElement;
const animeGenreGroup = document.getElementById('anime-genre-group') as HTMLElement;
const animeRatingGroup = document.getElementById('anime-rating-group') as HTMLElement;
const animeSeasonGroup = document.getElementById('anime-season-group') as HTMLElement;
const animeYearGroup = document.getElementById('anime-year-group') as HTMLElement;

const gameModeGroup = document.getElementById('game-mode-group') as HTMLElement;
const gamePlatformGroup = document.getElementById('game-platform-group') as HTMLElement;
const gameGenreGroup = document.getElementById('game-genre-group') as HTMLElement;

const ageGroup = document.getElementById('age-group') as HTMLElement;
const languageGroup = document.getElementById('language-group') as HTMLElement;

// Inputs & Selects
const moodSelect = document.getElementById('mood-select') as HTMLSelectElement;
const genreSelect = document.getElementById('genre-select') as HTMLSelectElement;
const ageSlider = document.getElementById('age-slider') as HTMLInputElement;
const ageValue = document.getElementById('age-value') as HTMLElement;
const ageBadge = document.getElementById('age-badge') as HTMLElement;
const langSelect = document.getElementById('language-select') as HTMLSelectElement;

const animeModeSelect = document.getElementById('anime-mode') as HTMLSelectElement;
const animeGenreSelect = document.getElementById('anime-genre') as HTMLSelectElement;
const animeRatingSelect = document.getElementById('anime-rating') as HTMLSelectElement;
const animeSeasonSelect = document.getElementById('anime-season') as HTMLSelectElement;
const animeYearInput = document.getElementById('anime-year') as HTMLInputElement;

const gameModeSelect = document.getElementById('game-mode') as HTMLSelectElement;
const gamePlatformSelect = document.getElementById('game-platform') as HTMLSelectElement;
const gameGenreSelect = document.getElementById('game-genre') as HTMLSelectElement;

// Main Action, Reset & AI Buttons
const fetchBtn = document.getElementById('fetch-action-btn') as HTMLButtonElement;
const surpriseBtn = document.getElementById('surprise-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const clearProfileBtn = document.getElementById('clear-profile-btn') as HTMLButtonElement | null;
const tabAiPromptInput = document.getElementById('tab-ai-prompt') as HTMLInputElement | null;
const tabAiSubmitBtn = document.getElementById('tab-ai-submit-btn') as HTMLButtonElement | null;

// ============================================================================
// LOCALSTORAGE SEEN & FEEDBACK TRACKING
// ============================================================================
const SEEN_STORAGE_PREFIX = 'retro_seen_';
const MAX_SEEN_COUNT = 300;

function getSeenIds(module: string): string[] {
  try {
    const raw = localStorage.getItem(`${SEEN_STORAGE_PREFIX}${module}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function addSeenId(module: string, id: string | number | undefined | null) {
  if (id === undefined || id === null) return;
  const strId = String(id).trim();
  if (!strId) return;
  try {
    let ids = getSeenIds(module);
    ids = ids.filter((x) => x !== strId);
    ids.push(strId);
    if (ids.length > MAX_SEEN_COUNT) {
      ids = ids.slice(ids.length - MAX_SEEN_COUNT);
    }
    localStorage.setItem(`${SEEN_STORAGE_PREFIX}${module}`, JSON.stringify(ids));
  } catch {
    // Graceful degradation
  }
}

function clearAllSeenIds() {
  try {
    const modules = ['videos', 'music', 'movies', 'anime', 'games'];
    modules.forEach((mod) => localStorage.removeItem(`${SEEN_STORAGE_PREFIX}${mod}`));
  } catch {
    // Graceful degradation
  }
}

// Feedback Storage (max 100 items, oldest dropped first)
const FEEDBACK_STORAGE_KEY = 'retro_feedback';
const MAX_FEEDBACK_COUNT = 100;

function getFeedbackList(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFeedback(item: FeedbackItem) {
  try {
    let list = getFeedbackList();
    list = list.filter((f) => !(f.type === item.type && String(f.id) === String(item.id)));
    list.push(item);
    if (list.length > MAX_FEEDBACK_COUNT) {
      list = list.slice(list.length - MAX_FEEDBACK_COUNT);
    }
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list));

    // Disliked IDs are added to that module's seen/exclude list automatically
    if (!item.liked) {
      addSeenId(item.type, item.id);
    }
  } catch {
    // Graceful degradation
  }
}

function clearFeedback() {
  try {
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
  } catch {
    // Graceful degradation
  }
}

// Build taste profile from last 30 items
function getTasteProfileSummary() {
  const list = getFeedbackList().slice(-30);
  const liked = list.filter((f) => f.liked);
  const disliked = list.filter((f) => !f.liked);

  const langCount: Record<string, number> = {};
  const moodCount: Record<string, number> = {};
  const genreCountByModule: Record<string, Record<string, number>> = {
    videos: {}, music: {}, movies: {}, anime: {}, games: {}
  };
  const dislikedGenres: Record<string, number> = {};

  liked.forEach((f) => {
    if (f.language) langCount[f.language] = (langCount[f.language] || 0) + 1;
    if (f.mood) moodCount[f.mood] = (moodCount[f.mood] || 0) + 1;
    if (f.genre) {
      const gList = Array.isArray(f.genre) ? f.genre : [f.genre];
      gList.forEach((g) => {
        if (!g) return;
        if (!genreCountByModule[f.type]) genreCountByModule[f.type] = {};
        genreCountByModule[f.type][g] = (genreCountByModule[f.type][g] || 0) + 1;
      });
    }
  });

  disliked.forEach((f) => {
    if (f.genre) {
      const gList = Array.isArray(f.genre) ? f.genre : [f.genre];
      gList.forEach((g) => {
        if (!g) return;
        dislikedGenres[g] = (dislikedGenres[g] || 0) + 1;
      });
    }
  });

  const topLanguages = Object.entries(langCount).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const topMoods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const favoriteGenresByModule: Record<string, string[]> = {};
  for (const [mod, gMap] of Object.entries(genreCountByModule)) {
    favoriteGenresByModule[mod] = Object.entries(gMap).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }

  const dislikedGenreList = Object.entries(dislikedGenres).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  return {
    totalRatings: list.length,
    likedCount: liked.length,
    dislikedCount: disliked.length,
    topLanguages,
    topMoods,
    favoriteGenresByModule,
    dislikedGenres: dislikedGenreList,
    recentLikedTitles: liked.slice(-5).map((f) => f.title)
  };
}

// Helpers
function getAgeGroup(age: number): 'kids' | 'teens' | 'adults' {
  if (age <= 12) return 'kids';
  if (age <= 19) return 'teens';
  return 'adults';
}

function resetMoviesQueue() {
  state.moviesQueue = [];
  state.movieIndex = 0;
  state.moviePage = 1;
}

function resetGamesQueue() {
  state.gamesQueue = [];
  state.gameIndex = 0;
  state.gamePage = 1;
}

function resetAnimeQueue() {
  state.animeQueue = [];
  state.animeIndex = 0;
  state.animePage = 1;
}

function updateAnimeModeVisibility() {
  const mode = animeModeSelect.value;
  if (mode === 'genre') {
    animeGenreGroup.classList.remove('hidden');
    animeRatingGroup.classList.remove('hidden');
    animeSeasonGroup.classList.add('hidden');
    animeYearGroup.classList.add('hidden');
  } else if (mode === 'seasonal') {
    animeGenreGroup.classList.add('hidden');
    animeRatingGroup.classList.add('hidden');
    animeSeasonGroup.classList.remove('hidden');
    animeYearGroup.classList.remove('hidden');
  } else if (mode === 'top') {
    animeGenreGroup.classList.add('hidden');
    animeRatingGroup.classList.add('hidden');
    animeSeasonGroup.classList.add('hidden');
    animeYearGroup.classList.add('hidden');
  }
}

function updateFetchButtonText() {
  const v = state.currentView;
  if (v === 'videos') {
    fetchBtn.textContent = '📺 GET VIDEO RECOMMENDATION';
  } else if (v === 'music') {
    fetchBtn.textContent = '🎵 GET MUSIC RECOMMENDATION';
  } else if (v === 'movies') {
    if (state.moviesQueue.length > 0) {
      if (state.movieIndex < state.moviesQueue.length - 1) {
        fetchBtn.textContent = `🎬 NEXT MOVIE (${state.movieIndex + 1}/${state.moviesQueue.length})`;
      } else {
        fetchBtn.textContent = `🔄 FETCH NEW BATCH (BATCH ${state.moviePage})`;
      }
    } else {
      fetchBtn.textContent = '🎬 GET MOVIE RECOMMENDATION';
    }
  } else if (v === 'anime') {
    if (state.animeQueue.length > 0) {
      if (state.animeIndex < state.animeQueue.length - 1) {
        fetchBtn.textContent = `⛩️ NEXT ANIME (${state.animeIndex + 1}/${state.animeQueue.length})`;
      } else {
        fetchBtn.textContent = `🔄 FETCH NEW BATCH (BATCH ${state.animePage})`;
      }
    } else {
      fetchBtn.textContent = '⛩️ GET ANIME RECOMMENDATION';
    }
  } else if (v === 'games') {
    if (state.gamesQueue.length > 0) {
      if (state.gameIndex < state.gamesQueue.length - 1) {
        fetchBtn.textContent = `🎮 NEXT GAME (${state.gameIndex + 1}/${state.gamesQueue.length})`;
      } else {
        fetchBtn.textContent = `🔄 FETCH NEW BATCH (BATCH ${state.gamePage})`;
      }
    } else {
      fetchBtn.textContent = '🎮 GET GAME RECOMMENDATION';
    }
  }
}

// Age Slider Sync & Change Event
ageSlider.addEventListener('input', () => {
  const age = Number(ageSlider.value);
  ageValue.textContent = String(age);
  ageBadge.textContent = getAgeGroup(age).toUpperCase();
  if (state.currentView === 'movies') {
    resetMoviesQueue();
    updateFetchButtonText();
  }
  if (state.currentView === 'games') {
    resetGamesQueue();
    updateFetchButtonText();
  }
});

// Movies filter listeners
genreSelect.addEventListener('change', () => {
  if (state.currentView === 'movies') {
    resetMoviesQueue();
    updateFetchButtonText();
  }
});

langSelect.addEventListener('change', () => {
  if (state.currentView === 'movies') {
    resetMoviesQueue();
    updateFetchButtonText();
  }
});

// Anime filter listeners
animeModeSelect.addEventListener('change', () => {
  updateAnimeModeVisibility();
  resetAnimeQueue();
  updateFetchButtonText();
});
animeGenreSelect.addEventListener('change', () => {
  resetAnimeQueue();
  updateFetchButtonText();
});
animeRatingSelect.addEventListener('change', () => {
  resetAnimeQueue();
  updateFetchButtonText();
});
animeSeasonSelect.addEventListener('change', () => {
  resetAnimeQueue();
  updateFetchButtonText();
});
animeYearInput.addEventListener('input', () => {
  resetAnimeQueue();
  updateFetchButtonText();
});

// Games filter listeners
gameModeSelect.addEventListener('change', () => {
  resetGamesQueue();
  updateFetchButtonText();
});
gamePlatformSelect.addEventListener('change', () => {
  resetGamesQueue();
  updateFetchButtonText();
});
gameGenreSelect.addEventListener('change', () => {
  resetGamesQueue();
  updateFetchButtonText();
});

// Reset Session Memory
resetBtn.addEventListener('click', () => {
  state.videoIterations = {};
  state.videoTopics = {};
  state.musicIterations = {};
  state.musicTopics = {};
  resetMoviesQueue();
  resetGamesQueue();
  resetAnimeQueue();
  clearAllSeenIds();
  updateFetchButtonText();
  renderPromptMessage('MEMORY BANKS CLEARED! CLICK GENERATE ABOVE TO START.');
});

// Clear Taste Profile Button
clearProfileBtn?.addEventListener('click', () => {
  clearFeedback();
  if (state.currentView === 'home') {
    renderHomeView();
  } else {
    renderPromptMessage('🧠 TASTE PROFILE CLEARED! RATE NEW CONTENT TO RETRAIN.');
  }
});

// Navigation Listener
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = (btn as HTMLElement).dataset.view as ViewName;
    switchView(view);
  });
});

function switchView(view: ViewName) {
  state.currentView = view;
  document.querySelectorAll('.nav-btn').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.view === view);
  });

  if (view === 'home') {
    prefPanel.classList.add('hidden');
    renderHomeView();
    return;
  }

  // Display the common preferences panel for all subpages
  prefPanel.classList.remove('hidden');

  // Toggle controls for current subpage
  moodGroup.classList.toggle('hidden', view !== 'videos' && view !== 'music');
  genreGroup.classList.toggle('hidden', view !== 'movies');
  ageGroup.classList.toggle('hidden', view === 'anime');
  languageGroup.classList.toggle('hidden', view !== 'videos' && view !== 'music' && view !== 'movies');

  const isAnime = view === 'anime';
  animeModeGroup.classList.toggle('hidden', !isAnime);
  if (isAnime) {
    updateAnimeModeVisibility();
  } else {
    animeGenreGroup.classList.add('hidden');
    animeRatingGroup.classList.add('hidden');
    animeSeasonGroup.classList.add('hidden');
    animeYearGroup.classList.add('hidden');
  }

  const isGames = view === 'games';
  gameModeGroup.classList.toggle('hidden', !isGames);
  gamePlatformGroup.classList.toggle('hidden', !isGames);
  gameGenreGroup.classList.toggle('hidden', !isGames);

  updateFetchButtonText();

  // Render subpage content in outlet
  if (view === 'videos') {
    renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "📺 GET VIDEO RECOMMENDATION"!');
  } else if (view === 'music') {
    renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "🎵 GET MUSIC RECOMMENDATION"!');
  } else if (view === 'movies') {
    if (state.moviesQueue.length > 0) {
      renderMovieCard(state.moviesQueue[state.movieIndex]);
    } else {
      renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "🎬 GET MOVIE RECOMMENDATION"!');
    }
  } else if (view === 'anime') {
    if (state.animeQueue.length > 0) {
      renderAnimeCard(state.animeQueue[state.animeIndex]);
    } else {
      renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "⛩️ GET ANIME RECOMMENDATION"!');
    }
  } else if (view === 'games') {
    if (state.gamesQueue.length > 0) {
      renderGameCard(state.gamesQueue[state.gameIndex]);
    } else {
      renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "🎮 GET GAME RECOMMENDATION"!');
    }
  }
}

function renderPromptMessage(msg: string) {
  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <div class="retro-card" style="text-align: center; padding: 2.5rem;">
      <p style="font-family: var(--font-term); font-size: 1.5rem; color: var(--retro-cyan);">${msg}</p>
    </div>
  `;
}

// ============================================================================
// AI REASON BANNER & FEEDBACK HELPERS
// ============================================================================
function renderAiReasonBannerHtml(): string {
  if (!state.lastAiReason) return '';
  const isErr = state.lastAiReasonIsError;
  return `
    <div class="ai-reason-banner ${isErr ? 'error' : ''}">
      <span>${isErr ? '⚠️' : '🤖'}</span>
      <span>${state.lastAiReason}</span>
    </div>
  `;
}

function renderAiReasonBanner(text: string, isError = false) {
  state.lastAiReason = text;
  state.lastAiReasonIsError = isError;
  const existing = document.querySelector('.ai-reason-banner');
  if (existing) {
    existing.className = `ai-reason-banner ${isError ? 'error' : ''}`;
    existing.innerHTML = `<span>${isError ? '⚠️' : '🤖'}</span><span>${text}</span>`;
  }
}

function renderFeedbackControls(
  type: 'videos' | 'music' | 'movies' | 'anime' | 'games',
  id: string | number,
  title: string,
  genre?: string | string[]
): string {
  const list = getFeedbackList();
  const existing = list.find((f) => f.type === type && String(f.id) === String(id));
  const isLiked = existing?.liked === true;
  const isDisliked = existing?.liked === false;
  const safeTitle = (title || '').replace(/"/g, '&quot;');
  const safeGenre = encodeURIComponent(JSON.stringify(genre || ''));

  return `
    <div class="card-feedback" data-feedback-container="true">
      <span class="feedback-label">RATE RECOMMENDATION:</span>
      <button class="feedback-btn thumbs-up ${isLiked ? 'active-like' : ''}" data-type="${type}" data-id="${id}" data-title="${safeTitle}" data-genre="${safeGenre}">
        👍 ${isLiked ? 'LIKED' : 'LIKE'}
      </button>
      <button class="feedback-btn thumbs-down ${isDisliked ? 'active-dislike' : ''}" data-type="${type}" data-id="${id}" data-title="${safeTitle}" data-genre="${safeGenre}">
        👎 ${isDisliked ? 'DISLIKED' : 'DISLIKE'}
      </button>
      <span class="feedback-status">${isLiked ? '⭐ SAVED TO PROFILE' : isDisliked ? '⛔ EXCLUDED' : ''}</span>
    </div>
  `;
}

function attachFeedbackListeners() {
  document.querySelectorAll('.card-feedback').forEach((container) => {
    const upBtn = container.querySelector('.thumbs-up') as HTMLButtonElement | null;
    const downBtn = container.querySelector('.thumbs-down') as HTMLButtonElement | null;
    const statusSpan = container.querySelector('.feedback-status') as HTMLElement | null;

    if (!upBtn || !downBtn) return;

    upBtn.onclick = () => {
      const type = upBtn.dataset.type as any;
      const id = upBtn.dataset.id!;
      const title = upBtn.dataset.title || '';
      let genre: any = '';
      try { genre = JSON.parse(decodeURIComponent(upBtn.dataset.genre || '')); } catch {}

      saveFeedback({
        type,
        id,
        title,
        mood: moodSelect.value,
        language: langSelect.value,
        genre,
        liked: true,
        timestamp: Date.now()
      });

      upBtn.classList.add('active-like');
      upBtn.textContent = '👍 LIKED';
      downBtn.classList.remove('active-dislike');
      downBtn.textContent = '👎 DISLIKE';
      if (statusSpan) statusSpan.textContent = '⭐ SAVED TO TASTE PROFILE';
    };

    downBtn.onclick = () => {
      const type = downBtn.dataset.type as any;
      const id = downBtn.dataset.id!;
      const title = downBtn.dataset.title || '';
      let genre: any = '';
      try { genre = JSON.parse(decodeURIComponent(downBtn.dataset.genre || '')); } catch {}

      saveFeedback({
        type,
        id,
        title,
        mood: moodSelect.value,
        language: langSelect.value,
        genre,
        liked: false,
        timestamp: Date.now()
      });

      downBtn.classList.add('active-dislike');
      downBtn.textContent = '👎 DISLIKED';
      upBtn.classList.remove('active-like');
      upBtn.textContent = '👍 LIKE';
      if (statusSpan) statusSpan.textContent = '⛔ EXCLUDED FROM FUTURE PICKS';
    };
  });
}

// ============================================================================
// NATURAL LANGUAGE AI PARSING ENGINE
// ============================================================================
async function handleAiPrompt(promptText: string) {
  if (!promptText || !promptText.trim()) return;

  const tasteProfile = getTasteProfileSummary();
  const currentUi = {
    target: state.currentView === 'home' ? 'videos' : state.currentView,
    mood: moodSelect.value,
    language: langSelect.value,
    age: Number(ageSlider.value),
    movieGenreId: genreSelect.value,
    animeGenre: animeGenreSelect.value,
    gameGenre: gameGenreSelect.value,
    gamePlatform: gamePlatformSelect.value
  };

  fetchBtn.disabled = true;
  state.lastAiReason = '⏳ CONSULTING GEMINI FLASH ENGINE...';
  state.lastAiReasonIsError = false;
  if (state.currentView !== 'home') {
    renderAiReasonBanner('⏳ CONSULTING GEMINI FLASH ENGINE...', false);
  } else {
    renderPromptMessage('⏳ CONSULTING GEMINI FLASH ENGINE...');
  }

  try {
    const res = await fetch('/api/ai/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: promptText,
        tasteProfile,
        currentUi
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      renderAiReasonBanner(err.error || 'AI OFFLINE — USE MANUAL CONTROLS', true);
      fetchBtn.disabled = false;
      return;
    }

    const aiConfig = await res.json();
    if (aiConfig.error) {
      renderAiReasonBanner(aiConfig.error, true);
      fetchBtn.disabled = false;
      return;
    }

    // 1. Switch to the target view
    const target = aiConfig.target as ViewName;
    switchView(target);

    // 2. Set the UI dropdowns & slider
    if (aiConfig.mood) moodSelect.value = aiConfig.mood;
    if (aiConfig.language) langSelect.value = aiConfig.language;
    if (aiConfig.age != null) {
      ageSlider.value = String(aiConfig.age);
      ageValue.textContent = String(aiConfig.age);
      ageBadge.textContent = getAgeGroup(aiConfig.age).toUpperCase();
    }
    if (aiConfig.movieGenreId) {
      genreSelect.value = String(aiConfig.movieGenreId);
      resetMoviesQueue();
    }
    if (aiConfig.animeGenre) {
      animeGenreSelect.value = aiConfig.animeGenre;
      resetAnimeQueue();
    }
    if (aiConfig.gameGenre) {
      gameGenreSelect.value = aiConfig.gameGenre;
      resetGamesQueue();
    }
    if (aiConfig.gamePlatform) {
      gamePlatformSelect.value = String(aiConfig.gamePlatform);
      resetGamesQueue();
    }

    // 3. Save reason
    state.lastAiReason = `${aiConfig.reason}${aiConfig.tavilyUsed ? ' (Live Web Insights)' : ''}`;
    state.lastAiReasonIsError = false;

    // 4. Auto-trigger generate recommendation
    fetchBtn.disabled = false;
    fetchBtn.click();
  } catch {
    renderAiReasonBanner('AI OFFLINE — USE MANUAL CONTROLS', true);
    fetchBtn.disabled = false;
  }
}

// Compact tab AI bar listeners
tabAiSubmitBtn?.addEventListener('click', () => {
  if (tabAiPromptInput && tabAiPromptInput.value.trim()) {
    const text = tabAiPromptInput.value.trim();
    tabAiPromptInput.value = '';
    handleAiPrompt(text);
  }
});

tabAiPromptInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && tabAiPromptInput && tabAiPromptInput.value.trim()) {
    const text = tabAiPromptInput.value.trim();
    tabAiPromptInput.value = '';
    handleAiPrompt(text);
  }
});

// ============================================================================
// HOME VIEW
// ============================================================================
function renderHomeView() {
  const profile = getTasteProfileSummary();

  const formatGenres = (gMap: Record<string, string[]>) => {
    const parts: string[] = [];
    for (const [mod, gList] of Object.entries(gMap)) {
      if (gList.length) {
        parts.push(`<strong>${mod.toUpperCase()}:</strong> ${gList.slice(0, 3).join(', ')}`);
      }
    }
    return parts.length ? parts.join('<br>') : 'None yet';
  };

  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <!-- ASK R.E.T.R.O. AI Panel -->
    <div class="retro-card ai-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <h3 style="font-family: var(--font-pixel); color: var(--retro-cyan); font-size: 0.95rem;">🤖 ASK R.E.T.R.O.</h3>
        <span class="arcade-badge" style="margin:0; border-color:var(--retro-cyan); color:var(--retro-cyan);">GEMINI FLASH ENGINE</span>
      </div>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.6rem; line-height: 1.5;">
        Tell me how you feel or what you want in natural language. Powered by Gemini Flash with real-time news intelligence and cross-platform taste learning.
      </p>
      <div class="ai-input-group">
        <input type="text" id="home-ai-prompt" class="retro-input ai-input" placeholder="Tell me how you feel or what you want... (e.g. stressed after exams, want something chill in Tamil)" />
        <button id="home-ai-submit-btn" class="btn-primary">🚀 ASK R.E.T.R.O.</button>
        <button id="home-for-you-btn" class="btn-secondary" style="border-color: var(--retro-yellow); color: var(--retro-yellow); font-family: var(--font-pixel); font-size: 0.75rem;">✨ FOR YOU</button>
      </div>
    </div>

    <!-- Taste Profile Panel -->
    <div class="retro-card taste-profile-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <h3 style="font-family: var(--font-pixel); color: var(--retro-yellow); font-size: 0.95rem;">🧠 MY TASTE PROFILE</h3>
        <span class="badge">${profile.totalRatings} RATINGS LOGGED</span>
      </div>
      <div class="taste-grid">
        <div class="taste-stat-box">
          <h4>TOP LANGUAGES</h4>
          <p>${profile.topLanguages.length ? profile.topLanguages.join(', ') : 'None yet'}</p>
        </div>
        <div class="taste-stat-box">
          <h4>TOP MOODS</h4>
          <p>${profile.topMoods.length ? profile.topMoods.join(', ') : 'None yet'}</p>
        </div>
        <div class="taste-stat-box">
          <h4>FAVORITE GENRES</h4>
          <p>${formatGenres(profile.favoriteGenresByModule)}</p>
        </div>
        <div class="taste-stat-box">
          <h4>DISLIKED GENRES</h4>
          <p>${profile.dislikedGenres.length ? profile.dislikedGenres.join(', ') : 'None'}</p>
        </div>
      </div>
      ${profile.totalRatings === 0 ? '<p style="color:var(--text-muted); font-size:0.85rem; margin-top:0.9rem; text-align:center;">NO RATINGS YET — RATE ITEMS WITH 👍 OR 👎 TO TRAIN YOUR ENGINE</p>' : ''}
    </div>

    <div class="retro-card">
      <p style="font-size: 1.15rem; line-height: 1.6;">
        Welcome to <strong style="color: var(--retro-red);">R.E.T.R.O.</strong>, your personalized entertainment recommendation system! 
        Select your emotional state, age, and preferred language to discover curated content across video, music, cinema, anime, and games.
      </p>
    </div>

    <h2 class="section-title">🎯 ACTIVE MODULES</h2>
    <div class="cards-grid">
      <div class="retro-card feature-card">
        <h3>📺 VIDEO DISCOVERY</h3>
        <ul>
          <li>YouTube mood & emotion mapping</li>
          <li>Dynamic topic rotation engine</li>
          <li>Age & regional language filtering</li>
          <li>Embedded instant-play deck</li>
          <li>Offline JSON fallback library</li>
        </ul>
      </div>
      <div class="retro-card feature-card">
        <h3>🎵 MUSIC SYNTHESIZER</h3>
        <ul>
          <li>Emotional wavelength music matching</li>
          <li>Regional language track discovery</li>
          <li>Embedded instant-play deck</li>
          <li>Curated fallback tracks</li>
        </ul>
      </div>
      <div class="retro-card feature-card">
        <h3>🎬 CINEMA ARCHIVE</h3>
        <ul>
          <li>TMDB + OMDb dual API engine</li>
          <li>US & Regional Indian certification filters</li>
          <li>IMDb ratings, Metascore & Box Office</li>
          <li>Streaming provider logos</li>
          <li>Zero-repeat session queue</li>
        </ul>
      </div>
      <div class="retro-card feature-card">
        <h3>⛩️ ANIME ARCHIVE</h3>
        <ul>
          <li>AniList GraphQL integration</li>
          <li>Genre & Content Rating filters</li>
          <li>Seasonal anime time-machine</li>
          <li>Top-rated anime leaderboard</li>
          <li>One-at-a-time discovery queue</li>
        </ul>
      </div>
      <div class="retro-card feature-card">
        <h3>🎮 GAME RECOMMENDERS</h3>
        <ul>
          <li>RAWG Video Games Database integration</li>
          <li>Top-rated & Metacritic recommendations</li>
          <li>Upcoming release date tracking (6 months)</li>
          <li>ESRB age-appropriate filtering</li>
          <li>One-at-a-time discovery queue</li>
        </ul>
      </div>
      <div class="retro-card feature-card" style="border-color: var(--retro-cyan);">
        <h3 style="color: var(--retro-cyan);">🤖 AI-ENHANCED ENGINE</h3>
        <ul>
          <li>Gemini Flash natural language parser</li>
          <li>Smart cross-platform taste profiling</li>
          <li>Real-time news & trending intelligence</li>
          <li>Instant tailored "FOR YOU" generator</li>
        </ul>
      </div>
    </div>
  `;

  // Wire up Home AI elements
  const homeAiInput = document.getElementById('home-ai-prompt') as HTMLInputElement | null;
  const homeAiBtn = document.getElementById('home-ai-submit-btn') as HTMLButtonElement | null;
  const homeForYouBtn = document.getElementById('home-for-you-btn') as HTMLButtonElement | null;

  homeAiBtn?.addEventListener('click', () => {
    if (homeAiInput && homeAiInput.value.trim()) {
      handleAiPrompt(homeAiInput.value.trim());
    }
  });

  homeAiInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && homeAiInput && homeAiInput.value.trim()) {
      handleAiPrompt(homeAiInput.value.trim());
    }
  });

  homeForYouBtn?.addEventListener('click', () => {
    handleAiPrompt('recommend something for me');
  });
}

// ============================================================================
// MAIN ACTION BUTTON CLICK HANDLER
// ============================================================================
fetchBtn.addEventListener('click', async () => {
  const view = state.currentView;

  if (view === 'videos' || view === 'music') {
    handleYouTubeFetch(view === 'music' ? 'music' : 'video');
  } else if (view === 'movies') {
    if (state.moviesQueue.length > 0 && state.movieIndex < state.moviesQueue.length - 1) {
      state.movieIndex += 1;
      renderMovieCard(state.moviesQueue[state.movieIndex]);
      return;
    }
    fetchNewMoviesBatch();
  } else if (view === 'anime') {
    if (state.animeQueue.length > 0 && state.animeIndex < state.animeQueue.length - 1) {
      state.animeIndex += 1;
      renderAnimeCard(state.animeQueue[state.animeIndex]);
      return;
    }
    fetchNewAnimeBatch();
  } else if (view === 'games') {
    if (state.gamesQueue.length > 0 && state.gameIndex < state.gamesQueue.length - 1) {
      state.gameIndex += 1;
      renderGameCard(state.gamesQueue[state.gameIndex]);
      return;
    }
    fetchNewGamesBatch();
  }
});

// ============================================================================
// YOUTUBE VIDEOS & MUSIC FETCH
// ============================================================================
async function handleYouTubeFetch(type: 'video' | 'music') {
  const mood = moodSelect.value;
  const age = Number(ageSlider.value);
  const ageGroup = getAgeGroup(age);
  const language = langSelect.value;
  const isMusic = type === 'music';
  const comboKey = `${mood}-${ageGroup}-${language}`;
  const currentTopic = isMusic ? state.musicTopics[comboKey] : state.videoTopics[comboKey];
  const iterations = isMusic ? state.musicIterations[comboKey] : state.videoIterations[comboKey];

  const moduleKey = isMusic ? 'music' : 'videos';
  const excludeIds = getSeenIds(moduleKey);

  fetchBtn.disabled = true;
  renderPromptMessage('⏳ SCANNING YOUTUBE SATELLITE FEEDS...');

  try {
    const res = await fetch('/api/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: isMusic ? 'music' : 'video',
        mood,
        ageGroup,
        language,
        currentTopic,
        iterations,
        excludeIds
      })
    });
    const data: YouTubeResponse = await res.json();

    if (data.id) {
      addSeenId(moduleKey, data.id);
    }

    if (isMusic) {
      state.musicTopics[comboKey] = data.topic;
      state.musicIterations[comboKey] = data.iterations;
    } else {
      state.videoTopics[comboKey] = data.topic;
      state.videoIterations[comboKey] = data.iterations;
    }

    outlet.innerHTML = `
      ${renderAiReasonBannerHtml()}
      <div class="retro-card video-stage">
        <h3 style="font-family: var(--font-pixel); color: var(--retro-red); font-size: 0.9rem; margin-bottom: 0.5rem;">
          ${isMusic ? '🎵 RECOMMENDED TRACK' : '📺 RECOMMENDED VIDEO'}
        </h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">
          ${data.title ? `${data.title}${data.channel ? ` — <strong>${data.channel}</strong>` : ''}` : `Mood: ${mood} | Language: ${language}`}
        </p>
        <div class="iframe-wrapper">
          <iframe 
            src="https://www.youtube.com/embed/${data.id}?autoplay=1" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
        ${renderFeedbackControls(moduleKey, data.id, data.title || (isMusic ? 'Music Track' : 'Video'), mood)}
      </div>
    `;
    attachFeedbackListeners();
    fetchBtn.disabled = false;
  } catch {
    renderPromptMessage('⚠️ SIGNAL LOST. PLEASE TRY AGAIN.');
    fetchBtn.disabled = false;
  }
}

// ============================================================================
// MOVIES FETCH & CARD
// ============================================================================
async function fetchNewMoviesBatch() {
  const genreId = genreSelect.value;
  const age = Number(ageSlider.value);
  const language = langSelect.value;
  const excludeIds = getSeenIds('movies');

  fetchBtn.disabled = true;
  renderPromptMessage(`⏳ QUERYING TMDB & OMDB ARCHIVES (BATCH ${state.moviePage})...`);

  try {
    const params = new URLSearchParams({
      genreId,
      age: String(age),
      language,
      page: String(state.moviePage),
      excludeIds: excludeIds.join(',')
    });
    const res = await fetch(`/api/movies?${params.toString()}`);
    if (!res.ok) throw new Error('TMDB Error');

    const data = await res.json();
    const newMovies: MovieItem[] = data.movies || [];

    if (newMovies.length === 0) {
      if (state.moviePage > 1) {
        outlet.innerHTML = `
          ${renderAiReasonBannerHtml()}
          <div class="retro-card" style="text-align:center;">
            <p style="color: var(--retro-yellow); margin-bottom: 1rem;">🏁 END OF ARCHIVES REACHED FOR THIS FILTER COMBINATION.</p>
            <button id="restart-movies-btn" class="btn-primary">🔄 RESTART FROM BATCH 1</button>
          </div>
        `;
        document.getElementById('restart-movies-btn')?.addEventListener('click', () => {
          state.moviePage = 1;
          fetchNewMoviesBatch();
        });
      } else {
        renderPromptMessage(`NO MOVIES FOUND FOR ${language.toUpperCase()} IN THIS GENRE. TRY ANOTHER!`);
        updateFetchButtonText();
      }
      fetchBtn.disabled = false;
      return;
    }

    state.moviesQueue = newMovies;
    state.movieIndex = 0;
    state.moviePage += 1;
    fetchBtn.disabled = false;
    renderMovieCard(state.moviesQueue[0]);
  } catch {
    renderPromptMessage('⚠️ MOVIE SERVICE TEMPORARILY UNAVAILABLE. CHECK YOUR .ENV KEYS.');
    fetchBtn.disabled = false;
  }
}

function renderMovieCard(movie: MovieItem) {
  addSeenId('movies', movie.id);
  updateFetchButtonText();
  const omdb = movie.omdb;
  const ratingText =
    omdb && omdb.imdb_rating !== 'N/A'
      ? `⭐ ${omdb.imdb_rating}/10 (IMDb)`
      : `⭐ ${movie.vote_average?.toFixed(1) || 'N/A'}/10 (TMDB)`;

  const providersHtml =
    movie.providers && movie.providers.length > 0
      ? `
        <h4 style="color: var(--retro-cyan); margin-top: 1rem;">WHERE TO STREAM</h4>
        <div class="providers-list">
          ${movie.providers
            .map(
              (p) => `
            <div class="provider-item">
              ${p.logo_path ? `<img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="${p.provider_name}" />` : ''}
              <span>${p.provider_name}</span>
            </div>`
            )
            .join('')}
        </div>`
      : '';

  const currentBatchNum = Math.max(1, state.moviePage - 1);

  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <div class="retro-card media-detail-card">
      <div>
        ${
          movie.poster_url
            ? `<img class="media-poster" src="${movie.poster_url}" alt="${movie.title}" />`
            : `<div class="retro-card" style="text-align:center; padding: 4rem 1rem;">NO POSTER</div>`
        }
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; align-items:start; gap: 1rem; flex-wrap: wrap;">
          <div>
            <h2 style="font-size: 1.65rem; color: var(--retro-red);">${movie.title}</h2>
            ${
              movie.original_title && movie.original_title !== movie.title
                ? `<p style="color: var(--text-muted); font-size: 0.95rem;">Original Title: ${movie.original_title}</p>`
                : ''
            }
          </div>
          <span class="badge">MOVIE ${state.movieIndex + 1} / ${state.moviesQueue.length} (BATCH ${currentBatchNum})</span>
        </div>

        <div class="stats-strip">
          <div class="stat-pill"><strong>Rating:</strong> ${ratingText}</div>
          <div class="stat-pill"><strong>Rated:</strong> ${omdb && omdb.rated !== 'N/A' ? omdb.rated : movie.age_rating}</div>
          <div class="stat-pill"><strong>Metascore:</strong> ${omdb?.metascore || 'N/A'}</div>
          <div class="stat-pill"><strong>Runtime:</strong> ${omdb?.runtime || 'N/A'}</div>
        </div>

        ${
          movie.genre_names?.length
            ? `<p style="margin-bottom: 0.6rem;"><strong style="color:var(--retro-yellow);">Genres:</strong> ${movie.genre_names.join(', ')}</p>`
            : ''
        }

        ${providersHtml}

        <div style="margin: 1rem 0; font-size: 0.94rem; line-height: 1.6; color: var(--text-muted);">
          ${omdb?.director && omdb.director !== 'N/A' ? `<p><strong style="color:#fff;">Director:</strong> ${omdb.director}</p>` : ''}
          ${omdb?.actors && omdb.actors !== 'N/A' ? `<p><strong style="color:#fff;">Cast:</strong> ${omdb.actors}</p>` : ''}
          ${omdb?.box_office && omdb.box_office !== 'N/A' ? `<p><strong style="color:#fff;">Box Office:</strong> ${omdb.box_office}</p>` : ''}
          ${omdb?.awards && omdb.awards !== 'N/A' ? `<p><strong style="color:#fff;">Awards:</strong> ${omdb.awards}</p>` : ''}
        </div>

        <h4 style="color: var(--retro-cyan); margin-bottom: 0.4rem;">SYNOPSIS</h4>
        <p style="line-height: 1.65;">${omdb?.plot && omdb.plot !== 'N/A' ? omdb.plot : movie.overview || 'No synopsis available.'}</p>

        ${renderFeedbackControls('movies', movie.id, movie.title, movie.genre_names)}

        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; align-items: center;">
          ${
            state.movieIndex > 0
              ? `<button id="prev-movie-btn" class="btn-secondary">◀ PREV MOVIE</button>`
              : ''
          }
          ${
            state.movieIndex < state.moviesQueue.length - 1
              ? `<button id="next-movie-btn" class="btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.75rem;">NEXT MOVIE ▶</button>`
              : `<button id="new-movie-batch-btn" class="btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.75rem;">🔄 FETCH NEW BATCH</button>`
          }
          <button id="quick-movie-batch-btn" class="btn-secondary" style="margin-left: auto; font-size: 0.75rem;">🔄 SKIP TO NEW BATCH</button>
        </div>
      </div>
    </div>
  `;

  attachFeedbackListeners();

  document.getElementById('prev-movie-btn')?.addEventListener('click', () => {
    if (state.movieIndex > 0) {
      state.movieIndex -= 1;
      renderMovieCard(state.moviesQueue[state.movieIndex]);
    }
  });

  document.getElementById('next-movie-btn')?.addEventListener('click', () => {
    if (state.movieIndex < state.moviesQueue.length - 1) {
      state.movieIndex += 1;
      renderMovieCard(state.moviesQueue[state.movieIndex]);
    }
  });

  document.getElementById('new-movie-batch-btn')?.addEventListener('click', () => {
    fetchNewMoviesBatch();
  });

  document.getElementById('quick-movie-batch-btn')?.addEventListener('click', () => {
    fetchNewMoviesBatch();
  });
}

// ============================================================================
// ANIME FETCH & CARD
// ============================================================================
async function fetchNewAnimeBatch() {
  const mode = animeModeSelect.value;
  const genres = animeGenreSelect.value;
  const rating = animeRatingSelect.value;
  const season = animeSeasonSelect.value;
  const year = animeYearInput.value || String(new Date().getFullYear());
  const excludeIds = getSeenIds('anime');

  fetchBtn.disabled = true;
  renderPromptMessage(`⏳ LOADING FROM ANILIST ARCHIVES (BATCH ${state.animePage})...`);

  try {
    const params = new URLSearchParams({
      mode,
      genres,
      rating,
      season,
      year,
      page: String(state.animePage),
      excludeIds: excludeIds.join(',')
    });
    const res = await fetch(`/api/anime?${params.toString()}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      renderPromptMessage(errJson.error || '⚠️ FAILED TO RETRIEVE ANIME.');
      fetchBtn.disabled = false;
      return;
    }

    const data = await res.json();
    const newAnime: AnimeItem[] = data.anime || [];

    if (!newAnime.length) {
      if (state.animePage > 1) {
        outlet.innerHTML = `
          ${renderAiReasonBannerHtml()}
          <div class="retro-card" style="text-align:center;">
            <p style="color: var(--retro-yellow); margin-bottom: 1rem;">🏁 END OF ARCHIVES REACHED FOR THIS FILTER COMBINATION.</p>
            <button id="restart-anime-btn" class="btn-primary">🔄 RESTART FROM BATCH 1</button>
          </div>
        `;
        document.getElementById('restart-anime-btn')?.addEventListener('click', () => {
          state.animePage = 1;
          fetchNewAnimeBatch();
        });
      } else {
        renderPromptMessage('NO ANIME FOUND MATCHING YOUR SELECTION. TRY ADJUSTING THE FILTERS!');
        updateFetchButtonText();
      }
      fetchBtn.disabled = false;
      return;
    }

    state.animeQueue = newAnime;
    state.animeIndex = 0;
    state.animePage += 1;
    fetchBtn.disabled = false;
    renderAnimeCard(state.animeQueue[0]);
  } catch {
    renderPromptMessage('⚠️ ANIME SERVICE TEMPORARILY UNAVAILABLE. PLEASE TRY AGAIN.');
    fetchBtn.disabled = false;
  }
}

function renderAnimeCard(a: AnimeItem) {
  addSeenId('anime', a.id);
  updateFetchButtonText();
  const currentBatchNum = Math.max(1, state.animePage - 1);
  const cleanSynopsis = (a.synopsis || 'No synopsis available.').replace(/<[^>]*>/g, '');
  const genresText = Array.isArray(a.genres) && a.genres.length ? a.genres.join(', ') : 'N/A';
  const scoreText = a.score != null ? `⭐ ${a.score}/10` : '⭐ N/A';

  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <div class="retro-card media-detail-card">
      <div>
        ${
          a.image
            ? `<img class="media-poster" src="${a.image}" alt="${a.title}" />`
            : `<div class="retro-card" style="text-align:center; padding: 4rem 1rem;">NO POSTER</div>`
        }
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; align-items:start; gap: 1rem; flex-wrap: wrap;">
          <h2 style="color: var(--retro-red); font-size: 1.65rem;">${a.title}</h2>
          <span class="badge">ANIME ${state.animeIndex + 1} / ${state.animeQueue.length} (BATCH ${currentBatchNum})</span>
        </div>
        <div class="stats-strip">
          <div class="stat-pill"><strong>Score:</strong> ${scoreText}</div>
          <div class="stat-pill"><strong>Genres:</strong> ${genresText}</div>
          <div class="stat-pill"><strong>Episodes:</strong> ${a.episodes ?? '?'}</div>
          <div class="stat-pill"><strong>Status:</strong> ${a.status || 'N/A'}</div>
        </div>
        <p style="line-height: 1.6; color: var(--text-muted);">${cleanSynopsis}</p>

        ${renderFeedbackControls('anime', a.id, a.title, a.genres)}
        
        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; align-items: center;">
          ${
            state.animeIndex > 0
              ? `<button id="prev-anime-btn" class="btn-secondary">◀ PREV ANIME</button>`
              : ''
          }
          ${
            state.animeIndex < state.animeQueue.length - 1
              ? `<button id="next-anime-btn" class="btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.75rem;">NEXT ANIME ▶</button>`
              : `<button id="new-anime-batch-btn" class="btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.75rem;">🔄 FETCH NEW BATCH</button>`
          }
          <button id="quick-anime-batch-btn" class="btn-secondary" style="font-size: 0.75rem;">🔄 SKIP TO NEW BATCH</button>
          ${
            a.url
              ? `<a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="margin-left: auto; font-size: 0.75rem; text-decoration:none; padding: 0.6rem 1rem;">VIEW ON ANILIST ↗</a>`
              : ''
          }
        </div>
      </div>
    </div>
  `;

  attachFeedbackListeners();

  document.getElementById('prev-anime-btn')?.addEventListener('click', () => {
    if (state.animeIndex > 0) {
      state.animeIndex -= 1;
      renderAnimeCard(state.animeQueue[state.animeIndex]);
    }
  });

  document.getElementById('next-anime-btn')?.addEventListener('click', () => {
    if (state.animeIndex < state.animeQueue.length - 1) {
      state.animeIndex += 1;
      renderAnimeCard(state.animeQueue[state.animeIndex]);
    }
  });

  document.getElementById('new-anime-batch-btn')?.addEventListener('click', () => {
    fetchNewAnimeBatch();
  });

  document.getElementById('quick-anime-batch-btn')?.addEventListener('click', () => {
    fetchNewAnimeBatch();
  });
}

// ============================================================================
// GAMES FETCH & CARD
// ============================================================================
async function fetchNewGamesBatch() {
  const mode = gameModeSelect.value;
  const platform = gamePlatformSelect.value;
  const genre = gameGenreSelect.value;
  const age = ageSlider.value;
  const excludeIds = getSeenIds('games');

  fetchBtn.disabled = true;
  renderPromptMessage(`⏳ QUERYING RAWG VIDEO GAME ARCHIVES (BATCH ${state.gamePage})...`);

  try {
    const params = new URLSearchParams({
      mode,
      platform,
      genre,
      age,
      page: String(state.gamePage),
      excludeIds: excludeIds.join(',')
    });
    const res = await fetch(`/api/games?${params.toString()}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      renderPromptMessage(errJson.error || '⚠️ FAILED TO RETRIEVE GAMES. CHECK YOUR RAWG_API_KEY IN .ENV.');
      fetchBtn.disabled = false;
      return;
    }

    const data = await res.json();
    const newGames: GameItem[] = data.games || [];

    if (!newGames.length) {
      if (state.gamePage > 1) {
        outlet.innerHTML = `
          ${renderAiReasonBannerHtml()}
          <div class="retro-card" style="text-align:center;">
            <p style="color: var(--retro-yellow); margin-bottom: 1rem;">🏁 END OF ARCHIVES REACHED FOR THIS FILTER COMBINATION.</p>
            <button id="restart-games-btn" class="btn-primary">🔄 RESTART FROM BATCH 1</button>
          </div>
        `;
        document.getElementById('restart-games-btn')?.addEventListener('click', () => {
          state.gamePage = 1;
          fetchNewGamesBatch();
        });
      } else {
        renderPromptMessage('NO GAMES FOUND MATCHING YOUR AGE RATING AND FILTER COMBINATION. TRY ADJUSTING THE PLATFORM, GENRE, OR AGE!');
        updateFetchButtonText();
      }
      fetchBtn.disabled = false;
      return;
    }

    state.gamesQueue = newGames;
    state.gameIndex = 0;
    state.gamePage += 1;
    fetchBtn.disabled = false;
    renderGameCard(state.gamesQueue[0]);
  } catch {
    renderPromptMessage('⚠️ GAME SERVICE TEMPORARILY UNAVAILABLE. CHECK YOUR NETWORK OR API KEYS.');
    fetchBtn.disabled = false;
  }
}

function renderGameCard(g: GameItem) {
  addSeenId('games', g.id);
  updateFetchButtonText();
  const currentBatchNum = Math.max(1, state.gamePage - 1);

  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <div class="retro-card media-detail-card">
      <div>
        ${
          g.background_image
            ? `<img class="media-poster" src="${g.background_image}" alt="${g.name}" />`
            : `<div class="retro-card" style="text-align:center; padding: 4rem 1rem;">NO IMAGE</div>`
        }
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; align-items:start; gap: 1rem; flex-wrap: wrap;">
          <h2 style="color: var(--retro-red); font-size: 1.65rem;">${g.name}</h2>
          <span class="badge">GAME ${state.gameIndex + 1} / ${state.gamesQueue.length} (BATCH ${currentBatchNum})</span>
        </div>
        <div class="stats-strip">
          <div class="stat-pill"><strong>Rating:</strong> ⭐ ${g.rating ? g.rating.toFixed(1) + ' / 5' : 'N/A'}</div>
          ${g.metacritic ? `<div class="stat-pill"><strong>Metacritic:</strong> 🎯 ${g.metacritic}/100</div>` : ''}
          <div class="stat-pill"><strong>Released:</strong> 📅 ${g.released}</div>
          <div class="stat-pill"><strong>ESRB:</strong> 🛡️ ${g.esrb}</div>
        </div>
        ${g.genres?.length ? `<p style="margin-bottom: 0.6rem;"><strong style="color:var(--retro-yellow);">Genres:</strong> ${g.genres.join(', ')}</p>` : ''}
        ${g.platforms?.length ? `<p style="margin-bottom: 0.6rem;"><strong style="color:var(--retro-cyan);">Platforms:</strong> ${g.platforms.join(', ')}</p>` : ''}

        ${renderFeedbackControls('games', g.id, g.name, g.genres)}

        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; align-items: center;">
          ${
            state.gameIndex > 0
              ? `<button id="prev-game-btn" class="btn-secondary">◀ PREV GAME</button>`
              : ''
          }
          ${
            state.gameIndex < state.gamesQueue.length - 1
              ? `<button id="next-game-btn" class="btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.75rem;">NEXT GAME ▶</button>`
              : `<button id="new-game-batch-btn" class="btn-primary" style="padding: 0.6rem 1.2rem; font-size: 0.75rem;">🔄 FETCH NEW BATCH</button>`
          }
          <button id="quick-game-batch-btn" class="btn-secondary" style="margin-left: auto; font-size: 0.75rem;">🔄 SKIP TO NEW BATCH</button>
        </div>
      </div>
    </div>
  `;

  attachFeedbackListeners();

  document.getElementById('prev-game-btn')?.addEventListener('click', () => {
    if (state.gameIndex > 0) {
      state.gameIndex -= 1;
      renderGameCard(state.gamesQueue[state.gameIndex]);
    }
  });

  document.getElementById('next-game-btn')?.addEventListener('click', () => {
    if (state.gameIndex < state.gamesQueue.length - 1) {
      state.gameIndex += 1;
      renderGameCard(state.gamesQueue[state.gameIndex]);
    }
  });

  document.getElementById('new-game-batch-btn')?.addEventListener('click', () => {
    fetchNewGamesBatch();
  });

  document.getElementById('quick-game-batch-btn')?.addEventListener('click', () => {
    fetchNewGamesBatch();
  });
}

// ============================================================================
// SURPRISE ME HANDLER (Randomizes Mood/Genre without touching Age or Language)
// ============================================================================
function pickRandomSelectOption(selectEl: HTMLSelectElement): void {
  const options = Array.from(selectEl.options).filter((opt) => opt.value !== '');
  if (options.length > 0) {
    const randomOpt = options[Math.floor(Math.random() * options.length)];
    selectEl.value = randomOpt.value;
  }
}

function handleSurpriseMe() {
  const view = state.currentView;
  if (view === 'home') {
    const moduleViews: ViewName[] = ['videos', 'music', 'movies', 'anime', 'games'];
    const randomView = moduleViews[Math.floor(Math.random() * moduleViews.length)];
    switchView(randomView);
    handleSurpriseMe();
    return;
  }

  if (view === 'videos' || view === 'music') {
    pickRandomSelectOption(moodSelect);
    handleYouTubeFetch(view === 'music' ? 'music' : 'video');
  } else if (view === 'movies') {
    pickRandomSelectOption(genreSelect);
    resetMoviesQueue();
    fetchNewMoviesBatch();
  } else if (view === 'anime') {
    pickRandomSelectOption(animeGenreSelect);
    resetAnimeQueue();
    fetchNewAnimeBatch();
  } else if (view === 'games') {
    pickRandomSelectOption(gameGenreSelect);
    resetGamesQueue();
    fetchNewGamesBatch();
  }
}

surpriseBtn?.addEventListener('click', () => {
  handleSurpriseMe();
});

// Boot on Home View
switchView('home');
