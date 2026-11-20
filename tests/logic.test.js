'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');
const S = require('../js/storage.js');

// Toistettava satunnaislukugeneraattori (mulberry32).
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newGame() {
  const s = S.defaultState();
  L.setupGame(s, { name: 'Testi', avatar: {}, pet: { kind: 'cat', color: 'orange', name: 'Mirri' } });
  return s;
}

function masterTable(state, t) {
  for (const m of L.MULTIPLIERS) {
    state.facts[L.factKey(t, m)] = { box: L.MASTERED_BOX, right: 3, wrong: 0, lastWrong: false };
  }
}

test('uusi peli: taulut 2, 5 ja 10, aloitustähdet ja ensimmäinen lemmikki', () => {
  const s = newGame();
  assert.deepEqual(L.enabledTables(s), [2, 5, 10]);
  assert.equal(s.stars, L.START_STARS);
  assert.equal(s.pets.length, 1);
  assert.equal(s.pets[0].name, 'Mirri');
  assert.equal(s.created, true);
});

test('factKey normalisoi järjestyksen', () => {
  assert.equal(L.factKey(5, 3), '3x5');
  assert.equal(L.factKey(3, 5), '3x5');
  assert.equal(L.factKey(7, 7), '7x7');
});

test('laskut tulevat vain avoimista tauluista', () => {
  const s = newGame();
  const rng = seeded(1);
  for (let i = 0; i < 500; i++) {
    const f = L.pickFact(s, [], rng);
    const q = L.makeQuestion(f, rng);
    assert.ok([2, 5, 10].includes(q.a) || [2, 5, 10].includes(q.b), `${q.a}·${q.b}`);
    assert.equal(q.answer, q.a * q.b);
  }
});

test('ehdokkaissa sama lasku on vain kerran', () => {
  const s = newGame();
  const keys = L.candidateFacts(s).map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  // 2, 5 ja 10: 30 laskua, joista 2·5, 2·10 ja 5·10 kahdesti
  assert.equal(keys.length, 27);
});

test('kierroksella sama lasku ei toistu kolmen sisällä', () => {
  const s = newGame();
  s.settings.roundLength = 15;
  const rng = seeded(7);
  for (let r = 0; r < 30; r++) {
    const round = L.newRound(s);
    const seen = [];
    let q;
    while ((q = L.nextQuestion(s, round, rng))) {
      const last = seen.slice(-L.RECENT_LIMIT);
      assert.ok(!last.includes(q.key), `toistui ${q.key}`);
      seen.push(q.key);
      L.submitAnswer(s, round, q.answer);
    }
    assert.equal(seen.length, 15);
  }
});

test('laatikko: oikein nostaa, väärin nollaa, vihjeellä ei nouse', () => {
  const s = newGame();
  const round = L.newRound(s);
  const q = L.nextQuestion(s, round, seeded(3));
  L.submitAnswer(s, round, q.answer);
  assert.equal(s.facts[q.key].box, 1);

  round.current = { ...q, retry: false, hintUsed: true };
  L.submitAnswer(s, round, q.answer);
  assert.equal(s.facts[q.key].box, 1, 'vihjeellä ei nouse');

  round.current = { ...q, retry: false, hintUsed: false };
  L.submitAnswer(s, round, q.answer + 1);
  assert.equal(s.facts[q.key].box, 0);
  assert.equal(s.facts[q.key].lastWrong, true);
});

test('laatikko ei nouse yli maksimin', () => {
  const s = newGame();
  const round = L.newRound(s);
  const q = L.nextQuestion(s, round, seeded(4));
  for (let i = 0; i < 10; i++) {
    round.current = { ...q, retry: false };
    L.submitAnswer(s, round, q.answer);
  }
  assert.equal(s.facts[q.key].box, L.MAX_BOX);
});

test('palkinnot: tähti oikeasta, putkibonus ja kierrosbonus', () => {
  const s = newGame();
  s.settings.roundLength = 10;
  const start = s.stars;
  const round = L.newRound(s);
  const rng = seeded(11);
  let q;
  let streakBonuses = 0;
  while ((q = L.nextQuestion(s, round, rng))) {
    const res = L.submitAnswer(s, round, q.answer);
    if (res.streakBonus) streakBonuses++;
  }
  L.finishRound(s, round);
  assert.equal(streakBonuses, 2);
  assert.equal(round.stars.correct, 10);
  assert.equal(round.stars.streak, 4);
  assert.equal(round.stars.round, 3);
  assert.equal(s.stars, start + 17);
  assert.equal(L.roundStarsTotal(round), 17);
  assert.equal(s.stats.bestStreak, 10);
});

test('väärä vastaus kysytään uudelleen ilman tähteä, kierros jatkuu', () => {
  const s = newGame();
  s.settings.roundLength = 5;
  const round = L.newRound(s);
  const rng = seeded(5);
  const first = L.nextQuestion(s, round, rng);
  const wrong = L.submitAnswer(s, round, first.answer + 1);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.stars, 0);

  const asked = [];
  let q;
  while ((q = L.nextQuestion(s, round, rng))) {
    asked.push(q);
    const res = L.submitAnswer(s, round, q.answer);
    if (q.retry) assert.equal(res.stars, 0);
  }
  const retries = asked.filter((x) => x.retry);
  assert.equal(retries.length, 1);
  assert.equal(retries[0].key, first.key);
  // Uusintaa ei kysytä heti seuraavana.
  assert.ok(asked.indexOf(retries[0]) >= 2);
  assert.deepEqual(round.marks, ['miss', 'ok', 'ok', 'ok', 'ok']);
  L.finishRound(s, round);
  assert.equal(round.stars.round, 3, '4/5 = 80 % riittää kierrosbonukseen');
});

test('väärin mennyt uusinta ei palaa jonoon uudelleen', () => {
  const s = newGame();
  s.settings.roundLength = 5;
  const round = L.newRound(s);
  const rng = seeded(9);
  let q;
  let count = 0;
  while ((q = L.nextQuestion(s, round, rng))) {
    count++;
    L.submitAnswer(s, round, q.answer + 1);
  }
  assert.equal(count, 10, '5 uutta + 5 uusintaa');
  L.finishRound(s, round);
  assert.equal(round.stars.round, 0);
});

test('avaus: ei avaudu ennen 80 %:a, sitten järjestyksessä 3, 4, 1, …', () => {
  const s = newGame();
  assert.equal(L.checkUnlock(s), null);
  masterTable(s, 2);
  masterTable(s, 5);
  // Kymppi 7/10 = 70 %, (2·10 ja 5·10 jo osattu)
  for (const m of [1, 3, 4, 6, 7]) s.facts[L.factKey(10, m)] = { box: 3, right: 3, wrong: 0, lastWrong: false };
  assert.equal(L.tableMastery(s, 10), 0.7);
  assert.equal(L.checkUnlock(s), null);
  s.facts[L.factKey(10, 8)] = { box: 3, right: 3, wrong: 0, lastWrong: false };
  assert.equal(L.tableMastery(s, 10), 0.8);
  assert.equal(L.checkUnlock(s), 3);
  assert.equal(s.tables.newest, 3);
  assert.ok(L.isTableEnabled(s, 3));

  masterTable(s, 3);
  assert.equal(L.checkUnlock(s), 4);
  masterTable(s, 4);
  assert.equal(L.checkUnlock(s), 1);
});

test('avaus ei tapahdu, jos automaattinen avaus on pois', () => {
  const s = newGame();
  s.settings.autoUnlock = false;
  [2, 5, 10].forEach((t) => masterTable(s, t));
  assert.equal(L.checkUnlock(s), null);
});

test('kierroksen lopussa avautuu taulu ja siitä tulee bonus', () => {
  const s = newGame();
  [2, 5, 10].forEach((t) => masterTable(s, t));
  const round = L.newRound(s);
  const before = s.stars;
  L.finishRound(s, round);
  assert.equal(round.unlocked, 3);
  assert.equal(round.stars.unlock, L.REWARDS.unlockBonus);
  assert.equal(s.stars, before + L.REWARDS.unlockBonus);
});

test('uusimman taulun laskuja kysytään useammin', () => {
  const s = newGame();
  L.setTableEnabled(s, 3, true);
  assert.equal(s.tables.newest, 3);
  const rng = seeded(21);
  let threes = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const f = L.pickFact(s, [], rng);
    if (f.a === 3 || f.b === 3) threes++;
  }
  // Ilman painotusta 3:n laskuja olisi 10/35 ≈ 29 %
  assert.ok(threes / n > 0.4, `osuus ${threes / n}`);
});

test('aikuinen ei voi sulkea viimeistä taulua, ja suljettu ei avaudu automaattisesti', () => {
  const s = newGame();
  assert.equal(L.setTableEnabled(s, 2, false), true);
  assert.equal(L.setTableEnabled(s, 5, false), true);
  assert.equal(L.setTableEnabled(s, 10, false), false);
  assert.deepEqual(L.enabledTables(s), [10]);

  L.setTableEnabled(s, 3, true);
  L.setTableEnabled(s, 3, false);
  assert.equal(L.nextUnlockTable(s), 4);
  L.setTableEnabled(s, 3, true);
  assert.deepEqual(s.tables.parentOff, [2, 5]);
});

test('tarpeet laskevat eivätkä mene alle nollan', () => {
  const s = newGame();
  const pet = s.pets[0];
  pet.needs = { food: 100, water: 100, fun: 100, clean: 100 };
  L.decayAll(s, 60);
  assert.equal(pet.needs.food, 100 - L.DECAY_PER_MINUTE.food);
  assert.equal(pet.needs.water, 100 - L.DECAY_PER_MINUTE.water);
  L.decayAll(s, 3600);
  for (const k of L.NEED_KEYS) assert.equal(pet.needs[k], 0);
  assert.equal(L.petMood(pet), 'sad');
  assert.equal(L.biggestNeed(pet) !== null, true);
});

test('mieliala tarpeiden mukaan', () => {
  const pet = { needs: { food: 100, water: 100, fun: 100, clean: 100 } };
  assert.equal(L.petMood(pet), 'happy');
  pet.needs.food = 40;
  assert.equal(L.petMood(pet), 'ok');
  pet.needs.food = 10;
  assert.equal(L.petMood(pet), 'sad');
  assert.equal(L.biggestNeed(pet), 'food');
});

test('hoito maksaa tähtiä, ei onnistu ilman tähtiä tai kun tarve on täynnä', () => {
  const s = newGame();
  const pet = s.pets[0];
  pet.needs = { food: 20, water: 100, fun: 50, clean: 50 };
  s.stars = 3;
  const r1 = L.care(s, pet.id, 'food', 0);
  assert.equal(r1.ok, true);
  assert.equal(s.stars, 1);
  assert.equal(pet.needs.food, 70);

  assert.deepEqual(L.care(s, pet.id, 'water', 0), { ok: false, reason: 'full' });
  assert.deepEqual(L.care(s, pet.id, 'wash', 0), { ok: false, reason: 'stars' });
  assert.equal(s.stars, 1);
});

test('silitys on ilmainen ja sillä on jäähy', () => {
  const s = newGame();
  const pet = s.pets[0];
  s.stars = 0;
  assert.equal(L.care(s, pet.id, 'pet', 100000).ok, true);
  assert.equal(L.care(s, pet.id, 'pet', 105000).reason, 'cooldown');
  assert.equal(L.care(s, pet.id, 'pet', 111000).ok, true);
  assert.equal(pet.hearts, 2);
});

test('ystävyystaso nousee sydämistä', () => {
  const s = newGame();
  const pet = s.pets[0];
  pet.hearts = L.HEARTS_PER_LEVEL - 1;
  pet.needs.food = 0;
  s.stars = 10;
  const res = L.care(s, pet.id, 'food', 0);
  assert.equal(res.levelUp, true);
  assert.equal(res.level, 2);
});

test('lemmikin adoptio: hinta nousee ja enimmäismäärä rajoittaa', () => {
  const s = newGame();
  s.stars = 1000;
  const prices = [];
  for (let i = 0; i < 5; i++) {
    const r = L.adoptPet(s, { kind: i % 2 ? 'dog' : 'cat', name: 'Lemmikki' + i });
    assert.equal(r.ok, true);
    prices.push(r.price);
  }
  assert.deepEqual(prices, L.PET_PRICES);
  assert.equal(s.pets.length, L.MAX_PETS);
  assert.deepEqual(L.adoptPet(s, { kind: 'cat' }), { ok: false, reason: 'max' });
  assert.equal(new Set(s.pets.map((p) => p.id)).size, s.pets.length);
});

test('adoptio ei onnistu ilman tähtiä', () => {
  const s = newGame();
  s.stars = 5;
  assert.deepEqual(L.adoptPet(s, { kind: 'dog' }), { ok: false, reason: 'stars' });
  assert.equal(s.pets.length, 1);
});

test('kaupan ostot ja asusteen pukeminen', () => {
  const s = newGame();
  s.stars = 15;
  assert.equal(L.setAccessory(s, s.pets[0].id, 'bow'), false, 'ei omisteta vielä');
  assert.equal(L.buyItem(s, 'accessories', 'bow').ok, true);
  assert.equal(s.stars, 5);
  assert.equal(L.buyItem(s, 'accessories', 'bow').reason, 'owned');
  assert.equal(L.buyItem(s, 'decor', 'plant').reason, 'stars');
  assert.equal(L.setAccessory(s, s.pets[0].id, 'bow'), true);
  assert.equal(s.pets[0].accessory, 'bow');
  assert.equal(L.setAccessory(s, s.pets[0].id, null), true);
  assert.equal(s.pets[0].accessory, null);
});

test('nimet siistitään ja lyhennetään', () => {
  assert.equal(L.cleanName('  Aino   Maria  '), 'Aino Maria');
  assert.equal(L.cleanName('abcdefghijklmnopq'), 'abcdefghijkl');
  assert.equal(L.cleanName('🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱🐱').length, 24, 'emojit eivät katkea kesken');
});

test('tallennuksen migraatio täydentää puuttuvat kentät ja korjaa arvot', () => {
  const old = {
    created: true,
    player: { name: 'Aino' },
    stars: '12',
    pets: [{ id: 'p3', kind: 'dog', name: 'Rekku', needs: { food: 150 } }, 'roskaa'],
    tables: { enabled: [2, 5, 5, 99, 3] },
    facts: { '3x5': { box: 9, right: 2 }, 'huono': {} },
    settings: { roundLength: 7, sign: 'x' }
  };
  const s = S.migrate(old);
  assert.equal(s.version, S.VERSION);
  assert.equal(s.player.name, 'Aino');
  assert.equal(typeof s.player.avatar.skin, 'number');
  assert.equal(s.stars, 12);
  assert.equal(s.pets.length, 1);
  assert.equal(s.pets[0].needs.food, 100);
  assert.equal(s.pets[0].needs.water, 100);
  assert.equal(s.nextId, 4, 'nextId suurempi kuin olemassa olevat tunnisteet');
  assert.deepEqual(s.tables.enabled, [2, 5, 3]);
  assert.deepEqual(s.tables.parentOff, []);
  assert.deepEqual(Object.keys(s.facts), ['3x5']);
  assert.equal(s.facts['3x5'].box, 5);
  assert.equal(s.settings.roundLength, 10);
  assert.equal(s.settings.sign, '·');
  assert.equal(s.settings.sound, true);
  assert.deepEqual(s.owned, { accessories: [], decor: [] });
});

test('migraatio: roskadata antaa oletustilan', () => {
  assert.deepEqual(S.migrate(null), S.defaultState());
  assert.deepEqual(S.migrate('x'), S.defaultState());
  const s = S.migrate({ created: true, pets: [] });
  assert.equal(s.created, false, 'ilman lemmikkejä aloitetaan alusta');
});

test('tallennus ja lataus säilyttävät tilan', () => {
  const mem = {};
  const store = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
  const s = newGame();
  s.stars = 42;
  L.adoptPet(s, { kind: 'dog', name: 'Nalle' });
  assert.equal(S.save(s, store), true);
  const loaded = S.load(store);
  assert.deepEqual(loaded, s);
  S.clear(store);
  assert.deepEqual(S.load(store), S.defaultState());
});

test('tallennus ei kaadu, jos localStorage heittää virheen', () => {
  const bad = {
    getItem: () => { throw new Error('estetty'); },
    setItem: () => { throw new Error('täynnä'); },
    removeItem: () => { throw new Error('estetty'); }
  };
  assert.deepEqual(S.load(bad), S.defaultState());
  assert.equal(S.save(S.defaultState(), bad), false);
  S.clear(bad);
});
