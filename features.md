# Fonctionnalités de Hetris

## Gameplay

- ✅ Les 7 pièces classiques (I, O, T, S, Z, J, L), une couleur chacune
- ✅ Tirage par sac de 7 mélangé, pas de série injuste
- ✅ Rotation dans les deux sens
- ✅ Wall-kicks (11 décalages testés en cascade)
- ✅ Pièce fantôme, pour voir le point de chute
- ✅ Réserve (hold), verrouillée une fois par pièce
- ✅ Les 4 prochaines pièces affichées
- ✅ Descente lente (+1 pt par case) et chute rapide (+2 pts par case)
- ✅ Lock delay de 480 ms, jusqu'à 12 resets par pièce
- ✅ Déplacement latéral continu au maintien (170 ms d'amorçage, puis 50 ms)
- ⬜ Vraie rotation SRS avec table de kicks par pièce
- ⬜ Détection de T-spin
- ⬜ Zone tampon d'apparition (2 rangées masquées au-dessus du plateau)

## Score

- ✅ Barème 100 / 300 / 500 / 800 × niveau
- ✅ Bonus de combo sur les effacements consécutifs
- ✅ Bonus back-to-back sur quadruple ligne
- ✅ Bonus de plateau vidé (1500 × niveau)
- ✅ Record perso en `localStorage`
- ⬜ Un record par difficulté
- ⬜ Bonus de T-spin

## Progression

- ✅ Un niveau tous les 10 lignes
- ✅ La chute accélère à chaque niveau
- ✅ 7 paliers nommés (Tranquille peinard, puis ça se gâte)
- ✅ 5 difficultés, de Facile à Cauchemar
- ✅ Gravats offerts au lancement selon la difficulté (0 à 6 rangées)
- ✅ Bandeau de passage de niveau
- ⬜ Mode sprint 40 lignes
- ⬜ Mode ultra 2 minutes
- ⬜ Mode sans fin avec paliers

## Audio

- ✅ Tout est synthétisé en Web Audio, aucun fichier son
- ✅ SFX : déplacement, rotation, pose, effacement, combo, quadruple, réserve, niveau, game over
- ✅ Musique qui suit le niveau : basse, kick, mélodie, hi-hat, arpèges, puis couche saw
- ✅ Nappe d'ambiance dont la période se resserre quand ça monte
- ✅ Battement de cœur au-delà du niveau 8
- ✅ Alerte sonore quand la pile devient inquiétante
- ✅ Mute et réglage du volume
- ⬜ Ordonnancement précis sur l'horloge AudioContext (tempo stable sous charge)

## Interface

- ✅ HUD complet : score, record, niveau, lignes, temps, PPS, combo, vitesse
- ✅ Barre de progression vers le niveau suivant
- ✅ Libellé de la dernière action (« Quadruple, combo x3, back-to-back »)
- ✅ Aperçu de la réserve et des prochaines pièces
- ✅ Rappel des contrôles à l'écran
- ✅ Plein écran avec HUD compacté
- ✅ Plateau redimensionné pour tenir en hauteur, y compris sur un 720p
- ✅ Effets : scanline, orbes flous, grain, secousse de plateau, pulsation de danger
- ⬜ Remappage des touches
- ⬜ Réglage de l'intensité des effets visuels

## Mobile

- ✅ 6 boutons tactiles (gauche, descente, droite, rotation, chute, réserve)
- ✅ `aria-label` sur chaque bouton
- ✅ Cibles tactiles d'environ 62 px, `touch-manipulation`
- ✅ Aucun débordement horizontal en 390×844
- ✅ Le plateau passe avant les stats sur téléphone, visible en entier sans scroller
- ⬜ Répétition automatique au maintien du bouton
- ⬜ Contrôles au balayage

## Technique

- ✅ Build en un seul fichier (~300 Ko), fonctionne hors ligne
- ✅ TypeScript strict, aucun `any` dans la logique de jeu
- ✅ Logique découplée de React (`engine.ts`)
- ✅ Bloc SEO complet, favicon, og-image (capture réelle du jeu)
- ⬜ Boucle de jeu sur `requestAnimationFrame`
- ⬜ Tests unitaires sur `engine.ts`
