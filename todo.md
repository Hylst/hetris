# TODO de Hetris

Audit fait le 2026-07-30 sur l'export brut (`advanced-tetris-game-development (1).zip`), puis
passe QA dans le navigateur (Playwright + Chromium).

---

## ✅ 2026-08-02 — Retrofit modale « ℹ️ Infos »

- [x] Ajout du bouton « ℹ️ Infos » dans l'en-tête (à côté du statut de partie) et de sa
  modale (stack, graphismes, musique, interactions, architecture, algorithmes notables).
  Contenu vérifié pour être spécifique à Hetris (7-bag, wall kicks, DAS, rendu 100% CSS)
  plutôt que copié du gabarit Crokinole. Vérifié : ouverture/fermeture, aucune erreur
  console, **aucun débordement horizontal en 390×844 vérifié explicitement** (leçon tirée de
  Crokinole, voir mémoire `feedback-verification-rigor`). Voir `todo.md` racine du monorepo,
  Étape 15.

---

## ✅ Corrigé, les bugs

- [x] **Le déplacement continu n'accélérait jamais.** `startDAS` faisait
  `let delay = 170; setInterval(repeat, delay)` puis réassignait `delay = 50` dans le callback.
  Sauf que `setInterval` capture la valeur au moment de l'appel : le délai restait à 170 ms
  pour toujours. Garder une flèche appuyée était donc lent en permanence. Remplacé par un
  `setTimeout` d'amorçage qui démarre ensuite un `setInterval` à 50 ms.
- [x] **Le PPS affiché était faux.** `piecesPlacedRef` était incrémenté à l'apparition de la
  pièce, pas au verrouillage, **et** une seconde fois à chaque mise en réserve. Le compteur
  gonflait tout seul. Maintenant incrémenté une seule fois, dans `lockAndClear`, quand la
  pièce se pose vraiment.
- [x] **`hold()` continuait après un game over.** Si l'échange avec la réserve n'avait plus la
  place de spawner, le code appelait `finishGame()` puis continuait à muter `heldRef` et
  `canHoldRef`. Ajout d'un `return`, plus reset du timer de verrouillage lors d'un échange.
- [x] **Un timer d'animation traînait après un redémarrage.** Le `setTimeout` de 360 ms de
  l'effacement de lignes n'était pas annulé par `startGame`. Appuyer sur `R` pendant qu'une
  ligne s'effaçait faisait spawner une pièce dans la partie neuve et décalait le sac. Le timer
  est maintenant dans `clearAnimTimerRef`, annulé au redémarrage et au démontage.
- [x] **« Prochain niveau » affichait 0 lignes.** `10 - (linesState % 10 || 10)` renvoyait 0 à
  0 ligne et à 10 lignes. C'est `10 - (linesState % 10)`.
- [x] **Deux timers fuyaient au démontage** (`dasDelayRef` et `clearAnimTimerRef`).
- [x] **Les écouteurs clavier étaient réinstallés 5 fois par seconde.** `togglePause`
  dépendait de l'état `elapsedMs`, mis à jour toutes les 200 ms, donc tout l'effet clavier se
  reconstruisait en boucle. Le temps écoulé passe par un ref.

## ✅ Corrigé, la perf et le rendu

- [x] **Les 200 cellules du plateau étaient détruites et recréées à chaque frame.** La `key`
  valait `` `${x}-${y}-${tick}` `` et `tick` change à chaque render. React démontait donc
  tout le plateau 60 fois par seconde, ce qui relançait aussi l'animation `cell-pop` partout
  en continu (d'où un scintillement permanent). `key` stable en `` `${x}-${y}` ``.
- [x] **Traînée noire derrière la pièce qui tombe.** Chaque cellule portait
  `transition-all duration-100`, et les fonds sont des `conic-gradient` que le navigateur ne
  sait pas interpoler : les cellules que la pièce venait de quitter s'affichaient noires
  pendant la transition. Le bug était masqué avant, parce que le remount permanent empêchait
  toute transition de démarrer. Transition retirée, l'animation `cell-pop` suffit.
- [x] **Le bas du plateau passait sous le pli en 720p.** Les cellules étaient dimensionnées
  uniquement par la largeur (`lg:w-8`, donc 32 px), ce qui donnait un plateau de 697 px de
  haut. Sur un portable 1280x720, le bas du plateau tombait à 827 px : les 3 dernières
  rangées étaient invisibles sans scroller, autant jouer à l'aveugle. La largeur est
  maintenant plafonnée par la hauteur dispo via `min()` et `100vh`. Vérifié : bas du plateau à
  642 px pour 720 px de viewport.
- [x] **Sur téléphone, on ouvrait sur un mur de stats.** Les trois colonnes s'empilaient dans
  l'ordre du DOM : score, réserve, stats, difficulté, *puis* le plateau, qui démarrait vers
  760 px sur un 390x844. Autrement dit, au lancement le joueur ne voyait pas du tout l'aire de
  jeu et devait scroller. Ajout de `order-1 lg:order-2` sur le plateau (et `order-2 lg:order-1`
  sur la colonne de gauche) : en dessous de `lg`, le plateau passe devant. Vérifié, plateau
  entièrement visible de 117 à 753 px sur 844 px de haut, boutons tactiles juste en dessous.

## ✅ Corrigé, la cohérence et l'intégration

- [x] Renommé en **Hetris** (« ça tombe bien ») : le nom d'origine reprenait une marque
  déposée. Titre, HUD, menu, module `tetris.ts` devenu `engine.ts`, libellé du quadruple,
  `playTetris()` devenu `playQuad()`, clé `localStorage`. La marque ne subsiste que dans les
  `keywords` SEO, comme descripteur de genre.
- [x] `base: '/hetris/'` ajouté dans `vite.config.ts`, il n'y en avait aucun.
- [x] `index.html` : `lang="en"` corrigé en `lang="fr"`, titre `Tetris` remplacé, bloc SEO
  complet (description, keywords, og, twitter, robots, canonical, theme-color) et
  `<link rel="icon">`.
- [x] `package.json` : `react-vite-tailwind` v0.0.0 devenu `hetris` v1.0.0.
- [x] Code mort viré : champ `startLine` des difficultés (jamais lu), fonction `countGarbage`
  (jamais appelée), paramètre `_dy` de `move()`.
- [x] Accessibilité tactile : `aria-label` sur les 6 boutons mobiles (ils n'affichaient que
  des glyphes), hauteur portée à ~62 px, `touch-manipulation` pour virer le délai de tap.
- [x] Les paliers de niveau ont été renommés, les anciens sonnaient un peu générés à la chaîne.

## ✅ La passe QA navigateur

- [x] 0 erreur console, 0 exception non gérée
- [x] Démarrage, gameplay clavier, score / temps / PPS qui bougent
- [x] Overlays menu, pause, game over
- [x] Redémarrage par `R` en pleine partie (le bug du timer orphelin)
- [x] Viewport mobile 390x844 : aucun débordement horizontal, boutons tactiles opérationnels
- [x] Capture de gameplay récupérée pour `og-image.png` et `og-image.webp`

---

## ⬜ Idées d'amélioration

### Game design
- [ ] **Ajouter une zone tampon au-dessus du plateau.** Les pièces apparaissent en `y = 0` sur
  un plateau de 20 rangées, sans zone d'apparition masquée. Résultat : dès que la pile atteint
  la rangée 1 au centre, le spawn échoue et la partie s'arrête net, sans laisser au joueur la
  moindre chance de décaler la pièce. Les versions modernes réservent 2 rangées invisibles
  au-dessus. Il faudrait passer `BOARD_ROWS` à 22 en n'affichant que les 20 du bas.
- [ ] **Rien n'indique que la pièce va se verrouiller.** Le délai de 480 ms et les 12 resets
  sont bien réglés, mais le joueur ne le voit pas. Faire pulser la pièce quand le timer est
  armé.
- [ ] Le mode Cauchemar (×2.5) combiné au niveau 10 passe sous le plancher de 30 ms : au-delà,
  tous les niveaux se ressemblent. La courbe de `getDropSpeed` mériterait un coup d'œil.
- [ ] Les gravats de départ (`Math.random() < 0.6` par cellule) peuvent générer une ligne
  complète d'entrée, effacée dès la première pose. Forcer au moins un trou par rangée.

### Fonctionnalités
- [ ] Vraie rotation SRS avec une table de wall-kicks par pièce (aujourd'hui c'est une liste
  générique de 11 décalages, donc pas de T-spin fiable)
- [ ] Détection et bonus de T-spin
- [ ] Sauvegarder la partie en cours dans `localStorage` (seul le record est gardé)
- [ ] Un record par difficulté, plutôt qu'un seul record global
- [ ] Remappage des touches
- [ ] Répétition automatique sur les boutons tactiles, comme au clavier
- [ ] Mode sprint 40 lignes et mode ultra 2 minutes

### Technique
- [ ] **Passer la boucle sur `requestAnimationFrame`** au lieu d'un `setInterval` recréé à
  chaque changement de niveau : la gravité dérive dans les onglets en arrière-plan, et la
  descente lente n'est pas synchronisée avec le tick.
- [ ] **L'ordonnancement audio.** `startMusic` enchaîne les temps par `setTimeout` en lisant
  `ctx.currentTime` à chaque battement : sous charge, le tempo tremble. Il faut planifier les
  événements à l'avance sur l'horloge de l'`AudioContext`. Le même correctif a déjà été fait
  sur DonjonFlash.
- [ ] `stopMusic()` n'annule que le `setTimeout` : les oscillateurs déjà planifiés jouent
  jusqu'au bout.
- [ ] Les casts `(cell as any).glow` et `.ghost` contournent le typage, autant étendre
  proprement `DisplayCell`.
- [ ] Zéro test automatisé. La logique pure de `engine.ts` (rotations, wall-kicks, effacement,
  score) serait très facile à couvrir.
