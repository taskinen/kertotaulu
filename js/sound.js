/*
 * Kertotassut – äänet. Efektit syntetisoidaan Web Audiolla, joten
 * äänitiedostoja ei tarvita. AudioContext luodaan vasta ensimmäisellä
 * napautuksella (iOS vaatii tämän).
 */
(function (root) {
  'use strict';

  var ctx = null;
  var isEnabled = function () { return true; };

  // [taajuus Hz, alku s, kesto s, aaltomuoto, voimakkuus]
  var SOUNDS = {
    tap: [[700, 0, 0.05, 'triangle', 0.05]],
    key: [[520, 0, 0.04, 'triangle', 0.05]],
    correct: [[660, 0, 0.12, 'sine', 0.16], [880, 0.1, 0.2, 'sine', 0.16]],
    wrong: [[330, 0, 0.16, 'triangle', 0.12], [262, 0.14, 0.26, 'triangle', 0.12]],
    streak: [[784, 0, 0.1, 'sine', 0.14], [988, 0.09, 0.1, 'sine', 0.14], [1175, 0.18, 0.22, 'sine', 0.14]],
    care: [[587, 0, 0.1, 'sine', 0.14], [784, 0.1, 0.18, 'sine', 0.14]],
    pet: [[440, 0, 0.18, 'sine', 0.08], [523, 0.14, 0.24, 'sine', 0.08]],
    buy: [[523, 0, 0.1, 'square', 0.06], [659, 0.08, 0.1, 'square', 0.06], [784, 0.16, 0.22, 'square', 0.06]],
    nope: [[220, 0, 0.12, 'triangle', 0.1]],
    fanfare: [
      [523, 0, 0.14, 'triangle', 0.14], [659, 0.13, 0.14, 'triangle', 0.14], [784, 0.26, 0.14, 'triangle', 0.14],
      [1046, 0.4, 0.5, 'triangle', 0.14], [784, 0.4, 0.5, 'sine', 0.08], [659, 0.4, 0.5, 'sine', 0.08]
    ]
  };

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(c, freq, start, dur, type, vol) {
    var t0 = c.currentTime + start;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function play(name) {
    if (!isEnabled()) return;
    var notes = SOUNDS[name];
    if (!notes) return;
    var c = ensure();
    if (!c) return;
    try {
      notes.forEach(function (n) { tone(c, n[0], n[1], n[2], n[3], n[4]); });
    } catch (e) { /* äänet eivät ole kriittisiä */ }
  }

  function vibrate(pattern) {
    if (!isEnabled()) return;
    try {
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(pattern);
    } catch (e) { /* ei tuettu */ }
  }

  root.KT = root.KT || {};
  root.KT.sound = {
    play: play,
    vibrate: vibrate,
    unlock: ensure,
    setEnabledGetter: function (fn) { isEnabled = fn; }
  };
})(typeof self !== 'undefined' ? self : this);
