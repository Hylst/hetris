# Changelog de Hetris

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage
[SemVer](https://semver.org/lang/fr/).

## [1.0.0] 2026-07-30

Première version intégrable à Hylst.Games, partie d'un export brut audité puis corrigé.

### Ajouté
- Bloc SEO complet dans `index.html` (description, keywords, og, twitter, robots, canonical,
  theme-color) et `lang="fr"`
- `favicon.png` 32x32, `og-image.png` 1024x576 (vraie capture de gameplay) et sa variante
  `og-image.webp`
- `base: '/hetris/'` dans `vite.config.ts`
- `aria-label` sur les six boutons de contrôle tactile
- La doc : `about.md`, `README.md`, `structure.md`, `features.md`, `todo.md`, `changelog.md`

### Modifié
- Renommé en **Hetris**, sous-titre « ça tombe bien ». Le nom précédent reprenait une marque
  déposée. Titre, HUD, menu, module `tetris.ts` devenu `engine.ts`, libellé du quadruple, clé
  `localStorage`.
- `package.json` : `react-vite-tailwind` v0.0.0 devenu `hetris` v1.0.0
- Le plateau se redimensionne selon la hauteur du viewport : les 20 rangées tiennent
  maintenant à l'écran en 1280x720, où le bas débordait de 107 px
- Boutons tactiles agrandis (~62 px) avec `touch-manipulation`
- Paliers de niveau renommés, les anciens sonnaient générés à la chaîne
- Commentaires du code repassés en français

### Corrigé
- Le déplacement latéral continu n'accélérait jamais : le délai restait bloqué à 170 ms,
  `setInterval` ayant capturé la valeur initiale
- PPS faux : les pièces étaient comptées à l'apparition, et une seconde fois à chaque mise en
  réserve, au lieu d'une fois au verrouillage
- `hold()` continuait de muter l'état après un game over sur échange
- Timer d'animation orphelin : redémarrer avec `R` pendant l'effacement d'une ligne volait une
  pièce et décalait le sac dans la partie suivante
- « Prochain niveau » affichait « 0 lignes » à 0 et à 10 lignes
- Traînée noire derrière la pièce active : `transition-all` sur des fonds `conic-gradient`, que
  le navigateur ne peut pas interpoler
- Les 200 cellules du plateau étaient détruites et recréées à chaque frame (la `key` contenait
  un compteur de render), ce qui relançait l'animation `cell-pop` en boucle
- Les écouteurs clavier étaient réinstallés cinq fois par seconde, `togglePause` dépendant du
  temps écoulé
- Deux fuites de timers au démontage (amorçage du déplacement continu, animation d'effacement)
- Sur téléphone, le plateau arrivait après le score, la réserve, les stats et la difficulté :
  au lancement on ne voyait aucune aire de jeu sans scroller. Le plateau passe maintenant en
  premier en dessous de `lg`

### Supprimé
- Code mort : champ `startLine` des difficultés, fonction `countGarbage`, paramètre `_dy` de
  `move()`
