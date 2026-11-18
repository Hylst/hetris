# À propos de Hetris

**Hetris** est un puzzle de blocs qui tombent, développé par **Geoffroy Streit** (alias **Hylst**).

## Le jeu

Le principe, tu le connais : des pièces de quatre cases descendent, tu les tournes et tu les
glisses pour compléter des rangées. Hetris y ajoute une esthétique rétro, un système de
combos et de back-to-back, une réserve de pièce, une pièce fantôme, cinq difficultés avec
gravats offerts au lancement, et une bande-son entièrement synthétisée qui se tend à mesure
que le niveau monte.

Le nom ? Le H de Hylst, et le reste tu devines. Le sous-titre « ça tombe bien », c'était trop
tentant.

Tout est rendu en CSS, il n'y a pas une seule image dans le jeu. Les sons sont générés par la
Web Audio API à l'exécution. Résultat : un fichier HTML de 300 Ko qui tourne hors ligne.

## Le créateur

- Développeur d'applications, ancien graphiste et compositeur
- Adepte de rétrocomputing et de demoscene

## Stack technique

- React 19, TypeScript 5.9 (strict), Tailwind CSS 4
- Vite 7 et vite-plugin-singlefile
- Web Audio API pour tout le son (SFX, musique qui suit le niveau, ambiance)
- Logique de jeu isolée dans `engine.ts`, sans dépendance à React

## Contact

- Email : geoffroy.streit@ik.me
- Plateforme : [games.hylst.fr](https://games.hylst.fr/)
