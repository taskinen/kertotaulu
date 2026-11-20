/*
 * Kertotassut – käyttöliittymä.
 * Näkymät renderöidään merkkijonoina #app-elementtiin. Napit käyttävät
 * data-action-attribuuttia, ja yksi delegoitu click-käsittelijä ohjaa ne
 * ACTIONS-taulun funktioille.
 */
(function () {
  'use strict';

  var KT = window.KT;
  var L = KT.logic;
  var S = KT.storage;
  var A = KT.art;
  var snd = KT.sound;

  var state = S.load();
  var ui = {
    screen: null,
    draft: null, // hahmon luonti / muokkaus
    petDraft: null, // lemmikin luonti / adoptio
    round: null,
    question: null,
    input: '',
    phase: 'idle', // 'answer' | 'wait' | 'feedback'
    advanceTimer: null,
    companionId: null,
    summary: null,
    sheetPetId: null,
    modalOk: null,
    gate: null,
    joyUntil: {}
  };

  var app = document.getElementById('app');
  var overlay = document.getElementById('overlay');
  var toastEl = document.getElementById('toast');
  var fxEl = document.getElementById('fx');

  snd.setEnabledGetter(function () { return state.settings.sound; });

  // ---- Tekstit --------------------------------------------------------
  var NEED_INFO = {
    food: { icon: '🍽️', label: 'Ruoka', ask: 'Nälkä! 🍽️', sentence: 'on nälkäinen' },
    water: { icon: '💧', label: 'Vesi', ask: 'Jano! 💧', sentence: 'on janoinen' },
    fun: { icon: '😊', label: 'Ilo', ask: 'Leikitään! 🎾', sentence: 'haluaa leikkiä' },
    clean: { icon: '🛁', label: 'Puhtaus', ask: 'Pese minut! 🛁', sentence: 'haluaa peseytyä' }
  };
  var PRAISE = ['Hienoa!', 'Mahtavaa!', 'Osaat tämän!', 'Jee!', 'Loistavaa!', 'Huippua!', 'Taitava!', 'Upeaa!'];
  var COMFORT = ['Ei haittaa, opitaan yhdessä!', 'Hyvä yritys!', 'Melkein! Kokeillaan pian uudestaan.'];
  var CAT_NAMES = ['Mirri', 'Nappi', 'Viiru', 'Misu', 'Pörrö', 'Tassu', 'Kisu', 'Täplä', 'Nöpö', 'Lumi'];
  var DOG_NAMES = ['Musti', 'Haukku', 'Rekku', 'Nalle', 'Hertta', 'Peni', 'Ressu', 'Jeppe', 'Namu', 'Tyyne'];

  function careInfo(id, kind) {
    var cat = kind !== 'dog';
    switch (id) {
      case 'food': return cat ? { emoji: '🐟', label: 'Kalaa' } : { emoji: '🍖', label: 'Ruokaa' };
      case 'water': return { emoji: '💧', label: 'Vettä' };
      case 'toy': return cat ? { emoji: '🧶', label: 'Lankakerä' } : { emoji: '🎾', label: 'Pallo' };
      case 'wash': return cat ? { emoji: '✨', label: 'Harjaus' } : { emoji: '🛁', label: 'Kylpy' };
      case 'treat': return cat ? { emoji: '🍤', label: 'Herkku' } : { emoji: '🦴', label: 'Herkkuluu' };
      default: return { emoji: '🤚', label: 'Silitä' };
    }
  }

  // ---- Apurit ---------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function rand(list) { return list[Math.floor(Math.random() * list.length)]; }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function save() { S.save(state); }
  function sign() { return state.settings.sign === '×' ? '×' : '·'; }
  function expr(a, b) { return a + ' ' + sign() + ' ' + b; }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function restartAnim(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  function paw(cls) {
    return '<svg class="paw ' + (cls || '') + '" aria-hidden="true"><use href="#paw"/></svg>';
  }

  function starPill() {
    return '<span class="star-pill" aria-label="Tähtiä"><span class="star-ico">⭐</span><span class="js-stars">' + state.stars + '</span></span>';
  }
  function updateStars(bump) {
    $all('.js-stars').forEach(function (el) { el.textContent = state.stars; });
    if (bump) $all('.star-pill').forEach(function (el) { restartAnim(el, 'bump'); });
  }
  function topbar(title, back) {
    return '<header class="topbar">' +
      '<button class="icon-btn" data-action="go" data-to="' + (back || 'home') + '" aria-label="Takaisin">←</button>' +
      '<h1 class="topbar-title">' + title + '</h1>' + starPill() + '</header>';
  }

  function displayMood(p) {
    return (ui.joyUntil[p.id] || 0) > Date.now() ? 'joy' : L.petMood(p);
  }

  // ---- Näkymät ja navigointi ---------------------------------------------
  var SCREENS = {};
  var ACTIONS = {};

  function go(name) {
    clearTimeout(ui.advanceTimer);
    closeOverlay();
    toastEl.classList.remove('show');
    ui.screen = name;
    var sc = SCREENS[name];
    if (sc.enter) sc.enter();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    var sc = SCREENS[ui.screen];
    app.className = 'screen-' + ui.screen;
    app.innerHTML = sc.html();
    if (sc.mount) sc.mount();
  }

  ACTIONS.go = function (el) { go(el.dataset.to); };

  // ---- Peitekerros: modaalit ja alapaneeli ----------------------------------
  function openOverlay(html, opts) {
    opts = opts || {};
    var sheet = opts.kind === 'sheet';
    overlay.innerHTML = '<div class="backdrop"' + (opts.dismiss === false ? '' : ' data-action="closeOverlay"') + '></div>' +
      '<div class="' + (sheet ? 'sheet-wrap' : 'modal-wrap') + '">' +
      '<div class="' + (sheet ? 'sheet' : 'modal') + (opts.cls ? ' ' + opts.cls : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '';
    ui.sheetPetId = null;
    ui.modalOk = null;
  }
  ACTIONS.closeOverlay = closeOverlay;

  function confirmModal(o) {
    openOverlay(
      (o.art ? '<div class="modal-art">' + o.art + '</div>' : '') +
      '<h2>' + o.title + '</h2>' + (o.text ? '<p>' + o.text + '</p>' : '') +
      '<div class="modal-actions">' +
      '<button class="btn" data-action="closeOverlay">' + (o.cancel || 'Peruuta') + '</button>' +
      '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-action="modalOk">' + o.ok + '</button></div>'
    );
    ui.modalOk = o.onOk;
  }
  ACTIONS.modalOk = function () {
    var fn = ui.modalOk;
    closeOverlay();
    if (fn) fn();
  };

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2800);
  }

  // ---- Efektit --------------------------------------------------------
  function fxAt(el, cls, text, dx, dy, delay) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    var s = document.createElement('span');
    s.className = 'fx ' + cls;
    s.textContent = text;
    s.style.left = (r.left + r.width / 2 + (dx || 0)) + 'px';
    s.style.top = (r.top + r.height * 0.45 + (dy || 0)) + 'px';
    if (delay) s.style.animationDelay = delay + 'ms';
    fxEl.appendChild(s);
    setTimeout(function () { s.remove(); }, 1600 + (delay || 0));
  }

  function careFx(emoji, el) {
    fxAt(el, 'fx-pop', emoji, 0, 0, 0);
    if (reducedMotion()) return;
    fxAt(el, 'fx-heart', '❤️', -30, -10, 150);
    fxAt(el, 'fx-heart', '💛', 28, -20, 300);
    fxAt(el, 'fx-heart', '❤️', 4, -30, 450);
  }

  function confetti(count) {
    if (reducedMotion()) return;
    var colors = ['#FF7A59', '#FFD34D', '#4CB963', '#4D9DE0', '#FF7EB6', '#9B6BD6'];
    for (var i = 0; i < (count || 60); i++) {
      var s = document.createElement('span');
      s.className = 'confetti';
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.background = colors[i % colors.length];
      s.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
      s.style.animationDelay = (Math.random() * 0.5) + 's';
      s.style.transform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      fxEl.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 4200); })(s);
    }
  }

  // ---- Aloitusnäyttö ------------------------------------------------------
  SCREENS.title = {
    html: function () {
      return '<div class="title-screen">' +
        '<div class="title-pets"><div class="tp tp-cat">' + A.cat({ color: 'orange', mood: 'happy' }) + '</div>' +
        '<div class="tp tp-dog">' + A.dog({ color: 'golden', mood: 'happy' }) + '</div></div>' +
        '<h1 class="logo">Kerto<span>tassut</span></h1>' +
        '<p class="tagline">Laske kertolaskuja, ansaitse tähtiä ja hoida omia kissoja ja koiria!</p>' +
        '<button class="btn btn-primary btn-big" data-action="beginCreate">Aloita peli</button>' +
        '</div>';
    }
  };

  ACTIONS.beginCreate = function () {
    ui.draft = {
      step: 1,
      name: '',
      avatar: Object.assign({}, state.player.avatar),
      pet: { kind: 'cat', color: 'orange', name: '', suggest: shuffle(CAT_NAMES).slice(0, 4) }
    };
    ui.petDraft = ui.draft.pet;
    go('create');
  };

  // ---- Hahmon editori -------------------------------------------------------
  function nameField(id, label, value, placeholder) {
    return '<label class="field"><span class="field-label">' + label + '</span>' +
      '<input id="' + id + '" type="text" maxlength="' + L.NAME_MAX + '" autocomplete="off" autocapitalize="words" ' +
      'spellcheck="false" enterkeyhint="done" placeholder="' + placeholder + '" value="' + esc(value) + '"></label>';
  }

  function swatches(part, list, selected) {
    return '<div class="swatches">' + list.map(function (item, i) {
      var sel = i === selected;
      return '<button class="swatch' + (sel ? ' sel' : '') + '" aria-pressed="' + sel + '" aria-label="' + item.name + '" ' +
        'data-action="avatarPart" data-part="' + part + '" data-value="' + i + '" style="--c:' + item.c + '"></button>';
    }).join('') + '</div>';
  }

  function avatarOptionsHTML(av) {
    var styles = A.HAIR_STYLES.map(function (st, i) {
      var sel = av.hairStyle === i;
      return '<button class="style-opt' + (sel ? ' sel' : '') + '" aria-pressed="' + sel + '" data-action="avatarPart" data-part="hairStyle" data-value="' + i + '">' +
        '<span class="so-art">' + A.avatar(Object.assign({}, av, { hairStyle: i })) + '</span><span class="so-name">' + st.name + '</span></button>';
    }).join('');
    return '<div class="opt-group"><h3>Hiukset</h3><div class="style-opts">' + styles + '</div></div>' +
      '<div class="opt-group"><h3>Hiusten väri</h3>' + swatches('hairColor', A.HAIR_COLORS, av.hairColor) + '</div>' +
      '<div class="opt-group"><h3>Iho</h3>' + swatches('skin', A.SKINS, av.skin) + '</div>' +
      '<div class="opt-group"><h3>Paita</h3>' + swatches('shirt', A.SHIRTS, av.shirt) + '</div>';
  }

  function avatarEditorHTML(d) {
    return '<div class="editor">' +
      '<div class="avatar-preview" id="avatarPreview">' + A.avatar(d.avatar) + '</div>' +
      nameField('nameInput', 'Nimesi', d.name, 'Kirjoita nimesi') +
      '<div id="avatarOptions">' + avatarOptionsHTML(d.avatar) + '</div></div>';
  }

  ACTIONS.avatarPart = function (el) {
    var d = ui.draft;
    if (!d) return;
    d.avatar[el.dataset.part] = Number(el.dataset.value);
    $('#avatarPreview').innerHTML = A.avatar(d.avatar);
    $('#avatarOptions').innerHTML = avatarOptionsHTML(d.avatar);
    snd.play('tap');
  };

  // ---- Lemmikin editori ----------------------------------------------------
  function petColorsHTML(pd) {
    var list = pd.kind === 'dog' ? A.DOG_COLORS : A.CAT_COLORS;
    return list.map(function (c) {
      var sel = c.id === pd.color;
      return '<button class="color-opt' + (sel ? ' sel' : '') + '" aria-pressed="' + sel + '" aria-label="' + c.name + '" data-action="petColor" data-color="' + c.id + '">' +
        '<span class="co-art">' + A.pet({ kind: pd.kind, color: c.id }, 'happy') + '</span><span class="co-name">' + c.name + '</span></button>';
    }).join('');
  }

  function petEditorHTML(pd, fixedKind) {
    var kinds = fixedKind ? '' :
      '<div class="kind-choice">' +
      '<button class="kind-btn' + (pd.kind === 'cat' ? ' sel' : '') + '" aria-pressed="' + (pd.kind === 'cat') + '" data-action="petKind" data-kind="cat">🐱 Kissa</button>' +
      '<button class="kind-btn' + (pd.kind === 'dog' ? ' sel' : '') + '" aria-pressed="' + (pd.kind === 'dog') + '" data-action="petKind" data-kind="dog">🐶 Koira</button></div>';
    return '<div class="pet-editor" id="petEditor">' + kinds +
      '<div class="pet-preview" id="petPreview">' + A.pet(pd, 'happy') + '</div>' +
      '<div class="opt-group"><h3>Väri</h3><div class="color-opts" id="petColors">' + petColorsHTML(pd) + '</div></div>' +
      nameField('petNameInput', 'Lemmikin nimi', pd.name, pd.kind === 'dog' ? 'Esim. Musti' : 'Esim. Mirri') +
      '<div class="name-suggest">' + pd.suggest.map(function (n) {
        return '<button class="chip" data-action="petNameSuggest" data-name="' + esc(n) + '">' + esc(n) + '</button>';
      }).join('') + '</div></div>';
  }

  ACTIONS.petKind = function (el) {
    var pd = ui.petDraft;
    if (!pd || pd.kind === el.dataset.kind) return;
    pd.kind = el.dataset.kind;
    pd.color = (pd.kind === 'dog' ? A.DOG_COLORS : A.CAT_COLORS)[0].id;
    pd.suggest = shuffle(pd.kind === 'dog' ? DOG_NAMES : CAT_NAMES).slice(0, 4);
    $('#petEditor').outerHTML = petEditorHTML(pd, false);
    snd.play('tap');
  };

  ACTIONS.petColor = function (el) {
    var pd = ui.petDraft;
    if (!pd) return;
    pd.color = el.dataset.color;
    $('#petPreview').innerHTML = A.pet(pd, 'happy');
    $('#petColors').innerHTML = petColorsHTML(pd);
    snd.play('tap');
  };

  ACTIONS.petNameSuggest = function (el) {
    if (!ui.petDraft) return;
    ui.petDraft.name = el.dataset.name;
    var input = $('#petNameInput');
    if (input) input.value = el.dataset.name;
    snd.play('tap');
  };

  function finalPetName(pd) {
    return L.cleanName(pd.name) || rand(pd.kind === 'dog' ? DOG_NAMES : CAT_NAMES);
  }

  // ---- Hahmon luonti ------------------------------------------------------
  SCREENS.create = {
    html: function () {
      var d = ui.draft;
      if (d.step === 1) {
        return '<div class="create">' +
          '<p class="step">Vaihe 1 / 2</p><h1>Tee oma hahmosi</h1>' +
          avatarEditorHTML(d) +
          '<div class="bottom-actions"><button class="btn btn-primary btn-big" data-action="createNext">Seuraava ➜</button></div></div>';
      }
      return '<div class="create">' +
        '<p class="step">Vaihe 2 / 2</p><h1>Valitse lemmikki</h1>' +
        '<p class="lead">Lemmikistä tulee paras kaverisi. Myöhemmin voit adoptoida lisää kissoja ja koiria.</p>' +
        petEditorHTML(d.pet, false) +
        '<div class="bottom-actions two"><button class="btn btn-big" data-action="createBack">← Takaisin</button>' +
        '<button class="btn btn-primary btn-big" data-action="createDone">Valmis!</button></div></div>';
    }
  };

  function requireName(inputId, value) {
    var name = L.cleanName(value);
    if (!name) {
      var input = $('#' + inputId);
      if (input) { restartAnim(input, 'shake'); input.focus(); }
      snd.play('nope');
      toast('Kirjoita ensin nimi.');
    }
    return name;
  }

  ACTIONS.createNext = function () {
    if (!requireName('nameInput', ui.draft.name)) return;
    ui.draft.step = 2;
    toastEl.classList.remove('show');
    render();
    window.scrollTo(0, 0);
  };
  ACTIONS.createBack = function () {
    ui.draft.step = 1;
    render();
  };
  ACTIONS.createDone = function () {
    var d = ui.draft;
    var petName = finalPetName(d.pet);
    L.setupGame(state, {
      name: d.name,
      avatar: d.avatar,
      pet: { kind: d.pet.kind, color: d.pet.color, name: petName }
    });
    save();
    ui.draft = null;
    ui.petDraft = null;
    go('home');
    snd.play('fanfare');
    var p = state.pets[0];
    openOverlay(
      '<div class="modal-art">' + A.pet(p, 'joy') + '</div>' +
      '<h2>Tervetuloa, ' + esc(state.player.name) + '!</h2>' +
      '<p>Tässä on <b>' + esc(p.name) + '</b>. Lemmikit tarvitsevat ruokaa, vettä, leikkiä ja pesua.</p>' +
      '<p>Hoitaminen maksaa tähtiä ⭐. Tähtiä saat laskemalla kertolaskuja!</p>' +
      '<p>Sait aloitukseen <b>' + L.START_STARS + ' ⭐</b>. Napauta lemmikkiä ja anna sille ruokaa.</p>' +
      '<div class="modal-actions"><button class="btn btn-primary btn-big" data-action="closeOverlay">Selvä!</button></div>'
    );
    confetti(50);
  };

  // ---- Oma hahmo (muokkaus) ------------------------------------------------
  SCREENS.profile = {
    enter: function () {
      ui.draft = { name: state.player.name, avatar: Object.assign({}, state.player.avatar) };
    },
    html: function () {
      return topbar('Oma hahmo') + '<div class="create">' + avatarEditorHTML(ui.draft) +
        '<div class="bottom-actions"><button class="btn btn-primary btn-big" data-action="profileSave">Tallenna</button></div></div>';
    }
  };
  ACTIONS.profileSave = function () {
    var name = requireName('nameInput', ui.draft.name);
    if (!name) return;
    state.player.name = name;
    state.player.avatar = Object.assign({}, ui.draft.avatar);
    save();
    snd.play('care');
    go('home');
    toast('Hahmo tallennettu!');
  };

  // ---- Koti -----------------------------------------------------------
  function roomDecorHTML() {
    var s = '<div class="decor decor-window">' + A.DECOR.window + '</div>';
    ['painting', 'rug', 'bed', 'tree', 'plant'].forEach(function (id) {
      if (L.isOwned(state, 'decor', id)) s += '<div class="decor decor-' + id + '">' + A.DECOR[id] + '</div>';
    });
    return s;
  }

  function petCardHTML(p, i) {
    var mood = displayMood(p);
    var need = L.biggestNeed(p);
    return '<button class="pet" data-action="openPet" data-id="' + p.id + '" data-mood="' + mood + '" style="--d:' + (-i * 0.7).toFixed(1) + 's" aria-label="Hoida: ' + esc(p.name) + '">' +
      '<span class="bubble' + (need ? ' show' : '') + '">' + (need ? NEED_INFO[need].ask : '') + '</span>' +
      '<span class="pet-art">' + A.pet(p, mood) + '</span>' +
      '<span class="pet-name">' + esc(p.name) + '</span></button>';
  }

  SCREENS.home = {
    html: function () {
      var n = state.pets.length;
      var cols = n <= 1 ? 1 : (n === 2 || n === 4) ? 2 : 3;
      return '<header class="topbar home-top">' +
        '<button class="me" data-action="go" data-to="profile" aria-label="Muokkaa hahmoa">' +
        '<span class="me-avatar">' + A.avatar(state.player.avatar) + '</span><span class="me-name">' + esc(state.player.name) + '</span></button>' +
        starPill() + '</header>' +
        '<section class="room" aria-label="Lemmikkien koti">' + roomDecorHTML() +
        '<div class="pets" style="--cols:' + cols + '">' + state.pets.map(petCardHTML).join('') + '</div></section>' +
        '<p class="room-hint">Napauta lemmikkiä hoitaaksesi sitä.</p>' +
        '<div class="home-actions">' +
        '<button class="btn btn-primary btn-big btn-play" data-action="startRound">Laske ja ansaitse ⭐</button>' +
        '<div class="nav-row">' +
        '<button class="btn nav-btn" data-action="go" data-to="shop"><span class="nav-ico">🛒</span>Kauppa</button>' +
        '<button class="btn nav-btn" data-action="go" data-to="tables"><span class="nav-ico">📊</span>Taulut</button>' +
        '<button class="btn nav-btn" data-action="go" data-to="profile"><span class="nav-ico">🙂</span>Hahmo</button>' +
        '</div>' +
        '<button class="link-btn" data-action="go" data-to="gate">Aikuisille</button>' +
        '</div>';
    }
  };

  function liveUpdate() {
    if (ui.screen === 'home') {
      $all('.pet[data-id]').forEach(function (el) {
        var p = L.findPet(state, el.dataset.id);
        if (!p) return;
        var mood = displayMood(p);
        if (el.dataset.mood !== mood) {
          el.dataset.mood = mood;
          el.querySelector('.pet-art').innerHTML = A.pet(p, mood);
        }
        var need = L.biggestNeed(p);
        var b = el.querySelector('.bubble');
        b.textContent = need ? NEED_INFO[need].ask : '';
        b.classList.toggle('show', !!need);
      });
    }
    if (ui.sheetPetId) updateSheet();
    if (ui.screen === 'practice') updateCompanion();
  }

  // ---- Lemmikin hoito (alapaneeli) ----------------------------------------
  ACTIONS.openPet = function (el) {
    var p = L.findPet(state, el.dataset.id);
    if (!p) return;
    snd.play('tap');
    ui.sheetPetId = p.id;
    var meters = L.NEED_KEYS.map(function (k) {
      return '<div class="meter" data-need="' + k + '"><span class="m-ico">' + NEED_INFO[k].icon + '</span>' +
        '<span class="m-label">' + NEED_INFO[k].label + '</span>' +
        '<span class="m-bar"><span class="m-fill"></span></span></div>';
    }).join('');
    openOverlay(
      '<button class="close-x" data-action="closeOverlay" aria-label="Sulje">✕</button>' +
      '<div class="sheet-head"><div class="sheet-art" id="sheetArt"></div>' +
      '<div class="sheet-title"><h2><span id="sheetName"></span> <button class="icon-btn small" data-action="renamePet" aria-label="Vaihda nimi">✏️</button></h2>' +
      '<div class="friend" id="sheetFriend"></div>' + starPill() + '</div></div>' +
      '<div class="meters">' + meters + '</div>' +
      '<div class="care-grid" id="careGrid"></div>' +
      '<div class="sheet-more" id="sheetMore"></div>' +
      '<div class="acc-row" id="accRow"></div>',
      { kind: 'sheet' }
    );
    updateSheet();
  };

  var BLOCK_TEXT = { full: 'Ei tarvetta', stars: 'Tarvitset tähtiä', cooldown: 'Hetki…' };

  function updateSheet() {
    var p = L.findPet(state, ui.sheetPetId);
    if (!p || !$('#sheetArt')) return;
    var art = $('#sheetArt');
    var mood = displayMood(p);
    if (art.dataset.mood !== mood || art.dataset.acc !== String(p.accessory)) {
      art.dataset.mood = mood;
      art.dataset.acc = String(p.accessory);
      art.innerHTML = A.pet(p, mood);
    }
    $('#sheetName').textContent = p.name;

    var level = L.friendshipLevel(p.hearts);
    var prog = (p.hearts % L.HEARTS_PER_LEVEL) / L.HEARTS_PER_LEVEL * 100;
    $('#sheetFriend').innerHTML = '<span>❤️ Ystävyys: taso ' + level + '</span><span class="f-bar"><span style="width:' + prog + '%"></span></span>';

    L.NEED_KEYS.forEach(function (k) {
      var m = document.querySelector('.meter[data-need="' + k + '"]');
      var v = Math.round(p.needs[k]);
      m.querySelector('.m-fill').style.width = v + '%';
      m.classList.toggle('low', v < 35);
      m.setAttribute('aria-label', NEED_INFO[k].label + ' ' + v + ' %');
    });

    var now = Date.now();
    var needStars = false;
    $('#careGrid').innerHTML = L.CARE_ORDER.map(function (id) {
      var a = L.CARE_ACTIONS[id];
      var info = careInfo(id, p.kind);
      var st = L.careStatus(state, p, id, now);
      if (st === 'stars') needStars = true;
      var price = a.cost ? a.cost + ' ⭐' : 'Ilmainen';
      return '<button class="care-btn' + (st !== 'ok' ? ' blocked' : '') + '" data-action="care" data-care="' + id + '">' +
        '<span class="c-emoji">' + info.emoji + '</span><span class="c-label">' + info.label + '</span>' +
        '<span class="c-price">' + (st !== 'ok' ? BLOCK_TEXT[st] : price) + '</span></button>';
    }).join('');

    $('#sheetMore').innerHTML = needStars ?
      '<button class="btn btn-primary btn-wide" data-action="startRound">Laske lisää tähtiä ⭐</button>' : '';

    var owned = state.owned.accessories;
    $('#accRow').innerHTML = owned.length ?
      '<h3>Asusteet</h3><div class="chips">' +
      '<button class="chip' + (!p.accessory ? ' sel' : '') + '" data-action="wear" data-acc="">Ei mitään</button>' +
      owned.map(function (id) {
        var item = L.shopItem('accessories', id);
        return '<button class="chip' + (p.accessory === id ? ' sel' : '') + '" data-action="wear" data-acc="' + id + '">' + A.ACCESSORY_EMOJI[id] + ' ' + item.name + '</button>';
      }).join('') + '</div>' : '';
  }

  ACTIONS.care = function (el) {
    var p = L.findPet(state, ui.sheetPetId);
    if (!p) return;
    var id = el.dataset.care;
    var a = L.CARE_ACTIONS[id];
    var res = L.care(state, p.id, id, Date.now());
    if (!res.ok) {
      snd.play('nope');
      restartAnim(el, 'shake');
      if (res.reason === 'stars') toast('Tarvitset ' + (a.cost - state.stars) + ' ⭐ lisää. Laske kertolaskuja!');
      else if (res.reason === 'full') toast(p.name + ' ei tarvitse tätä nyt.');
      else if (res.reason === 'cooldown') toast(p.name + ' nauttii vielä silityksestä 😊');
      return;
    }
    save();
    snd.play(id === 'pet' ? 'pet' : 'care');
    snd.vibrate(15);
    ui.joyUntil[p.id] = Date.now() + 1600;
    careFx(careInfo(id, p.kind).emoji, $('#sheetArt'));
    restartAnim($('#sheetArt'), 'hop');
    updateStars(a.cost > 0);
    updateSheet();
    liveUpdate();
    setTimeout(liveUpdate, 1700);
    if (res.levelUp) {
      setTimeout(function () {
        snd.play('fanfare');
        toast('❤️ Sinä ja ' + p.name + ' olette entistä parempia ystäviä! Taso ' + res.level);
      }, 700);
    }
  };

  ACTIONS.wear = function (el) {
    var p = L.findPet(state, ui.sheetPetId);
    if (!p) return;
    if (L.setAccessory(state, p.id, el.dataset.acc || null)) {
      save();
      snd.play('tap');
      ui.joyUntil[p.id] = Date.now() + 1200;
      updateSheet();
      liveUpdate();
      if (ui.screen === 'home') render();
      setTimeout(liveUpdate, 1300);
    }
  };

  ACTIONS.renamePet = function () {
    var p = L.findPet(state, ui.sheetPetId);
    if (!p) return;
    var petId = p.id;
    openOverlay(
      '<h2>Uusi nimi</h2>' +
      '<form data-submit="renameSave" data-id="' + petId + '">' + nameField('renameInput', 'Lemmikin nimi', p.name, 'Nimi') +
      '<div class="modal-actions"><button type="button" class="btn" data-action="reopenPet" data-id="' + petId + '">Peruuta</button>' +
      '<button type="submit" class="btn btn-primary">Tallenna</button></div></form>'
    );
    var input = $('#renameInput');
    if (input) input.select();
  };
  ACTIONS.reopenPet = function (el) {
    ACTIONS.openPet(el);
  };
  ACTIONS.renameSave = function (form) {
    var input = $('#renameInput');
    var petId = form.dataset.id;
    if (!requireName('renameInput', input && input.value)) return;
    L.renamePet(state, petId, input.value);
    save();
    if (ui.screen === 'home') render();
    ACTIONS.openPet({ dataset: { id: petId } });
  };

  // ---- Laskeminen ---------------------------------------------------------
  ACTIONS.startRound = function () {
    ui.round = L.newRound(state);
    var comp = rand(state.pets);
    ui.companionId = comp ? comp.id : null;
    go('practice');
    nextQuestion();
  };

  SCREENS.practice = {
    html: function () {
      var keys = '';
      for (var n = 1; n <= 9; n++) keys += '<button class="key" data-action="key" data-key="' + n + '">' + n + '</button>';
      keys += '<button class="key key-del" data-action="backspace" aria-label="Pyyhi">⌫</button>' +
        '<button class="key" data-action="key" data-key="0">0</button>' +
        '<button class="key key-ok" data-action="submit" aria-label="Tarkista">OK</button>';
      var p = L.findPet(state, ui.companionId);
      return '<div class="practice" id="practice">' +
        '<div class="p-top"><button class="icon-btn" data-action="quitRound" aria-label="Lopeta kierros">✕</button>' +
        '<div class="progress" id="progress"></div>' + starPill() + '</div>' +
        '<div class="companion" id="companion"><div class="comp-art" id="compArt"></div>' +
        '<div class="comp-bubble" id="compBubble">' + (p ? 'Lasketaan yhdessä, ' + esc(state.player.name) + '!' : 'Lasketaan!') + '</div></div>' +
        '<div class="q-card" id="qCard"><div class="q-tag" id="qTag"></div>' +
        '<div class="q-line"><span class="q-expr" id="qExpr"></span><span class="q-eq">=</span><span class="q-answer empty" id="qAnswer">?</span></div></div>' +
        '<div class="feedback" id="feedback" aria-live="polite"></div>' +
        '<div class="hint" id="hint" hidden></div>' +
        '<div class="pad-area">' +
        '<div class="pad-tools"><button class="btn btn-small hint-btn" id="hintBtn" data-action="hint">💡 Vihje</button>' +
        '<button class="btn btn-small btn-primary continue-btn" id="continueBtn" data-action="continue" hidden>Jatka ➜</button></div>' +
        '<div class="keypad" id="keypad">' + keys + '</div></div></div>';
    },
    mount: function () {
      updateCompanion();
    }
  };

  function updateCompanion(moodOverride) {
    var art = $('#compArt');
    var p = L.findPet(state, ui.companionId);
    if (!art || !p) return;
    var mood = moodOverride || displayMood(p);
    if (art.dataset.mood !== mood) {
      art.dataset.mood = mood;
      art.innerHTML = A.pet(p, mood);
    }
  }

  function companionReact(ok) {
    var p = L.findPet(state, ui.companionId);
    if (!p) return;
    var bubble = $('#compBubble');
    if (bubble) bubble.textContent = ok ? rand(PRAISE) : rand(COMFORT);
    if (ok) {
      ui.joyUntil[p.id] = Date.now() + 900;
      updateCompanion('joy');
      restartAnim($('#compArt'), 'hop');
    } else {
      updateCompanion('ok');
    }
  }

  function renderProgress() {
    var r = ui.round;
    var el = $('#progress');
    if (!el || !r) return;
    var html = '';
    var currentFresh = ui.question && !ui.question.retry && ui.phase !== 'feedback' && r.marks.length < r.freshAsked;
    for (var i = 0; i < r.length; i++) {
      var cls = r.marks[i] || (currentFresh && i === r.marks.length ? 'current' : '');
      html += '<span class="dot ' + cls + '"></span>';
    }
    el.innerHTML = html;
    el.setAttribute('aria-label', 'Tehtävä ' + Math.min(r.freshAsked, r.length) + ' / ' + r.length);
  }

  function nextQuestion() {
    if (ui.screen !== 'practice' || !ui.round) return;
    var q = L.nextQuestion(state, ui.round);
    if (!q) { finishRound(); return; }
    ui.question = q;
    ui.input = '';
    ui.phase = 'answer';
    $('#qExpr').textContent = expr(q.a, q.b);
    var ans = $('#qAnswer');
    ans.textContent = '?';
    ans.className = 'q-answer empty';
    var card = $('#qCard');
    card.className = 'q-card';
    restartAnim(card, 'pop');
    $('#qTag').textContent = q.retry ? 'Kokeillaan uudestaan!' : '';
    $('#feedback').innerHTML = '';
    var hint = $('#hint');
    hint.hidden = true;
    hint.innerHTML = '';
    $('#practice').classList.remove('hint-open', 'locked');
    var hb = $('#hintBtn');
    hb.hidden = false;
    hb.disabled = false;
    $('#continueBtn').hidden = true;
    renderProgress();
  }

  function showInput() {
    var a = $('#qAnswer');
    a.textContent = ui.input || '?';
    a.classList.toggle('empty', !ui.input);
  }

  function typeDigit(d) {
    if (ui.phase !== 'answer') return;
    if (ui.input.length >= 3) return;
    if (ui.input === '0') ui.input = '';
    ui.input += d;
    snd.play('key');
    showInput();
  }

  function backspace() {
    if (ui.phase !== 'answer') return;
    ui.input = ui.input.slice(0, -1);
    showInput();
  }

  ACTIONS.key = function (el) { typeDigit(el.dataset.key); };
  ACTIONS.backspace = backspace;

  ACTIONS.submit = function () {
    if (ui.phase === 'feedback') { ACTIONS.continue(); return; }
    if (ui.phase !== 'answer') return;
    if (!ui.input) {
      restartAnim($('#qAnswer'), 'shake');
      return;
    }
    submitAnswer();
  };

  function submitAnswer() {
    var q = ui.question;
    var given = ui.input;
    ui.phase = 'wait';
    $('#practice').classList.add('locked');
    var res = L.submitAnswer(state, ui.round, given);
    save();
    var gained = res.stars + res.streakBonus;
    updateStars(gained > 0);
    renderProgress();
    var card = $('#qCard');

    if (res.correct) {
      card.classList.add('correct');
      var html = '<div class="fb fb-ok">' + (res.retry ? 'Oikein! Nyt muistat sen.' : 'Oikein! +' + res.stars + ' ⭐') + '</div>';
      if (res.streakBonus) html += '<div class="fb fb-streak">🔥 ' + res.streak + ' oikein putkeen! +' + res.streakBonus + ' ⭐</div>';
      $('#feedback').innerHTML = html;
      snd.play(res.streakBonus ? 'streak' : 'correct');
      snd.vibrate(20);
      companionReact(true);
      if (gained) fxAt(card, 'fx-float', '+' + gained + ' ⭐', 0, -20, 0);
      ui.advanceTimer = setTimeout(nextQuestion, res.streakBonus ? 1600 : 1000);
    } else {
      ui.phase = 'feedback';
      card.classList.add('wrong');
      restartAnim(card, 'shake');
      $('#qAnswer').innerHTML = '<s>' + esc(given) + '</s> ' + q.answer;
      $('#qAnswer').classList.remove('empty');
      $('#feedback').innerHTML = '<div class="fb fb-miss">Melkein! <b>' + expr(q.a, q.b) + ' = ' + q.answer + '</b></div>' +
        (res.retry ? '' : '<div class="fb fb-note">Tämä lasku tulee pian uudestaan.</div>');
      showHint(q, true);
      snd.play('wrong');
      snd.vibrate([30, 40, 30]);
      companionReact(false);
      $('#hintBtn').hidden = true;
      $('#continueBtn').hidden = false;
    }
  }

  function showHint(q, withAnswer) {
    var groups = q.a;
    var size = q.b;
    var total = groups * size;
    var cls = total <= 20 ? 'big' : total <= 50 ? 'mid' : 'small';
    var one = '';
    for (var j = 0; j < size; j++) one += paw();
    var html = '<div class="groups ' + cls + '">';
    for (var i = 0; i < groups; i++) html += '<span class="group">' + one + '</span>';
    html += '</div>';
    var text;
    if (groups === 1) text = '1 ryhmä, jossa ' + size + ' tassua';
    else if (groups <= 6) text = new Array(groups).fill(size).join(' + ');
    else text = groups + ' ryhmää, joissa kussakin ' + size + ' tassua';
    html += '<div class="hint-text">' + text + (withAnswer ? ' = <b>' + total + '</b>' : (groups <= 6 && groups > 1 ? ' = ?' : '')) + '</div>';
    var h = $('#hint');
    h.innerHTML = html;
    h.hidden = false;
    $('#practice').classList.add('hint-open');
  }

  ACTIONS.hint = function () {
    if (ui.phase !== 'answer' || !ui.question) return;
    L.useHint(ui.round);
    showHint(ui.question, false);
    $('#hintBtn').disabled = true;
    snd.play('tap');
  };

  ACTIONS.continue = function () {
    if (ui.phase !== 'feedback') return;
    ui.phase = 'wait';
    nextQuestion();
  };

  ACTIONS.quitRound = function () {
    confirmModal({
      title: 'Lopetetaanko kierros?',
      text: 'Jo ansaitut tähdet jäävät sinulle.',
      ok: 'Lopeta',
      cancel: 'Jatka laskemista',
      onOk: function () {
        ui.round = null;
        ui.question = null;
        ui.phase = 'idle';
        go('home');
      }
    });
  };

  function finishRound() {
    var r = L.finishRound(state, ui.round);
    save();
    ui.summary = r;
    ui.round = null;
    ui.question = null;
    ui.phase = 'idle';
    go('summary');
    if (r.unlocked != null) {
      snd.play('fanfare');
      confetti(90);
    } else if (r.stars.round) {
      snd.play('streak');
      confetti(40);
    }
  }

  // ---- Yhteenveto ---------------------------------------------------------
  SCREENS.summary = {
    html: function () {
      var r = ui.summary;
      var total = L.roundStarsTotal(r);
      var p = L.findPet(state, ui.companionId) || state.pets[0];
      var rows = '<li><span>Oikeat vastaukset</span><b>+' + r.stars.correct + ' ⭐</b></li>';
      if (r.stars.streak) rows += '<li><span>Putkibonus 🔥</span><b>+' + r.stars.streak + ' ⭐</b></li>';
      if (r.stars.round) rows += '<li><span>Mahtava kierros! 🏆</span><b>+' + r.stars.round + ' ⭐</b></li>';
      if (r.stars.unlock) rows += '<li><span>Uusi kertotaulu 🎉</span><b>+' + r.stars.unlock + ' ⭐</b></li>';

      var unlock = r.unlocked != null ?
        '<div class="unlock-card"><div class="unlock-num">' + r.unlocked + '</div><div><b>Uusi kertotaulu avattu!</b><br>' +
        'Nyt mukana on myös ' + r.unlocked + ':n kertotaulu.</div></div>' : '';

      var wrong = r.wrongKeys.filter(function (k, i, arr) { return arr.indexOf(k) === i; });
      var tip = wrong.length ?
        '<div class="practice-tip"><h3>Muista nämä:</h3><div class="chips">' + wrong.map(function (k) {
          var ab = k.split('x').map(Number);
          return '<span class="chip static">' + expr(ab[0], ab[1]) + ' = ' + ab[0] * ab[1] + '</span>';
        }).join('') + '</div></div>' : '';

      var needy = state.pets.filter(function (x) { return L.biggestNeed(x); });
      var needText = needy.length ?
        '<p class="sum-need">🐾 ' + esc(needy[0].name) + ' ' + NEED_INFO[L.biggestNeed(needy[0])].sentence + '. Käy hoitamassa!</p>' : '';

      return '<div class="summary">' +
        (p ? '<div class="sum-pet">' + A.pet(p, 'joy') + '</div>' : '') +
        '<h1>Kierros valmis!</h1>' +
        '<div class="sum-stars">+' + total + ' ⭐</div>' +
        '<p class="sum-score">Oikein heti: <b>' + r.firstTry + ' / ' + r.length + '</b></p>' +
        '<ul class="earn-list">' + rows + '</ul>' + unlock + tip + needText +
        '<div class="bottom-actions"><button class="btn btn-primary btn-big" data-action="startRound">Uusi kierros</button>' +
        '<button class="btn btn-big" data-action="go" data-to="home">🏠 Hoitamaan lemmikkejä</button></div></div>';
    }
  };

  // ---- Kauppa ---------------------------------------------------------
  SCREENS.shop = {
    html: function () {
      var price = L.adoptPrice(state);
      var first = state.pets[0];
      var pets;
      if (price === null) {
        pets = '<p class="muted">Kotona on jo ' + L.MAX_PETS + ' lemmikkiä. Enempää ei mahdu!</p>';
      } else {
        pets = '<div class="shop-grid two">' + ['cat', 'dog'].map(function (kind) {
          var colors = kind === 'dog' ? A.DOG_COLORS : A.CAT_COLORS;
          return '<button class="shop-item' + (state.stars < price ? ' cant' : '') + '" data-action="adoptStart" data-kind="' + kind + '">' +
            '<span class="si-art">' + A.pet({ kind: kind, color: colors[kind === 'dog' ? 1 : 2].id }, 'happy') + '</span>' +
            '<span class="si-name">' + (kind === 'dog' ? 'Koira' : 'Kissa') + '</span><span class="si-price">' + price + ' ⭐</span></button>';
        }).join('') + '</div>';
      }

      function items(category) {
        return '<div class="shop-grid">' + L.SHOP[category].map(function (item) {
          var owned = L.isOwned(state, category, item.id);
          var art = category === 'accessories' ?
            A.pet({ kind: first.kind, color: first.color, accessory: item.id }, 'happy') :
            A.DECOR[item.id];
          return '<button class="shop-item' + (owned ? ' owned' : state.stars < item.price ? ' cant' : '') + '" data-action="buy" data-cat="' + category + '" data-id="' + item.id + '">' +
            '<span class="si-art si-' + category + '">' + art + '</span><span class="si-name">' + item.name + '</span>' +
            '<span class="si-price">' + (owned ? 'Omistat ✓' : item.price + ' ⭐') + '</span></button>';
        }).join('') + '</div>';
      }

      return topbar('Kauppa') + '<div class="shop">' +
        '<section class="shop-sec"><h2>Adoptoi lemmikki</h2>' + pets + '</section>' +
        '<section class="shop-sec"><h2>Asusteet</h2><p class="muted">Pue asusteet lemmikille sen hoitosivulla.</p>' + items('accessories') + '</section>' +
        '<section class="shop-sec"><h2>Sisustus</h2><p class="muted">Sisustus tulee lemmikkien kotiin.</p>' + items('decor') + '</section>' +
        '</div>';
    }
  };

  ACTIONS.buy = function (el) {
    var cat = el.dataset.cat;
    var item = L.shopItem(cat, el.dataset.id);
    if (!item) return;
    if (L.isOwned(state, cat, item.id)) {
      toast(cat === 'accessories' ? 'Omistat jo tämän. Pue se lemmikin hoitosivulla.' : 'Tämä on jo kotona.');
      return;
    }
    if (state.stars < item.price) {
      snd.play('nope');
      toast('Tarvitset vielä ' + (item.price - state.stars) + ' ⭐. Laske lisää kertolaskuja!');
      return;
    }
    var first = state.pets[0];
    var art = cat === 'accessories' ? A.pet({ kind: first.kind, color: first.color, accessory: item.id }, 'joy') : A.DECOR[item.id];
    confirmModal({
      art: art,
      title: 'Ostetaanko ' + item.name.toLowerCase() + '?',
      text: 'Hinta: <b>' + item.price + ' ⭐</b>',
      ok: 'Osta',
      onOk: function () { completePurchase(cat, item); }
    });
  };

  function completePurchase(cat, item) {
    var res = L.buyItem(state, cat, item.id);
    if (!res.ok) return;
    save();
    snd.play('buy');
    updateStars(true);
    render();
    if (cat === 'decor') {
      toast(item.name + ' on nyt kotona!');
      return;
    }
    if (state.pets.length === 1) {
      L.setAccessory(state, state.pets[0].id, item.id);
      save();
      toast(state.pets[0].name + ' sai asusteen: ' + item.name.toLowerCase() + '!');
      return;
    }
    openOverlay(
      '<h2>Kuka saa asusteen?</h2><div class="pet-pick">' + state.pets.map(function (p) {
        return '<button class="pick-btn" data-action="wearChoose" data-id="' + p.id + '" data-acc="' + item.id + '">' +
          '<span class="pick-art">' + A.pet({ kind: p.kind, color: p.color, accessory: item.id }, 'happy') + '</span>' +
          '<span>' + esc(p.name) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="modal-actions"><button class="btn" data-action="closeOverlay">Myöhemmin</button></div>'
    );
  }

  ACTIONS.wearChoose = function (el) {
    var p = L.findPet(state, el.dataset.id);
    if (!p) return;
    L.setAccessory(state, p.id, el.dataset.acc);
    save();
    closeOverlay();
    snd.play('care');
    toast(p.name + ' näyttää upealta!');
  };

  ACTIONS.adoptStart = function (el) {
    var price = L.adoptPrice(state);
    if (price === null) return;
    if (state.stars < price) {
      snd.play('nope');
      toast('Tarvitset vielä ' + (price - state.stars) + ' ⭐. Laske lisää kertolaskuja!');
      return;
    }
    var kind = el.dataset.kind === 'dog' ? 'dog' : 'cat';
    var colors = kind === 'dog' ? A.DOG_COLORS : A.CAT_COLORS;
    var taken = state.pets.map(function (p) { return p.name; });
    ui.petDraft = {
      kind: kind,
      color: rand(colors).id,
      name: '',
      suggest: shuffle(kind === 'dog' ? DOG_NAMES : CAT_NAMES).filter(function (n) { return taken.indexOf(n) === -1; }).slice(0, 4)
    };
    openOverlay(
      '<h2>Uusi ' + (kind === 'dog' ? 'koira' : 'kissa') + '</h2>' + petEditorHTML(ui.petDraft, true) +
      '<div class="modal-actions"><button class="btn" data-action="closeOverlay">Peruuta</button>' +
      '<button class="btn btn-primary" data-action="adoptConfirm">Adoptoi ' + price + ' ⭐</button></div>',
      { cls: 'modal-tall' }
    );
  };

  ACTIONS.adoptConfirm = function () {
    var pd = ui.petDraft;
    if (!pd) return;
    var res = L.adoptPet(state, { kind: pd.kind, color: pd.color, name: finalPetName(pd) });
    if (!res.ok) {
      snd.play('nope');
      toast(res.reason === 'max' ? 'Kotiin ei mahdu enempää lemmikkejä.' : 'Tähdet eivät riitä.');
      return;
    }
    save();
    ui.petDraft = null;
    ui.joyUntil[res.pet.id] = Date.now() + 2500;
    go('home');
    snd.play('fanfare');
    confetti(60);
    toast('Tervetuloa kotiin, ' + res.pet.name + '!');
    setTimeout(liveUpdate, 2600);
  };

  // ---- Kertotaulut ja tilastot ---------------------------------------------
  SCREENS.tables = {
    html: function () {
      var next = L.nextUnlockTable(state);
      var prog = Math.round(L.unlockProgress(state) * 100);
      var top;
      if (next === null || !state.settings.autoUnlock) {
        top = next === null ? '<div class="card center"><h2>Kaikki kertotaulut ovat auki! 🎉</h2></div>' : '';
      } else {
        top = '<div class="card"><h2>Matka seuraavaan tauluun</h2>' +
          '<div class="big-bar"><span style="width:' + prog + '%"></span></div>' +
          '<p class="muted">' + (prog >= 100 ?
            'Valmista! Uusi kertotaulu avautuu seuraavan kierroksen lopussa. 🎉' :
            'Kun osaat kaikki avoimet taulut hyvin, avautuu uusi kertotaulu!') + '</p></div>';
      }
      var cards = L.ALL_TABLES.map(function (t) {
        if (!L.isTableEnabled(state, t)) {
          return '<button class="tcard locked" data-action="showTable" data-t="' + t + '"><span class="tnum">' + t + '</span><span class="tlock">🔒</span></button>';
        }
        var n = L.masteredCount(state, t);
        var paws = '';
        for (var i = 0; i < 10; i++) paws += paw(i < n ? 'on' : '');
        var star = n / 10 >= L.UNLOCK_THRESHOLD;
        return '<button class="tcard on' + (star ? ' star' : '') + '" data-action="showTable" data-t="' + t + '">' +
          '<span class="tnum">' + t + '</span><span class="tpaws">' + paws + '</span>' +
          '<span class="tlabel">' + (star ? 'Hallussa! ⭐' : n + ' / 10') + '</span></button>';
      }).join('');
      var st = state.stats;
      var pct = st.answers ? Math.round(st.correct / st.answers * 100) : 0;
      var stats = [
        ['Kierroksia', st.rounds], ['Vastauksia', st.answers], ['Oikein', pct + ' %'],
        ['Paras putki', st.bestStreak], ['Tähtiä ansaittu', st.starsEarned]
      ].map(function (x) { return '<div class="stat"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
      return topbar('Kertotaulut') + '<div class="tables">' + top +
        '<div class="table-grid">' + cards + '</div>' +
        '<div class="card"><h2>Tilastot</h2><div class="stats">' + stats + '</div></div></div>';
    }
  };

  ACTIONS.showTable = function (el) {
    var t = Number(el.dataset.t);
    snd.play('tap');
    if (!L.isTableEnabled(state, t)) {
      var off = state.tables.parentOff.indexOf(t) !== -1;
      openOverlay('<div class="lock-big">🔒</div><h2>' + t + ':n kertotaulu</h2><p>' +
        (off ? 'Tämä taulu on suljettu aikuisten asetuksista.' : 'Tämä taulu avautuu myöhemmin. Jatka laskemista!') + '</p>' +
        '<div class="modal-actions"><button class="btn btn-primary" data-action="closeOverlay">Selvä</button></div>');
      return;
    }
    var rows = L.MULTIPLIERS.map(function (m) {
      var key = L.factKey(m, t);
      var box = Math.min(L.factBox(state, key), L.MASTERED_BOX);
      var dots = '';
      for (var i = 0; i < L.MASTERED_BOX; i++) dots += '<span class="bdot' + (i < box ? ' on' : '') + '"></span>';
      return '<li class="' + (box >= L.MASTERED_BOX ? 'done' : '') + '"><span class="tf">' + expr(m, t) + ' = <b>' + m * t + '</b></span>' +
        '<span class="bdots" aria-label="' + (box >= L.MASTERED_BOX ? 'osattu' : 'harjoittelussa') + '">' + dots + '</span></li>';
    }).join('');
    openOverlay('<h2>' + t + ':n kertotaulu</h2><ul class="fact-list">' + rows + '</ul>' +
      '<p class="muted small">Kolme pistettä = lasku on hallussa.</p>' +
      '<div class="modal-actions"><button class="btn btn-primary" data-action="closeOverlay">Sulje</button></div>');
  };

  // ---- Aikuisten portti ja asetukset ----------------------------------------
  SCREENS.gate = {
    enter: function () {
      ui.gate = { a: 12 + Math.floor(Math.random() * 8), b: 12 + Math.floor(Math.random() * 8) };
    },
    html: function () {
      return topbar('Aikuisille') + '<div class="card gate">' +
        '<p>Tämä osio on tarkoitettu aikuisille. Ratkaise lasku jatkaaksesi.</p>' +
        '<form data-submit="gateCheck"><label class="gate-q"><span>' + ui.gate.a + ' · ' + ui.gate.b + ' =</span>' +
        '<input id="gateInput" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="Vastaus"></label>' +
        '<button type="submit" class="btn btn-primary btn-wide">Jatka</button></form>' +
        '<p class="gate-err" id="gateErr" aria-live="polite"></p></div>';
    }
  };

  ACTIONS.gateCheck = function () {
    var v = Number(($('#gateInput') || {}).value);
    if (v === ui.gate.a * ui.gate.b) {
      go('settings');
      return;
    }
    snd.play('nope');
    SCREENS.gate.enter();
    render();
    $('#gateErr').textContent = 'Ei aivan. Tässä uusi lasku.';
  };

  function switchHTML(key, label) {
    var on = !!state.settings[key];
    return '<div class="switch-row"><span>' + label + '</span>' +
      '<button class="switch' + (on ? ' on' : '') + '" role="switch" aria-checked="' + on + '" aria-label="' + label + '" data-action="toggleSetting" data-key="' + key + '"></button></div>';
  }

  function segmentedHTML(key, options) {
    return '<div class="segmented">' + options.map(function (o) {
      var sel = state.settings[key] === o.value;
      return '<button class="seg' + (sel ? ' sel' : '') + '" aria-pressed="' + sel + '" data-action="setSetting" data-key="' + key + '" data-value="' + o.value + '">' + o.label + '</button>';
    }).join('') + '</div>';
  }

  SCREENS.settings = {
    html: function () {
      var toggles = L.ALL_TABLES.map(function (t) {
        var on = L.isTableEnabled(state, t);
        return '<button class="tog' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-action="toggleTable" data-t="' + t + '">' + t + '</button>';
      }).join('');

      var hard = Object.keys(state.facts).map(function (k) { return { key: k, f: state.facts[k] }; })
        .filter(function (x) { return x.f.wrong > 0; })
        .sort(function (a, b) { return b.f.wrong - a.f.wrong || a.f.right - b.f.right; })
        .slice(0, 6);
      var hardHTML = hard.length ? '<ul class="hard-list">' + hard.map(function (x) {
        var ab = x.key.split('x');
        return '<li><b>' + ab[0] + ' · ' + ab[1] + '</b><span>' + x.f.wrong + ' väärin, ' + x.f.right + ' oikein</span></li>';
      }).join('') + '</ul>' : '<p class="muted">Ei vielä vääriä vastauksia.</p>';

      var mastery = L.enabledTables(state).map(function (t) {
        return '<li><b>' + t + ':n taulu</b><span>' + L.masteredCount(state, t) + ' / 10 hallussa</span></li>';
      }).join('');

      return topbar('Asetukset') + '<div class="settings">' +
        '<section class="card"><h2>Kertotaulut</h2>' +
        '<p class="muted">Valitse harjoiteltavat taulut. Uusi taulu avautuu automaattisesti, kun kaikista avoimista tauluista on hallussa vähintään 8/10 laskua. Avausjärjestys: ' + L.UNLOCK_ORDER.join(', ') + '.</p>' +
        '<div class="table-toggles">' + toggles + '</div>' +
        switchHTML('autoUnlock', 'Avaa uusia tauluja automaattisesti') + '</section>' +
        '<section class="card"><h2>Pelin asetukset</h2>' +
        '<h3>Tehtäviä kierroksella</h3>' + segmentedHTML('roundLength', [{ value: 5, label: '5' }, { value: 10, label: '10' }, { value: 15, label: '15' }]) +
        '<h3>Kertomerkki</h3>' + segmentedHTML('sign', [{ value: '·', label: '3 · 4' }, { value: '×', label: '3 × 4' }]) +
        switchHTML('sound', 'Äänet') + '</section>' +
        '<section class="card"><h2>Edistyminen</h2><ul class="hard-list">' + mastery + '</ul>' +
        '<h3>Eniten vääriä vastauksia</h3>' + hardHTML + '</section>' +
        '<section class="card"><h2>Kotivalikkoon</h2><p class="muted">iPhone ja iPad: Safari → Jaa → Lisää Koti-valikkoon. ' +
        'Android: Chrome → valikko ⋮ → Lisää aloitusnäytölle. Peli toimii sen jälkeen myös ilman verkkoyhteyttä. ' +
        'Tallennus säilyy vain tällä laitteella ja tässä selaimessa.</p></section>' +
        '<section class="card danger"><h2>Aloita alusta</h2><p class="muted">Poistaa hahmon, lemmikit, tähdet ja edistymisen tältä laitteelta.</p>' +
        '<button class="btn btn-danger" data-action="resetAsk">Nollaa peli</button></section>' +
        '<p class="version">Kertotassut</p></div>';
    }
  };

  ACTIONS.toggleTable = function (el) {
    var t = Number(el.dataset.t);
    var on = !L.isTableEnabled(state, t);
    if (!L.setTableEnabled(state, t, on)) {
      snd.play('nope');
      toast('Vähintään yksi taulu pitää olla valittuna.');
      return;
    }
    save();
    snd.play('tap');
    render();
  };

  ACTIONS.toggleSetting = function (el) {
    var key = el.dataset.key;
    state.settings[key] = !state.settings[key];
    save();
    snd.play('tap');
    render();
  };

  ACTIONS.setSetting = function (el) {
    var key = el.dataset.key;
    var v = el.dataset.value;
    state.settings[key] = key === 'roundLength' ? Number(v) : v;
    save();
    snd.play('tap');
    render();
  };

  ACTIONS.resetAsk = function () {
    confirmModal({
      title: 'Nollataanko peli?',
      text: 'Kaikki tiedot poistetaan tältä laitteelta. Tätä ei voi perua.',
      ok: 'Nollaa',
      danger: true,
      onOk: function () {
        S.clear();
        state = S.defaultState();
        ui.joyUntil = {};
        go('title');
      }
    });
  };

  // ---- Tapahtumat -----------------------------------------------------------
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || el.disabled) return;
    var fn = ACTIONS[el.dataset.action];
    if (!fn) return;
    snd.unlock();
    fn(el, ev);
  });

  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    ev.preventDefault();
    var fn = ACTIONS[form.dataset.submit];
    if (fn) fn(form, ev);
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'nameInput' && ui.draft) ui.draft.name = t.value;
    else if (t.id === 'petNameInput' && ui.petDraft) ui.petDraft.name = t.value;
  });

  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if (typing) {
      if (ev.key === 'Enter' && !t.form) { t.blur(); ev.preventDefault(); }
      return;
    }
    if (ev.key === 'Escape' && overlay.classList.contains('open')) { closeOverlay(); return; }
    if (ui.screen !== 'practice' || overlay.classList.contains('open')) return;
    if (/^[0-9]$/.test(ev.key)) { typeDigit(ev.key); ev.preventDefault(); }
    else if (ev.key === 'Backspace') { backspace(); ev.preventDefault(); }
    else if (ev.key === 'Enter' || ev.key === ' ') { ACTIONS.submit(); ev.preventDefault(); }
  });

  // ---- Tarpeiden ajastin (vain pelatessa) ------------------------------------
  var TICK_MS = 5000;
  var PAUSED = { title: true, create: true, gate: true, settings: true };
  var lastTick = Date.now();

  function tick() {
    var now = Date.now();
    var dt = Math.min(10, (now - lastTick) / 1000);
    lastTick = now;
    if (document.hidden || !state.created || PAUSED[ui.screen]) return;
    L.decayAll(state, dt);
    save();
    liveUpdate();
  }

  // Kaikki muutokset tallennetaan heti, joten piilotettaessa riittää nollata ajastin.
  // (Erillinen tallennus sulkiessa voisi ylikirjoittaa toisen välilehden tilan.)
  document.addEventListener('visibilitychange', function () {
    lastTick = Date.now();
  });

  function start() {
    go(state.created ? 'home' : 'title');
    setInterval(tick, TICK_MS);
  }

  KT.ui = {
    start: start,
    // Kehitystä ja testausta varten selaimen konsolista.
    debug: {
      state: function () { return state; },
      save: save,
      render: render,
      tick: function (seconds) { L.decayAll(state, seconds); save(); liveUpdate(); }
    }
  };
})();
