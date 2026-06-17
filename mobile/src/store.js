// Persistence + SRS logic. Sync-ready: every read/write goes through Store.
// To add cloud sync later, reimplement load()/persist() to hit Supabase and
// the rest of the app keeps working unchanged.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WORDS } from './words';

const KEY = 'vocabflip.state.v2';
const DEFAULT = {
  progress: {}, // { [en]: {ease,interval,due,reps,lapses,last} }
  stats: { streak: 0, lastStudyDate: null },
  settings: { autoSpeak: false, newPerSession: 10 },
};

export const DAY = 86400000;
const MIN = 60000;
const now = () => Date.now();
const todayStr = () => new Date().toISOString().slice(0, 10);

// In-memory cache mirrors what's on disk; UI re-renders from it.
let state = JSON.parse(JSON.stringify(DEFAULT));

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = {
        progress: parsed.progress || {},
        stats: { ...DEFAULT.stats, ...(parsed.stats || {}) },
        settings: { ...DEFAULT.settings, ...(parsed.settings || {}) },
      };
    }
  } catch {
    state = JSON.parse(JSON.stringify(DEFAULT));
  }
  return state;
}

async function persist() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  // FUTURE: await supabase.from('state').upsert({ user_id, data: state });
}

export const getState = () => state;
export const getSettings = () => state.settings;
export const getStats = () => state.stats;

export async function setSetting(key, value) {
  state.settings[key] = value;
  await persist();
}

export async function resetAll() {
  state = JSON.parse(JSON.stringify(DEFAULT));
  await persist();
}

// ---------- SRS (SM-2-lite) ----------
function cardState(en) {
  return state.progress[en] || { ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, last: 0 };
}
export const isNew = (en) => !state.progress[en];
export const isLearned = (en) => {
  const s = state.progress[en];
  return !!(s && s.interval >= 1);
};

export async function grade(en, good) {
  const s = cardState(en);
  if (good) {
    s.reps += 1;
    if (s.reps === 1) s.interval = 1;
    else if (s.reps === 2) s.interval = 3;
    else s.interval = Math.round(s.interval * s.ease);
    s.ease = Math.min(3.0, s.ease + 0.05);
    s.due = now() + s.interval * DAY;
  } else {
    s.reps = 0;
    s.lapses += 1;
    s.interval = 0;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = now() + 10 * MIN;
  }
  s.last = now();
  state.progress[en] = s;
  await persist();
}

export const dueWords = () => {
  const t = now();
  return WORDS.filter((w) => { const s = state.progress[w.en]; return s && s.due <= t; });
};
export const newWords = () => WORDS.filter((w) => isNew(w.en));
export const learnedCount = () => WORDS.filter((w) => isLearned(w.en)).length;

// Which exercise to use, based on how mature the word is.
export function modeForWord(en) {
  const s = cardState(en);
  if (s.reps === 0) return 'flip';
  if (s.reps === 1) return 'mc';
  return 'type';
}

export async function touchStreak() {
  const st = state.stats;
  const today = todayStr();
  if (st.lastStudyDate === today) return;
  const yest = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  st.streak = st.lastStudyDate === yest ? st.streak + 1 : 1;
  st.lastStudyDate = today;
  await persist();
}
