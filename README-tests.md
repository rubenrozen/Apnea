# Tests

## Lancer localement

```
node tests/engine.test.js
```

Code de sortie 0 si tout passe, 1 sinon.

## Ce qui est vérifié

**Les vingt tables STAmina** — en-têtes et totaux de séance, sur des maximums
de 1:30 à 6:00, pour les deux types. C'est le contrôle de non-régression
principal : la formule a été reconstituée par rétro-ingénierie et ne doit
plus bouger.

**La structure** — nombre de phases, alternance repos/apnée, phase finale
« se calmer », durées strictement positives, pour chaque type et chaque
difficulté.

**La monotonie de la difficulté** — facile doit produire moins de temps
d'apnée que normal, qui doit en produire moins que difficile.

**Les tables sur mesure** — comptage des phases, total, et surtout fidélité
de la conversion d'une table calculée en table éditable.

**Les pratiques de respiration** — écart à la durée cible sous 10 %, présence
des libellés de phase, et progression effective du carré progressif.

**Les programmes** — total de semaines conforme à la durée annoncée, unicité
des clés de créneaux, existence des pratiques et difficultés référencées.

**Les dictionnaires de traduction** — JSON valide, mêmes clés dans les trois
langues, aucune valeur vide, marqueurs `{0}` `{1}` préservés à l'identique.

## Fonctionnement

Le fichier extrait le moteur d'`index.html` entre les balises
`==MOTEUR-DEBUT==` et `==MOTEUR-FIN==`, puis l'évalue en isolation avec un
état minimal. Aucune dépendance, aucun `npm install`.

**Ne pas retirer ces balises** d'`index.html` : les tests échoueraient avec
un message explicite plutôt que de passer silencieusement.

## Dans le workflow

Le job `tests` s'exécute avant `build`, qui en dépend. Un échec bloque le
déploiement : l'ancienne version reste en ligne.
