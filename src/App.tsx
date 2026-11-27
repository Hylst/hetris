import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./utils/cn";
import * as Engine from "./engine";
import type { ActivePiece, Board, Tetromino } from "./engine";
import * as Audio from "./audio";

interface DisplayCell {
  color: string;
  clearing: boolean;
  ghost?: boolean;
  glow?: string;
  active?: boolean;
}

const GHOST_GLOW = "0 0 8px rgba(255,255,255,0.25), 0 0 16px rgba(255,255,255,0.1)";

const DAS_INITIAL_MS = 170;
const DAS_REPEAT_MS = 50;
const LINE_CLEAR_ANIM_MS = 360;

// Un palier tous les 3 niveaux, histoire d'annoncer la couleur au joueur
const STAGE_NAMES = [
  "Tranquille peinard",
  "Ça chauffe un peu",
  "Léger vertige",
  "Ça part en vrille",
  "Panique à bord",
  "Sueurs froides",
  "Bon courage",
];

// Vire les lignes et colonnes vides de la matrice, sinon les apercus sont decentres
function trimMatrix(matrix: number[][]): number[][] {
  let top = matrix.length;
  let bottom = -1;
  let left = matrix[0]?.length ?? 0;
  let right = -1;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        top = Math.min(top, r);
        bottom = Math.max(bottom, r);
        left = Math.min(left, c);
        right = Math.max(right, c);
      }
    }
  }
  if (bottom === -1) return [];
  const out: number[][] = [];
  for (let r = top; r <= bottom; r++) {
    out.push(matrix[r].slice(left, right + 1));
  }
  return out;
}

function PiecePreview({
  type,
  label,
  empty = false,
  hint,
  cellSize = 16,
}: {
  type?: Tetromino;
  label?: string;
  empty?: boolean;
  hint?: string;
  cellSize?: number;
}) {
  const trimmed = type ? trimMatrix(Engine.getPieceMatrix(type, 0)) : [];
  const cols = trimmed[0]?.length ?? 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-3 shadow-xl shadow-black/40 backdrop-blur-md">
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</h3>
          {hint && (
            <span className="rounded bg-slate-950/60 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 ring-1 ring-white/10">
              {hint}
            </span>
          )}
        </div>
      )}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ minHeight: cellSize * 2 + 6 }}
      >
        {empty || !type ? (
          <span className="text-xs font-semibold text-slate-600">vide</span>
        ) : (
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${cols}, ${cellSize}px)` }}
          >
            {trimmed.flat().map((cell, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[3px]",
                  cell ? Engine.TETROMINO_COLORS[type] : "bg-transparent"
                )}
                style={{
                  width: cellSize,
                  height: cellSize,
                  boxShadow: cell ? Engine.TETROMINO_GLOW[type] : undefined,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  sub,
  variant = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  variant?: "default" | "cyan" | "emerald" | "yellow";
}) {
  const colorClass =
    variant === "cyan"
      ? "text-cyan-400"
      : variant === "emerald"
      ? "text-emerald-400"
      : variant === "yellow"
      ? "text-yellow-400"
      : "text-white";
  return (
    <div className="rounded-xl bg-slate-950/40 p-2.5 ring-1 ring-white/5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn("text-base font-black tabular-nums", colorClass)}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

export default function App() {
  const boardRef = useRef<Board>(Engine.createEmptyBoard());
  const pieceRef = useRef<ActivePiece | null>(null);
  const heldRef = useRef<Tetromino | null>(null);
  const nextRef = useRef<Tetromino[]>([]);

  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const levelRef = useRef(1);
  const canHoldRef = useRef(true);
  const statusRef = useRef<"running" | "paused" | "gameover" | "menu">("menu");
  const difficultyRef = useRef<(typeof Engine.DIFFICULTY_LEVELS)[number]>(Engine.DIFFICULTY_LEVELS[1]);
  const clearingRef = useRef(false);
  const dropIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const piecesPlacedRef = useRef(0);
  const dangerPulseRef = useRef(0);
  const gameTickRef = useRef<() => void>(() => {});
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockResetsRef = useRef(0);
  const lockAndClearRef = useRef<() => void>(() => {});
  const scheduleLockRef = useRef<() => void>(() => {});
  const bumpLockDelayRef = useRef<() => void>(() => {});

  // DAS = Delayed Auto Shift : la touche maintenue qui part en repetition
  const keyStateRef = useRef<Record<string, boolean>>({});
  const dasTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dasDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopDASRef = useRef<() => void>(() => {});
  const clearAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedMsRef = useRef(0);

  const [, setTick] = useState(0);
  const [scoreState, setScoreState] = useState(0);
  const [linesState, setLinesState] = useState(0);
  const [levelState, setLevelState] = useState(1);
  const [statusState, setStatusState] = useState<"running" | "paused" | "gameover" | "menu">("menu");
  const [difficultyState, setDifficultyState] = useState(difficultyRef.current);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [flashLines, setFlashLines] = useState(false);
  const [comboState, setComboState] = useState(0);
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem("hylst-hetris-best") ?? 0));
  const [lastAction, setLastAction] = useState("");
  const [boardShake, setBoardShake] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [scorePop, setScorePop] = useState(false);
  const [comboPulse, setComboPulse] = useState(false);

  const forceRender = useCallback(() => {
    setTick((t) => t + 1);
    setScoreState(scoreRef.current);
    setLinesState(linesRef.current);
    setLevelState(levelRef.current);
    setStatusState(statusRef.current);
    setComboState(comboRef.current);
  }, []);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const pps = elapsedSeconds > 0 ? (piecesPlacedRef.current / elapsedSeconds).toFixed(2) : "0.00";

  const finishGame = useCallback(() => {
    statusRef.current = "gameover";
    if (scoreRef.current > bestScore) {
      setBestScore(scoreRef.current);
      localStorage.setItem("hylst-hetris-best", String(scoreRef.current));
      setLastAction("Nouveau record personnel");
    }
    Audio.playGameOver();
    Audio.stopMusic();
    Audio.stopAmbience();
    forceRender();
  }, [bestScore, forceRender]);

  const clearLockTimer = useCallback(() => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const pieceCanFall = useCallback(() => {
    if (!pieceRef.current) return false;
    return Engine.isValidPosition(
      boardRef.current,
      pieceRef.current.matrix,
      pieceRef.current.x,
      pieceRef.current.y + 1
    );
  }, []);

  const spawnNextPiece = useCallback(() => {
    clearLockTimer();
    lockResetsRef.current = 0;
    nextRef.current = Engine.refillBag(nextRef.current);
    const type = nextRef.current.shift()!;
    const piece = Engine.spawnPiece(boardRef.current, type);
    if (!piece) {
      finishGame();
    } else {
      pieceRef.current = piece;
    }
  }, [clearLockTimer, finishGame]);

  const lockAndClear = useCallback(() => {
    if (!pieceRef.current) return;
    Engine.lockPiece(boardRef.current, pieceRef.current);
    piecesPlacedRef.current += 1;

    const clearingIndices = Engine.markClearingLines(boardRef.current);
    if (clearingIndices.length > 0) {
      clearingRef.current = true;
      setFlashLines(true);
      setBoardShake(true);
      setTimeout(() => setBoardShake(false), 320);
      Audio.playClear(clearingIndices.length);

      clearAnimTimerRef.current = setTimeout(() => {
        clearAnimTimerRef.current = null;
        const cleared = Engine.clearLines(boardRef.current);
        setFlashLines(false);
        clearingRef.current = false;

        if (cleared > 0) {
          comboRef.current += 1;
          linesRef.current += cleared;
          const baseScore = Engine.calculateScore(cleared, levelRef.current);
          const comboBonus = Math.max(0, comboRef.current - 1) * 50 * levelRef.current;
          const backToBack = cleared === 4;
          const b2bBonus = backToBack ? 400 * levelRef.current : 0;
          scoreRef.current += baseScore + comboBonus + b2bBonus;

          const perfectClear = boardRef.current.every((row) => row.every((cell) => cell === null));
          if (perfectClear) scoreRef.current += 1500 * levelRef.current;

          const action =
            cleared === 4 ? "Quadruple" : cleared === 3 ? "Triple" : `${cleared} ligne${cleared > 1 ? "s" : ""}`;
          setLastAction(
            `${action}${comboRef.current > 1 ? ` - combo x${comboRef.current}` : ""}${
              backToBack ? " - back-to-back" : ""
            }${perfectClear ? " - plateau vide" : ""}`
          );

          setScorePop(true);
          setTimeout(() => setScorePop(false), 260);

          if (comboRef.current > 1) {
            setComboPulse(true);
            setTimeout(() => setComboPulse(false), 600);
            Audio.playCombo(comboRef.current);
          }
          if (cleared === 4 || perfectClear) Audio.playQuad();

          const oldLevel = levelRef.current;
          levelRef.current = Math.floor(linesRef.current / 10) + 1;
          if (levelRef.current > oldLevel) {
            setShowLevelUp(true);
            Audio.playLevelUp();
            Audio.startMusic(levelRef.current);
            Audio.updateAmbienceLevel(levelRef.current);
            setTimeout(() => setShowLevelUp(false), 1600);
          }
        }

        canHoldRef.current = true;
        spawnNextPiece();
        forceRender();

        if (dropIntervalRef.current) clearInterval(dropIntervalRef.current);
        if (statusRef.current === "running") {
          const speed = Math.max(30, Engine.getDropSpeed(levelRef.current) / difficultyRef.current.speedMult);
          dropIntervalRef.current = setInterval(() => gameTickRef.current(), speed);
        }
      }, LINE_CLEAR_ANIM_MS);
    } else {
      comboRef.current = 0;
      setComboState(0);
      canHoldRef.current = true;
      spawnNextPiece();
      forceRender();
    }
  }, [forceRender, spawnNextPiece]);

  const startGame = useCallback(() => {
    if (dropIntervalRef.current) clearInterval(dropIntervalRef.current);
    // Si une anim d'effacement traine encore, elle va spawner une piece dans la
    // partie toute neuve et decaler le sac. Non merci.
    if (clearAnimTimerRef.current) {
      clearTimeout(clearAnimTimerRef.current);
      clearAnimTimerRef.current = null;
    }
    clearLockTimer();
    stopDASRef.current();
    boardRef.current = Engine.createEmptyBoard();

    const diff = difficultyRef.current;
    for (let row = Engine.BOARD_ROWS - 1; row >= Engine.BOARD_ROWS - diff.height; row--) {
      if (row < 0) break;
      for (let c = 0; c < Engine.BOARD_COLS; c++) {
        if (Math.random() < 0.6) {
          const junkType = Engine.TETROMINOES[Math.floor(Math.random() * Engine.TETROMINOES.length)];
          boardRef.current[row][c] = { color: Engine.TETROMINO_COLORS[junkType], clearing: false };
        }
      }
    }

    pieceRef.current = null;
    heldRef.current = null;
    nextRef.current = Engine.createBag();
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = 1;
    comboRef.current = 0;
    canHoldRef.current = true;
    statusRef.current = "running";
    clearingRef.current = false;
    startTimeRef.current = Date.now();
    piecesPlacedRef.current = 0;
    dangerPulseRef.current = 0;
    setFlashLines(false);
    setShowLevelUp(false);
    setComboState(0);
    elapsedMsRef.current = 0;
    setElapsedMs(0);
    setLastAction("Partie lancée");

    Audio.resumeAudio();
    Audio.startMusic(1);
    Audio.updateAmbienceLevel(1);

    spawnNextPiece();
    forceRender();

    const speed = Math.max(30, Engine.getDropSpeed(1) / difficultyRef.current.speedMult);
    dropIntervalRef.current = setInterval(() => gameTickRef.current(), speed);
  }, [clearLockTimer, forceRender, spawnNextPiece]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "gameover" || statusRef.current === "menu") return;
    const next = statusRef.current === "running" ? "paused" : "running";
    statusRef.current = next;

    if (next === "paused") {
      if (dropIntervalRef.current) clearInterval(dropIntervalRef.current);
      clearLockTimer();
      Audio.stopMusic();
      Audio.stopAmbience();
    } else {
      const speed = Math.max(30, Engine.getDropSpeed(levelRef.current) / difficultyRef.current.speedMult);
      dropIntervalRef.current = setInterval(() => gameTickRef.current(), speed);
      Audio.startMusic(levelRef.current);
      Audio.updateAmbienceLevel(levelRef.current);
      startTimeRef.current = Date.now() - elapsedMsRef.current;
    }
    forceRender();
  }, [clearLockTimer, forceRender]);

  const move = useCallback(
    (dx: number): boolean => {
      if (statusRef.current !== "running" || !pieceRef.current || clearingRef.current) return false;
      if (
        Engine.isValidPosition(
          boardRef.current,
          pieceRef.current.matrix,
          pieceRef.current.x + dx,
          pieceRef.current.y
        )
      ) {
        pieceRef.current.x += dx;
        Audio.playMove();
        bumpLockDelayRef.current();
        forceRender();
        return true;
      }
      return false;
    },
    [forceRender]
  );

  const rotate = useCallback(
    (direction: 1 | -1) => {
      if (statusRef.current !== "running" || !pieceRef.current || clearingRef.current) return;
      const rotated = Engine.tryRotate(boardRef.current, pieceRef.current, direction);
      if (rotated) {
        pieceRef.current = rotated;
        Audio.playRotate();
        bumpLockDelayRef.current();
        forceRender();
      }
    },
    [forceRender]
  );

  const softDrop = useCallback(() => {
    if (statusRef.current !== "running" || !pieceRef.current || clearingRef.current) return;
    if (
      Engine.isValidPosition(
        boardRef.current,
        pieceRef.current.matrix,
        pieceRef.current.x,
        pieceRef.current.y + 1
      )
    ) {
      pieceRef.current.y += 1;
      scoreRef.current += 1;
      Audio.playMove();
      forceRender();
    } else {
      scheduleLockRef.current();
    }
  }, [forceRender]);

  const hardDrop = useCallback(() => {
    if (statusRef.current !== "running" || !pieceRef.current || clearingRef.current) return;
    let dropped = 0;
    while (
      Engine.isValidPosition(
        boardRef.current,
        pieceRef.current.matrix,
        pieceRef.current.x,
        pieceRef.current.y + 1
      )
    ) {
      pieceRef.current.y += 1;
      dropped++;
    }
    scoreRef.current += dropped * 2;
    Audio.playDrop();
    clearLockTimer();
    lockAndClear();
    forceRender();
  }, [clearLockTimer, lockAndClear, forceRender]);

  const hold = useCallback(() => {
    if (!canHoldRef.current || statusRef.current !== "running" || !pieceRef.current || clearingRef.current) return;
    const currentType = pieceRef.current.type;
    const heldType = heldRef.current;

    if (heldType) {
      const spawned = Engine.spawnPiece(boardRef.current, heldType);
      if (!spawned) {
        finishGame();
        return;
      }
      pieceRef.current = spawned;
    } else {
      spawnNextPiece();
    }

    heldRef.current = currentType;
    canHoldRef.current = false;
    clearLockTimer();
    lockResetsRef.current = 0;
    Audio.playHold();
    forceRender();
  }, [clearLockTimer, finishGame, forceRender, spawnNextPiece]);

  const scheduleLock = useCallback(() => {
    if (lockTimerRef.current) return; // already pending
    lockTimerRef.current = setTimeout(() => {
      lockTimerRef.current = null;
      if (statusRef.current !== "running" || !pieceRef.current) return;
      if (!pieceCanFall()) {
        lockAndClearRef.current();
      } else {
        forceRender();
      }
    }, 480);
  }, [pieceCanFall, forceRender]);

  // Apres un move ou un rotate reussi : on rend un peu de temps au joueur colle au sol
  const bumpLockDelay = useCallback(() => {
    if (lockTimerRef.current && !pieceCanFall() && lockResetsRef.current < 12) {
      lockResetsRef.current += 1;
      clearLockTimer();
      scheduleLock();
    } else if (pieceCanFall()) {
      clearLockTimer();
    }
  }, [pieceCanFall, clearLockTimer, scheduleLock]);

  const gameTick = useCallback(() => {
    if (statusRef.current !== "running" || !pieceRef.current || clearingRef.current) return;
    if (pieceCanFall()) {
      pieceRef.current.y += 1;
      forceRender();
    } else {
      scheduleLock();
    }
  }, [forceRender, pieceCanFall, scheduleLock]);

  useEffect(() => {
    gameTickRef.current = gameTick;
  }, [gameTick]);

  useEffect(() => {
    lockAndClearRef.current = lockAndClear;
  }, [lockAndClear]);

  useEffect(() => {
    scheduleLockRef.current = scheduleLock;
  }, [scheduleLock]);

  useEffect(() => {
    bumpLockDelayRef.current = bumpLockDelay;
  }, [bumpLockDelay]);

  const setDifficulty = useCallback(
    (d: (typeof Engine.DIFFICULTY_LEVELS)[number]) => {
      difficultyRef.current = d;
      setDifficultyState(d);
    },
    []
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // le DAS, donc
  const stopDAS = useCallback(() => {
    if (dasDelayRef.current) {
      clearTimeout(dasDelayRef.current);
      dasDelayRef.current = null;
    }
    if (dasTimerRef.current) {
      clearInterval(dasTimerRef.current);
      dasTimerRef.current = null;
    }
  }, []);

  const startDAS = useCallback(
    (direction: number) => {
      stopDAS();
      move(direction);
      dasDelayRef.current = setTimeout(() => {
        dasDelayRef.current = null;
        dasTimerRef.current = setInterval(() => move(direction), DAS_REPEAT_MS);
      }, DAS_INITIAL_MS);
    },
    [move, stopDAS]
  );

  useEffect(() => {
    stopDASRef.current = stopDAS;
  }, [stopDAS]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "z", "Z", "x", "X", "c", "C", "p", "P", "r", "R"].includes(key)) {
        e.preventDefault();
      }

      if (keyStateRef.current[key]) return;
      keyStateRef.current[key] = true;

      if (statusRef.current === "menu") {
        if (key === "Enter" || key === " ") startGame();
        return;
      }

      switch (key) {
        case "ArrowLeft":
          startDAS(-1);
          break;
        case "ArrowRight":
          startDAS(1);
          break;
        case "ArrowDown":
          softDrop();
          break;
        case "ArrowUp":
        case "x":
        case "X":
          rotate(1);
          break;
        case "z":
        case "Z":
          rotate(-1);
          break;
        case " ":
          hardDrop();
          break;
        case "c":
        case "C":
          hold();
          break;
        case "p":
        case "P":
          togglePause();
          break;
        case "r":
        case "R":
          startGame();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keyStateRef.current[e.key] = false;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        stopDAS();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [startDAS, stopDAS, move, softDrop, rotate, hardDrop, hold, togglePause, startGame]);

  useEffect(() => {
    return () => {
      if (dropIntervalRef.current) clearInterval(dropIntervalRef.current);
      if (dasTimerRef.current) clearInterval(dasTimerRef.current);
      if (dasDelayRef.current) clearTimeout(dasDelayRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (clearAnimTimerRef.current) clearTimeout(clearAnimTimerRef.current);
      Audio.stopMusic();
      Audio.stopAmbience();
    };
  }, []);

  useEffect(() => {
    if (statusState !== "running") return;
    const id = setInterval(() => {
      elapsedMsRef.current = Date.now() - startTimeRef.current;
      setElapsedMs(elapsedMsRef.current);
    }, 200);
    return () => clearInterval(id);
  }, [statusState]);

  useEffect(() => {
    Audio.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    Audio.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (statusState !== "running") return;
    let lastDangerSound = 0;
    const id = setInterval(() => {
      const danger = Engine.isInDanger(boardRef.current);
      if (danger) {
        dangerPulseRef.current = 1;
        const now = Date.now();
        if (now - lastDangerSound > 2500) {
          lastDangerSound = now;
          Audio.playDanger();
        }
      } else {
        dangerPulseRef.current = 0;
      }
    }, 500);
    return () => clearInterval(id);
  }, [statusState]);

  // Plateau d'affichage recalcule a chaque render. Pas de useMemo : ca doit suivre chaque tick.
  const displayBoard: (DisplayCell | null)[] = (() => {
    const display: (DisplayCell | null)[][] = boardRef.current.map((row) =>
      row.map((c) => (c ? { color: c.color, clearing: c.clearing } : null))
    );

    if (pieceRef.current && !clearingRef.current) {
      const ghostY = Engine.getGhostY(boardRef.current, pieceRef.current);
      for (let r = 0; r < pieceRef.current.matrix.length; r++) {
        for (let c = 0; c < pieceRef.current.matrix[r].length; c++) {
          if (pieceRef.current.matrix[r][c]) {
            const by = ghostY + r;
            const bx = pieceRef.current.x + c;
            if (by >= 0 && by < Engine.BOARD_ROWS && bx >= 0 && bx < Engine.BOARD_COLS && !display[by][bx]) {
              display[by][bx] = { color: "ghost", clearing: false, ghost: true };
            }
          }
        }
      }
      for (let r = 0; r < pieceRef.current.matrix.length; r++) {
        for (let c = 0; c < pieceRef.current.matrix[r].length; c++) {
          if (pieceRef.current.matrix[r][c]) {
            const by = pieceRef.current.y + r;
            const bx = pieceRef.current.x + c;
            if (by >= 0 && by < Engine.BOARD_ROWS && bx >= 0 && bx < Engine.BOARD_COLS) {
              display[by][bx] = {
                color: Engine.TETROMINO_COLORS[pieceRef.current.type],
                clearing: false,
                glow: Engine.TETROMINO_GLOW[pieceRef.current.type],
                active: true,
              };
            }
          }
        }
      }
    }
    return display.flat();
  })();

  const nextThree = nextRef.current.slice(0, 4);
  const stageName = STAGE_NAMES[Math.min(STAGE_NAMES.length - 1, Math.floor((levelState - 1) / 3))];
  const linesToNextLevel = 10 - (linesState % 10);
  const progressToNext = ((linesState % 10) / 10) * 100;
  const effectiveSpeed = Math.max(30, Engine.getDropSpeed(levelState) / difficultyState.speedMult);
  // Le plateau doit tenir dans la hauteur de l'ecran, sinon les dernieres rangees
  // passent sous le pli et on joue a l'aveugle. 10 colonnes + 9 gouttieres de 3px.
  const boardWidth = isFullscreen
    ? "min(467px, calc(100vw - 2rem), calc((100vh - 153px) / 2 + 27px))"
    : "min(347px, calc(100vw - 2rem), calc((100vh - 265px) / 2 + 27px))";
  const inDanger = statusState === "running" && Engine.isInDanger(boardRef.current);

  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 5,
        opacity: 0.15 + Math.random() * 0.45,
        size: 1 + Math.random() * 2,
      })),
    []
  );

  return (
    <div className="relative min-h-screen select-none overflow-hidden bg-[#050510] text-slate-100">
      {/* la grille de fond */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* grain de pellicule, 2% d'opacite, juste pour salir un peu */}
      <div
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* les grosses taches floues qui derivent */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb-drift absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/15 blur-[100px]" />
        <div className="orb-drift absolute -right-24 bottom-0 h-[32rem] w-[32rem] rounded-full bg-violet-500/15 blur-[100px] [animation-delay:2s]" />
        <div className="orb-drift absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-rose-500/10 blur-[80px] [animation-delay:4s]" />
        <div className="scanline absolute left-0 top-0 h-32 w-full bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent" />
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute animate-pulse rounded-full bg-white"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {!isFullscreen && (
        <header className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-2 px-4 pt-4 sm:pt-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-300/80">
              Hylst - Geoffroy
            </div>
            <h1 className="neon-flicker mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">
              <span className="text-cyan-400">H</span>etris
            </h1>
            <div className="mt-0.5 text-[11px] font-semibold lowercase tracking-wide text-slate-500">
              ça tombe bien
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="hidden rounded-full border border-white/10 bg-slate-900/70 px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md sm:block">
              {statusState === "running"
                ? "Partie en cours"
                : statusState === "paused"
                ? "En pause"
                : statusState === "gameover"
                ? "Partie terminée"
                : "Menu principal"}
            </div>
            <button
              onClick={() => setShowInfo(true)}
              title="Comment ce jeu a été fait"
              className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 backdrop-blur-md transition-all hover:bg-slate-800/70 hover:text-white"
            >
              ℹ️ Infos
            </button>
          </div>
        </header>
      )}

      {/* modale « Comment ce jeu a ete fait » */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/95 to-slate-900/95 p-7 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-2xl font-black text-white">Comment ce jeu a été fait</h3>
            <div className="space-y-3.5 text-sm leading-relaxed text-slate-300">
              <p><strong className="text-cyan-300">Stack :</strong> React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7, compilé en un seul fichier HTML, aucune dépendance chargée depuis l'extérieur.</p>
              <p><strong className="text-cyan-300">Graphismes :</strong> aucun Canvas ni sprite, la grille est une simple grille CSS de <code>&lt;div&gt;</code>, une par cellule, colorée avec un dégradé conique Tailwind propre à chaque piece. La lueur des pieces et de l'écran vient de <code>box-shadow</code> et de filtres CSS, pas d'un moteur de rendu.</p>
              <p><strong className="text-cyan-300">Musique &amp; sons :</strong> entièrement synthétisés en direct avec l'API Web Audio (oscillateurs), aucun fichier audio chargé. La musique s'adapte au niveau, avec des basses de tension et un battement de cœur qui accélère quand la pile de pieces approche du sommet.</p>
              <p><strong className="text-cyan-300">Interactions :</strong> clavier et boutons tactiles (flèches, espace pour la chute rapide, X/Z pour tourner, C pour la réserve). Le maintien d'une touche de déplacement utilise un DAS (délai avant répétition de 170 ms, puis répétition toutes les 50 ms), comme les vrais jeux de chute de pieces.</p>
              <p><strong className="text-cyan-300">Architecture :</strong> la logique pure (plateau, pieces, collisions, score) vit dans un module séparé sans aucune dépendance au DOM, entièrement testable hors navigateur ; l'affichage et les contrôles vivent dans le composant React.</p>
              <p><strong className="text-cyan-300">Algorithmes notables :</strong> tirage des pieces par « sac de 7 » (les 7 formes mélangées une fois, jamais deux fois la même piece coup sur coup au-delà d'un sac), rotation par matrice avec correction de position façon SRS (11 décalages testés dans l'ordre pour éviter qu'une piece bloque contre un mur ou un tas), piece fantôme calculée en simulant sa chute jusqu'à collision.</p>
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 py-3 text-center font-black uppercase tracking-wider text-slate-950 transition-all active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* bandeau de passage de niveau */}
      {showLevelUp && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          <div className="banner-in rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400 to-orange-500 px-14 py-8 text-center shadow-[0_0_80px_rgba(249,115,22,0.5)]">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/90">Niveau {levelState}</p>
            <p className="mt-2 text-4xl font-black text-white drop-shadow-xl">NIVEAU SUPERIEUR</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/80">{stageName}</p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "relative z-10 mx-auto flex flex-col items-center gap-4 px-3 py-4 sm:px-4 sm:py-6 lg:flex-row lg:items-start lg:justify-center lg:gap-6 lg:py-8",
          isFullscreen ? "max-w-full lg:items-center" : "max-w-7xl"
        )}
      >
        {/* colonne de gauche : score, reserve, stats, difficulte */}
        {/* order-2 : sur telephone le plateau passe devant, sinon on ouvre sur un mur de stats */}
        <div className="order-2 flex w-full flex-row flex-wrap justify-center gap-3 sm:w-auto lg:order-1 lg:w-52 lg:flex-col lg:gap-4">
          {/* score */}
          <div className="flex-1 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Score</div>
            <div className={cn("text-4xl font-black tabular-nums tracking-tight text-white", scorePop && "score-pop")}>
              {scoreState.toLocaleString()}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">Record</span>
              <span className="font-black text-yellow-300">{bestScore.toLocaleString()}</span>
            </div>
            {lastAction && (
              <div className="mt-3 rounded-xl bg-cyan-400/10 px-3 py-1.5 text-center text-xs font-bold text-cyan-200 ring-1 ring-cyan-300/20">
                {lastAction}
              </div>
            )}
          </div>

          {/* la reserve : on met une piece de cote avec C */}
          <PiecePreview
            type={heldRef.current ?? undefined}
            label="Réserve (C)"
            hint={canHoldRef.current ? "prête" : "utilisée"}
            empty={!heldRef.current}
          />

          {/* stats */}
          {!isFullscreen && (
            <div className="flex-1 space-y-3 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-2xl backdrop-blur-xl">
              <StatBox label="Zone" value={stageName} />
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Niveau" value={levelState} variant="cyan" />
                <StatBox label="Lignes" value={linesState} variant="emerald" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Prochain niveau</span>
                  <span>{linesToNextLevel} lignes</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-950/70 ring-1 ring-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${progressToNext}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Temps" value={timeString} />
                <StatBox label="PPS" value={pps} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={cn(
                    "rounded-xl p-2.5 ring-1 transition-all",
                    comboPulse ? "combo-pulse ring-yellow-400/30 bg-yellow-400/10" : "ring-white/5 bg-slate-950/40"
                  )}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Combo</div>
                  <div className={cn("text-xl font-black", comboState > 1 ? "text-yellow-400" : "text-white")}>
                    x{comboState}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950/40 p-2.5 ring-1 ring-white/5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vitesse</div>
                  <div className="text-base font-black text-white">
                    {Math.round(effectiveSpeed)}
                    <span className="text-[10px] font-medium text-slate-500">ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* version compacte en plein ecran */}
          {isFullscreen && (
            <div className="flex-1 space-y-2 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-2xl backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Niveau" value={levelState} variant="cyan" />
                <StatBox label="Lignes" value={linesState} variant="emerald" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-950/70 ring-1 ring-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
            </div>
          )}

          {/* difficulte */}
          {!isFullscreen && (
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Difficulté</div>
              <div className="flex flex-wrap gap-1.5">
                {Engine.DIFFICULTY_LEVELS.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => setDifficulty(d)}
                    disabled={statusState === "running"}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all duration-200",
                      difficultyState.name === d.name
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25"
                        : "bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-50"
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* LE PLATEAU */}
        <div className="relative order-1 lg:order-2">
          <div
            className={cn(
              "relative rounded-3xl border-[3px] bg-slate-950/80 p-2 shadow-[0_0_80px_rgba(0,0,0,0.7)] backdrop-blur-sm transition-all duration-200",
              inDanger
                ? "danger-pulse border-rose-500/60"
                : flashLines
                ? "border-white/50 shadow-[0_0_80px_rgba(255,255,255,0.2)]"
                : "border-slate-700/80",
              boardShake && "board-shake"
            )}
          >
            <div
              className="absolute inset-2 rounded-2xl opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
                backgroundSize: "calc(100% / 10) calc(100% / 20)",
              }}
            />
            <div
              className="relative grid gap-[3px]"
              style={{
                gridTemplateColumns: `repeat(${Engine.BOARD_COLS}, minmax(0, 1fr))`,
                width: boardWidth,
              }}
            >
              {displayBoard.map((cell, i) => {
                const x = i % Engine.BOARD_COLS;
                const y = Math.floor(i / Engine.BOARD_COLS);
                const cellGlow = cell && "glow" in cell ? (cell as any).glow : undefined;
                const isGhost = cell && "ghost" in cell ? (cell as any).ghost : false;

                return (
                  <div
                    key={`${x}-${y}`}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-[4px] border",
                      cell
                        ? cell.clearing
                          ? "animate-[flash_0.36s_ease-in-out] border-white/80 bg-white shadow-[0_0_30px_white]"
                          : isGhost
                          ? "ghost-pulse border-white/25 bg-white/10"
                          : cn("cell-pop", cell.color)
                        : "border-slate-800/70 bg-slate-900/60"
                    )}
                    style={
                      cell && !cell.clearing && !isGhost && cellGlow
                        ? { boxShadow: cellGlow }
                        : isGhost
                        ? { boxShadow: GHOST_GLOW }
                        : undefined
                    }
                  >
                    {!isGhost && cell && !cell.clearing && (
                      <>
                        <div
                          className="absolute -left-1/2 -top-1/2 h-full w-full rounded-full bg-white/20 blur-sm"
                          style={{ transform: "translate(25%, 25%)" }}
                        />
                        <div className="absolute inset-0 rounded-[3px] bg-gradient-to-br from-white/25 via-transparent to-black/20" />
                        <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* overlay menu / pause / game over */}
          {(statusState === "paused" || statusState === "gameover" || statusState === "menu") && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl bg-slate-950/90 backdrop-blur-lg">
              <div className="text-center">
                {statusState === "menu" ? (
                  <>
                    <h2 className="text-5xl font-black tracking-tighter text-white drop-shadow-2xl sm:text-6xl">
                      <span className="text-cyan-400">H</span>etris
                    </h2>
                    <p className="mt-2 text-lg font-semibold lowercase tracking-wide text-cyan-200/70">
                      ça tombe bien
                    </p>
                    <p className="mt-4 text-sm uppercase tracking-widest text-slate-400">
                      Créé par Hylst - Geoffroy avec l&apos;aide d&apos;une IA
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-4xl font-black tracking-tighter text-white drop-shadow-2xl">
                      {statusState === "paused" ? "Pause" : "Partie terminée"}
                    </h2>
                    {statusState === "gameover" && (
                      <div className="mt-4 space-y-1 text-slate-300">
                        <p className="text-lg">
                          Score : <span className="font-black text-cyan-400">{scoreState.toLocaleString()}</span>
                        </p>
                        <p className="text-xs uppercase tracking-wider text-slate-500">
                          {scoreState >= bestScore && scoreState > 0
                            ? "Nouveau record personnel"
                            : `Record : ${bestScore.toLocaleString()}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Temps {timeString} · {linesState} lignes · Niveau {levelState}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <button
                  onClick={statusState === "paused" ? togglePause : startGame}
                  className="mt-8 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-10 py-4 text-lg font-black uppercase tracking-wider text-white shadow-2xl shadow-cyan-500/30 transition-all hover:from-cyan-400 hover:to-blue-500 hover:shadow-cyan-400/40 active:scale-95"
                >
                  {statusState === "paused" ? "Reprendre" : "Jouer"}
                </button>
                {statusState === "menu" && (
                  <p className="mt-4 text-xs text-slate-500">Appuyez sur Entrée ou Espace pour commencer</p>
                )}
              </div>
            </div>
          )}

          {/* boutons tactiles */}
          <div className="mt-4 grid grid-cols-6 gap-2 lg:hidden">
            {[
              { label: "←", name: "Déplacer à gauche", fn: () => move(-1) },
              { label: "↓", name: "Descente lente", fn: () => softDrop() },
              { label: "→", name: "Déplacer à droite", fn: () => move(1) },
              { label: "↻", name: "Rotation", fn: () => rotate(1), accent: "cyan" },
              { label: "↡", name: "Chute rapide", fn: () => hardDrop(), accent: "orange" },
              { label: "C", name: "Réserve", fn: () => hold(), accent: "violet" },
            ].map((btn) => (
              <button
                key={btn.label}
                aria-label={btn.name}
                onTouchStart={(e) => {
                  e.preventDefault();
                  btn.fn();
                }}
                onClick={btn.fn}
                className={cn(
                  "select-none touch-manipulation rounded-xl py-4 text-lg font-black active:scale-95",
                  btn.accent === "cyan"
                    ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : btn.accent === "orange"
                    ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20"
                    : btn.accent === "violet"
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"
                    : "border border-white/10 bg-slate-800/80 text-slate-200"
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* colonne de droite : prochaines pieces, controles, audio */}
        <div className="order-3 flex w-full flex-row flex-wrap justify-center gap-3 sm:w-auto lg:w-52 lg:flex-col lg:gap-4">
          {/* les prochaines pieces */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-2xl backdrop-blur-xl">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Prochaines
            </h3>
            <div className="flex flex-row items-stretch gap-3 lg:flex-col lg:gap-3">
              {/* la premiere en plus gros */}
              {nextThree[0] && (
                <div className="flex flex-1 items-center justify-center rounded-xl bg-slate-950/40 p-2 ring-1 ring-cyan-400/20">
                  {(() => {
                    const trimmed = trimMatrix(Engine.getPieceMatrix(nextThree[0], 0));
                    const cols = trimmed[0]?.length ?? 0;
                    return (
                      <div
                        className="grid gap-[3px]"
                        style={{ gridTemplateColumns: `repeat(${cols}, 22px)` }}
                      >
                        {trimmed.flat().map((cell, i) => (
                          <div
                            key={i}
                            className={cn("rounded-[3px]", cell ? Engine.TETROMINO_COLORS[nextThree[0]] : "bg-transparent")}
                            style={{
                              width: 22,
                              height: 22,
                              boxShadow: cell ? Engine.TETROMINO_GLOW[nextThree[0]] : undefined,
                            }}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* les suivantes en petit */}
              <div className="flex flex-1 flex-row gap-2 lg:flex-col">
                {nextThree.slice(1, isFullscreen ? 2 : 3).map((type, i) => (
                  <div
                    key={`${type}-${i}`}
                    className="flex flex-1 items-center justify-center rounded-lg bg-slate-950/30 p-1.5 ring-1 ring-white/5"
                  >
                    {(() => {
                      const trimmed = trimMatrix(Engine.getPieceMatrix(type, 0));
                      const cols = trimmed[0]?.length ?? 0;
                      return (
                        <div
                          className="grid gap-[2px]"
                          style={{ gridTemplateColumns: `repeat(${cols}, 13px)` }}
                        >
                          {trimmed.flat().map((cell, j) => (
                            <div
                              key={j}
                              className={cn("rounded-[2px]", cell ? Engine.TETROMINO_COLORS[type] : "bg-transparent")}
                              style={{
                                width: 13,
                                height: 13,
                                boxShadow: cell ? Engine.TETROMINO_GLOW[type] : undefined,
                              }}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* rappel des controles */}
          {!isFullscreen && (
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-2xl backdrop-blur-xl">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Contrôles</h3>
              <div className="space-y-1.5 text-xs text-slate-400">
                {[
                  ["← →", "Déplacer"],
                  ["↓", "Descente lente"],
                  ["Espace", "Chute rapide"],
                  ["↑ / X", "Rotation horaire"],
                  ["Z", "Rotation anti-horaire"],
                  ["C", "Réserve"],
                  ["P", "Pause"],
                  ["R", "Recommencer"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4">
                    <span className="rounded bg-slate-950/60 px-1.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/10">
                      {k}
                    </span>
                    <span className="text-right text-slate-500">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* audio */}
          {!isFullscreen && (
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Audio</h3>
                <button
                  onClick={() => setMuted((v) => !v)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all",
                    muted
                      ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/20"
                      : "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/20"
                  )}
                >
                  {muted ? "Muet" : "Actif"}
                </button>
              </div>
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Musique adaptative, basses de tension et effets dynamiques.
              </div>
            </div>
          )}

          {/* plein ecran */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={toggleFullscreen}
                className="flex-1 rounded-2xl border border-white/10 bg-slate-800/60 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-slate-700/60 hover:text-white"
              >
                {isFullscreen ? "Quitter plein écran" : "Plein écran"}
              </button>
              {isFullscreen && (
                <button
                  onClick={() => setMuted((v) => !v)}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all",
                    muted
                      ? "bg-rose-500/20 text-rose-200 ring-1 ring-rose-400/20"
                      : "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/20"
                  )}
                >
                  {muted ? "🔇" : "🔊"}
                </button>
              )}
            </div>
            {!isFullscreen && (
              <div className="rounded-2xl border border-white/5 bg-slate-800/40 px-4 py-3 text-center text-[10px] leading-relaxed text-slate-500">
                Créé par <span className="font-bold text-slate-300">Hylst - Geoffroy</span>
                <br />
                avec l&apos;aide d&apos;une IA
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
