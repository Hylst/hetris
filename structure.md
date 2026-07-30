# Structure de Hetris

## Arborescence

```
hetris-game-development/
├── index.html              # template Vite + bloc SEO complet (lang=fr)
├── package.json            # hetris v1.0.0
├── vite.config.ts          # base '/hetris/', react + tailwind + singlefile
├── tsconfig.json           # TypeScript strict
├── .gitignore              # deps, secrets, fichiers d'agents IA
├── about.md
├── README.md
├── structure.md
├── features.md
├── todo.md                 # l'audit et les idées d'amélioration
├── changelog.md
├── og-image.png            # 1024x576, capture de gameplay
├── favicon.png             # 32x32
├── public/                 # copié tel quel dans dist/
│   ├── favicon.png
│   ├── og-image.png
│   └── og-image.webp
└── src/
    ├── main.tsx            # createRoot + StrictMode
    ├── App.tsx             # tout l'UI et la boucle de jeu
    ├── engine.ts           # logique pure, sans React
    ├── audio.ts            # synthèse Web Audio
    ├── index.css           # @import tailwindcss + keyframes
    └── utils/
        └── cn.ts           # clsx + tailwind-merge
```

## Le découpage

### `engine.ts`, les règles du jeu

Module pur : toutes les fonctions prennent le plateau en paramètre et ne touchent à rien
d'extérieur. Testable en isolation, si un jour l'envie prend.

| Export | Rôle |
|--------|------|
| `BOARD_COLS` / `BOARD_ROWS` | 10 par 20 |
| `TETROMINOES` / `TETROMINO_MATRICES` | les 7 pièces et leur matrice de base |
| `TETROMINO_COLORS` / `TETROMINO_GLOW` | classes Tailwind et ombres par pièce |
| `createEmptyBoard` | plateau vide |
| `rotateMatrix` / `getPieceMatrix` | rotation d'une matrice, matrice pour une rotation donnée |
| `createBag` / `refillBag` | sac de 7 mélangé, réalimenté sous le seuil |
| `isValidPosition` | test de collision (bords et cellules occupées) |
| `tryRotate` | rotation avec wall-kicks testés en cascade |
| `getGhostY` | la ligne où la pièce va atterrir |
| `lockPiece` | grave la pièce dans le plateau |
| `markClearingLines` / `clearLines` | marque les rangées pleines, puis les retire |
| `calculateScore` | barème 100/300/500/800 fois le niveau |
| `getDropSpeed` | intervalle de gravité en ms selon le niveau |
| `spawnPiece` | nouvelle pièce centrée, `null` si la place manque |
| `DIFFICULTY_LEVELS` | 5 modes : multiplicateur de vitesse et rangées de gravats |
| `isInDanger` | vrai si la pile atteint les 5 rangées du haut |

### `App.tsx`, l'état et la boucle

L'état de jeu vit dans des `useRef` (plateau, pièce active, score, niveau, statut) plutôt que
dans des `useState` : la boucle de gravité les mute directement, sans déclencher de render à
chaque fois. Un `forceRender()` recopie ensuite les valeurs utiles dans des états React pour
l'affichage.

Les timers, tous nettoyés au démontage :

| Ref | Rôle |
|-----|------|
| `dropIntervalRef` | la gravité, recréée quand la vitesse change |
| `lockTimerRef` | le lock delay (480 ms) |
| `dasDelayRef` et `dasTimerRef` | amorçage du déplacement continu, puis répétition |
| `clearAnimTimerRef` | l'animation d'effacement de lignes (360 ms) |

Le pattern `xxxRef.current = xxx` dans un `useEffect` (pour `gameTick`, `lockAndClear`,
`scheduleLock`, `bumpLockDelay`, `stopDAS`) permet aux callbacks appelés depuis un timer de
toujours voir la dernière version, sans avoir à recréer les timers à chaque render.

`displayBoard` est recalculé à chaque render, sans `useMemo` : plateau verrouillé, puis les
cellules fantômes, puis la pièce active par-dessus, le tout aplati en 200 cellules.

### `audio.ts`, la synthèse

Un seul `AudioContext` créé à la demande, un `masterGain` pour le volume et le mute.
`tone()`, `chord()` et `noise()` sont les briques de base, les `playXxx()` composent par
dessus. `startMusic(level)` enchaîne les battements et choisit gamme et mélodie selon le
niveau, `updateAmbienceLevel(level)` gère la nappe de fond et le battement de cœur des
niveaux élevés.

## Le rendu

Aucune image dans le jeu : chaque cellule est un `<div>` avec un fond `conic-gradient` et un
`box-shadow`. Les animations (`cell-pop`, `flash`, `board-shake`, `ghost-pulse`,
`danger-pulse`, `scanline`, `orb-drift`, `neon-flicker`) sont des `@keyframes` CSS dans
`index.css`.

La largeur du plateau est plafonnée par la hauteur du viewport
(`min(347px, calc(100vw - 2rem), calc((100vh - 265px) / 2 + 27px))`) pour que les 20 rangées
restent visibles sans scroller, y compris sur un écran 1280x720.

## Le build

`vite-plugin-singlefile` inline le JS et le CSS dans `index.html`. Le `dist/` contient donc
`index.html` (~300 Ko) plus ce qu'il y a dans `public/`. Le `base: '/hetris/'` fait résoudre
le favicon et les assets sous `https://games.hylst.fr/hetris/`.
