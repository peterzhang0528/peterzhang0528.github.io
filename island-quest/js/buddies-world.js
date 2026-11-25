// Buddy Island scene: a small free-walk voxel island with the player, Mia and Leo.
// Game rules live in buddies-game.js; this file only draws and moves the player.
import * as THREE from './vendor/three.module.min.js';
import { BUDDIES } from './buddies-contract.js';
import { ISLAND_RADIUS, PLACES, PLAYER_SPEED, SPAWN, clampToIsland } from './buddies-map.js';

const POND = { x: PLACES.bridge.x, z: PLACES.bridge.z, r: 2.6 };
// Solid things the player walks around. Companions ignore them; they only stand next to places.
export const OBSTACLES = Object.freeze([
  { x: PLACES.tree.x, z: PLACES.tree.z, r: 1.1 }, { x: PLACES.lighthouse.x, z: PLACES.lighthouse.z, r: 1.9 },
  { x: PLACES.rock.x, z: PLACES.rock.z, r: 1.7 }, { x: PLACES.chest.x, z: PLACES.chest.z, r: 1 },
]);

/** Moves a point by a step, keeping it on the island and outside solid props. */
export function walk(point, dx, dz) {
  let next = clampToIsland({ x: point.x + dx, z: point.z + dz });
  for (const o of OBSTACLES) {
    const ox = next.x - o.x, oz = next.z - o.z, d = Math.hypot(ox, oz), min = o.r + .55;
    if (d < min) next = d < 1e-6 ? { x: o.x + min, z: o.z } : { x: o.x + ox / d * min, z: o.z + oz / d * min };
  }
  return clampToIsland(next);
}

export function createBuddyScene() {
  const scene = new THREE.Scene(), root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color('#bfe0e6');
  scene.fog = new THREE.Fog('#dcecdf', 48, 120);
  const unit = new THREE.BoxGeometry(1, 1, 1), materials = new Map(), textures = [];
  const mat = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color })); return materials.get(color); };
  const box = (parent, color, x, y, z, w, h, d) => { const mesh = new THREE.Mesh(unit, mat(color)); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  const group = (x, z, parent = root) => { const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); return g; };
  const outward = (place, by) => { const l = Math.hypot(place.x, place.z) || 1; return { x: place.x + place.x / l * by, z: place.z + place.z / l * by }; };

  // Ground: one instanced tile per square metre.
  const tiles = [];
  let seed = 20261114; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let x = -ISLAND_RADIUS; x <= ISLAND_RADIUS; x++) for (let z = -ISLAND_RADIUS; z <= ISLAND_RADIUS; z++) {
    const d = Math.hypot(x, z); if (d > ISLAND_RADIUS + .2) continue;
    const pond = Math.hypot(x - POND.x, z - POND.z) < POND.r;
    tiles.push({ x, z, y: pond ? -.62 : -.5, color: pond ? '#7fc1cf' : d > ISLAND_RADIUS - 2.6 ? ['#ecdcae', '#e6d4a2'][Math.floor(rnd() * 2)] : ['#8fbf78', '#88b871', '#96c57e', '#8cbb74'][Math.floor(rnd() * 4)] });
  }
  const ground = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: '#ffffff' }), tiles.length);
  const matrix = new THREE.Matrix4(), tint = new THREE.Color();
  tiles.forEach((tile, index) => { matrix.makeTranslation(tile.x, tile.y, tile.z); ground.setMatrixAt(index, matrix); ground.setColorAt(index, tint.set(tile.color)); });
  ground.receiveShadow = true; root.add(ground);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(170, 40), new THREE.MeshLambertMaterial({ color: '#7cc3d1' }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -.42; sea.userData.pickTarget = { kind: 'water', id: 'water' }; root.add(sea);
  ground.userData.pickTarget = { kind: 'ground', id: 'ground' };
  const clouds = [];
  for (let index = 0; index < 5; index++) { const cloud = group(-46 + index * 22, -50 + (index % 2) * 14); cloud.position.y = 20 + (index % 3) * 3; cloud.userData.baseX = cloud.position.x; cloud.userData.speed = .35 + (index % 3) * .12; for (let j = 0; j < 4; j++) box(cloud, '#ffffff', j * 2, j === 1 ? .6 : 0, 0, 3, 1.2, 2.6).castShadow = false; clouds.push(cloud); }

  // Places. Each model sits on its place point; you "arrive" by standing near it.
  const places = {};
  { const g = places.tree = group(PLACES.tree.x, PLACES.tree.z); box(g, '#9a7049', 0, 1.6, 0, 1, 3.2, 1); box(g, '#5f9d58', 0, 4.4, 0, 4.4, 2.6, 4.4); box(g, '#6eac64', 0, 6, 0, 2.8, 1.4, 2.8);
    for (const [x, y, z] of [[2.25, 4, .8], [-2.25, 4.6, -.6], [.9, 3.6, 2.25], [-1, 4.9, -2.25], [2.25, 5, -1.2]]) box(g, '#df5548', x, y, z, .5, .5, .5); }
  { const p = outward(PLACES.boat, 6), g = places.boat = group(p.x, p.z); g.rotation.y = Math.atan2(PLACES.boat.x, PLACES.boat.z) + Math.PI / 2;
    box(g, '#a8774b', 0, .1, 0, 5, .9, 2.2); box(g, '#8f6039', 2.9, .3, 0, .9, 1.1, 1.6); box(g, '#8f6039', -2.9, .3, 0, .9, 1.1, 1.6); box(g, '#7d5633', 0, 2.6, 0, .25, 4.4, .25); box(g, '#f6f1e3', .9, 2.9, 0, 1.6, 2.8, .12); box(g, '#e98a6b', 0, 4.95, 0, .9, .4, .1);
    const pier = group(0, 0); const a = outward(PLACES.boat, 2.4); for (let i = 0; i < 4; i++) { const q = outward(PLACES.boat, 1.2 + i * 1.1); box(pier, '#c69a66', q.x, -.02, q.z, 1.5, .16, 1.5); } pier.userData.end = a; }
  { const g = places.bridge = group(POND.x, POND.z); for (let i = -3; i <= 3; i++) box(g, '#c69a66', i, .12 + (3 - Math.abs(i)) * .09, 0, 1, .2, 2.2); for (const z of [-1.1, 1.1]) { box(g, '#9a7049', 0, .75, z, 6.6, .14, .14); for (const x of [-3, 0, 3]) box(g, '#9a7049', x, .45, z, .2, .9, .2); } }
  { const g = places.lighthouse = group(PLACES.lighthouse.x, PLACES.lighthouse.z); box(g, '#b9b5ac', 0, .3, 0, 3.4, .6, 3.4); for (let i = 0; i < 5; i++) box(g, i % 2 ? '#e0685a' : '#f6f1e3', 0, 1.5 + i * 1.8, 0, 2.6 - i * .2, 1.8, 2.6 - i * .2);
    box(g, '#3f4b56', 0, 10.3, 0, 2.4, .3, 2.4); const lantern = box(g, '#ffe7a1', 0, 11.2, 0, 1.3, 1.5, 1.3); g.userData.lantern = lantern; box(g, '#e0685a', 0, 12.2, 0, 2, .5, 2); }
  { const g = places.sheep = group(PLACES.sheep.x, PLACES.sheep.z); g.userData.sheep = [];
    for (const [x, z, turn] of [[-1.3, .2, .5], [1.2, -.8, -1.1], [.4, 1.6, 2.4]]) { const s = group(x, z, g); s.rotation.y = turn; box(s, '#f6f3ee', 0, .85, 0, 1, .8, 1.5); box(s, '#f0d9cc', 0, 1.05, .95, .62, .6, .5); for (const [lx, lz] of [[-.3, -.5], [.3, -.5], [-.3, .5], [.3, .5]]) box(s, '#5a5048', lx, .25, lz, .2, .5, .2); g.userData.sheep.push(s); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .4; box(g, '#b98d5b', Math.cos(a) * 3.1, .4, Math.sin(a) * 3.1, .22, .8, .22); } }
  { const g = places.flowers = group(PLACES.flowers.x, PLACES.flowers.z); const colors = ['#ef6f66', '#ffd45c', '#8fa9ff', '#f39ac0'];
    for (let i = 0; i < 16; i++) { const a = i * 2.4, r = .5 + (i % 5) * .5, x = Math.cos(a) * r, z = Math.sin(a) * r; box(g, '#5a9a4c', x, .3, z, .12, .6, .12); box(g, colors[i % 4], x, .7, z, .42, .3, .42); }
    g.userData.butterflies = [0, 1].map(i => { const bf = group(0, 0, g); box(bf, i ? '#ffd45c' : '#f39ac0', -.14, 0, 0, .24, .06, .3); box(bf, i ? '#ffd45c' : '#f39ac0', .14, 0, 0, .24, .06, .3); bf.position.y = 1.6 + i * .4; return bf; }); }
  { const g = places.rock = group(PLACES.rock.x, PLACES.rock.z); box(g, '#9b9ca0', 0, 1.1, 0, 3, 2.2, 2.6); box(g, '#a9aaae', .5, 2.5, -.2, 1.8, .9, 1.6); box(g, '#8a8b91', -1.4, .5, .9, 1.2, 1, 1.2); }
  { const g = places.chest = group(PLACES.chest.x, PLACES.chest.z); g.rotation.y = Math.atan2(-PLACES.chest.x, -PLACES.chest.z); box(g, '#a8774b', 0, .45, 0, 1.6, .9, 1.1); box(g, '#8f6039', 0, 1.05, 0, 1.7, .35, 1.2); box(g, '#f2c84b', 0, .75, .58, .3, .36, .1); box(g, '#f2c84b', -.75, .5, 0, .12, 1, 1.14); box(g, '#f2c84b', .75, .5, 0, .12, 1, 1.14); }
  for (const [id, g] of Object.entries(places)) g.userData.pickTarget = { kind: 'place', id };
  for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = 4 + rnd() * 18, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Object.values(PLACES).some(p => Math.hypot(p.x - x, p.z - z) < 4)) continue; box(root, '#74a862', x, .18, z, .5, .36, .5).castShadow = false; }

  function label(text, color) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96; const g = canvas.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.roundRect(8, 14, 240, 68, 30); g.fill();
    g.fillStyle = color; g.font = '700 44px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 50);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false })); sprite.scale.set(2.2, .82, 1); sprite.renderOrder = 5; return sprite;
  }
  function kid({ shirt, hair, pants, name, long }) {
    const g = group(0, 0), body = new THREE.Group(); g.add(body);
    const part = (color, x, y, z, w, h, d) => { const pivot = new THREE.Group(); pivot.position.set(x, y, z); body.add(pivot); box(pivot, color, 0, -h / 2, 0, w, h, d); return pivot; };
    box(body, shirt, 0, 1.35, 0, .9, 1, .5);
    box(body, '#f3cfae', 0, 2.25, 0, .8, .8, .8); box(body, hair, 0, 2.72, -.03, .88, .24, .88); box(body, hair, 0, 2.3, -.42, .88, .7, .1);
    if (long) { box(body, hair, -.45, 2.1, -.1, .1, .9, .6); box(body, hair, .45, 2.1, -.1, .1, .9, .6); }
    box(body, '#2f3a3a', -.2, 2.28, .41, .12, .14, .04); box(body, '#2f3a3a', .2, 2.28, .41, .12, .14, .04); box(body, '#c9776b', 0, 2.02, .41, .26, .07, .04);
    const limbs = [part('#f3cfae', -.6, 1.82, 0, .28, .95, .3), part('#f3cfae', .6, 1.82, 0, .28, .95, .3), part(pants, -.22, .86, 0, .36, .86, .4), part(pants, .22, .86, 0, .36, .86, .4)];
    const tag = name ? label(name, shirt) : null; if (tag) { tag.position.y = 3.6; g.add(tag); }
    return { group: g, body, limbs, phase: 0, bounce: 0 };
  }
  const actors = {
    player: kid({ shirt: '#f2c84b', hair: '#3a3230', pants: '#5c6b8a', name: 'You' }),
    mia: kid({ shirt: BUDDIES.mia.color, hair: '#8a5a33', pants: '#7d6aa8', name: 'Mia', long: true }),
    leo: kid({ shirt: BUDDIES.leo.color, hair: '#d9b25f', pants: '#4f6d52', name: 'Leo' }),
  };
  for (const who of Object.keys(actors)) {
    actors[who].group.position.set(SPAWN[who].x, 0, SPAWN[who].z);
    if (who !== 'player') actors[who].group.userData.pickTarget = { kind: 'buddy', id: who };
  }

  const marker = new THREE.Group(); marker.visible = false; root.add(marker);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40), new THREE.MeshBasicMaterial({ color: '#fff3b5', transparent: true, opacity: .85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .06; marker.add(ring);
  const arrow = box(marker, '#ffd45c', 0, 0, 0, .7, .7, .7); arrow.rotation.set(Math.PI / 4, 0, Math.PI / 4); arrow.castShadow = false;
  const tapRing = new THREE.Mesh(new THREE.RingGeometry(.45, .7, 32), new THREE.MeshBasicMaterial({ color: '#fff7c8', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  tapRing.rotation.x = -Math.PI / 2; tapRing.position.y = .08; tapRing.visible = false; root.add(tapRing);
  const apples = new Map(), sparks = [], reactions = {};
  let tapLife = 0;
  const sun = new THREE.DirectionalLight('#fff0d4', 2); sun.position.set(-22, 36, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 110 }); sun.shadow.normalBias = .05;
  scene.add(new THREE.HemisphereLight('#f1f6ea', '#7d8468', 1.8), sun);
  let clock = 0, markerHeight = 4;
  const ghosts = new Map();
  const burst = (at, colors, count = 14, y = 2, spread = 5, up = 4.2) => {
    for (let i = 0; i < count; i++) {
      const s = box(root, colors[i % colors.length], at.x, y, at.z, .24, .24, .24); s.castShadow = false;
      sparks.push({ mesh: s, vx: (rnd() - .5) * spread, vy: up + rnd() * 2.8, vz: (rnd() - .5) * spread, life: .95 + rnd() * .3 });
    }
  };
  const pickables = [actors.mia.group, actors.leo.group, ...Object.values(places), ground, sea];
  const items = new Map();

  return {
    scene, root, actors, places, apples, items, marker, pickables, tileCount: tiles.length,
    /** Turns a tall landmark see-through while it stands between the camera and the player. */
    fade(id, on) {
      const place = places[id]; if (!!place.userData.faded === on) return; place.userData.faded = on;
      place.traverse(mesh => {
        if (!mesh.isMesh) return;
        if (!mesh.userData.solid) { mesh.userData.solid = mesh.material; if (!ghosts.has(mesh.material)) ghosts.set(mesh.material, Object.assign(mesh.material.clone(), { transparent: true, opacity: .28, depthWrite: false })); }
        mesh.material = on ? ghosts.get(mesh.userData.solid) : mesh.userData.solid;
      });
    },
    /** Marks the place the current game is about, or hides the marker. */
    focus(id) {
      const place = PLACES[id]; marker.visible = !!place; if (!place) return;
      marker.position.set(place.x, 0, place.z); markerHeight = { lighthouse: 13.6, tree: 7.6, boat: 2.4 }[id] ?? 3.6;
    },
    showTap(x, z) { tapRing.position.set(x, .08, z); tapRing.scale.setScalar(.7); tapRing.material.opacity = .9; tapRing.visible = true; tapLife = .65; },
    react(targetId, point = null) {
      if (targetId === 'mia' || targetId === 'leo') {
        actors[targetId].bounce = 1.05;
        burst(actors[targetId].group.position, [BUDDIES[targetId].color, '#ffd45c', '#ffffff'], 12, 2.7, 4.4, 3.6);
        return;
      }
      if (targetId === 'water') {
        const at = point ?? { x: PLACES.boat.x, z: PLACES.boat.z };
        burst(at, ['#ffffff', '#a9e2f0', '#7cc3d1'], 14, .4, 4.2, 4.4);
        return;
      }
      if (!(targetId in places)) return;
      reactions[targetId] = 1.2;
      const at = point ?? places[targetId].position;
      const palette = {
        sheep: ['#ffffff', '#ffd45c', '#f0d9cc'],
        tree: ['#df5548', '#6eac64', '#ffd45c'],
        boat: ['#ffffff', '#a9e2f0', '#e98a6b'],
        bridge: ['#ffffff', '#a9e2f0', '#7fc1cf'],
        flowers: ['#ef6f66', '#ffd45c', '#f39ac0', '#8fa9ff'],
        lighthouse: ['#ffe7a1', '#ffd45c', '#ffffff'],
        rock: ['#ffd45c', '#ffffff', '#c5c7cc'],
        chest: ['#ffd45c', '#ffe7a1', '#ffffff'],
      }[targetId] ?? ['#ffd45c', '#ffffff'];
      const height = targetId === 'lighthouse' ? 11.4 : targetId === 'tree' ? 4.4 : 1.8;
      burst(at, palette, 15, height, 5, 4.4);
    },
    spawnApple(id, x, z) { if (apples.has(id)) return; const apple = group(x, z); box(apple, '#df5548', 0, .45, 0, .6, .6, .6); box(apple, '#5a9a4c', 0, .85, 0, .12, .22, .12); apples.set(id, apple); },
    removeApple(id) { const apple = apples.get(id); if (apple) { root.remove(apple); apples.delete(id); } },
    spawnItem(id, kind, x, z) {
      if (items.has(id)) return;
      const item = group(x, z);
      item.userData.kind = kind;
      if (kind === 'coin') {
        box(item, '#ffd45c', 0, .85, 0, .66, .66, .22);
        box(item, '#fff2ad', 0, .85, 0, .38, .38, .28);
      } else if (kind === 'golden_apple') {
        box(item, '#ffd45c', 0, .62, 0, .74, .74, .74);
        box(item, '#fff5b8', 0, 1.08, 0, .22, .26, .22);
      } else if (kind === 'boost') {
        box(item, '#27d7ff', 0, .09, 0, 2.2, .14, 2.2);
        box(item, '#ffffff', 0, .17, 0, 1.15, .08, 1.15);
      } else if (kind === 'gem') {
        box(item, '#5ce6ff', 0, 1.0, 0, .72, .95, .72);
        box(item, '#c084fc', 0, 1.0, 0, .92, .46, .92);
      } else {
        box(item, '#df5548', 0, .48, 0, .62, .62, .62);
        box(item, '#5a9a4c', 0, .88, 0, .12, .22, .12);
      }
      items.set(id, item);
    },
    removeItem(id, { withBurst = true } = {}) {
      const item = items.get(id);
      if (!item) return;
      if (withBurst) {
        const colors = item.userData.kind === 'boost' ? ['#27d7ff', '#ffffff']
          : item.userData.kind === 'gem' ? ['#5ce6ff', '#c084fc', '#ffd45c']
          : item.userData.kind === 'apple' ? ['#df5548', '#ffd45c', '#6eac64']
          : ['#ffd45c', '#fff2ad', '#ffffff'];
        burst(item.position, colors, 12, 1.1, 4.8, 4.2);
      }
      root.remove(item);
      items.delete(id);
    },
    clearItems() { for (const item of items.values()) root.remove(item); items.clear(); },
    setHidden(who, hidden) { actors[who].body.scale.y = hidden ? .55 : 1; actors[who].group.children.forEach(child => { if (child.isSprite) child.visible = !hidden; }); },
    cheer(who = 'player') { const at = actors[who].group.position; burst(at, ['#ffd45c', '#ef6f66', '#8fa9ff', '#ffffff'], 14, 2.6, 5, 4); for (const actor of Object.values(actors)) actor.bounce = .7; },
    celebrate(who = 'player') {
      const at = actors[who].group.position;
      burst(at, ['#ffd45c', '#27d7ff', '#ef6f66', '#a855f7', '#4ade80'], 28, 2.8, 8.5, 6.2);
      for (const actor of Object.values(actors)) actor.bounce = 1.15;
    },
    /** positions: { player, mia, leo } each { x, z, moving, heading } */
    update(dt, positions) {
      clock += dt;
      for (const who of Object.keys(actors)) {
        const actor = actors[who], p = positions[who]; if (!p) continue;
        actor.group.position.x = p.x; actor.group.position.z = p.z;
        let turn = p.heading - actor.group.rotation.y; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); actor.group.rotation.y += turn * Math.min(1, dt * 12);
        actor.phase = p.moving ? actor.phase + dt * 11 : actor.phase * Math.max(0, 1 - dt * 10);
        const swing = Math.sin(actor.phase) * .75;
        const waving = actor.bounce > .2 && !p.moving;
        actor.limbs[0].rotation.x = waving ? -2.2 + Math.sin(clock * 16) * .45 : swing;
        actor.limbs[1].rotation.x = waving ? -2.2 - Math.sin(clock * 16) * .45 : -swing;
        actor.limbs[2].rotation.x = -swing; actor.limbs[3].rotation.x = swing;
        actor.bounce = Math.max(0, actor.bounce - dt); actor.group.position.y = (p.y || 0) + Math.abs(Math.sin(actor.bounce * 9)) * .5 * Math.min(1, actor.bounce * 3);
      }
      for (const cloud of clouds) {
        cloud.position.x = cloud.userData.baseX + Math.sin(clock * .08 * cloud.userData.speed) * 9;
      }
      if (tapLife > 0) {
        tapLife = Math.max(0, tapLife - dt);
        const t = 1 - tapLife / .65;
        tapRing.scale.setScalar(.7 + t * 1.4);
        tapRing.material.opacity = (1 - t) * .85;
        if (tapLife === 0) tapRing.visible = false;
      }
      for (const key of Object.keys(reactions)) {
        reactions[key] = Math.max(0, reactions[key] - dt);
        if (reactions[key] === 0) delete reactions[key];
      }
      arrow.position.y = markerHeight + Math.sin(clock * 3) * .35; arrow.rotation.y = clock * 1.5; ring.scale.setScalar(1 + Math.sin(clock * 3) * .06);
      for (const apple of apples.values()) apple.rotation.y = clock * 1.4;
      for (const item of items.values()) {
        const k = item.userData.kind;
        if (k === 'boost') {
          const s = 1 + Math.sin(clock * 6) * .08;
          item.scale.set(s, 1, s);
        } else {
          item.rotation.y = clock * (k === 'coin' || k === 'gem' ? 2.6 : 1.7);
          item.position.y = Math.sin(clock * 3.5 + item.position.x) * .22;
        }
      }
      const sheepBoost = reactions.sheep ?? 0;
      places.sheep.userData.sheep.forEach((s, i) => {
        const idleHop = Math.max(0, Math.sin(clock * 1.3 + i * 2)) * .12;
        const excitedHop = sheepBoost > 0 ? Math.abs(Math.sin(sheepBoost * 10 + i)) * .68 * Math.min(1, sheepBoost * 2) : 0;
        s.position.y = idleHop + excitedHop;
      });
      places.tree.rotation.z = reactions.tree ? Math.sin(reactions.tree * 18) * .09 * Math.min(1, reactions.tree) : 0;
      places.boat.rotation.z = Math.sin(clock * 1.6) * .035 + (reactions.boat ? Math.sin(reactions.boat * 12) * .16 * Math.min(1, reactions.boat) : 0);
      places.rock.rotation.z = reactions.rock ? Math.sin(reactions.rock * 20) * .1 * Math.min(1, reactions.rock) : 0;
      places.chest.position.y = reactions.chest ? Math.abs(Math.sin(reactions.chest * 9)) * .45 * Math.min(1, reactions.chest * 2) : 0;
      if (places.lighthouse.userData.lantern) {
        const pulse = 1 + (reactions.lighthouse ? Math.sin(reactions.lighthouse * 14) * .28 * Math.min(1, reactions.lighthouse) : 0);
        places.lighthouse.userData.lantern.scale.set(1.3 * pulse, 1.5 * pulse, 1.3 * pulse);
      }
      const flowerBoost = reactions.flowers ? 2.5 : 1;
      places.flowers.userData.butterflies?.forEach((bf, i) => {
        const a = clock * (1.2 + i * .4) * flowerBoost + i * Math.PI;
        bf.position.set(Math.cos(a) * (1.5 + i * .5), 1.5 + Math.sin(clock * 3.2 + i) * .35 + (reactions.flowers ? .45 : 0), Math.sin(a) * (1.5 + i * .5));
        bf.rotation.y = -a;
      });
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; s.vy -= 12 * dt; s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt; if (s.life <= 0) { root.remove(s.mesh); sparks.splice(i, 1); } }
    },
    dispose() { unit.dispose(); ground.material.dispose(); sea.geometry.dispose(); sea.material.dispose(); ring.geometry.dispose(); ring.material.dispose(); tapRing.geometry.dispose(); tapRing.material.dispose(); for (const m of materials.values()) m.dispose(); for (const m of ghosts.values()) m.dispose(); for (const t of textures) t.dispose(); actors.player.group.traverse(o => { if (o.isSprite) o.material.dispose(); }); sun.shadow.map?.dispose(); scene.clear(); },
  };
}

const TALL = [['tree', 3.4], ['lighthouse', 2.2]];

function pickTargetOf(object) {
  let current = object;
  while (current) {
    if (current.userData?.pickTarget) return current.userData.pickTarget;
    current = current.parent;
  }
  return null;
}

/** Browser wrapper: renderer, follow camera, keyboard/drag/stick/tap input and the frame loop. */
export function createBuddyWorld(canvas, { onFrame = () => null, onTap = null, onAction = null, enableArcade = false } = {}) {
  const view = canvas.ownerDocument.defaultView;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(view.devicePixelRatio || 1, view.matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const world = createBuddyScene(), camera = new THREE.PerspectiveCamera(52, 1, .1, 400);
  const player = { ...SPAWN.player, y: 0, vy: 0, grounded: true, boostLeft: 0, boostCooldown: 0, heading: Math.PI, moving: false };
  const keys = new Set(), stick = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let yaw = 0, drag = null, paused = false, disposed = false, last = 0, autoWalk = null;
  function doJump() {
    if (paused || !player.grounded) return false;
    player.grounded = false; player.vy = 10.6;
    onAction?.('jump');
    return true;
  }
  function doDash() {
    if (paused || player.boostCooldown > 0) return false;
    player.boostLeft = 1.6; player.boostCooldown = 3.0;
    world.react('water', { x: player.x, z: player.z });
    onAction?.('dash');
    return true;
  }
  const KEYMAP = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const onKey = event => {
    if (event.target?.closest?.('input,textarea,dialog')) return;
    if (enableArcade && event.type === 'keydown' && !event.repeat) {
      if (event.code === 'Space') { doJump(); event.preventDefault(); return; }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { doDash(); event.preventDefault(); return; }
    }
    if (!(event.code in KEYMAP)) return;
    if (event.type === 'keydown') keys.add(event.code); else keys.delete(event.code); event.preventDefault();
  };
  const clearKeys = () => keys.clear();
  view.addEventListener('keydown', onKey); view.addEventListener('keyup', onKey); view.addEventListener('blur', clearKeys);
  const down = event => { drag = { id: event.pointerId, x: event.clientX, startX: event.clientX, startY: event.clientY, at: performance.now(), moved: false }; canvas.setPointerCapture?.(event.pointerId); };
  const move = event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 9) drag.moved = true;
    yaw -= (event.clientX - drag.x) * .006; drag.x = event.clientX;
  };
  const up = event => {
    if (drag?.id !== event.pointerId) return;
    const wasTap = !drag.moved && performance.now() - drag.at < 500;
    drag = null;
    if (!wasTap || paused || !onTap) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -(((event.clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(world.pickables, true);
    for (const hit of hits) {
      const target = pickTargetOf(hit.object);
      if (!target) continue;
      onTap({ ...target, point: { x: hit.point.x, z: hit.point.z } });
      return;
    }
  };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  function resize() { const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
  const observer = new view.ResizeObserver(resize); observer.observe(canvas); resize();
  renderer.setAnimationLoop(now => {
    if (disposed) return;
    const dt = Math.min(.5, last ? (now - last) / 1000 : 0); last = now;
    // A slow device still plays in real time: long frames are simulated in short steps.
    for (let left = paused ? 0 : dt; left > 1e-4; left -= .1) {
      const step = Math.min(.1, left);
      if (player.boostLeft > 0) player.boostLeft = Math.max(0, player.boostLeft - step);
      if (player.boostCooldown > 0) player.boostCooldown = Math.max(0, player.boostCooldown - step);
      if (!player.grounded || player.vy > 0) {
        player.vy -= 28 * step;
        player.y += player.vy * step;
        if (player.y <= 0) { player.y = 0; player.vy = 0; player.grounded = true; }
      }
      const speedMul = player.boostLeft > 0 ? 1.75 : 1;
      let x = stick.x, y = stick.y; for (const code of keys) { x += KEYMAP[code][0]; y += KEYMAP[code][1]; }
      const length = Math.hypot(x, y);
      if (length > .12) {
        autoWalk = null;
        player.moving = true;
        const scale = Math.min(1, length) / length * PLAYER_SPEED * speedMul * step, sin = Math.sin(yaw), cos = Math.cos(yaw);
        // Forward is away from the camera; right is the camera's right.
        const dx = (x * cos - y * sin) * scale, dz = (-x * sin - y * cos) * scale;
        Object.assign(player, walk(player, dx, dz)); player.heading = Math.atan2(dx, dz);
      } else if (autoWalk) {
        const dx = autoWalk.x - player.x, dz = autoWalk.z - player.z, dist = Math.hypot(dx, dz);
        if (dist <= autoWalk.stopRadius) {
          const done = autoWalk.onArrive;
          autoWalk = null;
          player.moving = false;
          done?.();
        } else {
          player.moving = true;
          const speed = PLAYER_SPEED * speedMul * step, ux = dx / dist, uz = dz / dist;
          const next = walk(player, ux * Math.min(dist, speed), uz * Math.min(dist, speed));
          const moved = Math.hypot(next.x - player.x, next.z - player.z);
          if (moved < speed * .25) {
            // Slide gently around a solid landmark if the straight line is blocked.
            const slide = walk(player, -uz * speed, ux * speed);
            Object.assign(player, slide);
          } else {
            Object.assign(player, next);
          }
          player.heading = Math.atan2(dx, dz);
        }
      } else {
        player.moving = false;
      }
      const positions = onFrame(step, player) || {};
      world.update(step, { ...positions, player });
    }
    const target = new THREE.Vector3(player.x, 1.6, player.z);
    camera.position.lerp(new THREE.Vector3(player.x + Math.sin(yaw) * 13, 9.5, player.z + Math.cos(yaw) * 13), last && !paused ? Math.min(1, dt * 6) : 1);
    camera.lookAt(target);
    for (const [id, radius] of TALL) {
      // Distance from the landmark to the sight line between camera and player, on the ground plane.
      const ax = camera.position.x, az = camera.position.z, bx = player.x - ax, bz = player.z - az, place = PLACES[id];
      const along = Math.min(1, Math.max(0, ((place.x - ax) * bx + (place.z - az) * bz) / (bx * bx + bz * bz || 1)));
      world.fade(id, Math.hypot(place.x - ax - bx * along, place.z - az - bz * along) < radius);
    }
    renderer.render(world.scene, camera);
  });
  const projected = new THREE.Vector3();
  return {
    world, player, camera,
    setStick(x, y) { stick.x = x; stick.y = y; if (Math.hypot(x, y) > .12) autoWalk = null; },
    walkTo(target, { stopRadius = 1.4, onArrive = null } = {}) {
      const clamped = clampToIsland(target);
      autoWalk = { x: clamped.x, z: clamped.z, stopRadius, onArrive };
    },
    cancelWalk() { autoWalk = null; },
    jump: doJump,
    dash: doDash,
    triggerBoost(seconds = 2.0) { player.boostLeft = Math.max(player.boostLeft, seconds); world.react('water', { x: player.x, z: player.z }); },
    setPaused(value) { paused = !!value; if (paused) { keys.clear(); stick.x = stick.y = 0; autoWalk = null; } },
    /** Screen position (CSS pixels inside the canvas) above an actor's head, or null when behind the camera. */
    project(who) {
      const at = world.actors[who].group.position; projected.set(at.x, 4.3, at.z).project(camera);
      if (projected.z > 1) return null;
      return { x: (projected.x + 1) / 2 * canvas.clientWidth, y: (1 - projected.y) / 2 * canvas.clientHeight };
    },
    dispose() { if (disposed) return; disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); view.removeEventListener('keydown', onKey); view.removeEventListener('keyup', onKey); view.removeEventListener('blur', clearKeys); world.dispose(); renderer.dispose(); },
  };
}
