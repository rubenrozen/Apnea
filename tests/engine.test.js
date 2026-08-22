/* =====================================================================
   INSPIR — tests du moteur

   Aucune dépendance : le fichier extrait le moteur d'index.html entre
   les balises ==MOTEUR-DEBUT== et ==MOTEUR-FIN==, puis rejoue les vingt
   tables STAmina relevées à la main.

   Lancer :  node tests/engine.test.js
   Sortie   :  code 0 si tout passe, 1 sinon (bloque le déploiement)
   ===================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------------------------------------------------------------------
// Extraction du moteur
// ---------------------------------------------------------------------
const A = html.indexOf('/* ==MOTEUR-DEBUT== */');
const B = html.indexOf('/* ==MOTEUR-FIN== */');
if (A === -1 || B === -1 || B < A) {
  console.error("ÉCHEC : balises ==MOTEUR-DEBUT== / ==MOTEUR-FIN== introuvables dans index.html.");
  process.exit(1);
}
const engine = html.slice(A, B);

// Dépendances minimales du moteur, redéfinies ici pour isoler le test
const prelude = `
  function fmt(sec){
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec/60), s = sec % 60;
    return m + ':' + String(s).padStart(2,'0');
  }
  let S = { pb:180, history:[], program:null, tables:[] };
`;

let api;
try {
  api = new Function(prelude + engine + `
    return { buildTable, tableHeader, tableTotal, tableHoldTotal, tableParams,
             buildBreath, breathCycles, BREATH, DIFF, PROGRAMS, ROUNDS, CALM, floor5,
             progPhases, progTotalWeeks, progSlots, slotTable, fmt,
             setS: v => { S = v; } };
  `)();
} catch (e) {
  console.error("ÉCHEC : le moteur ne s'évalue pas.\n", e.message);
  process.exit(1);
}

const { buildTable, tableHeader, tableTotal, BREATH, DIFF, PROGRAMS, ROUNDS, fmt } = api;

// ---------------------------------------------------------------------
// Utilitaires de test
// ---------------------------------------------------------------------
let passed = 0, failed = 0;
const fails = [];

function check(nom, attendu, obtenu) {
  const a = JSON.stringify(attendu), o = JSON.stringify(obtenu);
  if (a === o) { passed++; }
  else { failed++; fails.push(`${nom}\n    attendu : ${a}\n    obtenu  : ${o}`); }
}
function section(t) { console.log('\n' + t); }

// ---------------------------------------------------------------------
// 1. Les vingt tables STAmina
//    [type, max, valeur variable, pas, valeur fixe, total ou null]
// ---------------------------------------------------------------------
const STAMINA = [
  ['co2',  90, '1:20', '-10', '0:45', '13:00'],
  ['co2', 180, '1:20', '-10', '1:30', '19:00'],
  ['co2', 190, '1:20', '-10', '1:35', '19:40'],
  ['co2', 240, '1:20', '-10', '2:00', '23:00'],
  ['co2', 300, '1:20', '-10', '2:30', null],
  ['co2', 360, '1:20', '-10', '3:00', null],

  ['o2',   90, '0:30',  '+5', '1:00', '15:20'],
  ['o2',  180, '1:40',  '+5', '1:00', '24:40'],
  ['o2',  190, '1:45',  '+5', '1:00', '25:20'],
  ['o2',  200, '1:55',  '+5', '1:00', null],
  ['o2',  210, '2:00',  '+5', '1:00', null],
  ['o2',  220, '2:10',  '+5', '1:00', null],
  ['o2',  230, '1:40', '+10', '1:00', null],
  ['o2',  240, '1:50', '+10', '1:00', '28:20'],
  ['o2',  270, '2:10', '+10', '1:05', null],
  ['o2',  300, '2:35', '+10', '1:15', null],
  ['o2',  330, '2:55', '+10', '1:20', null],
  ['o2',  340, '2:30', '+15', '1:25', null],
  ['o2',  350, '2:35', '+15', '1:25', null],
  ['o2',  360, '2:45', '+15', '1:30', null],
];

section('Tables STAmina (difficulté normale)');
for (const [type, pb, vari, pas, fixe, total] of STAMINA) {
  const h = tableHeader(type, pb, 'normal', null);
  check(`${type.toUpperCase()} ${fmt(pb)} — en-tête`,
        { variable: vari, step: pas, fixed: fixe },
        { variable: h.variable, step: h.step, fixed: h.fixed });
  if (total) {
    check(`${type.toUpperCase()} ${fmt(pb)} — total`, total, fmt(tableTotal(buildTable(type, pb, 'normal', null))));
  }
}

// ---------------------------------------------------------------------
// 2. Invariants de structure
// ---------------------------------------------------------------------
section('Structure des tables');
for (const type of ['co2', 'o2']) {
  for (const diff of Object.keys(DIFF)) {
    const steps = buildTable(type, 180, diff, null);
    check(`${type}/${diff} — nombre de phases`, ROUNDS * 2 + 1, steps.length);
    check(`${type}/${diff} — première phase`, 'rest', steps[0].kind);
    check(`${type}/${diff} — dernière phase`, 'calm', steps[steps.length - 1].kind);
    const alterne = steps.slice(0, -1).every((s, i) => s.kind === (i % 2 ? 'hold' : 'rest'));
    check(`${type}/${diff} — alternance repos/apnée`, true, alterne);
    const positives = steps.every(s => s.dur > 0);
    check(`${type}/${diff} — durées strictement positives`, true, positives);
  }
}

// La difficulté doit être monotone : facile ≤ normal ≤ difficile
section('Monotonie de la difficulté');
for (const type of ['co2', 'o2']) {
  const [f, n, d] = ['facile', 'normal', 'difficile']
    .map(k => buildTable(type, 240, k, null).filter(s => s.kind === 'hold').reduce((a, s) => a + s.dur, 0));
  check(`${type} — facile < normal`, true, f < n);
  check(`${type} — normal < difficile`, true, n < d);
}

// ---------------------------------------------------------------------
// 3. Tables sur mesure
// ---------------------------------------------------------------------
section('Tables sur mesure');
const rounds = [{ rest: 90, hold: 45 }, { rest: 80, hold: 50 }, { rest: 70, hold: 55 }];
const custom = buildTable('custom', 0, 'normal', rounds);
check('sur mesure — nombre de phases', rounds.length * 2 + 1, custom.length);
check('sur mesure — total', 90 + 45 + 80 + 50 + 70 + 55 + 60, tableTotal(custom));

// La conversion d'une table calculée doit être fidèle
for (const [type, pb] of [['co2', 180], ['o2', 180], ['o2', 340]]) {
  const orig = buildTable(type, pb, 'normal', null);
  const plats = orig.filter(s => s.kind !== 'calm');
  const conv = [];
  for (let i = 0; i < plats.length; i += 2) conv.push({ rest: plats[i].dur, hold: plats[i + 1].dur });
  const rebuilt = buildTable('custom', 0, 'normal', conv);
  check(`conversion ${type} ${fmt(pb)} — fidèle`,
        orig.map(s => s.kind + ':' + s.dur),
        rebuilt.map(s => s.kind + ':' + s.dur));
}

// ---------------------------------------------------------------------
// 4. Respiration
// ---------------------------------------------------------------------
section('Pratiques de respiration');
for (const [k, b] of Object.entries(BREATH)) {
  const mn = b.durations[1], sv = b.steps[1];
  const steps = buildBreathSafe(k, mn, sv);
  const total = steps.reduce((a, p) => a + p.dur, 0);
  const cible = mn * 60;
  const ecart = Math.abs(total - cible) / cible;
  check(`${b.name} — écart à la durée cible sous 10 %`, true, ecart < 0.10);
  check(`${b.name} — libellés présents`, true, steps.every(p => !!p.label));
}
function buildBreathSafe(k, mn, sv) { return api.buildBreath(k, mn, sv); }

// Le carré progressif doit réellement progresser
const prog = api.buildBreath('carre_prog', 10, 5);
const dernier = prog[prog.length - 1].cycle;
const c1 = prog.filter(p => p.cycle === 1)[0].dur;
const cN = prog.filter(p => p.cycle === dernier)[0].dur;
check('carré progressif — le côté s\'allonge', true, cN > c1);

// ---------------------------------------------------------------------
// 5. Programmes
// ---------------------------------------------------------------------
section('Programmes');
for (const [id, p] of Object.entries(PROGRAMS)) {
  for (const dur of p.durations) {
    api.setS({ pb: 180, history: [], tables: [], program: { id, duration: dur, startDate: Date.now() } });
    check(`${p.name} ${dur} sem — total de semaines`, dur, api.progTotalWeeks());
    let creneaux = 0, cles = new Set();
    for (let w = 1; w <= dur; w++) {
      const sl = api.progSlots(w);
      creneaux += sl.length;
      sl.forEach(x => cles.add(x.key));
      sl.forEach(x => {
        if (x.t === 'breath') check(`${p.name} — pratique ${x.b} existe`, true, !!BREATH[x.b]);
        if (x.t === 'co2' || x.t === 'o2') check(`${p.name} — difficulté ${x.d} existe`, true, !!DIFF[x.d]);
      });
    }
    check(`${p.name} ${dur} sem — clés de créneaux uniques`, creneaux, cles.size);
    check(`${p.name} ${dur} sem — au moins une séance par semaine`, true, creneaux >= dur);
  }
}

// ---------------------------------------------------------------------
// 6. Cohérence des dictionnaires de traduction
// ---------------------------------------------------------------------
section('Traductions');
const langs = ['en', 'es', 'it'];
const dicts = {};
for (const lg of langs) {
  const p = path.join(ROOT, 'i18n', lg + '.json');
  if (!fs.existsSync(p)) { check(`i18n/${lg}.json — présent`, true, false); continue; }
  try { dicts[lg] = JSON.parse(fs.readFileSync(p, 'utf8')); check(`i18n/${lg}.json — JSON valide`, true, true); }
  catch (e) { check(`i18n/${lg}.json — JSON valide`, true, false); }
}
const cles = Object.keys(dicts.en || {});
for (const lg of langs) {
  if (!dicts[lg]) continue;
  const manquantes = cles.filter(k => dicts[lg][k] === undefined);
  check(`i18n/${lg}.json — mêmes clés que l'anglais`, [], manquantes.slice(0, 5));
  const vides = Object.entries(dicts[lg]).filter(([, v]) => !String(v).trim()).map(([k]) => k);
  check(`i18n/${lg}.json — aucune valeur vide`, [], vides.slice(0, 5));
  // Les marqueurs {0}, {1}… doivent être conservés à l'identique
  const cassees = Object.entries(dicts[lg])
    .filter(([k, v]) => (k.match(/\{\d+\}/g) || []).sort().join() !== (String(v).match(/\{\d+\}/g) || []).sort().join())
    .map(([k]) => k);
  check(`i18n/${lg}.json — marqueurs {n} préservés`, [], cassees.slice(0, 5));
}

// ---------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------
console.log('\n' + '-'.repeat(58));
if (failed) {
  console.log(`${failed} échec(s) sur ${passed + failed} vérifications\n`);
  fails.forEach(f => console.log('  ✗ ' + f + '\n'));
  process.exit(1);
}
console.log(`${passed} vérifications passées — moteur conforme`);
process.exit(0);
