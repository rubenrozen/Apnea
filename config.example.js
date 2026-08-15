// Copie ce fichier en config.js pour le développement local.
// config.js est ignoré par git : en production il est généré au déploiement
// depuis les secrets du dépôt (voir .github/workflows/deploy.yml).
//
// Rappel : cette clé est publiable et finit visible dans le navigateur.
// C'est normal. La protection des données repose sur les policies RLS.
window.STATIQUE_CONFIG = {
  url: "https://<projet>.supabase.co",
  key: "sb_publishable_..."
};
