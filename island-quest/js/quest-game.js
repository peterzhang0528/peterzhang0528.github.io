// Island Quest director: pure arcade game rules for a 3rd-grade gamer.
// Zero DOM, audio, or Three.js dependencies so every mission and reward is unit-tested.
import { BUDDIES, otherBuddy } from './buddies-contract.js';
import { HIDING_PLACES, PLACES, PLACE_IDS, SPAWN, clampToIsland, distance } from './buddies-map.js';

export const RANKS = Object.freeze([
  { level: 1, minCoins: 0, title: 'Rookie' },
  { level: 2, minCoins: 80, title: 'Explorer' },
  { level: 3, minCoins: 180, title: 'Ranger' },
  { level: 4, minCoins: 320, title: 'Island Pro' },
  { level: 5, minCoins: 500, title: 'Island Legend' },
]);

export const BADGES = Object.freeze({
  apple_king: Object.freeze({ id: 'apple_king', icon: '🍎', label: 'Apple Dash' }),
  turbo_champ: Object.freeze({ id: 'turbo_champ', icon: '⚡', label: 'Turbo Champ' }),
  treasure_hunter: Object.freeze({ id: 'treasure_hunter', icon: '💎', label: 'Treasure Hunter' }),
  sky_dragon: Object.freeze({ id: 'sky_dragon', icon: '🐉', label: 'Sky Dragon' }),
  island_legend: Object.freeze({ id: 'island_legend', icon: '👑', label: 'Island Legend' }),
});

export const QUICK_COMMS = Object.freeze([
  "Let's go!",
  'Watch me!',
  'Too slow!',
  'Over here!',
  'GG!',
  'Rematch!',
]);

const COMM_REPLIES = Object.freeze({
  "Let's go!": { who: 'leo', lines: ["Let's gooo! Full speed!", "Yeah! Best squad, let's roll!"], action: 'follow' },
  'Watch me!': { who: 'mia', lines: ['Whoa! Show us your move!', 'Ooh, nice jump! Do it again!'], action: 'cheer' },
  'Too slow!': { who: 'leo', lines: ['Hey! Wait for me! Turbo mode!', 'No way! I am catching up!'], action: 'sprint' },
  'Over here!': { who: 'mia', lines: ['Coming! Right behind you!', 'On my way! Wait up!'], action: 'rally' },
  'GG!': { who: 'leo', lines: ['GG! Best squad on the island!', 'GG! That was awesome!'], action: 'cheer' },
  'Rematch!': { who: 'mia', lines: ['You got it! Ready for round two?', 'Rematch! Let us go!'], action: 'rematch' },
});

export const MISSION_ORDER = Object.freeze(['rush', 'race', 'raid']);

export function rankForCoins(coins) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (coins >= rank.minCoins) current = rank;
  }
  return current;
}

export function createQuestDirector({
  emit = () => {},
  random = Math.random,
  initialCoins = 0,
  initialBadges = [],
  playerTag = 'Hero',
} = {}) {
  const buddy = who => ({
    x: SPAWN[who].x, z: SPAWN[who].z,
    tx: SPAWN[who].x, tz: SPAWN[who].z,
    speed: 0, follow: null, gap: 2.5,
    hidden: false, moving: false, heading: 0, rest: 0, targetItem: null,
  });

  const state = {
    time: 0,
    started: false,
    playerTag,
    mission: null,
    missionIndex: 0,
    missionCount: 0,
    raidsWon: 0,
    coins: Math.max(0, Math.floor(initialCoins || 0)),
    combo: 0,
    comboLeft: 0,
    badges: [...new Set(initialBadges.filter(id => id in BADGES))],
    rank: rankForCoins(initialCoins || 0),
    player: { ...SPAWN.player },
    buddies: { mia: buddy('mia'), leo: buddy('leo') },
    items: [],
    race: null,
    raid: null,
    cooldown: 0,
    idleTime: 0,
  };

  const pick = list => list[Math.floor(random() * list.length)];
  const near = (a, b, r) => distance(a, b) <= r;
  const go = (who, target, speed = 5.6) => {
    const b = state.buddies[who], p = clampToIsland(target);
    b.follow = null; b.tx = p.x; b.tz = p.z; b.speed = speed;
  };
  const follow = (who, whom, gap = 2.8, speed = 6.2) => {
    const b = state.buddies[who];
    b.follow = whom; b.gap = gap; b.speed = speed;
  };
  const around = (place, slot) => {
    const a = Math.atan2(-place.z, -place.x) + (slot ? 0.72 : -0.72);
    return { x: place.x + Math.cos(a) * 2.1, z: place.z + Math.sin(a) * 2.1 };
  };
  const behind = place => {
    const a = Math.atan2(place.z, place.x);
    return clampToIsland({ x: place.x + Math.cos(a) * 2.7, z: place.z + Math.sin(a) * 2.7 }, 1.1);
  };

  function clearMissionItems() {
    for (const item of state.items) {
      if (!item.taken) emit({ type: 'removeItem', id: item.id, withBurst: false });
    }
    state.items = [];
  }

  function spawn(kind, x, z, value = 10) {
    const p = clampToIsland({ x, z }, 2.2);
    const item = {
      id: `${kind}-${state.missionCount}-${state.items.length}`,
      kind,
      x: p.x,
      z: p.z,
      value,
      taken: false,
      rearm: 0,
    };
    state.items.push(item);
    emit({ type: 'spawnItem', id: item.id, kind: item.kind, x: item.x, z: item.z });
    return item;
  }

  function unlockBadge(id) {
    if (!(id in BADGES) || state.badges.includes(id)) return false;
    state.badges.push(id);
    emit({ type: 'badge', badge: BADGES[id], badges: [...state.badges] });
    return true;
  }

  function addCoins(amount, label = '') {
    state.coins += amount;
    const prevLevel = state.rank.level;
    state.rank = rankForCoins(state.coins);
    emit({ type: 'coins', coins: state.coins, delta: amount, label, rank: state.rank });
    if (state.rank.level > prevLevel) {
      emit({ type: 'sfx', name: 'levelup' });
      emit({ type: 'banner', text: `LEVEL UP! ${state.rank.title}!`, tone: 'gold' });
      if (state.rank.level >= 5) unlockBadge('island_legend');
    }
  }

  function say(who, text) {
    emit({ type: 'say', who, text });
  }

  function startRush() {
    clearMissionItems();
    state.mission = 'rush';
    state.race = null;
    state.raid = null;
    state.missionCount++;
    emit({ type: 'mission', id: 'rush', title: 'Golden Apple Rush', subtitle: 'Grab apples & gold before Leo and Mia!' });
    emit({ type: 'focus', place: 'tree' });
    emit({ type: 'radar', state: null });

    const center = PLACES.tree;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + random() * 0.4;
      const r = 4.2 + random() * 6.5;
      spawn('apple', center.x + Math.cos(a) * r, center.z + Math.sin(a) * r, 10);
    }
    for (let i = 0; i < 2; i++) {
      const place = PLACES[pick(PLACE_IDS)];
      spawn('golden_apple', place.x + (random() - 0.5) * 6, place.z + (random() - 0.5) * 6, 30);
    }
    for (let i = 0; i < 3; i++) {
      const a = random() * Math.PI * 2;
      const r = 5 + random() * 14;
      spawn('coin', Math.cos(a) * r, Math.sin(a) * r, 15);
    }
    spawn('boost', -4, 4, 0);
    spawn('boost', 7, -4, 0);

    say('leo', 'Yo! Golden Apple Rush! Grab the gold ones!');
    emit({ type: 'goal', text: 'Collect apples & coins! Grab the glowing Golden Apples (+30)!' });
  }

  function startRace() {
    clearMissionItems();
    state.mission = 'race';
    state.raid = null;
    state.missionCount++;
    const target = [...PLACE_IDS]
      .map(id => PLACES[id])
      .sort((a, b) => distance(state.player, b) - distance(state.player, a))[Math.floor(random() * 3)];

    state.race = {
      target,
      phase: 'countdown',
      timer: 2.2,
      winner: null,
    };
    follow('mia', 'player', 2.4, 7.5);
    follow('leo', 'player', 3.0, 7.5);

    // Put 3 speed pads roughly between player and target
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const px = state.player.x + (target.x - state.player.x) * t + (random() - 0.5) * 3.5;
      const pz = state.player.z + (target.z - state.player.z) * t + (random() - 0.5) * 3.5;
      spawn('boost', px, pz, 0);
    }
    // Bonus coins along the track
    for (let i = 1; i <= 3; i++) {
      const t = i / 4 + 0.1;
      const px = state.player.x + (target.x - state.player.x) * t + (random() - 0.5) * 4;
      const pz = state.player.z + (target.z - state.player.z) * t + (random() - 0.5) * 4;
      spawn('coin', px, pz, 15);
    }

    emit({ type: 'mission', id: 'race', title: `Turbo Race · ${target.word}`, subtitle: 'Hit the blue Speed Pads & Shift to Dash!' });
    emit({ type: 'focus', place: target.id });
    emit({ type: 'radar', state: null });
    emit({ type: 'goal', text: `Race Mia & Leo to the ${target.word}!` });
    say('mia', `Turbo race to the ${target.word}! Ready... set... GO!`);
  }

  function startRaid() {
    clearMissionItems();
    state.mission = 'raid';
    state.race = null;
    state.missionCount++;
    const farPlaces = HIDING_PLACES
      .map(id => PLACES[id])
      .sort((a, b) => distance(state.player, b) - distance(state.player, a));
    const spot = farPlaces[Math.floor(random() * Math.min(3, farPlaces.length))];
    const pos = behind(spot);
    const gem = spawn('gem', pos.x, pos.z, 80);
    spawn('boost', 0, 2, 0);
    spawn('boost', -6, -6, 0);

    state.raid = {
      spot,
      gem,
      lastRadar: '',
      clueTimer: 0,
    };
    follow('mia', 'player', 2.8, 6.4);
    follow('leo', 'player', 3.4, 6.4);

    emit({ type: 'mission', id: 'raid', title: 'Secret Treasure Raid', subtitle: 'Follow the Hot/Cold radar to the rare Gem!' });
    emit({ type: 'focus', place: null });
    emit({ type: 'goal', text: 'Find the hidden Dragon Gem! Watch the radar: COLD → WARM → HOT!' });
    say('leo', 'Secret Dragon Gem is hidden on the island! Follow the radar!');
  }

  function startMission(id) {
    state.cooldown = 0;
    state.idleTime = 0;
    if (id === 'rush') startRush();
    else if (id === 'race') startRace();
    else startRaid();
  }

  function nextMission() {
    state.missionIndex = (state.missionIndex + 1) % MISSION_ORDER.length;
    startMission(MISSION_ORDER[state.missionIndex]);
  }

  function collectItem(item, by) {
    if (item.taken) return;
    if (item.kind === 'boost') {
      if (by !== 'player' || item.rearm > 0) return;
      item.rearm = 3.0;
      emit({ type: 'boost', seconds: 2.2 });
      emit({ type: 'sfx', name: 'boost' });
      emit({ type: 'banner', text: '⚡ TURBO BOOST!', tone: 'cyan' });
      say(pick(['mia', 'leo']), pick(['Whoa! Turbo speed!', 'Zoom! So fast!']));
      return;
    }

    item.taken = true;
    emit({ type: 'removeItem', id: item.id, withBurst: true });

    if (by === 'player') {
      state.idleTime = 0;
      state.combo = state.comboLeft > 0 ? state.combo + 1 : 1;
      state.comboLeft = 4.8;
      const bonus = state.combo >= 2 ? (state.combo - 1) * 5 : 0;
      const total = item.value + bonus;
      if (item.kind === 'gem') {
        emit({ type: 'sfx', name: 'chest' });
      } else if (state.combo >= 2) {
        emit({ type: 'sfx', name: 'combo', combo: state.combo });
      } else {
        emit({ type: 'sfx', name: 'coin' });
      }
      addCoins(total, item.kind === 'golden_apple' ? 'Golden Apple!' : item.kind === 'gem' ? 'Dragon Gem!' : '');
      if (state.combo >= 2) {
        emit({ type: 'combo', count: state.combo });
      }
      if (item.kind === 'golden_apple') {
        emit({ type: 'banner', text: `✨ GOLDEN APPLE +${total}!`, tone: 'gold' });
        say('leo', pick(['Whoa! Golden apple! Nice!', 'Jackpot! Golden apple!']));
      } else if (state.combo === 3) {
        say('mia', 'Combo x3! You are on fire!');
      } else if (state.combo >= 5) {
        say('leo', 'Unstoppable! Pro gamer moves!');
      }
    }
  }

  function finishRush() {
    emit({ type: 'celebrate' });
    emit({ type: 'sfx', name: 'chest' });
    addCoins(40, 'Mission Clear!');
    unlockBadge('apple_king');
    emit({ type: 'banner', text: '🍎 RUSH CLEAR! +40 COINS!', tone: 'gold' });
    say('mia', 'Awesome! We got all the apples! Ready for a race?');
    state.cooldown = 3.2;
  }

  function finishRace(winner) {
    state.race.phase = 'done';
    state.race.winner = winner;
    emit({ type: 'celebrate' });
    if (winner === 'player') {
      emit({ type: 'sfx', name: 'chest' });
      addCoins(60, '1st Place!');
      unlockBadge('turbo_champ');
      emit({ type: 'banner', text: '🏆 1ST PLACE! +60 COINS!', tone: 'gold' });
      say('leo', 'GG! You crushed me! Rematch?');
    } else {
      emit({ type: 'sfx', name: 'levelup' });
      addCoins(25, 'Good Race!');
      emit({ type: 'banner', text: '🏁 CLOSE RACE! +25 COINS!', tone: 'cyan' });
      say(winner, 'Whoa, close one! You almost beat me!');
    }
    state.cooldown = 3.5;
  }

  function finishRaid() {
    state.raidsWon++;
    state.raid = null;
    emit({ type: 'radar', state: null });
    emit({ type: 'celebrate' });
    unlockBadge('treasure_hunter');
    if (state.raidsWon >= 2) unlockBadge('sky_dragon');
    emit({ type: 'banner', text: state.raidsWon >= 2 ? '🐉 SKY DRAGON UNLOCKED!' : '💎 TREASURE FOUND! +80!', tone: 'gold' });
    say('mia', state.raidsWon >= 2 ? 'BOOM! Sky Dragon badge! Legend!' : 'BOOM! Rare gem! You are a real treasure hunter!');
    state.cooldown = 3.5;
  }

  function moveBuddies(dt) {
    for (const who of ['mia', 'leo']) {
      const b = state.buddies[who];
      let target = { x: b.tx, z: b.tz }, stop = 0.2;
      if (b.follow) {
        target = b.follow === 'player' ? state.player : state.buddies[b.follow];
        stop = b.gap;
      }
      const dx = target.x - b.x, dz = target.z - b.z, length = Math.hypot(dx, dz);
      b.moving = !b.hidden && length > stop && b.speed > 0;
      if (!b.moving) continue;
      const stride = Math.min(length - stop + 0.01, b.speed * dt);
      b.x += (dx / length) * stride;
      b.z += (dz / length) * stride;
      b.heading = Math.atan2(dx, dz);
    }
  }

  return {
    state,
    start() {
      if (state.started) return;
      state.started = true;
      emit({ type: 'coins', coins: state.coins, delta: 0, label: '', rank: state.rank });
      startMission('rush');
    },
    selectMission(id) {
      if (!MISSION_ORDER.includes(id)) return;
      state.missionIndex = MISSION_ORDER.indexOf(id);
      startMission(id);
    },
    sayComm(phrase) {
      const reply = COMM_REPLIES[phrase];
      if (!reply) return;
      state.idleTime = 0;
      emit({ type: 'playerSay', text: phrase });
      emit({ type: 'sfx', name: 'pop' });
      const line = pick(reply.lines);
      say(reply.who, line);
      if (reply.action === 'rally' || reply.action === 'follow') {
        follow('mia', 'player', 2.4, 7.2);
        follow('leo', 'player', 3.0, 7.2);
      } else if (reply.action === 'sprint') {
        go('leo', { x: state.player.x + (random() - 0.5) * 4, z: state.player.z + (random() - 0.5) * 4 }, 8.2);
      } else if (reply.action === 'cheer') {
        emit({ type: 'cheer' });
      } else if (reply.action === 'rematch') {
        startMission(state.mission || 'race');
      }
    },
    onAction(action) {
      state.idleTime = 0;
      if (action === 'jump') emit({ type: 'sfx', name: 'jump' });
      else if (action === 'dash') {
        emit({ type: 'sfx', name: 'boost' });
        emit({ type: 'banner', text: '⚡ DASH!', tone: 'cyan' });
      }
    },
    tap({ kind, id, point } = {}) {
      state.idleTime = 0;
      if (kind === 'place' && id && PLACES[id]) {
        emit({ type: 'react', targetId: id, point });
        emit({ type: 'sfx', name: id === 'sheep' ? 'baa' : id === 'chest' ? 'coin' : 'pop' });
        emit({ type: 'walkTo', target: PLACES[id], stopRadius: 2.4 });
        return;
      }
      if (kind === 'buddy' && (id === 'mia' || id === 'leo')) {
        emit({ type: 'react', targetId: id });
        emit({ type: 'sfx', name: 'boing' });
        say(id, pick(['High five! Let us go!', 'You got this! Keep running!', 'Teamwork!']));
        return;
      }
      if (kind === 'ground' && point) {
        emit({ type: 'tapRing', x: point.x, z: point.z });
        emit({ type: 'walkTo', target: point, stopRadius: 0.9 });
      }
    },
    tick(dt, { player } = {}) {
      if (!state.started) return;
      state.time += dt;
      if (player) {
        const moved = Math.hypot(player.x - state.player.x, player.z - state.player.z);
        state.player = { ...player };
        if (moved > 0.05) state.idleTime = 0;
        else state.idleTime += dt;
      }
      if (state.comboLeft > 0) {
        state.comboLeft = Math.max(0, state.comboLeft - dt);
        if (state.comboLeft === 0) state.combo = 0;
      }
      for (const item of state.items) {
        if (item.rearm > 0) item.rearm = Math.max(0, item.rearm - dt);
        if (!item.taken && near(state.player, item, item.kind === 'boost' ? 1.9 : 1.75)) {
          collectItem(item, 'player');
          if (state.mission === 'raid' && item.kind === 'gem') {
            finishRaid();
            break;
          }
        }
      }

      if (state.cooldown > 0) {
        state.cooldown -= dt;
        if (state.cooldown <= 0) nextMission();
        moveBuddies(dt);
        return;
      }

      if (state.mission === 'rush') {
        const remaining = state.items.filter(i => !i.taken && i.kind !== 'boost');
        for (const who of ['mia', 'leo']) {
          const b = state.buddies[who];
          if (b.rest > 0) { b.rest -= dt; continue; }
          if (!b.targetItem || b.targetItem.taken) {
            const other = state.buddies[otherBuddy(who)].targetItem;
            b.targetItem = remaining.filter(i => i !== other && i.kind === 'apple')
              .sort((a, c) => distance(b, a) - distance(b, c))[0] ?? null;
            if (b.targetItem) go(who, b.targetItem, 3.8);
            else follow(who, 'player', 2.8, 5.2);
          } else if (near(b, b.targetItem, 1.15)) {
            collectItem(b.targetItem, who);
            b.targetItem = null;
            b.rest = 2.6 + random() * 2.2;
          }
        }
        if (state.items.every(i => i.taken || i.kind === 'boost')) {
          finishRush();
        }
      } else if (state.mission === 'race' && state.race) {
        if (state.race.phase === 'countdown') {
          state.race.timer -= dt;
          if (state.race.timer <= 0) {
            state.race.phase = 'go';
            emit({ type: 'banner', text: '🏁 GO! GO! GO!', tone: 'cyan' });
            go('mia', around(state.race.target, 0), 5.9);
            go('leo', around(state.race.target, 1), 5.6);
          }
        } else if (state.race.phase === 'go') {
          if (near(state.player, state.race.target, state.race.target.r)) {
            finishRace('player');
          } else {
            for (const who of ['mia', 'leo']) {
              if (near(state.buddies[who], state.race.target, 2.5)) {
                finishRace(who);
                break;
              }
            }
          }
        }
      } else if (state.mission === 'raid' && state.raid) {
        const d = distance(state.player, state.raid.gem);
        const level = d < 6 ? 'SUPER HOT' : d < 12 ? 'HOT' : d < 20 ? 'WARM' : 'COLD';
        if (level !== state.raid.lastRadar) {
          state.raid.lastRadar = level;
          emit({ type: 'radar', state: level });
          if (level === 'SUPER HOT') say('mia', 'SUPER HOT! Right next to you!');
          else if (level === 'HOT') say('leo', 'Hot! Getting super close!');
          else if (level === 'WARM') say('mia', 'Warmer! Keep going!');
        }
        state.raid.clueTimer += dt;
        if (state.raid.clueTimer >= 13) {
          state.raid.clueTimer = 0;
          say('leo', `Hint! Check near the ${state.raid.spot.word}!`);
        }
      }

      if (state.idleTime >= 11) {
        state.idleTime = 0;
        say(pick(['mia', 'leo']), pick(['Yo! Press Shift to Turbo Dash!', 'Come on! Press Space to jump!', 'Let us grab more coins!']));
      }

      moveBuddies(dt);
    },
  };
}
