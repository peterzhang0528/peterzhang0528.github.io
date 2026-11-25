// Little Island (5-year-old playful immersion) UI controller.
// Wires tap-to-walk 3D world, gentle WebAudio SFX + natural island ambience,
// speech bubbles, and warm slow English voice synthesis.
import { BUDDY_IDS } from './buddies-contract.js';
import { createBuddyWorld } from './buddies-world.js';
import { createLittleIslandDirector } from './little-island-play.js';
import { sfx } from './sfx.js';

const $ = selector => document.querySelector(selector);
const BUBBLE_MS = 2800;
const TOAST_MS = 1800;

export function speakLittleLine({ synth, Utterance, who, text, muted, onDone }) {
  const readable = performance.now() + Math.min(3400, 900 + text.length * 55);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };
  const done = () => {
    const left = readable - performance.now();
    if (left > 0) setTimeout(finish, left);
    else finish();
  };
  if (muted || !synth || !Utterance) {
    setTimeout(done, 0);
    return;
  }
  try {
    synth.cancel();
    const utterance = new Utterance(text);
    const voices = synth.getVoices().filter(v => /^en[-_]US/i.test(v.lang));
    utterance.lang = 'en-US';
    // Slightly slower and warmer for a 5-year-old ear.
    utterance.rate = 0.86;
    utterance.pitch = who === 'mia' ? 1.38 : 1.05;
    const voice = voices.find(v => (who === 'mia'
      ? /female|samantha|zira|jenny|aria|ava/i.test(v.name)
      : /\bmale|alex|david|guy|fred/i.test(v.name))) ?? voices[who === 'mia' ? 0 : voices.length - 1];
    if (voice) utterance.voice = voice;
    utterance.onend = utterance.onerror = done;
    synth.speak(utterance);
  } catch {
    setTimeout(done, 0);
  }
}

export async function initLittleIslandUI() {
  const view = window;
  const synth = view.speechSynthesis ?? null;
  const bubbles = { mia: $('#bubble-mia'), leo: $('#bubble-leo') };
  const soundButton = $('#sound-button');
  const starCount = $('#star-count');
  const wordToast = $('#word-toast');
  const playDock = $('#play-dock');
  const startPanel = $('#start-panel');
  const startPlay = $('#start-play');

  let started = false;
  let muted = sfx.muted;
  let talking = null;
  let toastUntil = 0;
  const bubbleUntil = { mia: 0, leo: 0 };

  function showBubble(who, text) {
    bubbles[who].textContent = text;
    bubbleUntil[who] = performance.now() + BUBBLE_MS;
  }

  function showToast(word) {
    wordToast.textContent = `✦ ${word}`;
    wordToast.hidden = false;
    toastUntil = performance.now() + TOAST_MS;
  }

  function updateSoundButton() {
    soundButton.setAttribute('aria-pressed', String(muted));
    soundButton.textContent = muted ? '🔇 静音' : '🔊 声音开';
  }

  function highlightDock(placeId) {
    for (const btn of playDock.querySelectorAll('.dock-btn')) {
      btn.classList.toggle('active', btn.dataset.place === placeId);
    }
  }

  const director = createLittleIslandDirector({
    emit(event) {
      if (event.type === 'walkTo') {
        world.walkTo(event.target, {
          stopRadius: event.stopRadius,
          onArrive: () => director.arrive(event.placeId),
        });
      } else if (event.type === 'tapRing') {
        world.world.showTap(event.point.x, event.point.z);
      } else if (event.type === 'focus') {
        world.world.focus(event.place);
        highlightDock(event.place);
      } else if (event.type === 'react') {
        world.world.react(event.id, event.point);
      } else if (event.type === 'sfx') {
        if (!muted && typeof sfx[event.name] === 'function') sfx[event.name]();
      } else if (event.type === 'say') {
        talking = event.who;
        showBubble(event.who, event.text);
        speakLittleLine({
          synth,
          Utterance: view.SpeechSynthesisUtterance,
          who: event.who,
          text: event.text,
          muted,
          onDone: () => { if (talking === event.who) talking = null; },
        });
      } else if (event.type === 'word') {
        starCount.textContent = `✦ ${director.state.words.length}`;
        showToast(event.word);
      }
    },
  });

  function onFrame(dt, player) {
    if (!started) return director.state.buddies;
    const now = performance.now();
    director.tick(dt, { player, busy: !!talking });
    for (const who of BUDDY_IDS) {
      const bubble = bubbles[who];
      const at = world.project(who);
      const visible = !!at && !!bubble.textContent && (now < bubbleUntil[who] || talking === who);
      bubble.hidden = !visible;
      if (visible) {
        const x = Math.round(Math.min(view.innerWidth - 96, Math.max(96, at.x)));
        const y = Math.round(Math.max(120, at.y));
        bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    }
    if (toastUntil && now > toastUntil) {
      toastUntil = 0;
      wordToast.hidden = true;
    }
    return director.state.buddies;
  }

  const world = createBuddyWorld($('#little-world'), {
    onFrame,
    onTap(hit) {
      if (!started) return;
      director.tap(hit);
    },
  });
  world.setPaused(true);

  function begin() {
    if (started) return;
    started = true;
    startPanel.hidden = true;
    soundButton.hidden = false;
    starCount.hidden = false;
    playDock.hidden = false;
    updateSoundButton();
    sfx.unlock();
    sfx.ambience();
    world.setPaused(false);
    director.start();
    $('#little-world').focus();
  }

  startPlay.addEventListener('click', begin);
  soundButton.addEventListener('click', () => {
    muted = !muted;
    sfx.muted = muted;
    if (muted) synth?.cancel();
    updateSoundButton();
  });

  for (const btn of playDock.querySelectorAll('.dock-btn')) {
    btn.addEventListener('click', () => {
      if (!started) return;
      director.tap({ kind: 'place', id: btn.dataset.place });
    });
  }

  view.addEventListener('pagehide', () => { synth?.cancel(); });

  return { world, director };
}
