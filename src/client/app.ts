
// src/client/app.ts

type ViewType = "home" | "videos" | "music" | "movies" | "tv" | "anime" | "games";

interface FeedbackItem {
  type: string;
  id: string | number;
  title: string;
  mood?: string;
  language?: string;
  genre?: string | string[];
  liked: boolean;
  timestamp: number;
}

const state = {
  currentView: "home" as ViewType,
  videoIterations: {} as Record<string, number>,
  videoTopics: {} as Record<string, string>,
  musicIterations: {} as Record<string, number>,
  musicTopics: {} as Record<string, string>,
  moviesQueue: [] as any[],
  movieIndex: 0,
  moviePage: 1,
  tvQueue: [] as any[],
  tvIndex: 0,
  tvPage: 1,
  gamesQueue: [] as any[],
  gameIndex: 0,
  gamePage: 1,
  animeQueue: [] as any[],
  animeIndex: 0,
  animePage: 1,
  lastAiReason: "",
  lastAiReasonIsError: false,
};

const outlet = document.getElementById("view-outlet")!;
const prefPanel = document.getElementById("preferences-panel")!;
const moodGroup = document.getElementById("mood-group")!;
const genreGroup = document.getElementById("genre-group")!;
const tvGenreGroup = document.getElementById("tv-genre-group")!;
const tvModeGroup = document.getElementById("tv-mode-group")!;
const animeModeGroup = document.getElementById("anime-mode-group")!;
const animeGenreGroup = document.getElementById("anime-genre-group")!;
const animeRatingGroup = document.getElementById("anime-rating-group")!;
const animeSeasonGroup = document.getElementById("anime-season-group")!;
const animeYearGroup = document.getElementById("anime-year-group")!;
const gameModeGroup = document.getElementById("game-mode-group")!;
const gamePlatformGroup = document.getElementById("game-platform-group")!;
const gameGenreGroup = document.getElementById("game-genre-group")!;
const ageGroup = document.getElementById("age-group")!;
const languageGroup = document.getElementById("language-group")!;

const moodSelect = document.getElementById("mood-select") as HTMLSelectElement;
const genreSelect = document.getElementById("genre-select") as HTMLSelectElement;
const tvGenreSelect = document.getElementById("tv-genre") as HTMLSelectElement;
const tvModeSelect = document.getElementById("tv-mode") as HTMLSelectElement;
const ageSlider = document.getElementById("age-slider") as HTMLInputElement;
const ageValue = document.getElementById("age-value")!;
const ageBadge = document.getElementById("age-badge")!;
const langSelect = document.getElementById("language-select") as HTMLSelectElement;
const animeModeSelect = document.getElementById("anime-mode") as HTMLSelectElement;
const animeGenreSelect = document.getElementById("anime-genre") as HTMLSelectElement;
const animeRatingSelect = document.getElementById("anime-rating") as HTMLSelectElement;
const animeSeasonSelect = document.getElementById("anime-season") as HTMLSelectElement;
const animeYearInput = document.getElementById("anime-year") as HTMLInputElement;
const gameModeSelect = document.getElementById("game-mode") as HTMLSelectElement;
const gamePlatformSelect = document.getElementById("game-platform") as HTMLSelectElement;
const gameGenreSelect = document.getElementById("game-genre") as HTMLSelectElement;

const fetchBtn = document.getElementById("fetch-action-btn") as HTMLButtonElement;
const surpriseBtn = document.getElementById("surprise-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const clearProfileBtn = document.getElementById("clear-profile-btn") as HTMLButtonElement;
const tabAiPromptInput = document.getElementById("tab-ai-prompt") as HTMLInputElement;
const tabAiSubmitBtn = document.getElementById("tab-ai-submit-btn") as HTMLButtonElement;
const crtToggleBtn = document.getElementById("crt-toggle-btn") as HTMLButtonElement | null;

// Default the anime season year to the current year
animeYearInput.value = String(new Date().getFullYear());

const SEEN_STORAGE_PREFIX = "retro_seen_";
const MAX_SEEN_COUNT = 300;

// CRT Scanline Toggle
crtToggleBtn?.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("crt-enabled");
  crtToggleBtn.textContent = enabled ? "📺 CRT FX: ON" : "📺 CRT FX: OFF";
});

// ============================================================================
// 8-BIT WEB AUDIO SYNTHESIZER (ZERO EXTERNAL ASSETS)
// ============================================================================
type SoundEffect = "blip" | "nav" | "coin" | "surprise" | "like" | "dislike" | "error";

class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  private readonly STORAGE_KEY = "retro_sfx_enabled";

  constructor() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved !== null) {
        this.enabled = saved === "true";
      }
    } catch {}
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(this.STORAGE_KEY, String(this.enabled));
    } catch {}
    if (this.enabled) {
      this.play("coin");
    }
    return this.enabled;
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    startTimeOffset = 0,
    peakGain = 0.08,
    slideToFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + startTimeOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  public play(effect: SoundEffect) {
    if (!this.enabled) return;

    switch (effect) {
      case "blip":
        // Crisp arcade button press
        this.playTone(680, "square", 0.055, 0, 0.06, 880);
        break;

      case "nav":
        // Two-step console menu switch
        this.playTone(523.25, "square", 0.06, 0, 0.06);    // C5
        this.playTone(659.25, "square", 0.08, 0.055, 0.06); // E5
        break;

      case "coin":
        // Classic arcade coin insert (B5 -> E6)
        this.playTone(987.77, "square", 0.08, 0, 0.07);     // B5
        this.playTone(1318.51, "square", 0.26, 0.075, 0.07); // E6
        break;

      case "surprise": {
        // Fast 5-note mystery box chiptune arpeggio
        const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
        for (let i = 0; i < 5; i++) {
          const randNote = notes[Math.floor(Math.random() * notes.length)];
          this.playTone(randNote, "triangle", 0.065, i * 0.055, 0.09);
        }
        break;
      }

      case "like":
        // 1UP / Power-up major triad (C5 -> E5 -> G5 -> C6)
        this.playTone(523.25, "square", 0.07, 0, 0.06);
        this.playTone(659.25, "square", 0.07, 0.06, 0.06);
        this.playTone(783.99, "square", 0.07, 0.12, 0.06);
        this.playTone(1046.5, "square", 0.16, 0.18, 0.07);
        break;

      case "dislike":
        // Retro descending sawtooth buzzer
        this.playTone(220, "sawtooth", 0.11, 0, 0.07, 150);
        this.playTone(145, "sawtooth", 0.18, 0.1, 0.07, 95);
        break;

      case "error":
        // Low warning pulse
        this.playTone(160, "sawtooth", 0.14, 0, 0.08);
        this.playTone(120, "sawtooth", 0.22, 0.15, 0.08);
        break;
    }
  }
}

const sfx = new RetroSoundEngine();
const sfxToggleBtn = document.getElementById("sfx-toggle-btn") as HTMLButtonElement | null;

if (sfxToggleBtn) {
  sfxToggleBtn.textContent = sfx.enabled ? "🔊 SFX: ON" : "🔇 SFX: OFF";
  sfxToggleBtn.classList.toggle("muted", !sfx.enabled);
  sfxToggleBtn.addEventListener("click", () => {
    const isNowOn = sfx.toggle();
    sfxToggleBtn.textContent = isNowOn ? "🔊 SFX: ON" : "🔇 SFX: OFF";
    sfxToggleBtn.classList.toggle("muted", !isNowOn);
  });
}

// ============================================================================
// SEEN LIST + FEEDBACK STORAGE
// ============================================================================
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

function addSeenId(module: string, id: string | number) {
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
  } catch {}
}

function clearAllSeenIds() {
  try {
    const modules = ["videos", "music", "movies", "tv", "anime", "games"];
    modules.forEach((mod) => localStorage.removeItem(`${SEEN_STORAGE_PREFIX}${mod}`));
  } catch {}
}

const FEEDBACK_STORAGE_KEY = "retro_feedback";
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
    if (!item.liked) {
      addSeenId(item.type, item.id);
    }
  } catch {}
}

function clearFeedback() {
  try {
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
  } catch {}
}

function getTasteProfileSummary() {
  const list = getFeedbackList().slice(-30);
  const liked = list.filter((f) => f.liked);
  const disliked = list.filter((f) => !f.liked);
  const langCount: Record<string, number> = {};
  const moodCount: Record<string, number> = {};
  const genreCountByModule: Record<string, Record<string, number>> = {
    videos: {},
    music: {},
    movies: {},
    anime: {},
    games: {},
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

  const topLanguages = Object.entries(langCount)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const topMoods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
  const favoriteGenresByModule: Record<string, string[]> = {};
  for (const [mod, gMap] of Object.entries(genreCountByModule)) {
    favoriteGenresByModule[mod] = Object.entries(gMap)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }
  const dislikedGenreList = Object.entries(dislikedGenres)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  return {
    totalRatings: list.length,
    likedCount: liked.length,
    dislikedCount: disliked.length,
    topLanguages,
    topMoods,
    favoriteGenresByModule,
    dislikedGenres: dislikedGenreList,
    recentLikedTitles: liked.slice(-5).map((f) => f.title),
  };
}

function getAgeGroup(age: number): string {
  if (age <= 12) return "kids";
  if (age <= 19) return "teens";
  return "adults";
}

function resetMoviesQueue() {
  state.moviesQueue = [];
  state.movieIndex = 0;
  state.moviePage = 1;
}

function resetTvQueue() {
  state.tvQueue = [];
  state.tvIndex = 0;
  state.tvPage = 1;
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
  if (mode === "genre") {
    animeGenreGroup.classList.remove("hidden");
    animeRatingGroup.classList.remove("hidden");
    animeSeasonGroup.classList.add("hidden");
    animeYearGroup.classList.add("hidden");
  } else if (mode === "seasonal") {
    animeGenreGroup.classList.add("hidden");
    animeRatingGroup.classList.add("hidden");
    animeSeasonGroup.classList.remove("hidden");
    animeYearGroup.classList.remove("hidden");
  } else if (mode === "top") {
    animeGenreGroup.classList.add("hidden");
    animeRatingGroup.classList.add("hidden");
    animeSeasonGroup.classList.add("hidden");
    animeYearGroup.classList.add("hidden");
  }
}

function updateFetchButtonText() {
  const v = state.currentView;
  if (v === "videos") {
    fetchBtn.textContent = "📺 GET VIDEO RECOMMENDATION";
  } else if (v === "music") {
    fetchBtn.textContent = "🎵 GET MUSIC RECOMMENDATION";
  } else if (v === "movies") {
    if (state.moviesQueue.length > 0) {
      if (state.movieIndex < state.moviesQueue.length - 1) {
        fetchBtn.textContent = `🎬 NEXT MOVIE (${state.movieIndex + 1}/${state.moviesQueue.length})`;
      } else {
        fetchBtn.textContent = `🔄 FETCH NEW BATCH (BATCH ${state.moviePage})`;
      }
    } else {
      fetchBtn.textContent = "🎬 GET MOVIE RECOMMENDATION";
    }
  } else if (v === "tv") {
    if (state.tvQueue.length > 0 && state.tvIndex < state.tvQueue.length - 1) {
      fetchBtn.textContent = `📺 NEXT SHOW (${state.tvIndex + 1}/${state.tvQueue.length})`;
    } else {
      fetchBtn.textContent = `🔄 FETCH NEW BATCH (BATCH ${state.tvPage})`;
    }
  } else if (v === "anime") {
    if (state.animeQueue.length > 0) {
      if (state.animeIndex < state.animeQueue.length - 1) {
        fetchBtn.textContent = `⛩️ NEXT ANIME (${state.animeIndex + 1}/${state.animeQueue.length})`;
      } else {
        fetchBtn.textContent = `🔄 FETCH NEW BATCH (BATCH ${state.animePage})`;
      }
    } else {
      fetchBtn.textContent = "⛩️ GET ANIME RECOMMENDATION";
    }
  } else if (v === "games") {
    if (state.gamesQueue.length > 0) {
      if (state.gameIndex < state.gamesQueue.length - 1) {
        fetchBtn.textContent = `🎮 NEXT GAME (${state.gameIndex + 1}/${state.gamesQueue.length})`;
      } else {
        fetchBtn.textContent = `🔄 FETCH NEW BATCH (BATCH ${state.gamePage})`;
      }
    } else {
      fetchBtn.textContent = "🎮 GET GAME RECOMMENDATION";
    }
  }
}

ageSlider.addEventListener("input", () => {
  const age = Number(ageSlider.value);
  ageValue.textContent = String(age);
  ageBadge.textContent = getAgeGroup(age).toUpperCase();
  if (state.currentView === "movies") {
    resetMoviesQueue();
    updateFetchButtonText();
  }
  if (state.currentView === "tv") { resetTvQueue(); updateFetchButtonText(); }
  if (state.currentView === "games") {
    resetGamesQueue();
    updateFetchButtonText();
  }
});

genreSelect.addEventListener("change", () => {
  if (state.currentView === "movies") {
    resetMoviesQueue();
    updateFetchButtonText();
  }
});

tvGenreSelect.addEventListener('change', () => { resetTvQueue(); updateFetchButtonText(); });
tvModeSelect.addEventListener('change', () => { resetTvQueue(); updateFetchButtonText(); });

langSelect.addEventListener("change", () => {
  if (state.currentView === "movies") {
    resetMoviesQueue();
    updateFetchButtonText();
  }
  if (state.currentView === 'tv') { resetTvQueue(); updateFetchButtonText(); }
});

animeModeSelect.addEventListener("change", () => {
  updateAnimeModeVisibility();
  resetAnimeQueue();
  updateFetchButtonText();
});

animeGenreSelect.addEventListener("change", () => {
  resetAnimeQueue();
  updateFetchButtonText();
});

animeRatingSelect.addEventListener("change", () => {
  resetAnimeQueue();
  updateFetchButtonText();
});

animeSeasonSelect.addEventListener("change", () => {
  resetAnimeQueue();
  updateFetchButtonText();
});

animeYearInput.addEventListener("input", () => {
  resetAnimeQueue();
  updateFetchButtonText();
});

gameModeSelect.addEventListener("change", () => {
  resetGamesQueue();
  updateFetchButtonText();
});

gamePlatformSelect.addEventListener("change", () => {
  resetGamesQueue();
  updateFetchButtonText();
});

gameGenreSelect.addEventListener("change", () => {
  resetGamesQueue();
  updateFetchButtonText();
});

resetBtn.addEventListener("click", () => {
  state.videoIterations = {};
  state.videoTopics = {};
  state.musicIterations = {};
  state.musicTopics = {};
  resetMoviesQueue();
  resetTvQueue();
  resetGamesQueue();
  resetAnimeQueue();
  clearAllSeenIds();
  updateFetchButtonText();
  renderPromptMessage("MEMORY BANKS CLEARED! CLICK GENERATE ABOVE TO START.");
});

clearProfileBtn?.addEventListener("click", () => {
  clearFeedback();
  if (state.currentView === "home") {
    renderHomeView();
  } else {
    renderPromptMessage("🧠 TASTE PROFILE CLEARED! RATE NEW CONTENT TO RETRAIN.");
  }
});

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = (btn as HTMLElement).dataset.view as ViewType;
    switchView(view);
  });
});

function switchView(view: ViewType) {
  state.currentView = view;
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", (b as HTMLElement).dataset.view === view);
  });

  if (view === "home") {
    prefPanel.classList.add("hidden");
    renderHomeView();
    return;
  }

  prefPanel.classList.remove("hidden");
  moodGroup.classList.toggle("hidden", view !== "videos" && view !== "music");
  genreGroup.classList.toggle("hidden", view !== "movies");
  tvGenreGroup.classList.toggle('hidden', view !== 'tv');
  tvModeGroup.classList.toggle('hidden', view !== 'tv');
  ageGroup.classList.toggle("hidden", view === "anime");
  languageGroup.classList.toggle("hidden", view !== "videos" && view !== "music" && view !== "movies" && view !== "tv");

  const isAnime = view === "anime";
  animeModeGroup.classList.toggle("hidden", !isAnime);
  if (isAnime) {
    updateAnimeModeVisibility();
  } else {
    animeGenreGroup.classList.add("hidden");
    animeRatingGroup.classList.add("hidden");
    animeSeasonGroup.classList.add("hidden");
    animeYearGroup.classList.add("hidden");
  }

  const isGames = view === "games";
  gameModeGroup.classList.toggle("hidden", !isGames);
  gamePlatformGroup.classList.toggle("hidden", !isGames);
  gameGenreGroup.classList.toggle("hidden", !isGames);

  updateFetchButtonText();

  if (view === "videos") {
    renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "📺 GET VIDEO RECOMMENDATION"!');
  } else if (view === "music") {
    renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "🎵 GET MUSIC RECOMMENDATION"!');
  } else if (view === "movies") {
    if (state.moviesQueue.length > 0) {
      renderMovieCard(state.moviesQueue[state.movieIndex]);
    } else {
      renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "🎬 GET MOVIE RECOMMENDATION"!');
    }
  } else if (view === 'tv') {
    if (state.tvQueue.length) renderTvCard(state.tvQueue[state.tvIndex]);
    else renderPromptMessage('SELECT YOUR TV FILTERS AND GENERATE A SHOW.');
  } else if (view === "anime") {
    if (state.animeQueue.length > 0) {
      renderAnimeCard(state.animeQueue[state.animeIndex]);
    } else {
      renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "⛩️ GET ANIME RECOMMENDATION"!');
    }
  } else if (view === "games") {
    if (state.gamesQueue.length > 0) {
      renderGameCard(state.gamesQueue[state.gameIndex]);
    } else {
      renderPromptMessage('SELECT YOUR PREFERENCES ABOVE AND CLICK "🎮 GET GAME RECOMMENDATION"!');
    }
  }
}

function renderPromptMessage(msg: string, isLoading = false) {
  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <div class="retro-card" style="text-align: center; padding: 2.75rem 1.5rem;">
      ${
        isLoading
          ? `<div class="retro-loader"><span></span><span></span><span></span><span></span></div>`
          : ""
      }
      <p style="font-family: var(--font-term); font-size: 1.55rem; color: var(--retro-cyan); letter-spacing: 0.8px;">${msg}</p>
    </div>
  `;
}

function renderAiReasonBannerHtml() {
  if (!state.lastAiReason) return "";
  const isErr = state.lastAiReasonIsError;
  return `
    <div class="ai-reason-banner ${isErr ? "error" : ""}">
      <span style="font-size: 1.25rem;">${isErr ? "⚠️" : "🤖"}</span>
      <span>${state.lastAiReason}</span>
    </div>
  `;
}

function renderAiReasonBanner(text: string, isError = false) {
  state.lastAiReason = text;
  state.lastAiReasonIsError = isError;
  const existing = document.querySelector(".ai-reason-banner");
  if (existing) {
    existing.className = `ai-reason-banner ${isError ? "error" : ""}`;
    existing.innerHTML = `<span style="font-size: 1.25rem;">${isError ? "⚠️" : "🤖"}</span><span>${text}</span>`;
  }
}

function renderFeedbackControls(type: string, id: string | number, title: string, genre?: any) {
  const list = getFeedbackList();
  const existing = list.find((f) => f.type === type && String(f.id) === String(id));
  const isLiked = existing?.liked === true;
  const isDisliked = existing?.liked === false;
  const safeTitle = (title || "").replace(/"/g, "&quot;");
  const safeGenre = encodeURIComponent(JSON.stringify(genre || ""));
  return `
    <div class="card-feedback" data-feedback-container="true">
      <span class="feedback-label">RATE RECOMMENDATION:</span>
      <button class="feedback-btn thumbs-up ${isLiked ? "active-like" : ""}" data-type="${type}" data-id="${id}" data-title="${safeTitle}" data-genre="${safeGenre}">
        👍 ${isLiked ? "LIKED" : "LIKE"}
      </button>
      <button class="feedback-btn thumbs-down ${isDisliked ? "active-dislike" : ""}" data-type="${type}" data-id="${id}" data-title="${safeTitle}" data-genre="${safeGenre}">
        👎 ${isDisliked ? "DISLIKED" : "DISLIKE"}
      </button>
      <span class="feedback-status">${isLiked ? "⭐ SAVED TO PROFILE" : isDisliked ? "⛔ EXCLUDED" : ""}</span>
    </div>
  `;
}

function attachFeedbackListeners() {
  document.querySelectorAll(".card-feedback").forEach((container) => {
    const upBtn = container.querySelector(".thumbs-up") as HTMLButtonElement | null;
    const downBtn = container.querySelector(".thumbs-down") as HTMLButtonElement | null;
    const statusSpan = container.querySelector(".feedback-status");
    if (!upBtn || !downBtn) return;

    upBtn.onclick = () => {
      const type = upBtn.dataset.type!;
      const id = upBtn.dataset.id!;
      const title = upBtn.dataset.title || "";
      let genre = "";
      try {
        genre = JSON.parse(decodeURIComponent(upBtn.dataset.genre || ""));
      } catch {}
      saveFeedback({
        type,
        id,
        title,
        mood: moodSelect.value,
        language: langSelect.value,
        genre,
        liked: true,
        timestamp: Date.now(),
      });
      upBtn.classList.add("active-like");
      upBtn.textContent = "👍 LIKED";
      downBtn.classList.remove("active-dislike");
      downBtn.textContent = "👎 DISLIKE";
      if (statusSpan) statusSpan.textContent = "⭐ SAVED TO TASTE PROFILE";
    };

    downBtn.onclick = () => {
      const type = downBtn.dataset.type!;
      const id = downBtn.dataset.id!;
      const title = downBtn.dataset.title || "";
      let genre = "";
      try {
        genre = JSON.parse(decodeURIComponent(downBtn.dataset.genre || ""));
      } catch {}
      saveFeedback({
        type,
        id,
        title,
        mood: moodSelect.value,
        language: langSelect.value,
        genre,
        liked: false,
        timestamp: Date.now(),
      });
      downBtn.classList.add("active-dislike");
      downBtn.textContent = "👎 DISLIKED";
      upBtn.classList.remove("active-like");
      upBtn.textContent = "👍 LIKE";
      if (statusSpan) statusSpan.textContent = "⛔ EXCLUDED FROM FUTURE PICKS";
    };
  });
}

async function handleAiPrompt(promptText: string) {
  if (!promptText || !promptText.trim()) return;
  const tasteProfile = getTasteProfileSummary();
  const currentUi = {
    target: state.currentView === "home" ? "videos" : state.currentView,
    mood: moodSelect.value,
    language: langSelect.value,
    age: Number(ageSlider.value),
    movieGenreId: genreSelect.value,
    tvGenreId: tvGenreSelect.value,
    animeGenre: animeGenreSelect.value,
    gameGenre: gameGenreSelect.value,
    gamePlatform: gamePlatformSelect.value,
  };

  fetchBtn.disabled = true;
  state.lastAiReason = "⏳ CONSULTING GEMINI FLASH ENGINE...";
  state.lastAiReasonIsError = false;
  if (state.currentView !== "home") {
    renderAiReasonBanner("⏳ CONSULTING GEMINI FLASH ENGINE...", false);
  } else {
    renderPromptMessage("CONSULTING GEMINI FLASH ENGINE...", true);
  }

  try {
    const res = await fetch("/api/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: promptText,
        tasteProfile,
        currentUi,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      renderAiReasonBanner(err.error || "AI OFFLINE — USE MANUAL CONTROLS", true);
      sfx.play("error");
      fetchBtn.disabled = false;
      return;
    }

    const aiConfig = await res.json();
    if (aiConfig.error) {
      renderAiReasonBanner(aiConfig.error, true);
      sfx.play("error");
      fetchBtn.disabled = false;
      return;
    }

    const target = aiConfig.target as ViewType;
    switchView(target);

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
    if (aiConfig.tvGenreId) { tvGenreSelect.value = String(aiConfig.tvGenreId); resetTvQueue(); }
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

    state.lastAiReason = `${aiConfig.reason}${aiConfig.tavilyUsed ? " (Live Web Insights)" : ""}`;
    state.lastAiReasonIsError = false;
    fetchBtn.disabled = false;
    fetchBtn.click();
  } catch {
    renderAiReasonBanner("AI OFFLINE — USE MANUAL CONTROLS", true);
    sfx.play("error");
    fetchBtn.disabled = false;
  }
}

tabAiSubmitBtn?.addEventListener("click", () => {
  if (tabAiPromptInput && tabAiPromptInput.value.trim()) {
    const text = tabAiPromptInput.value.trim();
    tabAiPromptInput.value = "";
    handleAiPrompt(text);
  }
});

tabAiPromptInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && tabAiPromptInput && tabAiPromptInput.value.trim()) {
    const text = tabAiPromptInput.value.trim();
    tabAiPromptInput.value = "";
    handleAiPrompt(text);
  }
});

function renderHomeView() {
  const profile = getTasteProfileSummary();
  const formatGenres = (gMap: Record<string, string[]>) => {
    const parts: string[] = [];
    for (const [mod, gList] of Object.entries(gMap)) {
      if (gList.length) {
        parts.push(`<strong>${mod.toUpperCase()}:</strong> ${gList.slice(0, 3).join(", ")}`);
      }
    }
    return parts.length ? parts.join("<br>") : "None yet";
  };

  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <!-- ASK R.E.T.R.O. AI Panel -->
    <div class="retro-card ai-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <h3 style="font-family: var(--font-pixel); color: var(--retro-cyan); font-size: 0.95rem;">🤖 ASK R.E.T.R.O.</h3>
        <span class="arcade-badge" style="margin:0; border-color:var(--retro-cyan); color:var(--retro-cyan); background:rgba(0,240,255,0.08);">GEMINI FLASH ENGINE</span>
      </div>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 0.65rem; line-height: 1.55;">
        Tell me how you feel or what you want in natural language. Powered by Gemini Flash with real-time news intelligence and cross-platform taste learning.
      </p>
      <div class="ai-input-group">
        <input type="text" id="home-ai-prompt" class="retro-input ai-input" placeholder="Tell me how you feel or what you want... (e.g. stressed after exams, want something chill in Tamil)" />
        <button id="home-ai-submit-btn" class="btn-primary">🚀 ASK R.E.T.R.O.</button>
        <button id="home-for-you-btn" class="btn-surprise">✨ FOR YOU</button>
      </div>
      <div class="ai-chips-row">
        <span class="ai-chip-label">TRY:</span>
        <button class="ai-chip" data-prompt="Relaxing Tamil melody songs after a long day">🎧 Chill Tamil Music</button>
        <button class="ai-chip" data-prompt="High-octane sci-fi or action movie to watch tonight">🎬 Sci-Fi / Action Movie</button>
        <button class="ai-chip" data-prompt="Top-rated dark fantasy or action anime">⛩️ Dark Fantasy Anime</button>
        <button class="ai-chip" data-prompt="Best PC action RPG games to play this weekend">🎮 PC Action RPG</button>
      </div>
    </div>

    <!-- Taste Profile Panel -->
    <div class="retro-card taste-profile-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <h3 style="font-family: var(--font-pixel); color: var(--retro-yellow); font-size: 0.92rem;">🧠 MY TASTE PROFILE</h3>
        <span class="badge">${profile.totalRatings} RATINGS LOGGED</span>
      </div>
      <div class="taste-grid">
        <div class="taste-stat-box">
          <h4>TOP LANGUAGES</h4>
          <p>${profile.topLanguages.length ? profile.topLanguages.join(", ") : "None yet"}</p>
        </div>
        <div class="taste-stat-box">
          <h4>TOP MOODS</h4>
          <p>${profile.topMoods.length ? profile.topMoods.join(", ") : "None yet"}</p>
        </div>
        <div class="taste-stat-box">
          <h4>FAVORITE GENRES</h4>
          <p>${formatGenres(profile.favoriteGenresByModule)}</p>
        </div>
        <div class="taste-stat-box">
          <h4>DISLIKED GENRES</h4>
          <p>${profile.dislikedGenres.length ? profile.dislikedGenres.join(", ") : "None"}</p>
        </div>
      </div>
      ${
        profile.totalRatings === 0
          ? '<p style="color:var(--text-muted); font-size:0.85rem; margin-top:1rem; text-align:center;">NO RATINGS YET — RATE ITEMS WITH 👍 OR 👎 TO TRAIN YOUR ENGINE</p>'
          : ""
      }
    </div>

    <h2 class="section-title">🎯 ACTIVE ARCADE MODULES (CLICK TO LAUNCH)</h2>
    <div class="cards-grid">
      <div class="retro-card feature-card" data-launch-view="videos">
        <div>
          <h3><span>📺 VIDEO DISCOVERY</span></h3>
          <ul>
            <li>YouTube mood &amp; emotion mapping</li>
            <li>Dynamic 5-topic rotation engine</li>
            <li>Age &amp; regional language filtering</li>
            <li>Embedded instant-play deck</li>
          </ul>
        </div>
        <div class="card-launch-footer">
          <span>MODULE 01</span>
          <span>LAUNCH DECK ▶</span>
        </div>
      </div>

      <div class="retro-card feature-card" data-launch-view="music">
        <div>
          <h3><span>🎵 MUSIC SYNTHESIZER</span></h3>
          <ul>
            <li>Emotional wavelength music matching</li>
            <li>Regional language track discovery</li>
            <li>Embedded instant-play deck</li>
            <li>Curated fallback tracks</li>
          </ul>
        </div>
        <div class="card-launch-footer">
          <span>MODULE 02</span>
          <span>LAUNCH DECK ▶</span>
        </div>
      </div>

      <div class="retro-card feature-card" data-launch-view="movies">
        <div>
          <h3><span>🎬 CINEMA ARCHIVE</span></h3>
          <ul>
            <li>TMDB + OMDb dual API engine</li>
            <li>US &amp; Regional Indian certifications</li>
            <li>IMDb ratings, Metascore &amp; Box Office</li>
            <li>Streaming provider logos</li>
          </ul>
        </div>
        <div class="card-launch-footer">
          <span>MODULE 03</span>
          <span>LAUNCH DECK ▶</span>
        </div>
      </div>

      <div class="retro-card feature-card" data-launch-view="tv">
        <div><h3><span>📺 TV SHOWS</span></h3>
          <ul><li>TMDB series discovery</li><li>Popular, top rated &amp; airing now</li><li>Age and language filters</li><li>Streaming and cast details</li></ul>
        </div><div class="card-launch-footer"><span>MODULE 04</span><span>LAUNCH DECK ▶</span></div>
      </div>

      <div class="retro-card feature-card" data-launch-view="anime">
        <div>
          <h3><span>⛩️ ANIME ARCHIVE</span></h3>
          <ul>
            <li>AniList GraphQL integration</li>
            <li>Genre &amp; Content Rating filters</li>
            <li>Seasonal anime time-machine</li>
            <li>Top-rated anime leaderboard</li>
          </ul>
        </div>
        <div class="card-launch-footer">
          <span>MODULE 04</span>
          <span>LAUNCH DECK ▶</span>
        </div>
      </div>

      <div class="retro-card feature-card" data-launch-view="games">
        <div>
          <h3><span>🎮 GAME RECOMMENDERS</span></h3>
          <ul>
            <li>RAWG Video Games Database API</li>
            <li>Top-rated &amp; Metacritic picks</li>
            <li>Upcoming releases (Next 6 Months)</li>
            <li>ESRB age-appropriate filtering</li>
          </ul>
        </div>
        <div class="card-launch-footer">
          <span>MODULE 05</span>
          <span>LAUNCH DECK ▶</span>
        </div>
      </div>

      <div class="retro-card feature-card" style="border-color: var(--retro-cyan);">
        <div>
          <h3 style="color: var(--retro-cyan);"><span>🤖 AI-ENHANCED ENGINE</span></h3>
          <ul>
            <li>Gemini Flash natural language parser</li>
            <li>Smart cross-platform taste profiling</li>
            <li>Real-time news &amp; trending intelligence</li>
            <li>Instant tailored "FOR YOU" generator</li>
          </ul>
        </div>
        <div class="card-launch-footer" style="color: var(--retro-cyan);">
          <span>CORE AI</span>
          <span>ACTIVE ⚡</span>
        </div>
      </div>
    </div>
  `;

  const homeAiInput = document.getElementById("home-ai-prompt") as HTMLInputElement | null;
  const homeAiBtn = document.getElementById("home-ai-submit-btn");
  const homeForYouBtn = document.getElementById("home-for-you-btn");

  homeAiBtn?.addEventListener("click", () => {
    if (homeAiInput && homeAiInput.value.trim()) {
      handleAiPrompt(homeAiInput.value.trim());
    }
  });

  homeAiInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && homeAiInput && homeAiInput.value.trim()) {
      handleAiPrompt(homeAiInput.value.trim());
    }
  });

  homeForYouBtn?.addEventListener("click", () => {
    handleAiPrompt("recommend something for me");
  });

  document.querySelectorAll(".ai-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = (chip as HTMLElement).dataset.prompt;
      if (prompt) handleAiPrompt(prompt);
    });
  });

  document.querySelectorAll(".feature-card[data-launch-view]").forEach((card) => {
    card.addEventListener("click", () => {
      const targetView = (card as HTMLElement).dataset.launchView as ViewType;
      if (targetView) switchView(targetView);
    });
  });
}

fetchBtn.addEventListener("click", async () => {
  const view = state.currentView;
  if (view === "videos" || view === "music") {
    handleYouTubeFetch(view === "music" ? "music" : "video");
  } else if (view === "movies") {
    if (state.moviesQueue.length > 0 && state.movieIndex < state.moviesQueue.length - 1) {
      state.movieIndex += 1;
      renderMovieCard(state.moviesQueue[state.movieIndex]);
      return;
    }
    fetchNewMoviesBatch();
  } else if (view === "tv") {
    if (state.tvQueue.length > 0 && state.tvIndex < state.tvQueue.length - 1) {
      state.tvIndex += 1;
      renderTvCard(state.tvQueue[state.tvIndex]);
      return;
    }
    fetchNewTvBatch();
  } else if (view === "anime") {
    if (state.animeQueue.length > 0 && state.animeIndex < state.animeQueue.length - 1) {
      state.animeIndex += 1;
      renderAnimeCard(state.animeQueue[state.animeIndex]);
      return;
    }
    fetchNewAnimeBatch();
  } else if (view === "games") {
    if (state.gamesQueue.length > 0 && state.gameIndex < state.gamesQueue.length - 1) {
      state.gameIndex += 1;
      renderGameCard(state.gamesQueue[state.gameIndex]);
      return;
    }
    fetchNewGamesBatch();
  }
});

async function handleYouTubeFetch(type: "video" | "music") {
  const mood = moodSelect.value;
  const age = Number(ageSlider.value);
  const ageGroup2 = getAgeGroup(age);
  const language = langSelect.value;
  const isMusic = type === "music";
  const comboKey = `${mood}-${ageGroup2}-${language}`;
  const currentTopic = isMusic ? state.musicTopics[comboKey] : state.videoTopics[comboKey];
  const iterations = isMusic ? state.musicIterations[comboKey] : state.videoIterations[comboKey];
  const moduleKey = isMusic ? "music" : "videos";
  const excludeIds = getSeenIds(moduleKey);

  fetchBtn.disabled = true;
  renderPromptMessage("SCANNING YOUTUBE SATELLITE FEEDS...", true);

  try {
    const res = await fetch("/api/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: isMusic ? "music" : "video",
        mood,
        ageGroup: ageGroup2,
        language,
        currentTopic,
        iterations,
        excludeIds,
      }),
    });
    const data = await res.json();
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
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
          <h3 style="font-family: var(--font-pixel); color: var(--retro-red); font-size: 0.85rem;">
            ${isMusic ? "🎵 RECOMMENDED TRACK" : "📺 RECOMMENDED VIDEO"}
          </h3>
          <span class="badge">${mood.toUpperCase()} // ${language.toUpperCase()}</span>
        </div>
        <p style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 0.4rem;">
          ${data.title ? `${data.title}${data.channel ? ` — <strong style="color:var(--retro-cyan);">${data.channel}</strong>` : ""}` : `Mood: ${mood} | Language: ${language}`}
        </p>
        <div class="iframe-wrapper">
          <iframe 
            src="https://www.youtube.com/embed/${data.id}?autoplay=1" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
        ${renderFeedbackControls(moduleKey, data.id, data.title || (isMusic ? "Music Track" : "Video"), mood)}
      </div>
    `;
    attachFeedbackListeners();
    fetchBtn.disabled = false;
  } catch {
    renderPromptMessage("⚠️ SIGNAL LOST. PLEASE TRY AGAIN.");
    sfx.play("error");
    fetchBtn.disabled = false;
  }
}

async function fetchNewMoviesBatch() {
  const genreId = genreSelect.value;
  const age = Number(ageSlider.value);
  const language = langSelect.value;
  const excludeIds = getSeenIds("movies");

  fetchBtn.disabled = true;
  renderPromptMessage(`QUERYING TMDB & OMDB ARCHIVES (BATCH ${state.moviePage})...`, true);

  try {
    const params = new URLSearchParams({
      genreId,
      age: String(age),
      language,
      page: String(state.moviePage),
      excludeIds: excludeIds.join(","),
    });
    const res = await fetch(`/api/movies?${params.toString()}`);
    if (!res.ok) throw new Error("TMDB Error");
    const data = await res.json();
    const newMovies = data.movies || [];

    if (newMovies.length === 0) {
      if (state.moviePage > 1) {
        outlet.innerHTML = `
          ${renderAiReasonBannerHtml()}
          <div class="retro-card" style="text-align:center;">
            <p style="color: var(--retro-yellow); margin-bottom: 1rem;">🏁 END OF ARCHIVES REACHED FOR THIS FILTER COMBINATION.</p>
            <button id="restart-movies-btn" class="btn-primary">🔄 RESTART FROM BATCH 1</button>
          </div>
        `;
        document.getElementById("restart-movies-btn")?.addEventListener("click", () => {
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
    renderPromptMessage("⚠️ MOVIE SERVICE TEMPORARILY UNAVAILABLE. CHECK YOUR .ENV KEYS.");
    sfx.play("error");
    fetchBtn.disabled = false;
  }
}

function renderMovieCard(movie: any) {
  addSeenId("movies", movie.id);
  updateFetchButtonText();
  const omdb = movie.omdb;
  const ratingText =
    omdb && omdb.imdb_rating !== "N/A"
      ? `⭐ ${omdb.imdb_rating}/10 (IMDb)`
      : `⭐ ${movie.vote_average?.toFixed(1) || "N/A"}/10 (TMDB)`;

  const providersHtml =
    movie.providers && movie.providers.length > 0
      ? `
        <h4 style="color: var(--retro-cyan); margin-top: 1rem; font-family: var(--font-pixel); font-size: 0.7rem;">WHERE TO STREAM</h4>
        <div class="providers-list">
          ${movie.providers
            .map(
              (p: any) => `
            <div class="provider-item">
              ${p.logo_path ? `<img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="${p.provider_name}" />` : ""}
              <span>${p.provider_name}</span>
            </div>`
            )
            .join("")}
        </div>`
      : "";

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
                : ""
            }
          </div>
          <span class="badge">MOVIE ${state.movieIndex + 1} / ${state.moviesQueue.length} (BATCH ${currentBatchNum})</span>
        </div>

        <div class="stats-strip">
          <div class="stat-pill"><strong>Rating:</strong> ${ratingText}</div>
          <div class="stat-pill"><strong>Rated:</strong> ${omdb && omdb.rated !== "N/A" ? omdb.rated : movie.age_rating}</div>
          <div class="stat-pill"><strong>Metascore:</strong> ${omdb?.metascore || "N/A"}</div>
          <div class="stat-pill"><strong>Runtime:</strong> ${omdb?.runtime || "N/A"}</div>
        </div>

        ${
          movie.genre_names?.length
            ? `<p style="margin-bottom: 0.6rem;"><strong style="color:var(--retro-yellow);">Genres:</strong> ${movie.genre_names.join(", ")}</p>`
            : ""
        }

        ${providersHtml}

        <div style="margin: 1rem 0; font-size: 0.94rem; line-height: 1.6; color: var(--text-muted);">
          ${omdb?.director && omdb.director !== "N/A" ? `<p><strong style="color:#fff;">Director:</strong> ${omdb.director}</p>` : ""}
          ${omdb?.actors && omdb.actors !== "N/A" ? `<p><strong style="color:#fff;">Cast:</strong> ${omdb.actors}</p>` : ""}
          ${omdb?.box_office && omdb.box_office !== "N/A" ? `<p><strong style="color:#fff;">Box Office:</strong> ${omdb.box_office}</p>` : ""}
          ${omdb?.awards && omdb.awards !== "N/A" ? `<p><strong style="color:#fff;">Awards:</strong> ${omdb.awards}</p>` : ""}
        </div>

        <h4 style="color: var(--retro-cyan); margin-bottom: 0.4rem; font-family: var(--font-pixel); font-size: 0.7rem;">SYNOPSIS</h4>
        <p style="line-height: 1.65;">${omdb?.plot && omdb.plot !== "N/A" ? omdb.plot : movie.overview || "No synopsis available."}</p>

        ${renderFeedbackControls("movies", movie.id, movie.title, movie.genre_names)}

        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; align-items: center;">
          ${state.movieIndex > 0 ? `<button id="prev-movie-btn" class="btn-secondary">◀ PREV MOVIE</button>` : ""}
          ${
            state.movieIndex < state.moviesQueue.length - 1
              ? `<button id="next-movie-btn" class="btn-primary btn-sm">NEXT MOVIE ▶</button>`
              : `<button id="new-movie-batch-btn" class="btn-primary btn-sm">🔄 FETCH NEW BATCH</button>`
          }
          <button id="quick-movie-batch-btn" class="btn-secondary" style="margin-left: auto;">🔄 SKIP TO NEW BATCH</button>
        </div>
      </div>
    </div>
  `;
  attachFeedbackListeners();
  document.getElementById("prev-movie-btn")?.addEventListener("click", () => {
    if (state.movieIndex > 0) {
      state.movieIndex -= 1;
      renderMovieCard(state.moviesQueue[state.movieIndex]);
    }
  });
  document.getElementById("next-movie-btn")?.addEventListener("click", () => {
    if (state.movieIndex < state.moviesQueue.length - 1) {
      state.movieIndex += 1;
      renderMovieCard(state.moviesQueue[state.movieIndex]);
    }
  });
  document.getElementById("new-movie-batch-btn")?.addEventListener("click", () => {
    fetchNewMoviesBatch();
  });
  document.getElementById("quick-movie-batch-btn")?.addEventListener("click", () => {
    fetchNewMoviesBatch();
  });
}

async function fetchNewTvBatch() {
  const params = new URLSearchParams({
    genreId: tvGenreSelect.value, mode: tvModeSelect.value,
    age: ageSlider.value, language: langSelect.value, page: String(state.tvPage),
    excludeIds: getSeenIds('tv').join(',')
  });
  fetchBtn.disabled = true;
  renderPromptMessage(`SCANNING TMDB TV ARCHIVES (BATCH ${state.tvPage})...`, true);
  try {
    const res = await fetch(`/api/tv?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'TV service unavailable');
    const shows = data.tv || [];
    if (!shows.length) {
      renderPromptMessage('NO TV SHOWS FOUND FOR THESE FILTERS. TRY ANOTHER GENRE OR SERVICE.');
      fetchBtn.disabled = false;
      return;
    }
    state.tvQueue = shows;
    state.tvIndex = 0;
    state.tvPage++;
    renderTvCard(shows[0]);
  } catch (err: any) {
    renderPromptMessage(err?.message || 'TV SERVICE TEMPORARILY UNAVAILABLE. CHECK YOUR TMDB AND OMDB KEYS.');
    sfx.play('error');
  } finally { fetchBtn.disabled = false; }
}

function renderTvCard(show: any) {
  addSeenId('tv', show.id);
  updateFetchButtonText();
  const rating = show.omdb?.imdb_rating && show.omdb.imdb_rating !== 'N/A'
    ? `⭐ ${show.omdb.imdb_rating}/10 (IMDb)`
    : `⭐ ${Number(show.vote_average || 0).toFixed(1)}/10 (TMDB)`;
  const providersHtml = show.providers?.length ? `<h4 style="color:var(--retro-cyan);margin-top:1rem;font-family:var(--font-pixel);font-size:.7rem;">WHERE TO STREAM</h4><div class="providers-list">${show.providers.map((p: any) => `<div class="provider-item">${p.logo_path ? `<img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="${p.provider_name}" />` : ''}<span>${p.provider_name}</span></div>`).join('')}</div>` : '';
  const currentBatch = Math.max(1, state.tvPage - 1);
  outlet.innerHTML = `
    ${renderAiReasonBannerHtml()}
    <div class="retro-card media-detail-card"><div>${show.poster_url ? `<img class="media-poster" src="${show.poster_url}" alt="${show.name}" />` : '<div class="retro-card" style="text-align:center;padding:4rem 1rem;">NO POSTER</div>'}</div>
    <div><div style="display:flex;justify-content:space-between;align-items:start;gap:1rem;flex-wrap:wrap;"><h2 style="font-size:1.65rem;color:var(--retro-red);">${show.name}</h2><span class="badge">TV ${state.tvIndex + 1} / ${state.tvQueue.length} (BATCH ${currentBatch})</span></div>
    ${show.original_name && show.original_name !== show.name ? `<p style="color:var(--text-muted);">Original Name: ${show.original_name}</p>` : ''}
    <div class="stats-strip"><div class="stat-pill"><strong>Rating:</strong> ${rating}</div><div class="stat-pill"><strong>Rated:</strong> ${show.age_rating || 'Not Rated'}</div><div class="stat-pill"><strong>Seasons:</strong> S${show.seasons ?? '?'} · ${show.episodes ?? '?'} episodes</div><div class="stat-pill"><strong>Status:</strong> ${show.status || 'Unknown'}</div>${show.runtime ? `<div class="stat-pill"><strong>Episode:</strong> ${show.runtime} min</div>` : ''}</div>
    ${show.genre_names?.length ? `<p><strong style="color:var(--retro-yellow);">Genres:</strong> ${show.genre_names.join(', ')}</p>` : ''}
    ${show.networks?.length ? `<p><strong style="color:var(--retro-cyan);">Networks:</strong> ${show.networks.join(', ')}</p>` : ''}
    ${providersHtml}
    <div style="margin:1rem 0;font-size:.94rem;line-height:1.6;color:var(--text-muted);">${show.omdb?.actors && show.omdb.actors !== 'N/A' ? `<p><strong style="color:#fff;">Cast:</strong> ${show.omdb.actors}</p>` : ''}</div>
    <h4 style="color:var(--retro-cyan);margin-bottom:.4rem;font-family:var(--font-pixel);font-size:.7rem;">SYNOPSIS</h4><p style="line-height:1.65;">${show.omdb?.plot && show.omdb.plot !== 'N/A' ? show.omdb.plot : show.overview || 'No synopsis available.'}</p>
    ${renderFeedbackControls('tv', show.id, show.name, show.genre_names)}
    <div style="display:flex;gap:.75rem;margin-top:1.5rem;flex-wrap:wrap;align-items:center;">
      ${state.tvIndex > 0 ? '<button id="prev-tv-btn" class="btn-secondary">◀ PREV SHOW</button>' : ''}
      ${state.tvIndex < state.tvQueue.length - 1 ? '<button id="next-tv-btn" class="btn-primary btn-sm">NEXT SHOW ▶</button>' : '<button id="new-tv-batch-btn" class="btn-primary btn-sm">🔄 FETCH NEW BATCH</button>'}
      <button id="quick-tv-batch-btn" class="btn-secondary" style="margin-left:auto;">🔄 SKIP TO NEW BATCH</button>
    </div></div></div>`;
  attachFeedbackListeners();
  document.getElementById('prev-tv-btn')?.addEventListener('click', () => { state.tvIndex--; renderTvCard(state.tvQueue[state.tvIndex]); });
  document.getElementById('next-tv-btn')?.addEventListener('click', () => { state.tvIndex++; renderTvCard(state.tvQueue[state.tvIndex]); });
  document.getElementById('new-tv-batch-btn')?.addEventListener('click', fetchNewTvBatch);
  document.getElementById('quick-tv-batch-btn')?.addEventListener('click', fetchNewTvBatch);
}

async function fetchNewAnimeBatch() {
  const mode = animeModeSelect.value;
  const genres = animeGenreSelect.value;
  const rating = animeRatingSelect.value;
  const season = animeSeasonSelect.value;
  const year = animeYearInput.value || String(new Date().getFullYear());
  const excludeIds = getSeenIds("anime");

  fetchBtn.disabled = true;
  renderPromptMessage(`LOADING FROM ANILIST ARCHIVES (BATCH ${state.animePage})...`, true);

  try {
    const params = new URLSearchParams({
      mode,
      genres,
      rating,
      season,
      year,
      page: String(state.animePage),
      excludeIds: excludeIds.join(","),
    });
    const res = await fetch(`/api/anime?${params.toString()}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      renderPromptMessage(errJson.error || "⚠️ FAILED TO RETRIEVE ANIME.");
      sfx.play("error");
      fetchBtn.disabled = false;
      return;
    }
    const data = await res.json();
    const newAnime = data.anime || [];

    if (!newAnime.length) {
      if (state.animePage > 1) {
        outlet.innerHTML = `
          ${renderAiReasonBannerHtml()}
          <div class="retro-card" style="text-align:center;">
            <p style="color: var(--retro-yellow); margin-bottom: 1rem;">🏁 END OF ARCHIVES REACHED FOR THIS FILTER COMBINATION.</p>
            <button id="restart-anime-btn" class="btn-primary">🔄 RESTART FROM BATCH 1</button>
          </div>
        `;
        document.getElementById("restart-anime-btn")?.addEventListener("click", () => {
          state.animePage = 1;
          fetchNewAnimeBatch();
        });
      } else {
        renderPromptMessage("NO ANIME FOUND MATCHING YOUR SELECTION. TRY ADJUSTING THE FILTERS!");
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
    renderPromptMessage("⚠️ ANIME SERVICE TEMPORARILY UNAVAILABLE. PLEASE TRY AGAIN.");
    sfx.play("error");
    fetchBtn.disabled = false;
  }
}

function renderAnimeCard(a: any) {
  addSeenId("anime", a.id);
  updateFetchButtonText();
  const currentBatchNum = Math.max(1, state.animePage - 1);
  const cleanSynopsis = (a.synopsis || "No synopsis available.").replace(/<[^>]*>/g, "");
  const genresText = Array.isArray(a.genres) && a.genres.length ? a.genres.join(", ") : "N/A";
  const scoreText = a.score != null ? `⭐ ${a.score}/10` : "⭐ N/A";

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
          <div class="stat-pill"><strong>Episodes:</strong> ${a.episodes ?? "?"}</div>
          <div class="stat-pill"><strong>Status:</strong> ${a.status || "N/A"}</div>
        </div>
        <p style="line-height: 1.65; color: var(--text-muted);">${cleanSynopsis}</p>

        ${renderFeedbackControls("anime", a.id, a.title, a.genres)}
        
        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; align-items: center;">
          ${state.animeIndex > 0 ? `<button id="prev-anime-btn" class="btn-secondary">◀ PREV ANIME</button>` : ""}
          ${
            state.animeIndex < state.animeQueue.length - 1
              ? `<button id="next-anime-btn" class="btn-primary btn-sm">NEXT ANIME ▶</button>`
              : `<button id="new-anime-batch-btn" class="btn-primary btn-sm">🔄 FETCH NEW BATCH</button>`
          }
          <button id="quick-anime-batch-btn" class="btn-secondary">🔄 SKIP TO NEW BATCH</button>
          ${
            a.url
              ? `<a href="${a.url}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="margin-left: auto; text-decoration:none;">VIEW ON ANILIST ↗</a>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
  attachFeedbackListeners();
  document.getElementById("prev-anime-btn")?.addEventListener("click", () => {
    if (state.animeIndex > 0) {
      state.animeIndex -= 1;
      renderAnimeCard(state.animeQueue[state.animeIndex]);
    }
  });
  document.getElementById("next-anime-btn")?.addEventListener("click", () => {
    if (state.animeIndex < state.animeQueue.length - 1) {
      state.animeIndex += 1;
      renderAnimeCard(state.animeQueue[state.animeIndex]);
    }
  });
  document.getElementById("new-anime-batch-btn")?.addEventListener("click", () => {
    fetchNewAnimeBatch();
  });
  document.getElementById("quick-anime-batch-btn")?.addEventListener("click", () => {
    fetchNewAnimeBatch();
  });
}

async function fetchNewGamesBatch() {
  const mode = gameModeSelect.value;
  const platform = gamePlatformSelect.value;
  const genre = gameGenreSelect.value;
  const age = ageSlider.value;
  const excludeIds = getSeenIds("games");

  fetchBtn.disabled = true;
  renderPromptMessage(`QUERYING RAWG VIDEO GAME ARCHIVES (BATCH ${state.gamePage})...`, true);

  try {
    const params = new URLSearchParams({
      mode,
      platform,
      genre,
      age,
      page: String(state.gamePage),
      excludeIds: excludeIds.join(","),
    });
    const res = await fetch(`/api/games?${params.toString()}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      renderPromptMessage(errJson.error || "⚠️ FAILED TO RETRIEVE GAMES. CHECK YOUR RAWG_API_KEY IN .ENV.");
      sfx.play("error");
      fetchBtn.disabled = false;
      return;
    }
    const data = await res.json();
    const newGames = data.games || [];

    if (!newGames.length) {
      if (state.gamePage > 1) {
        outlet.innerHTML = `
          ${renderAiReasonBannerHtml()}
          <div class="retro-card" style="text-align:center;">
            <p style="color: var(--retro-yellow); margin-bottom: 1rem;">🏁 END OF ARCHIVES REACHED FOR THIS FILTER COMBINATION.</p>
            <button id="restart-games-btn" class="btn-primary">🔄 RESTART FROM BATCH 1</button>
          </div>
        `;
        document.getElementById("restart-games-btn")?.addEventListener("click", () => {
          state.gamePage = 1;
          fetchNewGamesBatch();
        });
      } else {
        renderPromptMessage("NO GAMES FOUND MATCHING YOUR AGE RATING AND FILTER COMBINATION. TRY ADJUSTING THE PLATFORM, GENRE, OR AGE!");
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
    renderPromptMessage("⚠️ GAME SERVICE TEMPORARILY UNAVAILABLE. CHECK YOUR NETWORK OR API KEYS.");
    sfx.play("error");
    fetchBtn.disabled = false;
  }
}

function renderGameCard(g: any) {
  addSeenId("games", g.id);
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
          <div class="stat-pill"><strong>Rating:</strong> ⭐ ${g.rating ? g.rating.toFixed(1) + " / 5" : "N/A"}</div>
          ${g.metacritic ? `<div class="stat-pill"><strong>Metacritic:</strong> 🎯 ${g.metacritic}/100</div>` : ""}
          <div class="stat-pill"><strong>Released:</strong> 📅 ${g.released}</div>
          <div class="stat-pill"><strong>ESRB:</strong> 🛡️ ${g.esrb}</div>
        </div>
        ${g.genres?.length ? `<p style="margin-bottom: 0.6rem;"><strong style="color:var(--retro-yellow);">Genres:</strong> ${g.genres.join(", ")}</p>` : ""}
        ${g.platforms?.length ? `<p style="margin-bottom: 0.6rem;"><strong style="color:var(--retro-cyan);">Platforms:</strong> ${g.platforms.join(", ")}</p>` : ""}

        ${renderFeedbackControls("games", g.id, g.name, g.genres)}

        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; align-items: center;">
          ${state.gameIndex > 0 ? `<button id="prev-game-btn" class="btn-secondary">◀ PREV GAME</button>` : ""}
          ${
            state.gameIndex < state.gamesQueue.length - 1
              ? `<button id="next-game-btn" class="btn-primary btn-sm">NEXT GAME ▶</button>`
              : `<button id="new-game-batch-btn" class="btn-primary btn-sm">🔄 FETCH NEW BATCH</button>`
          }
          <button id="quick-game-batch-btn" class="btn-secondary" style="margin-left: auto;">🔄 SKIP TO NEW BATCH</button>
        </div>
      </div>
    </div>
  `;
  attachFeedbackListeners();
  document.getElementById("prev-game-btn")?.addEventListener("click", () => {
    if (state.gameIndex > 0) {
      state.gameIndex -= 1;
      renderGameCard(state.gamesQueue[state.gameIndex]);
    }
  });
  document.getElementById("next-game-btn")?.addEventListener("click", () => {
    if (state.gameIndex < state.gamesQueue.length - 1) {
      state.gameIndex += 1;
      renderGameCard(state.gamesQueue[state.gameIndex]);
    }
  });
  document.getElementById("new-game-batch-btn")?.addEventListener("click", () => {
    fetchNewGamesBatch();
  });
  document.getElementById("quick-game-batch-btn")?.addEventListener("click", () => {
    fetchNewGamesBatch();
  });
}

function pickRandomSelectOption(selectEl: HTMLSelectElement) {
  const options = Array.from(selectEl.options).filter((opt) => opt.value !== "");
  if (options.length > 0) {
    const randomOpt = options[Math.floor(Math.random() * options.length)];
    selectEl.value = randomOpt.value;
  }
}

function handleSurpriseMe() {
  const view = state.currentView;
  if (view === "home") {
    const moduleViews: ViewType[] = ["videos", "music", "movies", "tv", "anime", "games"];
    const randomView = moduleViews[Math.floor(Math.random() * moduleViews.length)];
    switchView(randomView);
    handleSurpriseMe();
    return;
  }
  if (view === "videos" || view === "music") {
    pickRandomSelectOption(moodSelect);
    handleYouTubeFetch(view === "music" ? "music" : "video");
  } else if (view === "movies") {
    pickRandomSelectOption(genreSelect);
    resetMoviesQueue();
    fetchNewMoviesBatch();
  } else if (view === 'tv') {
    pickRandomSelectOption(tvGenreSelect);
    pickRandomSelectOption(tvModeSelect);
    resetTvQueue();
    fetchNewTvBatch();
  } else if (view === "anime") {
    pickRandomSelectOption(animeGenreSelect);
    resetAnimeQueue();
    fetchNewAnimeBatch();
  } else if (view === "games") {
    pickRandomSelectOption(gameGenreSelect);
    resetGamesQueue();
    fetchNewGamesBatch();
  }
}

surpriseBtn?.addEventListener("click", () => {
  handleSurpriseMe();
});

// ============================================================================
// GLOBAL ARCADE UI SOUND DELEGATION
// ============================================================================
document.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest("button, a, .feature-card[data-launch-view], .ai-chip");
  if (!target) return;

  // Skip the mute button itself since it handles its own chime
  if (target.id === "sfx-toggle-btn") return;

  if (target.id === "fetch-action-btn" || target.id === "home-ai-submit-btn" || target.id === "tab-ai-submit-btn") {
    sfx.play("coin");
  } else if (target.id === "surprise-btn" || target.id === "home-for-you-btn") {
    sfx.play("surprise");
  } else if (target.classList.contains("thumbs-up")) {
    sfx.play("like");
  } else if (target.classList.contains("thumbs-down")) {
    sfx.play("dislike");
  } else if (target.classList.contains("nav-btn") || target.hasAttribute("data-launch-view")) {
    sfx.play("nav");
  } else {
    sfx.play("blip");
  }
});

// Subtle blip when changing dropdowns
document.querySelectorAll("select.retro-input").forEach((sel) => {
  sel.addEventListener("change", () => sfx.play("blip"));
});

switchView("home");
