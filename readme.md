# Scanner de tickets couture

Application statique HTML/CSS/JavaScript compatible GitHub Pages.
Ouvrir avec Live Server (port 5501), HTTPS ou localhost pour la PWA.

## Saisie et calcul

Ajouter, supprimer, dupliquer et modifier les articles.
La largeur n'intervient jamais dans le calcul.
Sous 50 : quantité × tarif ; à partir de 50 : cm / 100 × tarif.
Chaque ligne est arrondie au centime, puis les montants affichés sont additionnés.
Un prix manuel est conservé ; modifier la quantité ou le tarif relance son calcul.

## Envoi dans le Sheets existant

Le bouton Enregistrer envoie les données à « robe », onglet « Feuille 1 ».
Aucun enregistrement à chaque frappe. Le style des nouveaux blocs est repris automatiquement
du premier tableau existant, sans modifier le CSS du site ni les anciens tableaux.

| Colonne Sheets | Donnée |
|---|---|
| A | Nom |
| B | Référence, conservée en texte avec ses zéros initiaux |
| C | Largeur |
| D | Hauteur / Quantité |
| E | Tarif au m² / unité (selon le modèle actuel) |
| F | Prix (selon le modèle actuel) |
| G | Note, laissée vide |

L'écran présente le tarif avant le prix ; le POST garde son ordre historique,
et le serveur détecte les colonnes Prix et Tarif dans l'en-tête du premier tableau.
Il s'adapte si ces deux colonnes sont inversées dans le modèle.
Chaque tenue est ajoutée sous les tableaux précédents avec son nom, ses articles,
son total dans la colonne Prix et deux lignes de séparation. Les anciens tableaux et notes restent intacts.
Formatting.gs copie seulement les formats de l'en-tête, d'une ligne article et de la ligne TOTAL
du premier tableau. Les valeurs, formules et notes du modèle ne sont jamais copiées.
Les polices, couleurs, bordures et alignements restent donc ceux du classeur existant.
Les hauteurs des nouvelles lignes sont ajustées au contenu ; les largeurs des colonnes ne changent pas.
Un modèle absent ou non reconnu bloque l'écriture avec un message au lieu d'importer sans style.

Le POST contient rows, total, tenue et requestId ; JSON est transmis en text/plain.
Le serveur lit JSON.parse(e.postData.contents) et renvoie le texte « ok ».
Le client vérifie la version du serveur avant d'envoyer, puis attend une confirmation réelle.
Il suit les redirections sans cookies Google et n'utilise pas de mode no-cors opaque.

Un identifiant conservé avec la dernière saisie dans le stockage local évite de dupliquer
le même envoi après une réponse perdue. Une saisie modifiée reçoit un nouvel identifiant.
Un reçu serveur « pending » après panne demande une vérification manuelle ;
ne pas effacer le reçu pour forcer un renvoi sans vérifier les lignes déjà écrites.

## Apps Script

- Code.gs : réception, validation et écriture des données uniquement.
- Formatting.gs : mise en forme automatique par copie des formats du premier tableau existant.
- remote/ : copie du code Google récupérée par clasp.
- release/ : Code.js, Formatting.js et le manifeste réel, préparés avec npm.cmd run google:prepare.
- backups/ : versions locales sauvegardées, exclues de Git.
- Même projet et même URL de déploiement ; aucune modification des autorisations.

Connexion : google-apps-script/CONNEXION.md.
npm.cmd run google:pull sauvegarde remote/ avant récupération.
Ne jamais copier de jetons OAuth dans le code, le chat ou Git.

La version 1 précédemment utilisée attendait nom/prix au lieu de rows et renvoyait du JSON.
La réception minimale avait été publiée en version 33 le 31 octobre 2026.
La mise à jour du 11 novembre ajoute la mise en forme automatique au même déploiement.
GET et POST vide répondent en HTTP 200 avec Access-Control-Allow-Origin: *.
Le POST vide est rejeté avant toute écriture. Le premier enregistrement réel reste
à confirmer avec les données saisies par l'utilisateur.
Ne pas exécuter doPost à la main dans l'éditeur : il attend e.postData.

## Vérifications

npm.cmd test :
- calcul, seuil 50, prix manuel, total et ressources PWA ;
- serveur simulé : bonnes colonnes, références, notes, copie des formats sans copie des valeurs,
  deux lignes vides, doublons et validation avant écriture ;
- site relié au serveur simulé : corps POST, confirmation et erreurs réseau.

node tools/check-sheets-endpoint.cjs :
diagnostic HTTP réel de la version et des en-têtes CORS, puis POST volontairement vide.
Aucun article ne peut être écrit par ce diagnostic.

La copie de test du 31 octobre et son onglet Aperçu envoi du site montrent un prototype
de mise en forme désormais abandonné. Ils ne servent pas de modèle à la correction minimale.
Aucun article de test n'est envoyé à la feuille principale.

## OCR

Choisir une photo JPG/PNG du ticket, nette, droite et éclairée, de 20 Mo maximum.
Le moteur Tesseract français lit la photo dans le navigateur. Son moteur et son modèle
sont téléchargés ; la photo n'est pas envoyée à Google, Gemini ou un serveur OCR.
L'aperçu et la progression restent visibles. Le worker est fermé après chaque lecture.

Le parseur propose plusieurs articles : nom, référence explicite, laize/largeur,
longueur convertie en cm, quantité, tarif et prix payé quand ils sont identifiables.
Il reconnaît notamment les lignes « 1,50 m x 5,99 8,99 », « 5 x 2,00 10,00 »,
les libellés Article, Réf., Laize, Longueur, Qté et PU, et certains codes devant le nom.
Les lignes de total, TVA ou paiement ne deviennent pas des articles.
Une mesure sans libellé n'est pas arbitrairement affectée à la largeur ou à la longueur.
Les valeurs absentes ou contradictoires restent vides ; remises et écarts sont signalés.
Les formats de tickets non reconnus peuvent nécessiter une saisie manuelle.

Les propositions sont ajoutées sans écraser la saisie existante.
Le prix payé lu sur le ticket reste prioritaire ; s'il manque, sa cellule reste vide.
Modifier ensuite quantité ou tarif relance le calcul habituel du site.
Attention aux longueurs inférieures à 50 cm et aux quantités de 50 ou plus : la règle
historique du site ne peut pas les distinguer ; un avertissement le rappelle.

Corriger les cellules, consulter « Voir le texte lu et les points à vérifier », puis cocher
« J’ai vérifié les articles et les montants avec le ticket » avant Enregistrer.
Le scan n'envoie rien dans Sheets : le bouton reste l'unique déclencheur d'enregistrement.
Aucune clé Gemini n'est utilisée et aucun changement Apps Script n'est nécessaire pour ce scan.

Tests ajoutés : parser.cjs (formats, plusieurs articles, champs absents, remises),
ocr.cjs (import, prix conservés, correction, vérification obligatoire, erreurs et aucun envoi).
`npm.cmd run test:ocr-image` exécute le vrai moteur sur tests/fixtures/ticket-demo.png
(ticket fictif lisible, modèle français conservé dans .ocr-cache/, exclu de Git).
Ce test réussit avec les deux articles, leurs références et leurs prix ; il ne garantit
pas la lecture de toutes les photos ou de toutes les présentations de magasins.
Le test navigateur du sélecteur de fichiers reste limité par l'automatisation Chrome.

OCR et enregistrement nécessitent Internet.
Fermer toutes les fenêtres de la PWA puis rouvrir après une mise à jour (cache v5).
