// Island Quest UI controller: connects quest-game.js, buddies-world.js, sfx.js and browser speech.
import { BUDDY_IDS } from './buddies-contract.js';
import { createBuddyWorld } from './buddies-world.js';
import { BADGES, QUICK_COMMS, createQuestDirector } from './quest-game.js';
import { sfx } from './sfx.js';

const $ = selector => document.querySelector(selector);
export const QUEST_STORAGE_KEY = 'island-quest-progress-v1';
const BUBBLE_MS = 3200;

export function loadQuestProgress(storage) {
  try {
    const raw = storage?.getItem(QUEST_STORAGE_KEY);
    if (!raw) return { coins: 0, badges: [] };
    const parsed = JSON.parse(raw);
    return {
      coins: Number.isFinite(parsed?.coins) ? Math.max(0, Math.floor(parsed.coins)) : 0,
      badges: Array.isArray(parsed?.badges) ? parsed.badges.filter(id => id in BADGES) : [],
    };
  } catch {
    return { coins: 0, badges: [] };
  }
}

export function saveQuestProgress(storage, state) {
  try {
    storage?.setItem(QUEST_STORAGE_KEY, JSON.stringify({
      coins: state.coins,
      badges: state.badges,
    }));
  } catch {}
}

export function speakQuestLine({ synth, Utterance, who, text, muted }) {
  if (muted || !synth || !Utterance) return;
  try { synth.cancel(); } catch {}
  const utterance = new Utterance(text);
  const voices = (synth.getVoices?.() ?? []).filter(v => /^en[-_]US/i.test(v.lang));
  utterance.lang = 'en-US';
  utterance.rate = 0.96;
  utterance.pitch = who === 'mia' ? 1.35 : who === 'player' ? 1.15 : 1.02;
  const voice = voices.find(v => who === 'mia'
    ? /female|samantha|zira|jenny|aria/i.test(v.name)
    : /\bmale|alex|david|guy|fred/i.test(v.name)) ?? voices[who === 'mia' ? 0 : Math.max(0, voices.length - 1)];
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export async function initQuestUI() {
  const view = window;
  const synth = view.speechSynthesis ?? null;
  const Utterance = view.SpeechSynthesisUtterance ?? null;
  const saved = loadQuestProgress(view.localStorage);

  const bubbles = {
    mia: $('#bubble-mia'),
    leo: $('#bubble-leo'),
    player: $('#bubble-player'),
  };
  const bubbleUntil = { mia: 0, leo: 0, player: 0 };
  const coinCount = $('#coin-count');
  const rankPill = $('#rank-pill');
  const comboPill = $('#combo-pill');
  const missionTitle = $('#mission-title');
  const missionGoal = $('#mission-goal');
  const radarChip = $('#radar-chip');
  const badgeRow = $('#badge-row');
  const bannerToast = $('#banner-toast');
  const soundButton = $('#sound-button');
  const dashBtn = $('#dash-btn');
  const jumpBtn = $('#jump-btn');
  const missionTabs = [...document.querySelectorAll('.mission-tab')];

  let muted = sfx.muted;
  let bannerTimer = 0;

  function updateSoundButton() {
    soundButton.textContent = muted ? '🔇' : '🔊';
    soundButton.setAttribute('aria-pressed', String(muted));
  }
  updateSoundButton();

  function renderBadges(ids) {
    badgeRow.replaceChildren(...ids.map(id => {
      const b = BADGES[id];
      const pill = document.createElement('span');
      pill.className = 'badge-pill';
      pill.textContent = `${b.icon} ${b.label}`;
      return pill;
    }));
  }
  renderBadges(saved.badges);

  function showBubble(who, text) {
    const el = bubbles[who];
    if (!el) return;
    el.textContent = text;
    bubbleUntil[who] = performance.now() + BUBBLE_MS;
  }

  function showBanner(text, tone = 'gold') {
    bannerToast.textContent = text;
    bannerToast.dataset.tone = tone;
    bannerToast.hidden = false;
    view.clearTimeout(bannerTimer);
    bannerTimer = view.setTimeout(() => { bannerToast.hidden = true; }, 2200);
  }

  function playSfx(name, combo) {
    if (muted) return;
    if (name === 'combo') { sfx.combo(combo); return; }
    sfx[name]?.();
  }

  let world = null;
  const director = createQuestDirector({
    initialCoins: saved.coins,
    initialBadges: saved.badges,
    emit(event) {
      if (event.type === 'spawnItem') {
        world?.world.spawnItem(event.id, event.kind, event.x, event.z);
      } else if (event.type === 'removeItem') {
        world?.world.removeItem(event.id, { withBurst: event.withBurst });
      } else if (event.type === 'focus') {
        world?.world.focus(event.place);
      } else if (event.type === 'boost') {
        world?.triggerBoost(event.seconds);
      } else if (event.type === 'celebrate') {
        world?.world.celebrate('player');
      } else if (event.type === 'cheer') {
        world?.world.cheer('player');
      } else if (event.type === 'react') {
        world?.world.react(event.targetId, event.point);
      } else if (event.type === 'tapRing') {
        world?.world.showTap(event.x, event.z);
      } else if (event.type === 'walkTo') {
        world?.walkTo(event.target, { stopRadius: event.stopRadius });
      } else if (event.type === 'sfx') {
        playSfx(event.name, event.combo);
      } else if (event.type === 'say') {
        showBubble(event.who, event.text);
        speakQuestLine({ synth, Utterance, who: event.who, text: event.text, muted });
      } else if (event.type === 'playerSay') {
        showBubble('player', event.text);
        speakQuestLine({ synth, Utterance, who: 'player', text: event.text, muted });
      } else if (event.type === 'mission') {
        missionTitle.textContent = event.title;
        for (const tab of missionTabs) {
          tab.classList.toggle('active', tab.dataset.mission === event.id);
        }
      } else if (event.type === 'goal') {
        missionGoal.textContent = event.text;
      } else if (event.type === 'radar') {
        if (!event.state) {
          radarChip.hidden = true;
        } else {
          radarChip.hidden = false;
          radarChip.dataset.level = event.state;
          radarChip.textContent = event.state === 'SUPER HOT' ? 'SUPER HOT ⚡'
            : event.state === 'HOT' ? 'HOT 🔥'
            : event.state === 'WARM' ? 'WARM 🌤️' : 'COLD ❄️';
        }
      } else if (event.type === 'coins') {
        coinCount.textContent = String(event.coins);
        rankPill.textContent = `Lv.${event.rank.level} ${event.rank.title}`;
        saveQuestProgress(view.localStorage, director.state);
      } else if (event.type === 'combo') {
        comboPill.textContent = `🔥 x${event.count}`;
        comboPill.hidden = event.count < 2;
      } else if (event.type === 'badge') {
        renderBadges(event.badges);
        saveQuestProgress(view.localStorage, director.state);
      } else if (event.type === 'banner') {
        showBanner(event.text, event.tone);
      }
    },
  });

  world = createBuddyWorld($('#quest-world'), {
    enableArcade: true,
    onTap(hit) { director.tap(hit); },
    onAction(action) { director.onAction(action); },
    onFrame(dt, player) {
      director.tick(dt, { player });
      if (director.state.combo < 2) comboPill.hidden = true;
      dashBtn.classList.toggle('cooling', player.boostCooldown > 0);
      const now = performance.now();
      for (const who of [...BUDDY_IDS, 'player']) {
        const bubble = bubbles[who];
        const at = world.project(who);
        const show = !!at && !!bubble.textContent && now < bubbleUntil[who];
        bubble.hidden = !show;
        if (show) {
          bubble.style.transform = `translate(${Math.round(Math.min(view.innerWidth - 110, Math.max(110, at.x)))}px, ${Math.round(Math.max(120, at.y))}px) translate(-50%, -100%)`;
        }
      }
      return director.state.buddies;
    },
  });
  world.setPaused(true);

  // Build quick-comms buttons
  const commsList = $('#comms-list');
  commsList.replaceChildren(...QUICK_COMMS.map(phrase => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'comm-btn';
    btn.textContent = phrase;
    btn.addEventListener('click', () => {
      sfx.unlock();
      director.sayComm(phrase);
    });
    return btn;
  }));

  for (const tab of missionTabs) {
    tab.addEventListener('click', () => {
      sfx.unlock();
      director.selectMission(tab.dataset.mission);
      $('#quest-world').focus();
    });
  }

  dashBtn.addEventListener('click', () => { sfx.unlock(); world.dash(); $('#quest-world').focus(); });
  jumpBtn.addEventListener('click', () => { sfx.unlock(); world.jump(); $('#quest-world').focus(); });

  soundButton.addEventListener('click', () => {
    muted = !muted;
    sfx.muted = muted;
    if (muted) synth?.cancel();
    updateSoundButton();
  });

  // Virtual joystick for touch screens
  const stick = $('#stick'), knob = $('#stick-knob');
  let stickId = null;
  function updateStick(clientX, clientY) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    const dx = clientX - cx, dy = clientY - cy, dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const nx = dist > 0 ? (dx / dist) * (clamped / maxR) : 0;
    const ny = dist > 0 ? -(dy / dist) * (clamped / maxR) : 0;
    knob.style.transform = `translate(${Math.round(nx * maxR)}px, ${Math.round(-ny * maxR)}px)`;
    world.setStick(nx, ny);
  }
  stick.addEventListener('pointerdown', e => { stickId = e.pointerId; stick.setPointerCapture?.(e.pointerId); updateStick(e.clientX, e.clientY); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) updateStick(e.clientX, e.clientY); });
  const endStick = e => { if (e.pointerId !== stickId) return; stickId = null; knob.style.transform = ''; world.setStick(0, 0); };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  $('#start-play').addEventListener('click', () => {
    sfx.unlock();
    sfx.ambience();
    $('#start-panel').hidden = true;
    $('#mission-bar').hidden = false;
    $('#quest-tracker').hidden = false;
    $('#comms-dock').hidden = false;
    $('#action-pad').hidden = false;
    $('#stick').hidden = false;
    world.setPaused(false);
    director.start();
    $('#quest-world').focus();
  });

  return { world, director };
}
