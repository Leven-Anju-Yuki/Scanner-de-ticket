# Connexion Google sur téléphone

Le client Corvus existant est de type **Application de bureau** pour Gmail. Le
scanner utilise un client **Application Web** dans son propre projet Cloud
`scanner-de-tickets-couture` (numéro `882018689960`). Corvus reste indépendant.
Ne pas copier le secret ou le refresh token Gmail de Corvus.

Le client **Scanner de tickets Web** a été créé le 11 novembre 2026 dans ce
projet indépendant, avec l'origine `https://leven-anju-yuki.github.io`.
Son identifiant public est intégré dans `Code.gs` (`GOOGLE_WEB_CLIENT_ID`).
La propriété `GOOGLE_OAUTH_CLIENT_ID` peut le remplacer si nécessaire.
La version locale est préparée ; la publication et une connexion réelle restent
à vérifier. Ne pas recréer de client pour finir cette installation.

Les étapes ci-dessous décrivent une future reconfiguration éventuelle.

1. Dans Google Cloud Console, sélectionner le projet `scanner-de-tickets-couture`, puis
   **Google Auth Platform → Clients → Créer un client → Application Web**.
2. Nom : `Scanner de tickets Web`.
3. Dans **Origines JavaScript autorisées**, ajouter :
   - `https://leven-anju-yuki.github.io`
   - `http://127.0.0.1:5501` uniquement pour les essais locaux avec cette adresse.
   Le chemin `/Scanner-de-ticket/` ne fait pas partie de l'origine.
   Le parcours utilise une fenêtre Google : pas d'URI de redirection à ajouter.
4. Copier l'**ID client**, terminé par `.apps.googleusercontent.com`.
   Aucun secret client n'est nécessaire pour le site.
5. Dans le projet Apps Script existant, **Paramètres du projet → Propriétés du
   script → Ajouter une propriété**, enregistrer :
   - nom : `GOOGLE_OAUTH_CLIENT_ID`
   - valeur : l'ID client Web de l'étape 4.
6. Préparer/publier le code Apps Script et le site, puis tester avec le bouton
   **Se connecter avec Google** depuis le site HTTPS. Les scripts actuels locaux
   doivent être publiés avant que le parcours fonctionne sur le site en ligne.

Le serveur utilise l'endpoint Google UserInfo pour vérifier le jeton OAuth et
le courriel vérifié, et n'autorise que le compte du propriétaire exécutant le
déploiement Apps Script. L'authentification ne demande que `openid email`.
Elle ne demande pas l'accès à Gmail ou à tout Drive. Les jetons restent en mémoire,
ne sont pas mis dans les URL ou le stockage local et expirent ; une nouvelle
connexion est alors nécessaire. Déconnexion masque les tableaux de cette page.

Le consentement Google doit être effectué par l'utilisatrice. Si le projet reste
en mode test, son compte doit figurer dans les utilisateurs de test.

Références :
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/openid-connect/reference
