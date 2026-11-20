/*
 * Kertotassut – pelilogiikka.
 * Ei riippuvuuksia DOMiin, joten sama tiedosto toimii selaimessa (KT.logic)
 * ja Nodessa testeissä (module.exports). Funktiot muokkaavat annettua tilaa.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.KT = root.KT || {};
    root.KT.logic = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Kertotaulut ja osaaminen ----------------------------------------
  var ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var START_TABLES = [2, 5, 10];
  // Järjestys, jossa uudet taulut avautuvat osaamisen myötä.
  var UNLOCK_ORDER = [3, 4, 1, 6, 9, 8, 7];
  var MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  var MAX_BOX = 5;
  var MASTERED_BOX = 3; // lasku on "osattu", kun laatikko on vähintään tämä
  var UNLOCK_THRESHOLD = 0.8; // kaikkien avointen taulujen osaaminen ennen avausta
  var RECENT_LIMIT = 3; // näin monta edellistä laskua ei toisteta
  var RETRY_GAP = 2; // väärin mennyt lasku kysytään uudelleen tämän monen tehtävän päästä

  // Arvontapainot laatikon mukaan (0 = uusi lasku). Juuri väärin mennyt saa MISSED_WEIGHT.
  var BOX_WEIGHTS = [3, 2.5, 2, 1.5, 1, 0.5];
  var MISSED_WEIGHT = 4;
  var NEWEST_TABLE_FACTOR = 2;

  // ---- Palkinnot ------------------------------------------------------
  var START_STARS = 5;
  var REWARDS = {
    correct: 1, // oikein ensimmäisellä yrityksellä
    streakEvery: 5, // putkibonus joka viides oikea peräkkäin
    streakBonus: 2,
    roundBonusRatio: 0.8, // kierrosbonus, kun näin suuri osuus oikein
    roundBonus: 3,
    unlockBonus: 5 // uusi taulu avautui
  };
  var ROUND_LENGTHS = [5, 10, 15];

  // ---- Lemmikit -------------------------------------------------------
  var NEED_KEYS = ['food', 'water', 'fun', 'clean'];
  // Tarpeiden lasku minuutissa (vain pelatessa).
  var DECAY_PER_MINUTE = { food: 6, water: 8, fun: 5, clean: 3 };
  var FULL_LEVEL = 95; // tästä ylöspäin hoitoa ei tarvita
  var NEEDY_LEVEL = 35; // tästä alaspäin lemmikki pyytää apua
  var HEARTS_PER_LEVEL = 10;

  var CARE_ACTIONS = {
    food: { cost: 2, effects: { food: 50 }, hearts: 1 },
    water: { cost: 1, effects: { water: 100 }, hearts: 1 },
    toy: { cost: 2, effects: { fun: 50 }, hearts: 1 },
    wash: { cost: 3, effects: { clean: 100 }, hearts: 1 },
    treat: { cost: 4, effects: { food: 30, fun: 30 }, hearts: 2 },
    pet: { cost: 0, effects: { fun: 5 }, hearts: 1, cooldownMs: 10000 }
  };
  var CARE_ORDER = ['food', 'water', 'toy', 'wash', 'treat', 'pet'];

  var PET_KINDS = ['cat', 'dog'];
  var MAX_PETS = 6;
  var PET_PRICES = [20, 35, 50, 70, 90]; // 2.–6. lemmikin hinta
  var FIRST_PET_NEEDS = { food: 60, water: 70, fun: 70, clean: 100 };
  var NEW_PET_NEEDS = { food: 70, water: 70, fun: 80, clean: 100 };
  var NAME_MAX = 12;

  var SHOP = {
    accessories: [
      { id: 'bow', name: 'Rusetti', price: 10 },
      { id: 'collar', name: 'Kaulapanta', price: 12 },
      { id: 'hat', name: 'Juhlahattu', price: 20 },
      { id: 'glasses', name: 'Aurinkolasit', price: 25 },
      { id: 'crown', name: 'Kruunu', price: 40 }
    ],
    decor: [
      { id: 'rug', name: 'Matto', price: 10 },
      { id: 'plant', name: 'Kukka', price: 12 },
      { id: 'bed', name: 'Peti', price: 15 },
      { id: 'painting', name: 'Taulu', price: 20 },
      { id: 'tree', name: 'Kiipeilypuu', price: 30 }
    ]
  };

  // ---- Apurit ---------------------------------------------------------
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function cleanName(s, max) {
    var chars = Array.from(String(s == null ? '' : s).replace(/\s+/g, ' ').trim());
    return chars.slice(0, max || NAME_MAX).join('');
  }

  function addStars(state, n) {
    state.stars += n;
    if (n > 0) state.stats.starsEarned += n;
  }

  // ---- Laskut ---------------------------------------------------------
  function factKey(a, b) {
    return Math.min(a, b) + 'x' + Math.max(a, b);
  }

  function factBox(state, key) {
    var f = state.facts[key];
    return f ? f.box : 0;
  }

  function isMastered(state, key) {
    return factBox(state, key) >= MASTERED_BOX;
  }

  function masteredCount(state, table) {
    var n = 0;
    for (var i = 0; i < MULTIPLIERS.length; i++) {
      if (isMastered(state, factKey(table, MULTIPLIERS[i]))) n++;
    }
    return n;
  }

  function tableMastery(state, table) {
    return masteredCount(state, table) / MULTIPLIERS.length;
  }

  function enabledTables(state) {
    return state.tables.enabled.slice().sort(function (a, b) { return a - b; });
  }

  function isTableEnabled(state, table) {
    return state.tables.enabled.indexOf(table) !== -1;
  }

  // Kaikki avointen taulujen laskut, sama lasku vain kerran (2·5 kuuluu 2:n ja 5:n tauluun).
  function candidateFacts(state) {
    var map = {};
    var list = [];
    enabledTables(state).forEach(function (t) {
      MULTIPLIERS.forEach(function (m) {
        var key = factKey(t, m);
        if (!map[key]) {
          map[key] = { key: key, a: t, b: m, tables: [t] };
          list.push(map[key]);
        } else if (map[key].tables.indexOf(t) === -1) {
          map[key].tables.push(t);
        }
      });
    });
    return list;
  }

  function factWeight(state, cand) {
    var f = state.facts[cand.key];
    var w = f && f.lastWrong ? MISSED_WEIGHT : BOX_WEIGHTS[f ? f.box : 0];
    var newest = state.tables.newest;
    if (newest != null && cand.tables.indexOf(newest) !== -1) w *= NEWEST_TABLE_FACTOR;
    return w;
  }

  function pickFact(state, exclude, rng) {
    rng = rng || Math.random;
    var cands = candidateFacts(state);
    var ex = exclude || [];
    var pool = cands.filter(function (c) { return ex.indexOf(c.key) === -1; });
    if (!pool.length) pool = cands;
    var weights = pool.map(function (c) { return factWeight(state, c); });
    var total = weights.reduce(function (s, w) { return s + w; }, 0);
    var r = rng() * total;
    for (var i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function makeQuestion(fact, rng) {
    rng = rng || Math.random;
    var swap = rng() < 0.5;
    var a = swap ? fact.b : fact.a;
    var b = swap ? fact.a : fact.b;
    return { key: fact.key, a: a, b: b, answer: a * b, retry: false, hintUsed: false };
  }

  // ---- Kierros --------------------------------------------------------
  function newRound(state) {
    var length = ROUND_LENGTHS.indexOf(state.settings.roundLength) !== -1 ? state.settings.roundLength : 10;
    return {
      length: length,
      freshAsked: 0,
      answered: 0,
      firstTry: 0,
      streak: 0,
      recent: [],
      retryQueue: [],
      marks: [], // 'ok' | 'miss' jokaiselle uudelle tehtävälle
      wrongKeys: [],
      current: null,
      stars: { correct: 0, streak: 0, round: 0, unlock: 0 },
      unlocked: null,
      finished: false
    };
  }

  function nextQuestion(state, round, rng) {
    rng = rng || Math.random;
    var q = null;
    var dueIndex = -1;
    for (var i = 0; i < round.retryQueue.length; i++) {
      if (round.retryQueue[i].dueAt <= round.answered) { dueIndex = i; break; }
    }
    if (dueIndex === -1 && round.freshAsked >= round.length && round.retryQueue.length) dueIndex = 0;

    if (dueIndex !== -1) {
      var item = round.retryQueue.splice(dueIndex, 1)[0];
      q = { key: item.key, a: item.a, b: item.b, answer: item.answer, retry: true, hintUsed: false };
    } else if (round.freshAsked < round.length) {
      var exclude = round.recent.concat(round.retryQueue.map(function (r) { return r.key; }));
      q = makeQuestion(pickFact(state, exclude, rng), rng);
      round.freshAsked++;
    } else {
      round.current = null;
      return null;
    }
    round.recent.push(q.key);
    if (round.recent.length > RECENT_LIMIT) round.recent.shift();
    round.current = q;
    return q;
  }

  function useHint(round) {
    if (round.current) round.current.hintUsed = true;
  }

  function submitAnswer(state, round, value) {
    var q = round.current;
    if (!q) return null;
    var correct = Number(value) === q.answer;
    var result = { correct: correct, answer: q.answer, retry: q.retry, stars: 0, streakBonus: 0, streak: 0 };
    var fact = state.facts[q.key] || (state.facts[q.key] = { box: 0, right: 0, wrong: 0, lastWrong: false });

    round.answered++;
    state.stats.answers++;

    if (correct) {
      state.stats.correct++;
      fact.right++;
      if (!q.hintUsed) {
        fact.box = Math.min(MAX_BOX, fact.box + 1);
        fact.lastWrong = false;
      }
      if (!q.retry) {
        round.firstTry++;
        round.streak++;
        round.marks.push('ok');
        result.stars = REWARDS.correct;
        round.stars.correct += REWARDS.correct;
        if (round.streak % REWARDS.streakEvery === 0) {
          result.streakBonus = REWARDS.streakBonus;
          round.stars.streak += REWARDS.streakBonus;
        }
        if (round.streak > state.stats.bestStreak) state.stats.bestStreak = round.streak;
      }
    } else {
      fact.wrong++;
      fact.box = 0;
      fact.lastWrong = true;
      if (!q.retry) {
        round.streak = 0;
        round.marks.push('miss');
        round.wrongKeys.push(q.key);
        round.retryQueue.push({ key: q.key, a: q.a, b: q.b, answer: q.answer, dueAt: round.answered + RETRY_GAP });
      }
    }
    result.streak = round.streak;
    addStars(state, result.stars + result.streakBonus);
    round.current = null;
    return result;
  }

  function roundStarsTotal(round) {
    var s = round.stars;
    return s.correct + s.streak + s.round + s.unlock;
  }

  function finishRound(state, round) {
    if (round.finished) return round;
    round.finished = true;
    state.stats.rounds++;
    if (round.firstTry / round.length >= REWARDS.roundBonusRatio) {
      round.stars.round = REWARDS.roundBonus;
      addStars(state, REWARDS.roundBonus);
    }
    var unlocked = checkUnlock(state);
    if (unlocked != null) {
      round.unlocked = unlocked;
      round.stars.unlock = REWARDS.unlockBonus;
      addStars(state, REWARDS.unlockBonus);
    }
    return round;
  }

  // ---- Taulujen avaaminen ----------------------------------------------
  function nextUnlockTable(state) {
    for (var i = 0; i < UNLOCK_ORDER.length; i++) {
      var t = UNLOCK_ORDER[i];
      if (!isTableEnabled(state, t) && state.tables.parentOff.indexOf(t) === -1) return t;
    }
    return null;
  }

  // 0..1: kuinka lähellä seuraavan taulun avausta ollaan.
  function unlockProgress(state) {
    var tables = state.tables.enabled;
    if (!tables.length) return 0;
    var sum = tables.reduce(function (s, t) {
      return s + Math.min(1, tableMastery(state, t) / UNLOCK_THRESHOLD);
    }, 0);
    return sum / tables.length;
  }

  function checkUnlock(state) {
    if (!state.settings.autoUnlock) return null;
    var ready = state.tables.enabled.every(function (t) {
      return tableMastery(state, t) >= UNLOCK_THRESHOLD;
    });
    if (!ready) return null;
    var next = nextUnlockTable(state);
    if (next == null) return null;
    state.tables.enabled.push(next);
    state.tables.newest = next;
    return next;
  }

  // Aikuisen asetus. Palauttaa false, jos viimeistä taulua yritetään sulkea.
  function setTableEnabled(state, table, on) {
    var tables = state.tables;
    var idx = tables.enabled.indexOf(table);
    if (on) {
      if (idx === -1) {
        tables.enabled.push(table);
        tables.newest = table;
      }
      tables.parentOff = tables.parentOff.filter(function (t) { return t !== table; });
      return true;
    }
    if (idx === -1) return true;
    if (tables.enabled.length <= 1) return false;
    tables.enabled.splice(idx, 1);
    if (tables.parentOff.indexOf(table) === -1) tables.parentOff.push(table);
    if (tables.newest === table) tables.newest = null;
    return true;
  }

  // ---- Lemmikit ja hoito -------------------------------------------------
  function findPet(state, petId) {
    for (var i = 0; i < state.pets.length; i++) {
      if (state.pets[i].id === petId) return state.pets[i];
    }
    return null;
  }

  function decayPet(pet, seconds) {
    NEED_KEYS.forEach(function (k) {
      pet.needs[k] = clamp(pet.needs[k] - DECAY_PER_MINUTE[k] * seconds / 60, 0, 100);
    });
  }

  function decayAll(state, seconds) {
    state.pets.forEach(function (p) { decayPet(p, seconds); });
  }

  function petMood(pet) {
    var vals = NEED_KEYS.map(function (k) { return pet.needs[k]; });
    var min = Math.min.apply(null, vals);
    var avg = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
    if (min < 25) return 'sad';
    if (avg >= 70 && min >= 45) return 'happy';
    return 'ok';
  }

  // Suurin tarve, jos jokin tarve on alhainen, muuten null.
  function biggestNeed(pet) {
    var worst = null;
    NEED_KEYS.forEach(function (k) {
      if (pet.needs[k] < NEEDY_LEVEL && (worst === null || pet.needs[k] < pet.needs[worst])) worst = k;
    });
    return worst;
  }

  function friendshipLevel(hearts) {
    return Math.floor(hearts / HEARTS_PER_LEVEL) + 1;
  }

  function careStatus(state, pet, actionId, now) {
    var a = CARE_ACTIONS[actionId];
    if (!a || !pet) return 'invalid';
    if (a.cooldownMs && pet.lastPetted && now - pet.lastPetted < a.cooldownMs) return 'cooldown';
    if (a.cost > 0) {
      var full = Object.keys(a.effects).every(function (k) { return pet.needs[k] >= FULL_LEVEL; });
      if (full) return 'full';
    }
    if (state.stars < a.cost) return 'stars';
    return 'ok';
  }

  function care(state, petId, actionId, now) {
    var pet = findPet(state, petId);
    var status = careStatus(state, pet, actionId, now);
    if (status !== 'ok') return { ok: false, reason: status };
    var a = CARE_ACTIONS[actionId];
    var levelBefore = friendshipLevel(pet.hearts);
    state.stars -= a.cost;
    Object.keys(a.effects).forEach(function (k) {
      pet.needs[k] = clamp(pet.needs[k] + a.effects[k], 0, 100);
    });
    pet.hearts += a.hearts;
    if (a.cooldownMs) pet.lastPetted = now;
    var levelAfter = friendshipLevel(pet.hearts);
    return { ok: true, levelUp: levelAfter > levelBefore, level: levelAfter };
  }

  function createPet(state, data, needs) {
    var kind = PET_KINDS.indexOf(data.kind) !== -1 ? data.kind : 'cat';
    var name = cleanName(data.name) || (kind === 'cat' ? 'Mirri' : 'Musti');
    var n = needs || NEW_PET_NEEDS;
    return {
      id: 'p' + state.nextId++,
      kind: kind,
      color: String(data.color || ''),
      name: name,
      accessory: null,
      needs: { food: n.food, water: n.water, fun: n.fun, clean: n.clean },
      hearts: 0,
      lastPetted: 0
    };
  }

  function setupGame(state, data) {
    state.player.name = cleanName(data.name) || 'Pelaaja';
    state.player.avatar = Object.assign({}, state.player.avatar, data.avatar || {});
    state.pets = [createPet(state, data.pet || {}, FIRST_PET_NEEDS)];
    state.stars = START_STARS;
    state.created = true;
    return state;
  }

  function adoptPrice(state) {
    var n = state.pets.length;
    if (n === 0) return 0;
    if (n >= MAX_PETS) return null;
    return PET_PRICES[n - 1];
  }

  function adoptPet(state, data) {
    var price = adoptPrice(state);
    if (price === null) return { ok: false, reason: 'max' };
    if (state.stars < price) return { ok: false, reason: 'stars' };
    var pet = createPet(state, data, NEW_PET_NEEDS);
    state.stars -= price;
    state.pets.push(pet);
    return { ok: true, pet: pet, price: price };
  }

  function shopItem(category, id) {
    var list = SHOP[category] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function isOwned(state, category, id) {
    return (state.owned[category] || []).indexOf(id) !== -1;
  }

  function buyItem(state, category, id) {
    var item = shopItem(category, id);
    if (!item) return { ok: false, reason: 'invalid' };
    if (isOwned(state, category, id)) return { ok: false, reason: 'owned' };
    if (state.stars < item.price) return { ok: false, reason: 'stars' };
    state.stars -= item.price;
    state.owned[category].push(id);
    return { ok: true, item: item };
  }

  function setAccessory(state, petId, accId) {
    var pet = findPet(state, petId);
    if (!pet) return false;
    if (accId && !isOwned(state, 'accessories', accId)) return false;
    pet.accessory = accId || null;
    return true;
  }

  function renamePet(state, petId, name) {
    var pet = findPet(state, petId);
    var clean = cleanName(name);
    if (!pet || !clean) return false;
    pet.name = clean;
    return true;
  }

  return {
    ALL_TABLES: ALL_TABLES,
    START_TABLES: START_TABLES,
    UNLOCK_ORDER: UNLOCK_ORDER,
    MULTIPLIERS: MULTIPLIERS,
    MASTERED_BOX: MASTERED_BOX,
    MAX_BOX: MAX_BOX,
    UNLOCK_THRESHOLD: UNLOCK_THRESHOLD,
    RECENT_LIMIT: RECENT_LIMIT,
    START_STARS: START_STARS,
    REWARDS: REWARDS,
    ROUND_LENGTHS: ROUND_LENGTHS,
    NEED_KEYS: NEED_KEYS,
    DECAY_PER_MINUTE: DECAY_PER_MINUTE,
    FULL_LEVEL: FULL_LEVEL,
    HEARTS_PER_LEVEL: HEARTS_PER_LEVEL,
    CARE_ACTIONS: CARE_ACTIONS,
    CARE_ORDER: CARE_ORDER,
    PET_KINDS: PET_KINDS,
    MAX_PETS: MAX_PETS,
    PET_PRICES: PET_PRICES,
    NAME_MAX: NAME_MAX,
    SHOP: SHOP,

    cleanName: cleanName,
    addStars: addStars,
    factKey: factKey,
    factBox: factBox,
    isMastered: isMastered,
    masteredCount: masteredCount,
    tableMastery: tableMastery,
    enabledTables: enabledTables,
    isTableEnabled: isTableEnabled,
    candidateFacts: candidateFacts,
    pickFact: pickFact,
    makeQuestion: makeQuestion,
    newRound: newRound,
    nextQuestion: nextQuestion,
    useHint: useHint,
    submitAnswer: submitAnswer,
    roundStarsTotal: roundStarsTotal,
    finishRound: finishRound,
    nextUnlockTable: nextUnlockTable,
    unlockProgress: unlockProgress,
    checkUnlock: checkUnlock,
    setTableEnabled: setTableEnabled,
    findPet: findPet,
    decayPet: decayPet,
    decayAll: decayAll,
    petMood: petMood,
    biggestNeed: biggestNeed,
    friendshipLevel: friendshipLevel,
    careStatus: careStatus,
    care: care,
    createPet: createPet,
    setupGame: setupGame,
    adoptPrice: adoptPrice,
    adoptPet: adoptPet,
    shopItem: shopItem,
    isOwned: isOwned,
    buyItem: buyItem,
    setAccessory: setAccessory,
    renamePet: renamePet
  };
});
