import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { computerMove, emptyBoard, isDraw, nextPlayer, winner, type Board } from './game';

type Mode = 'two-player' | 'computer';

export default function App() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [mode, setMode] = useState<Mode>('two-player');
  const [score, setScore] = useState({ X: 0, O: 0, draws: 0 });

  const result = winner(board);
  const draw = isDraw(board);
  const turn = nextPlayer(board);

  function play(index: number) {
    if (board[index] || result) return;
    let next = board.map((c, i) => (i === index ? turn : c));
    if (mode === 'computer' && !winner(next) && !isDraw(next)) {
      next = next.map((c, i) => (i === computerMove(next, 'O') ? 'O' : c));
    }
    setBoard(next);
    const won = winner(next);
    if (won) setScore((s) => ({ ...s, [won.player]: s[won.player] + 1 }));
    else if (isDraw(next)) setScore((s) => ({ ...s, draws: s.draws + 1 }));
  }

  function reset() {
    setBoard(emptyBoard());
  }

  function toggleMode() {
    setMode((m) => (m === 'two-player' ? 'computer' : 'two-player'));
    reset();
    setScore({ X: 0, O: 0, draws: 0 });
  }

  const status = result ? `${result.player} wins!` : draw ? "It's a draw" : `${turn}'s turn`;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Tic Tac Toe</Text>
      <Text testID="status" accessibilityRole="header" style={styles.status}>{status}</Text>
      <View style={styles.board}>
        {board.map((cell, i) => (
          <Pressable
            key={i}
            testID={`cell-${i}`}
            accessibilityLabel={`cell ${i}${cell ? `, ${cell}` : ''}`}
            onPress={() => play(i)}
            style={[styles.cell, result?.line.includes(i) && styles.winCell]}
          >
            <Text style={[styles.mark, cell === 'O' && styles.markO]}>{cell}</Text>
          </Pressable>
        ))}
      </View>
      <Text testID="score" style={styles.score}>X {score.X} · O {score.O} · Draws {score.draws}</Text>
      <View style={styles.row}>
        <Pressable testID="reset" onPress={reset} style={styles.button}>
          <Text style={styles.buttonText}>New game</Text>
        </Pressable>
        <Pressable testID="mode" onPress={toggleMode} style={[styles.button, styles.secondary]}>
          <Text style={styles.buttonText}>{mode === 'two-player' ? 'Play the computer' : 'Two players'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', gap: 16 },
  title: { fontSize: 32, fontWeight: '800', color: '#f8fafc' },
  status: { fontSize: 20, color: '#cbd5e1' },
  board: { width: 288, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: 92, height: 92, borderRadius: 12, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  winCell: { backgroundColor: '#166534' },
  mark: { fontSize: 44, fontWeight: '800', color: '#38bdf8' },
  markO: { color: '#fb923c' },
  score: { color: '#94a3b8', fontSize: 15 },
  row: { flexDirection: 'row', gap: 10 },
  button: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  secondary: { backgroundColor: '#475569' },
  buttonText: { color: 'white', fontWeight: '600' },
});
