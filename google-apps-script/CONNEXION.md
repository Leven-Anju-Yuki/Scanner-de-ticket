# Connexion au projet existant

Clasp est une dépendance locale : aucune installation globale nécessaire.
L'identifiant du projet existant est dans `.clasp.json` (configuration locale exclue de Git).

1. Avec le compte propriétaire du script, ouvrir https://script.google.com/home/usersettings
   et activer « Google Apps Script API » si elle est désactivée.
2. Dans le terminal VS Code à la racine du scanner : `npm.cmd run google:login`.
   Effectuer la connexion et vérifier les autorisations dans le navigateur.
3. Vérifier la session : `npm.cmd run google:status`.
4. Récupérer le code : `npm.cmd run google:pull`.

Le code distant arrive dans `google-apps-script/remote/`. Les fichiers Code.gs et
Formatting.gs préparés précédemment restent séparés. Avant chaque nouvelle récupération,
la copie locale remote est sauvegardée dans backups/.

Une récupération ne publie rien et ne change pas le script distant ou le tableur.
Ne pas lancer de push avant comparaison et fusion : il remplace le contenu du projet distant.
La publication d'une version et toute modification d'autorisation restent à valider séparément.

Les identifiants OAuth sont enregistrés par clasp dans le profil utilisateur et ne doivent
jamais être copiés dans le chat, le site ou Git. `.clasprc.json` et ses variantes sont exclus.
La connexion clasp permet la gestion du code ; elle ne corrige pas à elle seule l'erreur CORS
du déploiement Web. Cette erreur sera diagnostiquée après récupération du code réel.
