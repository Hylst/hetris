export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

export type CellColor = string;
export type BoardCell = { color: CellColor; clearing: boolean } | null;
export type Board = BoardCell[][];

export const TETROMINOES = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export type Tetromino = (typeof TETROMINOES)[number];

export const TETROMINO_MATRICES: Record<Tetromino, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

// Une classe Tailwind par piece. Verbeux, mais c'est du CSS pur : zero image a charger.
export const TETROMINO_COLORS: Record<Tetromino, string> = {
  I: "bg-[conic-gradient(at_30%_30%,#a5f3fc,#22d3ee,#0891b2,#a5f3fc)] border-cyan-200",
  O: "bg-[conic-gradient(at_30%_30%,#fef08a,#facc15,#ca8a04,#fef08a)] border-yellow-200",
  T: "bg-[conic-gradient(at_30%_30%,#ddd6fe,#a855f7,#7e22ce,#ddd6fe)] border-violet-200",
  S: "bg-[conic-gradient(at_30%_30%,#86efac,#22c55e,#15803d,#86efac)] border-emerald-200",
  Z: "bg-[conic-gradient(at_30%_30%,#fda4af,#f43f5e,#be123c,#fda4af)] border-rose-200",
  J: "bg-[conic-gradient(at_30%_30%,#93c5fd,#3b82f6,#1d4ed8,#93c5fd)] border-blue-200",
  L: "bg-[conic-gradient(at_30%_30%,#fed7aa,#f97316,#c2410c,#fed7aa)] border-orange-200",
};

export const TETROMINO_GLOW: Record<Tetromino, string> = {
  I: "0 0 2px rgba(165,243,252,0.9), 0 0 12px rgba(34,211,238,0.85), 0 0 24px rgba(34,211,238,0.45)",
  O: "0 0 2px rgba(254,240,138,0.9), 0 0 12px rgba(250,204,21,0.85), 0 0 24px rgba(250,204,21,0.45)",
  T: "0 0 2px rgba(221,214,254,0.9), 0 0 12px rgba(168,85,247,0.85), 0 0 24px rgba(168,85,247,0.45)",
  S: "0 0 2px rgba(134,239,172,0.9), 0 0 12px rgba(34,197,94,0.85), 0 0 24px rgba(34,197,94,0.45)",
  Z: "0 0 2px rgba(253,164,175,0.9), 0 0 12px rgba(244,63,94,0.85), 0 0 24px rgba(244,63,94,0.45)",
  J: "0 0 2px rgba(147,197,253,0.9), 0 0 12px rgba(59,130,246,0.85), 0 0 24px rgba(59,130,246,0.45)",
  L: "0 0 2px rgba(254,215,170,0.9), 0 0 12px rgba(249,115,22,0.85), 0 0 24px rgba(249,115,22,0.45)",
};

export interface ActivePiece {
  type: Tetromino;
  x: number;
  y: number;
  rotation: number;
  matrix: number[][];
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null)
  );
}

export function rotateMatrix(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      rotated[x][rows - 1 - y] = matrix[y][x];
    }
  }
  return rotated;
}

export function getPieceMatrix(type: Tetromino, rotation: number): number[][] {
  let matrix = TETROMINO_MATRICES[type];
  let r = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < r; i++) {
    matrix = rotateMatrix(matrix);
  }
  return matrix;
}

export function createBag(): Tetromino[] {
  const bag = [...TETROMINOES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function refillBag(bag: Tetromino[]): Tetromino[] {
  if (bag.length <= 7) {
    return [...bag, ...createBag()];
  }
  return bag;
}

export function isValidPosition(
  board: Board,
  matrix: number[][],
  x: number,
  y: number
): boolean {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        const boardY = y + r;
        const boardX = x + c;
        if (
          boardX < 0 ||
          boardX >= BOARD_COLS ||
          boardY >= BOARD_ROWS ||
          boardY < 0 ||
          board[boardY][boardX]
        ) {
          return false;
        }
      }
    }
  }
  return true;
}

const WALL_KICKS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-2, 0],
  [2, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

export function tryRotate(
  board: Board,
  piece: ActivePiece,
  direction: 1 | -1
): ActivePiece | null {
  const newRotation = piece.rotation + direction;
  const newMatrix = getPieceMatrix(piece.type, newRotation);

  for (const [dx, dy] of WALL_KICKS) {
    const newX = piece.x + dx;
    const newY = piece.y + dy;
    if (isValidPosition(board, newMatrix, newX, newY)) {
      return {
        ...piece,
        x: newX,
        y: newY,
        rotation: newRotation,
        matrix: newMatrix,
      };
    }
  }
  return null;
}

export function getGhostY(board: Board, piece: ActivePiece): number {
  let ghostY = piece.y;
  while (isValidPosition(board, piece.matrix, piece.x, ghostY + 1)) {
    ghostY++;
  }
  return ghostY;
}

export function lockPiece(board: Board, piece: ActivePiece): void {
  for (let r = 0; r < piece.matrix.length; r++) {
    for (let c = 0; c < piece.matrix[r].length; c++) {
      if (piece.matrix[r][c]) {
        const boardY = piece.y + r;
        const boardX = piece.x + c;
        if (boardY >= 0 && boardY < BOARD_ROWS) {
          board[boardY][boardX] = {
            color: TETROMINO_COLORS[piece.type],
            clearing: false,
          };
        }
      }
    }
  }
}

export function markClearingLines(board: Board): number[] {
  const indices: number[] = [];
  for (let y = BOARD_ROWS - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell !== null)) {
      indices.push(y);
      board[y] = board[y].map(() => ({ color: "", clearing: true }));
    }
  }
  return indices;
}

export function clearLines(board: Board): number {
  let cleared = 0;
  for (let y = BOARD_ROWS - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell !== null && cell.clearing)) {
      board.splice(y, 1);
      board.unshift(Array.from({ length: BOARD_COLS }, () => null));
      cleared++;
      y++;
    }
  }
  return cleared;
}

export function calculateScore(lines: number, level: number): number {
  const base = [0, 100, 300, 500, 800];
  return base[lines] * level;
}

export function getDropSpeed(level: number): number {
  return Math.max(50, 1000 * Math.pow(0.8 - (level - 1) * 0.007, level - 1));
}

export function spawnPiece(board: Board, type: Tetromino): ActivePiece | null {
  const matrix = getPieceMatrix(type, 0);
  const x = Math.floor((BOARD_COLS - matrix[0].length) / 2);
  const y = 0;

  if (!isValidPosition(board, matrix, x, y)) {
    return null;
  }

  return { type, x, y, rotation: 0, matrix };
}

// height = les rangees de gravats offertes gracieusement au lancement
export const DIFFICULTY_LEVELS = [
  { name: "Facile", speedMult: 0.8, height: 0 },
  { name: "Normal", speedMult: 1, height: 0 },
  { name: "Difficile", speedMult: 1.3, height: 2 },
  { name: "Expert", speedMult: 1.8, height: 4 },
  { name: "Cauchemar", speedMult: 2.5, height: 6 },
] as const;

export function isInDanger(board: Board): boolean {
  const dangerRows = 5;
  for (let y = 0; y < dangerRows; y++) {
    if (board[y].some((cell) => cell !== null)) {
      return true;
    }
  }
  return false;
}
