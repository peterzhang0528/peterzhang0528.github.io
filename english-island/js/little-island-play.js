// Little Island (5-year-old playful immersion) director: pure rules, no DOM/Three.js.
// Tap anywhere to walk, tap any landmark or buddy for instant cute animation, SFX,
// and ultra-short rhythmic English immersion with gentle idle coaxing.
import { BUDDY_IDS } from './buddies-contract.js';
import { PLACES, PLACE_IDS, SPAWN, clampToIsland, distance } from './buddies-map.js';

export const PLAY_SPOTS = Object.freeze({
  sheep: Object.freeze({
    id: 'sheep',
    word: 'sheep',
    sfx: 'baa',
    lines: ['Baa! Fluffy sheep!', 'Hi, sheep! Baa!', 'Look! Jump, sheep!'],
    invite: 'Hey! Look! Fluffy sheep!',
  }),
  tree: Object.freeze({
    id: 'tree',
    word: 'apple',
    sfx: 'pop',
    lines: ['Red apple! Yum!', 'Ooh! Big apple tree!', 'Pop! Red apple!'],
    invite: 'Ooh! Tap the apple tree!',
  }),
  boat: Object.freeze({
    id: 'boat',
    word: 'boat',
    sfx: 'splash',
    lines: ['Splash! Little boat!', 'Yay! Big boat!', 'Blue water! Boat!'],
    invite: 'Come see the boat!',
  }),
  bridge: Object.freeze({
    id: 'bridge',
    word: 'water',
    sfx: 'splash',
    lines: ['Splash, splash! Water!', 'Walk on the bridge!', 'Ooh! Cool water!'],
    invite: 'Splash! Let us cross the bridge!',
  }),
  flowers: Object.freeze({
    id: 'flowers',
    word: 'flowers',
    sfx: 'twinkle',
    lines: ['Pretty flowers! Smell!', 'Pink, yellow, blue!', 'Hi, little butterfly!'],
    invite: 'Look! Pretty flowers!',
  }),
  lighthouse: Object.freeze({
    id: 'lighthouse',
    word: 'light',
    sfx: 'twinkle',
    lines: ['Whoa! Bright light!', 'Twinkle, twinkle!', 'Look up! Tall tower!'],
    invite: 'Whoa! Tap the bright light!',
  }),
  rock: Object.freeze({
    id: 'rock',
    word: 'rock',
    sfx: 'boing',
    lines: ['Peek-a-boo! Big rock!', 'Knock, knock! Rock!', 'Haha! Boing!'],
    invite: 'Peek-a-boo! Big rock!',
  }),
  chest: Object.freeze({
    id: 'chest',
    word: 'star',
    sfx: 'levelup',
    lines: ['Ooh! Gold stars!', 'Open! Sparkle, sparkle!', 'Yay! Treasure!'],
    invite: 'Ooh! Open the treasure!',
  }),
  mia: Object.freeze({
    id: 'mia',
    word: 'hi',
    sfx: 'boing',
    lines: ['Hehe! Hi, friend!', 'Yay! High five!', 'Come play with me!'],
    invite: 'Hehe! Come play!',
  }),
  leo: Object.freeze({
    id: 'leo',
    word: 'jump',
    sfx: 'boing',
    lines: ['Whoa! Hi, buddy!', 'Haha! Jump with me!', 'Yay! You found me!'],
    invite: 'Whoa! Over here!',
  }),
  water: Object.freeze({
    id: 'water',
    word: 'splash',
    sfx: 'splash',
    lines: ['Splash! Blue sea!', 'Whoa! Cool water!', 'Splash, splash!'],
    invite: 'Splash! Blue water!',
  }),
});

export const IDLE_COAX_SECONDS = 8.5;

const GREETING_LINES = [
  ['mia', 'Hi! Come play!'],
  ['leo', 'Tap anything! Yay!'],
];

function buddySpot(center, slot) {
  const angle = Math.atan2(-center.z, -center.x) + (slot ? 0.85 : -0.85);
  return clampToIsland({ x: center.x + Math.cos(angle) * 2.2, z: center.z + Math.sin(angle) * 2.2 }, 1.6);
}

export function createLittleIslandDirector({ emit = () => {}, random = Math.random } = {}) {
  const makeBuddy = who => ({
    x: SPAWN[who].x,
    z: SPAWN[who].z,
    tx: SPAWN[who].x,
    tz: SPAWN[who].z,
    speed: 4.8,
    moving: false,
    heading: 0,
  });

  const state = {
    time: 0,
    idle: 0,
    player: { ...SPAWN.player },
    buddies: { mia: makeBuddy('mia'), leo: makeBuddy('leo') },
    lineIndex: {},
    speakerIndex: 0,
    lastInvite: null,
    taps: 0,
    words: [],
    activePlace: null,
    started: false,
    greetQueue: [],
    greetDelay: 0,
  };

  function nextSpeaker(preferred = null) {
    if (preferred && BUDDY_IDS.includes(preferred)) {
      state.speakerIndex = preferred === 'mia' ? 1 : 0;
      return preferred;
    }
    const who = BUDDY_IDS[state.speakerIndex % BUDDY_IDS.length];
    state.speakerIndex++;
    return who;
  }

  function nextLine(id) {
    const spot = PLAY_SPOTS[id];
    if (!spot) return '';
    const idx = state.lineIndex[id] ?? 0;
    state.lineIndex[id] = (idx + 1) % spot.lines.length;
    return spot.lines[idx];
  }

  function sendBuddiesAround(point, speed = 5.0) {
    BUDDY_IDS.forEach((who, slot) => {
      const target = buddySpot(point, slot);
      state.buddies[who].tx = target.x;
      state.buddies[who].tz = target.z;
      state.buddies[who].speed = speed;
    });
  }

  function learn(word) {
    if (!word || state.words.includes(word)) return;
    state.words.push(word);
    emit({ type: 'word', word });
  }

  function celebrateSpot(id, point = null) {
    const spot = PLAY_SPOTS[id];
    if (!spot) return;
    const who = nextSpeaker(id === 'mia' || id === 'leo' ? id : null);
    const text = nextLine(id);
    emit({ type: 'react', id, point });
    emit({ type: 'sfx', name: spot.sfx });
    emit({ type: 'say', who, text });
    learn(spot.word);
  }

  function start() {
    if (state.started) return;
    state.started = true;
    state.idle = 0;
    state.greetQueue = [...GREETING_LINES];
    state.greetDelay = 0.4;
    // Buddies trot closer to welcome the 5-year-old right away.
    sendBuddiesAround({ x: 0, z: 14.5 }, 5.2);
  }

  function tap({ kind, id, point } = {}) {
    state.idle = 0;
    state.taps++;

    if (kind === 'buddy' && (id === 'mia' || id === 'leo')) {
      const target = { x: state.buddies[id].x, z: state.buddies[id].z };
      emit({ type: 'focus', place: null });
      celebrateSpot(id, target);
      return;
    }

    if (kind === 'water') {
      emit({ type: 'focus', place: null });
      celebrateSpot('water', point ?? null);
      return;
    }

    if (kind === 'place' && id in PLACES) {
      const place = PLACES[id];
      state.activePlace = id;
      emit({ type: 'focus', place: id });
      emit({ type: 'sfx', name: 'step' });
      sendBuddiesAround(place, 5.4);
      const alreadyNear = distance(state.player, place) <= place.r + 0.6;
      if (alreadyNear) {
        celebrateSpot(id, place);
      } else {
        emit({
          type: 'walkTo',
          target: { x: place.x, z: place.z },
          stopRadius: Math.max(2.4, place.r - 0.8),
          placeId: id,
        });
      }
      return;
    }

    if (kind === 'ground' && point) {
      const dest = clampToIsland(point, 1.4);
      state.activePlace = null;
      emit({ type: 'focus', place: null });
      emit({ type: 'tapRing', point: dest });
      emit({ type: 'sfx', name: 'step' });
      emit({ type: 'walkTo', target: dest, stopRadius: 1.0, placeId: null });
      sendBuddiesAround(dest, 4.9);
    }
  }

  function arrive(placeId) {
    state.idle = 0;
    if (placeId && placeId in PLACES) {
      celebrateSpot(placeId, PLACES[placeId]);
    }
  }

  function coax() {
    const candidates = PLACE_IDS.filter(id => id !== state.lastInvite && id !== state.activePlace);
    const chosen = candidates[Math.floor(random() * candidates.length)] ?? PLACE_IDS[0];
    state.lastInvite = chosen;
    const who = nextSpeaker();
    const spot = PLAY_SPOTS[chosen];
    // Friendly buddy hops near the player and points to a fun spot.
    const nearPlayer = clampToIsland({ x: state.player.x + (who === 'mia' ? -2.2 : 2.2), z: state.player.z - 2.2 }, 1.6);
    state.buddies[who].tx = nearPlayer.x;
    state.buddies[who].tz = nearPlayer.z;
    state.buddies[who].speed = 5.4;
    emit({ type: 'focus', place: chosen });
    emit({ type: 'react', id: who });
    emit({ type: 'sfx', name: 'boing' });
    emit({ type: 'say', who, text: spot.invite });
  }

  function tick(dt, { player, busy = false } = {}) {
    state.time += dt;
    if (player) {
      state.player.x = player.x;
      state.player.z = player.z;
    }

    // Move Mia and Leo smoothly toward their targets, facing the player when resting.
    for (const who of BUDDY_IDS) {
      const b = state.buddies[who];
      const dx = b.tx - b.x;
      const dz = b.tz - b.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.25) {
        const step = Math.min(dist, b.speed * dt);
        b.x += (dx / dist) * step;
        b.z += (dz / dist) * step;
        b.heading = Math.atan2(dx, dz);
        b.moving = true;
      } else {
        b.moving = false;
        b.heading = Math.atan2(state.player.x - b.x, state.player.z - b.z);
      }
    }

    if (state.greetQueue.length > 0 && !busy) {
      state.greetDelay -= dt;
      if (state.greetDelay <= 0) {
        const [who, text] = state.greetQueue.shift();
        emit({ type: 'react', id: who });
        emit({ type: 'say', who, text });
        state.greetDelay = 1.6;
      }
      return;
    }

    if (busy || player?.moving) {
      state.idle = 0;
      return;
    }

    state.idle += dt;
    if (state.idle >= IDLE_COAX_SECONDS) {
      state.idle = 0;
      coax();
    }
  }

  return { state, start, tap, arrive, tick };
}
