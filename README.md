# Quiz Pokémon 100 % autonome

`index.html` contient directement les noms français, anglais, espagnols,
allemands, italiens et japonais, ainsi que les 1 025 sprites. Il fonctionne dès
la première ouverture, même si PokeAPI, GitHub ou la connexion Internet sont
indisponibles.

## Mise à jour dans le navigateur

La copie intégrée est toujours affichée en premier. Au maximum une fois tous les
sept jours, la page vérifie ensuite PokeAPI en arrière-plan. Les corrections ou
nouveaux Pokémon sont conservés dans IndexedDB. Si cette vérification échoue,
le quiz continue normalement avec sa base intégrée. Le bouton de mise à jour
permet de forcer une vérification immédiate.

## Mise à jour et déploiement GitHub Pages

Le workflow `.github/workflows/update-and-deploy.yml` s'exécute chaque lundi,
sur demande et lors d'un envoi sur `main` ou `master`. Il reconstruit la base
intégrée, enregistre le nouveau `index.html`, puis le déploie sur GitHub Pages.

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
```

Le script n'utilise aucune dépendance npm. Le pipeline peut ensuite publier le
fichier `index.html` selon la procédure habituelle de l'hébergeur.

Sources de mise à jour : [PokeAPI](https://pokeapi.co/) et
[PokeAPI/sprites](https://github.com/PokeAPI/sprites).
