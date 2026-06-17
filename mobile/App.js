import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Animated, PanResponder,
  Dimensions, ScrollView, Modal, Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';

import { WORDS, shuffle } from './src/words';
import * as Store from './src/store';

const { width: SCREEN_W } = Dimensions.get('window');
const C = {
  bg: '#1a1a2e', card: '#16213e', card2: '#0f3460',
  accent: '#f39c12', green: '#27ae60', red: '#e74c3c',
  muted: '#9aabbf', sub: '#aaa',
};

const speak = (t) => {
  if (!t) return;
  Speech.stop();
  Speech.speak(t, { language: 'en-US', rate: 0.95 });
};

/* ============================================================ */
export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  // session results passed to Done screen
  const [result, setResult] = useState({ total: 0, known: 0, review: 0 });
  const sessionQueue = useRef([]);

  useEffect(() => { Store.loadState().then(() => setReady(true)); }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={[styles.fill, styles.center]}><Text style={styles.homeTitle}>VocabFlip 🇮🇱</Text></View>
      </SafeAreaProvider>
    );
  }

  const startSession = async () => {
    const due = shuffle(Store.dueWords());
    const fresh = shuffle(Store.newWords()).slice(0, Store.getSettings().newPerSession);
    const queue = shuffle([...due, ...fresh]);
    if (queue.length === 0) { rerender(); return; }
    await Store.touchStreak();
    sessionQueue.current = queue;
    setScreen('session');
  };

  const finishSession = (known, review) => {
    setResult({ total: sessionQueue.current.length, known, review });
    setScreen('done');
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.fill}>
        {screen === 'home' && (
          <HomeScreen onStart={startSession} onSettings={() => setSettingsOpen(true)} />
        )}
        {screen === 'session' && (
          <SessionScreen
            queue={sessionQueue.current}
            onQuit={() => setScreen('home')}
            onFinish={finishSession}
          />
        )}
        {screen === 'done' && (
          <DoneScreen result={result} onHome={() => setScreen('home')} />
        )}
        <SettingsModal
          visible={settingsOpen}
          onClose={() => { setSettingsOpen(false); rerender(); }}
          onChange={rerender}
        />
      </View>
    </SafeAreaProvider>
  );
}

/* ============================================================
   HOME
   ============================================================ */
function HomeScreen({ onStart, onSettings }) {
  const due = Store.dueWords().length;
  const newAvail = Store.newWords().length;
  const startable = due + Math.min(newAvail, Store.getSettings().newPerSession);
  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.homePad}>
        <View style={styles.homeTopRow}>
          <View>
            <Text style={styles.homeTitle}>VocabFlip 🇮🇱</Text>
            <Text style={styles.homeSub}>English ↔ עברית</Text>
          </View>
          <Pressable onPress={onSettings} hitSlop={12}><Text style={{ fontSize: 24 }}>⚙️</Text></Pressable>
        </View>

        <View style={styles.tileGrid}>
          <Tile big={String(Store.getStats().streak)} lbl="🔥 Day streak" color={C.accent} />
          <Tile big={String(Store.learnedCount())} lbl="✓ Words learned" color={C.green} />
          <Tile big={String(WORDS.length)} lbl="📚 Total words" />
          <Tile big={String(newAvail)} lbl="🆕 New available" />
        </View>

        <View style={styles.dueCallout}>
          <Text style={styles.dueNum}>{due}</Text>
          <Text style={styles.dueLbl}>
            {startable === 0 ? 'all caught up — come back later!' : (due === 1 ? 'card ready to review' : 'cards ready to review')}
          </Text>
        </View>

        <View>
          <Pressable
            onPress={onStart}
            disabled={startable === 0}
            style={({ pressed }) => [styles.startBtn, startable === 0 && styles.startBtnOff, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.startBtnTxt}>{startable === 0 ? 'Nothing due 🎉' : `Start session (${startable})`}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Tile({ big, lbl, color }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileBig, color && { color }]}>{big}</Text>
      <Text style={styles.tileLbl}>{lbl}</Text>
    </View>
  );
}

/* ============================================================
   SESSION
   ============================================================ */
function SessionScreen({ queue, onQuit, onFinish }) {
  const [qi, setQi] = useState(0);
  const known = useRef(0);
  const review = useRef(0);
  const word = queue[qi];
  const mode = Store.modeForWord(word.en);

  const advance = async (good) => {
    await Store.grade(word.en, good);
    if (good) known.current += 1; else review.current += 1;
    if (qi + 1 >= queue.length) onFinish(known.current, review.current);
    else setQi(qi + 1);
  };

  const modeLabel = mode === 'flip' ? 'Flashcard' : mode === 'mc' ? 'Multiple choice' : 'Type the word';

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={styles.sessHeader}>
        <Pressable onPress={onQuit} hitSlop={12}><Text style={{ color: '#778', fontSize: 22 }}>✕</Text></Pressable>
        <Text style={styles.counter}>{qi + 1} / {queue.length}</Text>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${(qi / queue.length) * 100}%` }]} />
      </View>
      <Text style={styles.modeTag}>{modeLabel}</Text>

      <View style={styles.cardArea}>
        {mode === 'flip' && <FlashCard key={qi} word={word} onGrade={advance} />}
        {mode === 'mc' && <MultipleChoice key={qi} word={word} onGrade={advance} />}
        {mode === 'type' && <TypeRecall key={qi} word={word} onGrade={advance} />}
      </View>
    </SafeAreaView>
  );
}

/* ---------- FLIP MODE (tap to flip, swipe to grade) ---------- */
const FlashCard = forwardRef(function FlashCard({ word, onGrade }, ref) {
  const [flipped, setFlipped] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const [hint, setHint] = useState(0); // -1 review, 1 know
  const locked = useRef(false);

  const doFlip = () => {
    const to = flipped ? 0 : 1;
    setFlipped(!flipped);
    Animated.timing(flip, { toValue: to, duration: 450, useNativeDriver: true }).start();
    if (!flipped && Store.getSettings().autoSpeak) speak(word.en);
  };

  const swipeOff = (good) => {
    if (locked.current) return;
    locked.current = true;
    Animated.timing(pan, {
      toValue: { x: good ? SCREEN_W * 1.4 : -SCREEN_W * 1.4, y: 0 },
      duration: 250, useNativeDriver: true,
    }).start(() => onGrade(good));
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        pan.setValue({ x: g.dx, y: 0 });
        setHint(g.dx > 40 ? 1 : g.dx < -40 ? -1 : 0);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 100) swipeOff(true);
        else if (g.dx < -100) swipeOff(false);
        else {
          setHint(0);
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const rotate = pan.x.interpolate({ inputRange: [-SCREEN_W, 0, SCREEN_W], outputRange: ['-15deg', '0deg', '15deg'] });
  const frontRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  return (
    <View style={styles.cardWrap}>
      <View style={styles.hintRow}>
        <Text style={[styles.hint, { color: C.red, opacity: hint === -1 ? 1 : 0 }]}>← REVIEW</Text>
        <Text style={[styles.hint, { color: C.green, opacity: hint === 1 ? 1 : 0 }]}>KNOW IT →</Text>
      </View>

      <Animated.View
        style={[styles.flipBox, { transform: [{ translateX: pan.x }, { rotate }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={doFlip} style={styles.fill}>
          {/* FRONT */}
          <Animated.View style={[styles.face, { backgroundColor: C.card, transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}>
            <Text style={styles.langBadge}>English</Text>
            <Text style={styles.wordEn}>{word.en}</Text>
            <Pressable onPress={() => speak(word.en)} style={styles.speakBtn}><Text style={styles.speakTxt}>🔊</Text></Pressable>
            <Text style={styles.tapHint}>Tap to reveal Hebrew</Text>
          </Animated.View>
          {/* BACK */}
          <Animated.View style={[styles.face, styles.faceBack, { backgroundColor: C.card2, transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}>
            <Text style={[styles.langBadge, { color: C.accent }]}>עברית</Text>
            <Text style={styles.wordHe}>{word.he}</Text>
            <View style={styles.divider} />
            <Text style={styles.sentEn}>{word.sentence}</Text>
            <Text style={styles.sentHe}>{word.heSentence}</Text>
            <Pressable onPress={() => speak(word.sentence)} style={styles.speakBtn}><Text style={styles.speakTxt}>🔊</Text></Pressable>
          </Animated.View>
        </Pressable>
      </Animated.View>

      <View style={styles.btnRow}>
        <Pressable onPress={() => swipeOff(false)} style={({ pressed }) => [styles.btn, { backgroundColor: '#c0392b' }, pressed && { opacity: 0.85 }]}>
          <Text style={styles.btnTxt}>✕  Review Again</Text>
        </Pressable>
        <Pressable onPress={() => swipeOff(true)} style={({ pressed }) => [styles.btn, { backgroundColor: C.green }, pressed && { opacity: 0.85 }]}>
          <Text style={styles.btnTxt}>✓  Know It</Text>
        </Pressable>
      </View>
    </View>
  );
});

/* ---------- MULTIPLE CHOICE (EN -> HE) ---------- */
function MultipleChoice({ word, onGrade }) {
  const options = useRef(
    shuffle([word.he, ...shuffle(WORDS.filter((w) => w.en !== word.en)).slice(0, 3).map((w) => w.he)])
  ).current;
  const [picked, setPicked] = useState(null);

  const choose = (opt) => {
    if (picked !== null) return;
    setPicked(opt);
    speak(word.en);
    setTimeout(() => onGrade(opt === word.he), 750);
  };

  return (
    <View style={styles.cardWrap}>
      <View style={[styles.quizCard, { justifyContent: 'space-between' }]}>
        <Text style={styles.quizPrompt}>Choose the Hebrew meaning</Text>
        <Text style={styles.quizWord}>{word.en}</Text>
        <View style={{ gap: 12 }}>
          {options.map((opt) => {
            let bg = C.card2, border = 'transparent', dim = false;
            if (picked !== null) {
              if (opt === word.he) { bg = C.green; border = '#fff'; }
              else if (opt === picked) { bg = C.red; border = '#fff'; }
              else dim = true;
            }
            return (
              <Pressable key={opt} onPress={() => choose(opt)} style={[styles.mcOpt, { backgroundColor: bg, borderColor: border, opacity: dim ? 0.4 : 1 }]}>
                <Text style={styles.mcOptTxt}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/* ---------- TYPE RECALL (HE -> type EN) ---------- */
function TypeRecall({ word, onGrade }) {
  const [value, setValue] = useState('');
  const [done, setDone] = useState(false);
  const [correct, setCorrect] = useState(false);

  const submit = () => {
    if (done) return;
    const guess = value.trim().toLowerCase();
    if (!guess) return;
    Keyboard.dismiss();
    const ok = guess === word.en.toLowerCase();
    setCorrect(ok); setDone(true);
    speak(word.en);
    setTimeout(() => onGrade(ok), ok ? 900 : 1600);
  };

  const border = !done ? '#2a4a7a' : correct ? C.green : C.red;
  return (
    <View style={styles.cardWrap}>
      <View style={[styles.quizCard, { justifyContent: 'space-between' }]}>
        <Text style={styles.quizPrompt}>Write the English word</Text>
        <Text style={[styles.quizWord, { color: C.accent, writingDirection: 'rtl' }]}>{word.he}</Text>
        <View>
          <TextInput
            value={value}
            onChangeText={setValue}
            editable={!done}
            onSubmitEditing={submit}
            placeholder="type in English…"
            placeholderTextColor="#5a6b82"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={[styles.typeInput, { borderColor: border }]}
          />
          <Text style={styles.typeFeedback}>
            {done ? (correct
              ? <Text style={{ color: C.green }}>Correct! ✓</Text>
              : <Text style={{ color: C.red }}>Answer: {word.en}</Text>) : ' '}
          </Text>
          <Pressable onPress={submit} style={styles.typeSubmit}><Text style={styles.btnTxt}>Check</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

/* ============================================================
   DONE
   ============================================================ */
function DoneScreen({ result, onHome }) {
  return (
    <SafeAreaView style={[styles.fill, styles.center, { padding: 30 }]} edges={['top', 'bottom']}>
      <Text style={{ fontSize: 72, marginBottom: 16 }}>🎉</Text>
      <Text style={styles.doneTitle}>Session Complete!</Text>
      <Text style={styles.doneSub}>{result.total} cards reviewed</Text>
      <View style={styles.doneStats}>
        <View style={[styles.statBox, { backgroundColor: C.green }]}>
          <Text style={styles.statNum}>{result.known}</Text><Text style={styles.statLbl}>Got it</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: C.red }]}>
          <Text style={styles.statNum}>{result.review}</Text><Text style={styles.statLbl}>Need work</Text>
        </View>
      </View>
      <Text style={styles.streakLine}>🔥 {Store.getStats().streak} day streak</Text>
      <Pressable onPress={onHome} style={styles.restartBtn}><Text style={styles.startBtnTxt}>Back to home 🏠</Text></Pressable>
    </SafeAreaView>
  );
}

/* ============================================================
   SETTINGS
   ============================================================ */
function SettingsModal({ visible, onClose, onChange }) {
  const s = Store.getSettings();
  const [, force] = useState(0);
  const refresh = () => { force((n) => n + 1); onChange(); };

  const toggleAuto = async () => { await Store.setSetting('autoSpeak', !s.autoSpeak); refresh(); };
  const bump = async (d) => {
    const v = Math.max(0, Math.min(50, s.newPerSession + d));
    await Store.setSetting('newPerSession', v); refresh();
  };
  const reset = async () => { await Store.resetAll(); refresh(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView>
            <Text style={styles.sheetTitle}>Settings</Text>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingName}>Auto-speak on reveal</Text>
                <Text style={styles.settingDesc}>Hear the English word automatically</Text>
              </View>
              <Pressable onPress={toggleAuto} style={[styles.switch, s.autoSpeak && styles.switchOn]}>
                <View style={[styles.knob, s.autoSpeak && styles.knobOn]} />
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingName}>New words per session</Text>
                <Text style={styles.settingDesc}>How many fresh words to introduce</Text>
              </View>
              <View style={styles.numCtl}>
                <Pressable onPress={() => bump(-5)} style={styles.numBtn}><Text style={styles.numBtnTxt}>−</Text></Pressable>
                <Text style={styles.numVal}>{s.newPerSession}</Text>
                <Pressable onPress={() => bump(5)} style={styles.numBtn}><Text style={styles.numBtnTxt}>＋</Text></Pressable>
              </View>
            </View>

            <Pressable onPress={reset} style={styles.resetBtn}><Text style={styles.resetTxt}>Reset all progress</Text></Pressable>
            <Pressable onPress={onClose} style={styles.closeBtn}><Text style={styles.btnTxt}>Done</Text></Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ============================================================ */
const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  // home
  homePad: { flex: 1, paddingHorizontal: 22, paddingVertical: 12, justifyContent: 'space-between' },
  homeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  homeTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  homeSub: { fontSize: 14, color: C.muted, marginTop: 4 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 20 },
  tile: { width: '48%', backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 14 },
  tileBig: { fontSize: 38, fontWeight: '900', color: '#fff' },
  tileLbl: { fontSize: 13, color: C.muted, marginTop: 8, fontWeight: '600' },
  dueCallout: { backgroundColor: C.card2, borderRadius: 22, padding: 22, alignItems: 'center' },
  dueNum: { fontSize: 54, fontWeight: '900', color: C.accent },
  dueLbl: { fontSize: 15, color: '#bcd', marginTop: 6, fontWeight: '600' },
  startBtn: { backgroundColor: C.accent, borderRadius: 18, padding: 20, alignItems: 'center', marginTop: 8 },
  startBtnOff: { backgroundColor: '#333' },
  startBtnTxt: { fontSize: 19, fontWeight: '800', color: '#fff' },

  // session
  sessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  counter: { fontSize: 15, color: C.sub, fontWeight: '600' },
  progressBg: { height: 4, backgroundColor: '#333', marginHorizontal: 20, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  modeTag: { textAlign: 'center', fontSize: 12, letterSpacing: 1.2, fontWeight: '700', color: '#8af', textTransform: 'uppercase', paddingVertical: 10 },
  cardArea: { flex: 1, paddingHorizontal: 20, paddingBottom: 8 },
  cardWrap: { flex: 1 },

  hintRow: { flexDirection: 'row', justifyContent: 'space-between', height: 22, marginBottom: 6 },
  hint: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  flipBox: { flex: 1 },
  face: { position: 'absolute', width: '100%', height: '100%', borderRadius: 22, padding: 28, alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden' },
  faceBack: {},
  langBadge: { position: 'absolute', top: 22, left: 24, fontSize: 11, color: C.sub, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  wordEn: { fontSize: 46, fontWeight: '900', color: '#fff', textAlign: 'center' },
  wordHe: { fontSize: 46, fontWeight: '900', color: C.accent, textAlign: 'center', writingDirection: 'rtl' },
  divider: { width: 60, height: 2, backgroundColor: '#2a4a7a', marginVertical: 16 },
  sentEn: { fontSize: 15, color: '#ccc', textAlign: 'center', lineHeight: 22 },
  sentHe: { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22, marginTop: 8, writingDirection: 'rtl' },
  tapHint: { position: 'absolute', bottom: 20, fontSize: 13, color: '#556' },
  speakBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  speakTxt: { fontSize: 18 },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // quiz
  quizCard: { flex: 1, backgroundColor: C.card, borderRadius: 22, padding: 26 },
  quizPrompt: { fontSize: 13, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  quizWord: { fontSize: 42, fontWeight: '900', color: '#fff', textAlign: 'center' },
  mcOpt: { borderRadius: 14, padding: 16, borderWidth: 2, alignItems: 'center' },
  mcOptTxt: { fontSize: 20, fontWeight: '700', color: '#fff', writingDirection: 'rtl' },
  typeInput: { backgroundColor: C.card2, borderWidth: 2, borderRadius: 14, padding: 16, fontSize: 22, color: '#fff', textAlign: 'center' },
  typeFeedback: { textAlign: 'center', minHeight: 26, marginTop: 12, fontSize: 16, fontWeight: '700' },
  typeSubmit: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },

  // done
  doneTitle: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 8 },
  doneSub: { fontSize: 16, color: C.sub, marginBottom: 30 },
  doneStats: { flexDirection: 'row', gap: 18, marginBottom: 24 },
  statBox: { borderRadius: 16, paddingVertical: 20, paddingHorizontal: 26, alignItems: 'center' },
  statNum: { fontSize: 38, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  streakLine: { fontSize: 16, color: C.accent, fontWeight: '700', marginBottom: 30 },
  restartBtn: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40 },

  // settings
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#13182b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 18 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  settingName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  settingDesc: { fontSize: 12, color: '#889', marginTop: 3 },
  switch: { width: 52, height: 30, borderRadius: 15, backgroundColor: '#444', justifyContent: 'center' },
  switchOn: { backgroundColor: C.green },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', marginLeft: 3 },
  knobOn: { marginLeft: 25 },
  numCtl: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  numBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  numBtnTxt: { fontSize: 20, fontWeight: '800', color: '#fff' },
  numVal: { fontSize: 18, fontWeight: '800', color: '#fff', minWidth: 28, textAlign: 'center' },
  resetBtn: { marginTop: 18, borderWidth: 1, borderColor: C.red, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  resetTxt: { color: C.red, fontSize: 15, fontWeight: '700' },
  closeBtn: { marginTop: 10, backgroundColor: C.card, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
});
