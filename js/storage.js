/*
 * Kertotassut – tallennus selaimen localStorageen.
 * migrate() täydentää puuttuvat kentät ja korjaa virheelliset arvot,
 * joten vanhemmat tallennukset toimivat uusissa versioissa.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.KT = root.KT || {};
    root.KT.storage = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SAVE_KEY = 'kertotassut-save';
  var VERSION = 1;
  var START_TABLES = [2, 5, 10];
  var NEED_KEYS = ['food', 'water', 'fun', 'clean'];

  function defaultState() {
    return {
      version: VERSION,
      created: false,
      player: {
        name: '',
        avatar: { skin: 1, hairStyle: 0, hairColor: 0, shirt: 4 }
      },
      stars: 0,
      pets: [],
      owned: { accessories: [], decor: [] },
      tables: { enabled: START_TABLES.slice(), newest: null, parentOff: [] },
      facts: {},
      stats: { rounds: 0, answers: 0, correct: 0, bestStreak: 0, starsEarned: 0 },
      settings: { sound: true, sign: '·', roundLength: 10, autoUnlock: true },
      nextId: 1
    };
  }

  function isObj(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
  }

  function toInt(v, def, min, max) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return def;
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  }

  function toNum(v, def, min, max) {
    var n = Number(v);
    if (!isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  }

  // Yhdistää oletusrakenteen ja tallennuksen: vain tunnetut avaimet, oikeat tyypit.
  function merge(def, raw) {
    if (!isObj(raw)) return def;
    var out = {};
    Object.keys(def).forEach(function (k) {
      var d = def[k];
      var r = raw[k];
      if (isObj(d)) out[k] = merge(d, r);
      else if (Array.isArray(d)) out[k] = Array.isArray(r) ? r : d;
      else if (d === null) out[k] = r === undefined ? null : r;
      else if (typeof d === 'number') {
        var n = (typeof r === 'number' || (typeof r === 'string' && r.trim() !== '')) ? Number(r) : NaN;
        out[k] = isFinite(n) ? n : d;
      } else out[k] = typeof r === typeof d ? r : d;
    });
    return out;
  }

  function tableList(list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).map(Number).filter(function (t) {
      if (!(t >= 1 && t <= 10 && Math.floor(t) === t) || seen[t]) return false;
      seen[t] = true;
      return true;
    });
  }

  function idList(list) {
    return (Array.isArray(list) ? list : []).filter(function (x, i, arr) {
      return typeof x === 'string' && arr.indexOf(x) === i;
    });
  }

  function migratePet(raw, index) {
    if (!isObj(raw)) return null;
    var needsRaw = isObj(raw.needs) ? raw.needs : {};
    var needs = {};
    NEED_KEYS.forEach(function (k) { needs[k] = toNum(needsRaw[k], 100, 0, 100); });
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : 'p_old' + index,
      kind: raw.kind === 'dog' ? 'dog' : 'cat',
      color: typeof raw.color === 'string' ? raw.color : '',
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 24) : (raw.kind === 'dog' ? 'Musti' : 'Mirri'),
      accessory: typeof raw.accessory === 'string' ? raw.accessory : null,
      needs: needs,
      hearts: toInt(raw.hearts, 0, 0),
      lastPetted: 0,
      lastDecorBonus: toInt(raw.lastDecorBonus, 0, 0)
    };
  }

  function migrateFacts(raw) {
    var out = {};
    if (!isObj(raw)) return out;
    Object.keys(raw).forEach(function (key) {
      if (!/^\d{1,2}x\d{1,2}$/.test(key)) return;
      var f = raw[key];
      if (!isObj(f)) return;
      out[key] = {
        box: toInt(f.box, 0, 0, 5),
        right: toInt(f.right, 0, 0),
        wrong: toInt(f.wrong, 0, 0),
        lastWrong: f.lastWrong === true
      };
    });
    return out;
  }

  function migrate(raw) {
    if (!isObj(raw)) return defaultState();
    var s = merge(defaultState(), raw);

    s.version = VERSION;
    s.created = raw.created === true;
    s.stars = toInt(s.stars, 0, 0);
    s.nextId = toInt(s.nextId, 1, 1);
    s.player.name = String(s.player.name).slice(0, 24);
    ['skin', 'hairStyle', 'hairColor', 'shirt'].forEach(function (k) {
      s.player.avatar[k] = toInt(s.player.avatar[k], 0, 0, 20);
    });

    s.pets = s.pets.map(migratePet).filter(Boolean);
    // Varmistetaan uniikit tunnisteet ja että nextId on niitä suurempi.
    var ids = {};
    s.pets.forEach(function (p) {
      while (ids[p.id]) p.id = 'p' + s.nextId++;
      ids[p.id] = true;
      var m = /^p(\d+)$/.exec(p.id);
      if (m && Number(m[1]) >= s.nextId) s.nextId = Number(m[1]) + 1;
    });
    if (s.created && !s.pets.length) s.created = false;

    s.owned.accessories = idList(s.owned.accessories);
    s.owned.decor = idList(s.owned.decor);

    s.tables.enabled = tableList(s.tables.enabled);
    if (!s.tables.enabled.length) s.tables.enabled = START_TABLES.slice();
    s.tables.parentOff = tableList(s.tables.parentOff);
    var newest = Number(s.tables.newest);
    s.tables.newest = s.tables.enabled.indexOf(newest) !== -1 ? newest : null;

    s.facts = migrateFacts(raw.facts);

    Object.keys(s.stats).forEach(function (k) { s.stats[k] = toInt(s.stats[k], 0, 0); });

    if ([5, 10, 15].indexOf(s.settings.roundLength) === -1) s.settings.roundLength = 10;
    if (s.settings.sign !== '·' && s.settings.sign !== '×') s.settings.sign = '·';
    return s;
  }

  function getStore(store) {
    if (store) return store;
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }

  function load(store) {
    try {
      var st = getStore(store);
      var raw = st && st.getItem(SAVE_KEY);
      if (!raw) return defaultState();
      return migrate(JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  function save(state, store) {
    try {
      var st = getStore(store);
      if (!st) return false;
      st.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear(store) {
    try {
      var st = getStore(store);
      if (st) st.removeItem(SAVE_KEY);
    } catch (e) { /* ei voi mitään */ }
  }

  return {
    SAVE_KEY: SAVE_KEY,
    VERSION: VERSION,
    defaultState: defaultState,
    migrate: migrate,
    load: load,
    save: save,
    clear: clear
  };
});
