/*
 * Kertotassut – grafiikka. Kaikki hahmot piirretään inline-SVG:nä,
 * joten ne näyttävät samalta kaikilla laitteilla.
 */
(function (root) {
  'use strict';

  var CAT_COLORS = [
    { id: 'orange', name: 'Oranssi', body: '#F4A259', dark: '#D27A2C', light: '#FFE6C7', line: '#B9692A', pattern: 'stripes' },
    { id: 'gray', name: 'Harmaa', body: '#AEB8C3', dark: '#7F8B98', light: '#EEF1F4', line: '#6F7B88', pattern: 'stripes' },
    { id: 'black', name: 'Musta', body: '#4C4955', dark: '#33313A', light: '#77737F', line: '#2A2830', pattern: '' },
    { id: 'white', name: 'Valkoinen', body: '#FFFCF6', dark: '#E8DCCB', light: '#FFFFFF', line: '#CDBCA6', pattern: '' },
    { id: 'cream', name: 'Kerma', body: '#F3D7A8', dark: '#DDB57A', light: '#FFF4E0', line: '#C59A5E', pattern: 'stripes' }
  ];

  var DOG_COLORS = [
    { id: 'brown', name: 'Ruskea', body: '#BC8452', dark: '#8A5830', light: '#F3DABD', line: '#7A4C28', pattern: '' },
    { id: 'golden', name: 'Kulta', body: '#EFC26F', dark: '#C99240', light: '#FFF2D6', line: '#B07F33', pattern: '' },
    { id: 'black', name: 'Musta', body: '#4C4955', dark: '#2F2D35', light: '#D9A86C', line: '#2A2830', pattern: '' },
    { id: 'spotted', name: 'Täplikäs', body: '#FFFCF6', dark: '#4C4955', light: '#FFFFFF', line: '#BDAE9B', pattern: 'spots' },
    { id: 'gray', name: 'Harmaa', body: '#AEB8C3', dark: '#6F7B88', light: '#EEF1F4', line: '#5E6975', pattern: '' }
  ];

  var SKINS = [
    { c: '#FFE3CC', name: 'Vaalea' },
    { c: '#F6C9A0', name: 'Persikka' },
    { c: '#DDA77B', name: 'Ruskehtava' },
    { c: '#A9724D', name: 'Ruskea' },
    { c: '#6F4730', name: 'Tumma' }
  ];
  var HAIR_COLORS = [
    { c: '#4A2F22', name: 'Tummanruskea' },
    { c: '#8A5A33', name: 'Ruskea' },
    { c: '#E9C46A', name: 'Vaalea' },
    { c: '#C8553D', name: 'Punainen' },
    { c: '#26232B', name: 'Musta' },
    { c: '#9B6BD6', name: 'Violetti' }
  ];
  var HAIR_STYLES = [{ name: 'Lyhyt' }, { name: 'Pitkä' }, { name: 'Saparot' }, { name: 'Kihara' }];
  var SHIRTS = [
    { c: '#EF5B5B', name: 'Punainen' },
    { c: '#FF9F45', name: 'Oranssi' },
    { c: '#FFD34D', name: 'Keltainen' },
    { c: '#4CB963', name: 'Vihreä' },
    { c: '#4D9DE0', name: 'Sininen' },
    { c: '#9B6BD6', name: 'Violetti' },
    { c: '#FF7EB6', name: 'Pinkki' }
  ];

  var INK = '#2B2B33';

  function pick(list, i) {
    return list[i] || list[0];
  }

  function colorOf(kind, id) {
    var list = kind === 'dog' ? DOG_COLORS : CAT_COLORS;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  // ---- Yhteiset osat ----------------------------------------------------
  function eyes(mood) {
    var y = 84;
    if (mood === 'joy') {
      return '<g fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round">' +
        '<path d="M70 ' + (y + 3) + ' Q80 ' + (y - 9) + ' 90 ' + (y + 3) + '"/>' +
        '<path d="M110 ' + (y + 3) + ' Q120 ' + (y - 9) + ' 130 ' + (y + 3) + '"/></g>';
    }
    if (mood === 'sleep') {
      return '<g fill="none" stroke="' + INK + '" stroke-width="4.5" stroke-linecap="round">' +
        '<path d="M70 ' + (y + 1) + ' Q80 ' + (y + 9) + ' 90 ' + (y + 1) + '"/>' +
        '<path d="M110 ' + (y + 1) + ' Q120 ' + (y + 9) + ' 130 ' + (y + 1) + '"/></g>';
    }
    var down = mood === 'sad' ? 3 : 0;
    function one(x) {
      return '<ellipse cx="' + x + '" cy="' + y + '" rx="10" ry="11.5" fill="#fff"/>' +
        '<ellipse cx="' + x + '" cy="' + (y + 1 + down) + '" rx="7" ry="8.5" fill="' + INK + '"/>' +
        '<circle cx="' + (x + 2.6) + '" cy="' + (y - 2.5 + down) + '" r="2.8" fill="#fff"/>';
    }
    var s = '<g class="eyes">' + one(80) + one(120) + '</g>';
    if (mood === 'sad') {
      s += '<g fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round">' +
        '<path d="M69 ' + (y - 14) + ' L89 ' + (y - 19) + '"/><path d="M111 ' + (y - 19) + ' L131 ' + (y - 14) + '"/></g>' +
        '<path d="M70 ' + (y + 13) + ' q-4 7 0 9 q4 -2 0 -9z" fill="#7CC6F2"/>';
    }
    return s;
  }

  function cheeks(mood) {
    if (mood !== 'happy' && mood !== 'joy') return '';
    return '<ellipse cx="64" cy="104" rx="8" ry="5" fill="#FF7E95" opacity=".45"/>' +
      '<ellipse cx="136" cy="104" rx="8" ry="5" fill="#FF7E95" opacity=".45"/>';
  }

  function accessorySVG(id, kind) {
    var top = kind === 'dog' ? 47 : 45;
    switch (id) {
      case 'bow':
        return '<g transform="translate(' + (kind === 'dog' ? 130 : 126) + ' ' + (top + 6) + ') rotate(-15)">' +
          '<path d="M0 0 L-18 -11 Q-22 0 -18 11 Z" fill="#FF5C8A" stroke="#C93366" stroke-width="2.5" stroke-linejoin="round"/>' +
          '<path d="M0 0 L18 -11 Q22 0 18 11 Z" fill="#FF5C8A" stroke="#C93366" stroke-width="2.5" stroke-linejoin="round"/>' +
          '<circle r="6" fill="#FF8FB1" stroke="#C93366" stroke-width="2.5"/></g>';
      case 'collar':
        return '<path d="M62 126 Q100 146 138 126" fill="none" stroke="#B82535" stroke-width="12" stroke-linecap="round"/>' +
          '<path d="M62 126 Q100 146 138 126" fill="none" stroke="#EF4B5B" stroke-width="7" stroke-linecap="round"/>' +
          '<circle cx="100" cy="142" r="7.5" fill="#FFD34D" stroke="#D9A400" stroke-width="2.5"/>' +
          '<path d="M97 143 h6" stroke="#B88A00" stroke-width="2" stroke-linecap="round"/>';
      case 'hat':
        return '<g transform="rotate(10 100 ' + top + ')">' +
          '<path d="M79 ' + (top + 6) + ' L100 ' + (top - 40) + ' L121 ' + (top + 6) + ' Z" fill="#5BC0EB" stroke="#2E8FB8" stroke-width="3" stroke-linejoin="round"/>' +
          '<circle cx="93" cy="' + (top - 6) + '" r="3.5" fill="#FFD34D"/>' +
          '<circle cx="105" cy="' + (top - 18) + '" r="3" fill="#FF5C8A"/>' +
          '<circle cx="106" cy="' + top + '" r="3" fill="#fff"/>' +
          '<circle cx="100" cy="' + (top - 42) + '" r="7" fill="#FFD34D" stroke="#D9A400" stroke-width="2.5"/></g>';
      case 'glasses':
        return '<g>' +
          '<path d="M66 83 L50 78 M134 83 L150 78" stroke="#15151A" stroke-width="3.5" stroke-linecap="round"/>' +
          '<rect x="64" y="73" width="31" height="22" rx="10" fill="#2B2B33" stroke="#15151A" stroke-width="2.5"/>' +
          '<rect x="105" y="73" width="31" height="22" rx="10" fill="#2B2B33" stroke="#15151A" stroke-width="2.5"/>' +
          '<path d="M95 82 Q100 78 105 82" stroke="#15151A" stroke-width="3.5" fill="none"/>' +
          '<path d="M70 79 h8 M111 79 h8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".55"/></g>';
      case 'crown':
        return '<path d="M74 ' + (top + 6) + ' L77 ' + (top - 22) + ' L89 ' + (top - 8) + ' L100 ' + (top - 28) +
          ' L111 ' + (top - 8) + ' L123 ' + (top - 22) + ' L126 ' + (top + 6) + ' Z" fill="#FFD34D" stroke="#D9A400" stroke-width="3" stroke-linejoin="round"/>' +
          '<circle cx="100" cy="' + (top - 4) + '" r="4.5" fill="#FF5C8A"/>' +
          '<circle cx="86" cy="' + top + '" r="3" fill="#5BC0EB"/>' +
          '<circle cx="114" cy="' + top + '" r="3" fill="#5BC0EB"/>';
      default:
        return '';
    }
  }

  function tail(d, c, width) {
    return '<g class="tail"><path d="' + d + '" fill="none" stroke="' + c.line + '" stroke-width="' + (width + 6) + '" stroke-linecap="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + c.body + '" stroke-width="' + width + '" stroke-linecap="round"/></g>';
  }

  function paws(c) {
    return '<ellipse cx="80" cy="188" rx="15" ry="10" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3"/>' +
      '<ellipse cx="120" cy="188" rx="15" ry="10" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3"/>' +
      '<path d="M76 184 v6 M84 184 v6 M116 184 v6 M124 184 v6" stroke="' + c.line + '" stroke-width="2" stroke-linecap="round"/>';
  }

  function svgOpen(cls, mood) {
    return '<svg class="pet-svg ' + cls + ' mood-' + mood + '" viewBox="0 0 200 200" aria-hidden="true" focusable="false">';
  }

  // ---- Kissa ----------------------------------------------------------
  function cat(o) {
    var c = colorOf('cat', o.color);
    var mood = o.mood || 'happy';
    var s = svgOpen('cat', mood);
    s += tail('M136 172 C 172 172, 184 140, 168 112 C 164 104, 170 96, 177 104', c, 12);
    s += '<ellipse cx="100" cy="150" rx="46" ry="42" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3"/>';
    s += '<ellipse cx="100" cy="160" rx="25" ry="27" fill="' + c.light + '"/>';
    if (c.pattern === 'stripes') {
      s += '<path d="M58 138 q9 4 14 0 M142 138 q-9 4 -14 0 M57 154 q9 4 14 0 M143 154 q-9 4 -14 0" stroke="' + c.dark + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    }
    s += paws(c);
    s += '<path d="M58 76 L62 26 L98 50 Z" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3" stroke-linejoin="round"/>';
    s += '<path d="M66 64 L68 38 L88 52 Z" fill="#F7A8B8"/>';
    s += '<path d="M142 76 L138 26 L102 50 Z" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3" stroke-linejoin="round"/>';
    s += '<path d="M134 64 L132 38 L112 52 Z" fill="#F7A8B8"/>';
    s += '<ellipse cx="100" cy="88" rx="52" ry="45" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3"/>';
    if (c.pattern === 'stripes') {
      s += '<path d="M100 46 v12 M86 48 l3 10 M114 48 l-3 10" stroke="' + c.dark + '" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
    }
    s += '<ellipse cx="100" cy="106" rx="22" ry="14" fill="' + c.light + '"/>';
    s += cheeks(mood);
    s += eyes(mood);
    s += '<path d="M94 96 Q100 93 106 96 Q103 102 100 103 Q97 102 94 96Z" fill="#F28CA0" stroke="#D9677F" stroke-width="1.5" stroke-linejoin="round"/>';
    if (mood === 'happy' || mood === 'joy') {
      s += '<path d="M100 103 v4" stroke="#5A3A3A" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M90 108 Q100 123 110 108 Z" fill="#8E3B46" stroke="#5A3A3A" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<path d="M95 115 Q100 121 105 115 Q100 112 95 115Z" fill="#F58FA3"/>';
    } else if (mood === 'sad') {
      s += '<path d="M100 103 v4" stroke="#5A3A3A" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M91 116 Q100 108 109 116" fill="none" stroke="#5A3A3A" stroke-width="3" stroke-linecap="round"/>';
    } else {
      s += '<path d="M100 103 v4 M90 106 Q95 112 100 107 Q105 112 110 106" fill="none" stroke="#5A3A3A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    s += '<g stroke="' + c.line + '" stroke-width="2" stroke-linecap="round" opacity=".8">' +
      '<path d="M80 103 L48 97 M80 109 L48 113 M120 103 L152 97 M120 109 L152 113"/></g>';
    s += accessorySVG(o.accessory, 'cat');
    return s + '</svg>';
  }

  // ---- Koira ----------------------------------------------------------
  function dog(o) {
    var c = colorOf('dog', o.color);
    var mood = o.mood || 'happy';
    var s = svgOpen('dog', mood);
    s += tail('M138 164 C 166 160, 178 138, 170 110', c, 13);
    s += '<ellipse cx="100" cy="150" rx="47" ry="42" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3"/>';
    s += '<ellipse cx="100" cy="160" rx="25" ry="27" fill="' + c.light + '"/>';
    if (c.pattern === 'spots') {
      s += '<ellipse cx="70" cy="142" rx="10" ry="8" fill="' + c.dark + '"/><ellipse cx="132" cy="160" rx="8" ry="7" fill="' + c.dark + '"/>';
    }
    s += paws(c);
    s += '<ellipse cx="100" cy="90" rx="48" ry="44" fill="' + c.body + '" stroke="' + c.line + '" stroke-width="3"/>';
    if (c.pattern === 'spots') {
      s += '<ellipse cx="121" cy="82" rx="17" ry="16" fill="' + c.dark + '"/>';
    }
    s += '<g class="ear ear-l"><path d="M64 54 C 42 50, 30 84, 38 112 C 42 124, 58 122, 62 108 C 66 92, 70 74, 64 54 Z" fill="' + c.dark + '" stroke="' + c.line + '" stroke-width="3" stroke-linejoin="round"/></g>';
    s += '<g class="ear ear-r"><path d="M136 54 C 158 50, 170 84, 162 112 C 158 124, 142 122, 138 108 C 134 92, 130 74, 136 54 Z" fill="' + c.dark + '" stroke="' + c.line + '" stroke-width="3" stroke-linejoin="round"/></g>';
    s += '<ellipse cx="100" cy="111" rx="26" ry="18" fill="' + c.light + '"/>';
    s += cheeks(mood);
    s += eyes(mood);
    s += '<ellipse cx="100" cy="100" rx="11" ry="7.5" fill="' + INK + '"/><ellipse cx="96" cy="98" rx="3.5" ry="2" fill="#fff" opacity=".6"/>';
    if (mood === 'happy' || mood === 'joy') {
      s += '<path d="M100 107 v4" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M86 112 Q100 130 114 112 Z" fill="#8E3B46" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<path d="M94 118 Q94 133 100 133 Q106 133 106 118 Z" fill="#F58FA3" stroke="#D96A82" stroke-width="1.5"/>';
    } else if (mood === 'sad') {
      s += '<path d="M100 107 v5" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M90 121 Q100 112 110 121" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>';
    } else {
      s += '<path d="M100 107 v5 M88 112 Q94 118 100 112 Q106 118 112 112" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    s += accessorySVG(o.accessory, 'dog');
    return s + '</svg>';
  }

  function pet(p, moodOverride) {
    var o = { color: p.color, mood: moodOverride || p.mood || 'happy', accessory: p.accessory };
    return p.kind === 'dog' ? dog(o) : cat(o);
  }

  // ---- Pelaajan hahmo ------------------------------------------------------
  function avatar(av) {
    av = av || {};
    var skin = pick(SKINS, av.skin).c;
    var hair = pick(HAIR_COLORS, av.hairColor).c;
    var shirt = pick(SHIRTS, av.shirt).c;
    var style = av.hairStyle || 0;
    var s = '<svg class="avatar-svg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">';
    if (style === 1) {
      s += '<path d="M50 92 C 48 46, 78 34, 100 34 C 122 34, 152 46, 150 92 L 154 152 Q 140 162 126 150 L 74 150 Q 60 162 46 152 Z" fill="' + hair + '"/>';
    } else if (style === 2) {
      // Saparot ja pompulat piirretään pään taakse, joten korvat ja pää jäävät aina niiden eteen.
      s += '<circle cx="38" cy="70" r="20" fill="' + hair + '"/><circle cx="162" cy="70" r="20" fill="' + hair + '"/>';
      s += '<ellipse cx="54" cy="72" rx="5.5" ry="9" transform="rotate(25 54 72)" fill="#FF5C8A"/>' +
        '<ellipse cx="146" cy="72" rx="5.5" ry="9" transform="rotate(-25 146 72)" fill="#FF5C8A"/>';
    } else if (style === 3) {
      s += '<circle cx="100" cy="84" r="54" fill="' + hair + '"/>';
    }
    s += '<path d="M86 118 h28 v30 q-14 10 -28 0 Z" fill="' + skin + '"/>';
    s += '<path d="M34 200 C 34 160, 62 144, 100 144 C 138 144, 166 160, 166 200 Z" fill="' + shirt + '"/>';
    s += '<path d="M82 147 Q100 166 118 147" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="5" stroke-linecap="round"/>';
    s += '<circle cx="55" cy="96" r="10" fill="' + skin + '"/><circle cx="145" cy="96" r="10" fill="' + skin + '"/>';
    s += '<circle cx="100" cy="90" r="45" fill="' + skin + '"/>';
    if (style === 0) {
      s += '<path d="M54 92 C 50 52, 76 38, 102 40 C 130 40, 152 58, 146 94 C 140 76, 128 66, 112 64 C 106 72, 92 74, 84 66 C 72 70, 60 80, 54 92 Z" fill="' + hair + '"/>';
    } else if (style === 1) {
      s += '<path d="M54 98 C 50 54, 76 40, 100 40 C 124 40, 150 54, 146 98 C 142 80, 132 68, 118 62 C 104 70, 84 70, 74 64 C 64 72, 56 84, 54 98 Z" fill="' + hair + '"/>';
    } else if (style === 2) {
      s += '<path d="M55 90 C 54 54, 80 40, 104 41 C 128 42, 150 60, 145 90 C 130 70, 100 60, 76 66 C 66 70, 58 80, 55 90 Z" fill="' + hair + '"/>';
    } else {
      s += '<path d="M58 88 C 58 52, 80 44, 100 44 C 120 44, 142 52, 142 88 C 130 70, 70 70, 58 88Z" fill="' + hair + '"/>';
      for (var a = 165; a <= 375; a += 21) {
        var rad = a * Math.PI / 180;
        s += '<circle cx="' + (100 + 44 * Math.cos(rad)).toFixed(1) + '" cy="' + (86 + 42 * Math.sin(rad)).toFixed(1) + '" r="15" fill="' + hair + '"/>';
      }
    }
    s += '<path d="M77 81 Q84 77 91 81 M109 81 Q116 77 123 81" stroke="' + hair + '" stroke-width="3.5" fill="none" stroke-linecap="round"/>';
    s += '<g class="eyes"><ellipse cx="84" cy="94" rx="5.5" ry="7" fill="' + INK + '"/><circle cx="86" cy="91" r="2" fill="#fff"/>' +
      '<ellipse cx="116" cy="94" rx="5.5" ry="7" fill="' + INK + '"/><circle cx="118" cy="91" r="2" fill="#fff"/></g>';
    s += '<path d="M100 99 q-3 5 0 7" stroke="rgba(0,0,0,.18)" stroke-width="3" fill="none" stroke-linecap="round"/>';
    s += '<ellipse cx="71" cy="108" rx="8" ry="5" fill="#FF7A8A" opacity=".3"/><ellipse cx="129" cy="108" rx="8" ry="5" fill="#FF7A8A" opacity=".3"/>';
    s += '<path d="M88 112 Q100 124 112 112" fill="none" stroke="#8E3B46" stroke-width="4" stroke-linecap="round"/>';
    return s + '</svg>';
  }

  // ---- Sisustus -------------------------------------------------------
  var DECOR = {
    window: '<svg viewBox="0 0 120 100" aria-hidden="true"><rect x="4" y="4" width="112" height="92" rx="10" fill="#fff"/>' +
      '<rect x="12" y="12" width="96" height="76" rx="6" fill="#BFE6FF"/><circle cx="84" cy="32" r="11" fill="#FFE07A"/>' +
      '<ellipse cx="36" cy="30" rx="13" ry="6" fill="#fff"/><path d="M12 72 Q36 58 60 70 T108 66 V88 H12Z" fill="#9ED89A"/>' +
      '<path d="M60 12 V88 M12 50 H108" stroke="#fff" stroke-width="6"/></svg>',
    painting: '<svg viewBox="0 0 100 80" aria-hidden="true"><rect x="2" y="2" width="96" height="76" rx="6" fill="#C8875A"/>' +
      '<rect x="10" y="10" width="80" height="60" rx="3" fill="#FFF4D6"/>' +
      '<g fill="#FF7EB6"><ellipse cx="50" cy="48" rx="12" ry="10"/><circle cx="36" cy="34" r="5"/><circle cx="45" cy="26" r="5"/><circle cx="55" cy="26" r="5"/><circle cx="64" cy="34" r="5"/></g></svg>',
    plant: '<svg viewBox="0 0 80 120" aria-hidden="true">' +
      '<path d="M40 72 C 20 52, 10 32, 18 16 C 32 26, 40 48, 40 72Z" fill="#4CB963"/>' +
      '<path d="M40 72 C 60 52, 70 32, 62 14 C 48 26, 40 48, 40 72Z" fill="#3FA055"/>' +
      '<path d="M40 74 C 30 58, 36 32, 40 22 C 44 32, 50 58, 40 74Z" fill="#5BD16F"/>' +
      '<g fill="#FF7EB6"><circle cx="18" cy="16" r="6"/><circle cx="62" cy="14" r="6"/><circle cx="40" cy="20" r="6"/></g>' +
      '<g fill="#FFD34D"><circle cx="18" cy="16" r="2.5"/><circle cx="62" cy="14" r="2.5"/><circle cx="40" cy="20" r="2.5"/></g>' +
      '<path d="M18 72 H62 L56 114 Q40 118 24 114 Z" fill="#E07A5F"/><rect x="14" y="66" width="52" height="10" rx="4" fill="#C8654B"/></svg>',
    bed: '<svg viewBox="0 0 160 70" aria-hidden="true"><ellipse cx="80" cy="42" rx="76" ry="25" fill="#5B8DEF"/>' +
      '<ellipse cx="80" cy="40" rx="60" ry="16" fill="#A9C5FF"/><ellipse cx="80" cy="36" rx="44" ry="9" fill="#C8DAFF"/></svg>',
    rug: '<svg viewBox="0 0 200 60" aria-hidden="true"><ellipse cx="100" cy="30" rx="97" ry="27" fill="#E86A92"/>' +
      '<ellipse cx="100" cy="30" rx="78" ry="20" fill="#F7A1C0"/><ellipse cx="100" cy="30" rx="56" ry="13" fill="#FFD1E1"/></svg>',
    tree: '<svg viewBox="0 0 100 160" aria-hidden="true"><rect x="12" y="146" width="76" height="12" rx="5" fill="#A87A58"/>' +
      '<rect x="44" y="36" width="12" height="112" fill="#E5C49F"/>' +
      '<path d="M44 50 h12 M44 62 h12 M44 74 h12 M44 86 h12 M44 98 h12 M44 110 h12 M44 122 h12 M44 134 h12" stroke="#C9A47D" stroke-width="2"/>' +
      '<rect x="6" y="88" width="56" height="12" rx="6" fill="#A87A58"/><rect x="38" y="28" width="58" height="12" rx="6" fill="#A87A58"/>' +
      '<path d="M86 40 v26" stroke="#8A6A50" stroke-width="2"/><circle cx="86" cy="70" r="6" fill="#FF5C8A"/></svg>'
  };

  var ACCESSORY_EMOJI = { bow: '🎀', collar: '🔔', hat: '🥳', glasses: '🕶️', crown: '👑' };

  root.KT = root.KT || {};
  root.KT.art = {
    CAT_COLORS: CAT_COLORS,
    DOG_COLORS: DOG_COLORS,
    SKINS: SKINS,
    HAIR_COLORS: HAIR_COLORS,
    HAIR_STYLES: HAIR_STYLES,
    SHIRTS: SHIRTS,
    DECOR: DECOR,
    ACCESSORY_EMOJI: ACCESSORY_EMOJI,
    colorOf: colorOf,
    cat: cat,
    dog: dog,
    pet: pet,
    avatar: avatar,
    accessorySVG: accessorySVG
  };
})(typeof self !== 'undefined' ? self : this);
