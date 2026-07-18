# Quiz Pokémon 100 % autonome

`index.html` contient directement les noms français, anglais, espagnols,
allemands, italiens et japonais, ainsi que les 1 025 sprites. Il fonctionne dès
la première ouverture, même si PokeAPI, GitHub ou la connexion Internet sont
indisponibles.

## Aucun téléchargement depuis la page

La page web ne contient ni bouton de mise à jour ni vérification automatique.
Elle n'appelle jamais PokeAPI ou GitHub depuis le navigateur et utilise
exclusivement sa base intégrée. Les visiteurs ne peuvent donc pas déclencher une
mise à jour. L'actualisation de la copie intégrée est réservée au workflow de
construction décrit ci-dessous.

## Fonctions du quiz

- saisie tolérante aux accents, espaces, tirets, apostrophes et variantes de
  Nidoran mâle/femelle ;
- interface entièrement traduite dans les six langues disponibles ;
- sélection de toutes les générations ou d'une génération précise ;
- contre la montre avec durées rapides ou durée exacte personnalisée en heures,
  minutes et secondes ;
- écran d'accueil présentant les fonctions et permettant de préparer la partie ;
- régions affichées avec chaque génération et drapeau dynamique pour la langue ;
- arrière-plan de l'accueil semi-transparent et flouté pour masquer les Pokémon ;
- reconnaissance automatique d'une petite faute après deux secondes sans modification de la saisie ;
- pause sécurisée qui masque le quiz et écran de victoire avec temps réalisé ;
- favicon Poké Ball entièrement intégré au HTML.

## Mise à jour et déploiement GitHub Pages

Le workflow `.github/workflows/update-and-deploy.yml` s'exécute chaque lundi,
sur demande et lors d'un envoi sur `main` ou `master`. Il reconstruit la base
intégrée, enregistre le nouveau `index.html`, puis le déploie sur GitHub Pages.
Avant chaque publication, `tools/validate-quiz.mjs` contrôle automatiquement la
syntaxe, les noms traduits, les sprites PNG, l'autonomie hors ligne et les
fonctions principales. Une copie incomplète n'est donc pas déployée.

Dans les paramètres du dépôt GitHub :

1. autoriser les workflows à lire et écrire le dépôt ;
2. choisir **GitHub Actions** comme source de GitHub Pages ;
3. lancer une première fois le workflow depuis l'onglet **Actions**.

Aucun jeton personnel n'est placé dans le HTML. Le workflow utilise uniquement
le jeton temporaire fourni par GitHub avec les permissions déclarées.

## Autre hébergeur

Exécuter cette commande dans le pipeline de construction avant le déploiement :

```bash
node tools/update-offline-data.mjs index.html
node tools/validate-quiz.mjs index.html
```

Le script n'utilise aucune dépendance npm. Le pipeline peut ensuite publier le
fichier `index.html` selon la procédure habituelle de l'hébergeur.

Sources de mise à jour : [PokeAPI](https://pokeapi.co/) et
[PokeAPI/sprites](https://github.com/PokeAPI/sprites).
