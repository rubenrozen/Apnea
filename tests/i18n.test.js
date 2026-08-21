/* =====================================================================
   INSPIR — couverture des traductions

   Les tests du moteur vérifient que les trois dictionnaires sont
   cohérents entre eux. Ils ne peuvent pas voir qu'une chaîne du source
   n'a jamais été traduite : les fichiers restent alors parfaitement
   cohérents, simplement incomplets.

   Ce fichier ferme la boucle : il extrait du source les chaînes dont on
   est certain qu'elles s'affichent, et vérifie que chacune a une entrée
   dans i18n/en.json.

   Lancer :  node tests/i18n.test.js
   ===================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------------------------------------------------------------------
// Chaînes volontairement non traduites
// ---------------------------------------------------------------------
const EXEMPTIONS = new Set([
  'Inspir',            // nom du produit
  'CO₂', 'O₂', 'MAX', 'NSDR', 'NADI', 'BUT', 'SOUF', 'SUR', 'BOX',
  'CARRÉ', 'CARRÉ+', 'CARRÉ°', 'DÉBUT', 'PROGRAMME',
  'FR', 'EN', 'ES', 'IT',
  'Nadi Shodhana',     // nom propre, identique partout
  'Box breathing',
]);

const estExempt = s =>
  EXEMPTIONS.has(s) ||
  /^[\d\s:./+—·%-]+$/.test(s) ||        // purement numérique ou ponctuation
  !/[A-Za-zÀ-ÿ]{2}/.test(s);           // pas de mot réel

// ---------------------------------------------------------------------
// Extraction — uniquement des motifs sans interpolation, donc fiables
// ---------------------------------------------------------------------
const trouvees = new Map();   // chaîne -> origine

function collecte(regex, origine, groupe = 1) {
  for (const m of src.matchAll(regex)) {
    const s = (m[groupe] || '').trim();
    if (!s || s.includes('${') || s.includes('<') || s.includes('`')) continue;
    if (s.includes('}') || s.includes('"') || s.includes('\\')) continue;
    if (estExempt(s)) continue;
    if (!trouvees.has(s)) trouvees.set(s, origine);
  }
}

// Blocs de texte à classe connue, sans interpolation
for (const cls of ['cd-lead','cd-sub','dial-tap','hint','tile-desc','gate-lede','prog-focus','sub']) {
  collecte(new RegExp(`class="${cls}"[^>]*>([^<${'$'}\`]{3,200})<`, 'g'), 'bloc .' + cls);
}

// Titres portés par un bandeau image : bandImg(src, h, surtitre, titre)
for (const m of src.matchAll(/bandImg\([^,]+,\s*\d+\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g)) {
  for (const g of [m[1], m[2]]) {
    const v = g.replace(/\\'/g, "'").trim();
    if (v && !v.includes('${') && !estExempt(v) && !trouvees.has(v)) trouvees.set(v, 'bandeau image');
  }
}

// Titres et sous-titres d'écran
collecte(/<h1[^>]*>([^<${`]{2,80})<\/h1>/g, 'titre h1');
collecte(/<h2[^>]*>([^<${`]{2,80})<\/h2>/g, 'titre h2');
collecte(/<h3[^>]*>([^<${`]{2,80})<\/h3>/g, 'titre h3');

// Surtitres et étiquettes de champ
collecte(/class="eyebrow"[^>]*>([^<${`]{2,60})</g, 'surtitre');
collecte(/class="lbl"[^>]*>([^<${`]{2,60})</g, 'étiquette');

// Libellés de boutons sans interpolation
collecte(/<button class="btn[^"]*"[^>]*>\s*([^<${`]{2,70}?)\s*<\/button>/g, 'bouton');

// Messages du bandeau
for (const m of src.matchAll(/toast\(\s*'((?:[^'\\`$]|\\.){3,140})'/g)) {
  const s = m[1].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
  if (s && !s.includes('${') && !estExempt(s) && !trouvees.has(s)) trouvees.set(s, 'bandeau');
}

// Appels explicites t('…') — le cas le plus courant dans le code récent
for (const q of ["'", '"']) {
  // Le paramètre nommé « t » de tabbar produit des faux positifs : on exige
  // au moins un espace ou une majuscule, absents des clés de route.
  const re = new RegExp(`(?<![A-Za-zÀ-ÿ_.])t\\(\\s*${q}((?:[^${q}\\\\]|\\\\.){2,200}?)${q}`, 'g');
  for (const m of src.matchAll(re)) {
    const s = m[1].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
    if (!s || s.includes('${') || estExempt(s)) continue;
    if (!/[\s{]/.test(s) && !/[A-ZÀ-Þ]/.test(s)) continue;   // 'home', 'breath'…
    if (!trouvees.has(s)) trouvees.set(s, 'appel t()');
  }
}

// Contenu éditorial : structures de données
function bloc(debut, fin) {
  const a = src.indexOf(debut), b = src.indexOf(fin);
  return (a === -1 || b === -1) ? '' : src.slice(a, b);
}
function champs(texte, cles, origine) {
  for (const c of cles) {
    for (const q of ['"', "'"]) {
      const re = new RegExp(`(?<![A-Za-zÀ-ÿ])${c}:\\s*${q}((?:[^${q}\\\\]|\\\\.)*)${q}`, 'g');
      for (const m of texte.matchAll(re)) {
        const s = m[1].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
        if (!s || s.includes('${') || estExempt(s)) continue;
        if (!trouvees.has(s)) trouvees.set(s, origine);
      }
    }
  }
}

champs(bloc('const RISKS = [', 'let riskChecked'), ['t', 'd'], 'avertissement');
champs(bloc('const BREATH = {', 'function buildBreath'), ['name', 'alt', 'lede', 'how'], 'respiration');
champs(bloc('const PROGRAMS = {', '/* --- lecture'), ['name', 'lede', 'how', 'focus'], 'programme');
champs(bloc('const RPE = [', 'function noteBlock'), ['l', 'd'], 'ressenti');
champs(bloc('const DIFF = {', 'const CO2_REST0'), ['name'], 'difficulté');

// Guide et aide : appels guideSection(id, titre, corps) et faq(id, question, réponse)
for (const m of src.matchAll(/(?:guideSection|faq)\(\s*'[^']*'\s*,\s*(['"])((?:[^\\]|\\.)*?)\1\s*,/g)) {
  const s = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
  if (s && !estExempt(s) && !trouvees.has(s)) trouvees.set(s, 'titre guide / aide');
}

// Corps de texte : littéraux entre accents graves, dont les clés sont
// normalisées (espaces réduits) côté application par tBlock().
for (const m of src.matchAll(/(?:guideSection|faq)\(\s*'[^']*'\s*,\s*(['"])(?:[^\\]|\\.)*?\1\s*,\s*`/g)) {
  let i = m.index + m[0].length;
  const debut = i;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') break;
    i++;
  }
  const corps = src.slice(debut, i).replace(/\s+/g, ' ').trim();
  if (corps && !trouvees.has(corps)) trouvees.set(corps, 'corps guide / aide');
}

// ---------------------------------------------------------------------
// Vérification
// ---------------------------------------------------------------------
const dictPath = path.join(ROOT, 'i18n', 'en.json');
if (!fs.existsSync(dictPath)) {
  console.error('ÉCHEC : i18n/en.json introuvable.');
  process.exit(1);
}
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));

const manquantes = [];
for (const [s, origine] of trouvees) {
  if (dict[s] === undefined) manquantes.push({ s, origine });
}

const total = trouvees.size;
const couvertes = total - manquantes.length;
const pct = total ? Math.floor(couvertes * 1000 / total) / 10 : 100;

console.log(`\nCouverture des traductions : ${couvertes}/${total} (${pct} %)`);

if (manquantes.length) {
  const parOrigine = {};
  manquantes.forEach(({ s, origine }) => (parOrigine[origine] = parOrigine[origine] || []).push(s));

  console.log('\nChaînes affichées mais absentes de i18n/en.json :\n');
  for (const [origine, liste] of Object.entries(parOrigine)) {
    console.log(`  ${origine} (${liste.length})`);
    liste.forEach(s => console.log(`    · ${s.length > 90 ? s.slice(0, 90) + '…' : s}`));
    console.log('');
  }
  console.log("Deux façons de corriger : ajouter l'entrée dans les trois fichiers");
  console.log("de i18n/, ou l'inscrire dans EXEMPTIONS si elle ne doit pas être");
  console.log("traduite (nom propre, sigle).\n");
  process.exit(1);
}

console.log('Toutes les chaînes détectées ont une traduction.\n');
process.exit(0);
