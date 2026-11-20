/* Kertotassut – käynnistys. */
(function () {
  'use strict';

  window.KT.ui.start();

  // Manifesti lisätään vain http(s)-osoitteissa, koska file://-osoitteessa selain estää sen latauksen.
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'manifest.webmanifest';
    document.head.appendChild(link);
  }

  // Service worker mahdollistaa offline-käytön. Se toimii vain https- ja localhost-osoitteissa,
  // joten file://-osoitteesta avattaessa rekisteröinti ohitetaan.
  var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* peli toimii ilmankin */ });
    });
  }
})();
