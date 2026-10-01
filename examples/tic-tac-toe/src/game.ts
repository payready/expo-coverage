export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = Cell[];

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const emptyBoard = (): Board => Array<Cell>(9).fill(null);

export function winner(board: Board): { player: Player; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line as [number, number, number];
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return { player: mark, line };
  }
  return null;
}

export const isDraw = (board: Board): boolean => !winner(board) && board.every(Boolean);

export const nextPlayer = (board: Board): Player => (board.filter(Boolean).length % 2 === 0 ? 'X' : 'O');

/** Naive computer opponent: win if it can, block if it must, else take the centre, then any free cell. */
export function computerMove(board: Board, me: Player): number {
  const other: Player = me === 'X' ? 'O' : 'X';
  for (const who of [me, other]) {
    for (const line of LINES) {
      const marks = line.map((i) => board[i]);
      const empty = line.filter((i) => !board[i]);
      if (empty.length === 1 && marks.filter((m) => m === who).length === 2) return empty[0]!;
    }
  }
  if (!board[4]) return 4;
  return board.findIndex((c) => !c);
}
