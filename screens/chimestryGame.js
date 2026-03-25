import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity
} from "react-native";
import Svg, { Polygon } from "react-native-svg";

const EMPTY = 0;
const P1 = 1; 
const P2 = 2; 
const CELL_SIZE = 32;

export default function ChemistryGame() {
  const [size, setSize] = useState(32);
  const [grid, setGrid] = useState(null);
  const [player, setPlayer] = useState(P1);
  const [isAiMode, setIsAiMode] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [capturedSet, setCapturedSet] = useState(new Set()); // Stocke les clés "x,y" des points déjà comptés
  const [score, setScore] = useState({ p1: 0, p2: 0 });

  const initGame = (modeIA) => {
    setGrid(Array.from({ length: 32 }, () => Array(32).fill(EMPTY)));
    setIsAiMode(modeIA);
    setScore({ p1: 0, p2: 0 });
    setTerritories([]);
    setCapturedSet(new Set());
    setPlayer(P1);
  };

  useEffect(() => {
    if (isAiMode && player === P2) {
      const timer = setTimeout(makeAiMove, 600);
      return () => clearTimeout(timer);
    }
  }, [player, isAiMode]);

  const makeAiMove = () => {
    let availableMoves = [];
    grid.forEach((row, y) => row.forEach((cell, x) => {
      if (cell === EMPTY) availableMoves.push({ x, y });
    }));
    if (availableMoves.length > 0) {
      const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
      handlePress(move.x, move.y);
    }
  };

  const handlePress = (x, y) => {
    if (!grid || grid[y][x] !== EMPTY) return;

    const newGrid = grid.map(r => [...r]);
    newGrid[y][x] = player;

    // Détection de capture
    const captureResult = detectCapture(newGrid, x, y, player, capturedSet);
    
    if (captureResult.newlyCapturedPoints.length > 0) {
      // Ajouter la nouvelle surface visuelle
      setTerritories(prev => [...prev, { points: captureResult.cycle, owner: player }]);
      
      // Mettre à jour le set des points capturés pour ne plus les compter
      const newCapturedSet = new Set(capturedSet);
      captureResult.newlyCapturedPoints.forEach(ptKey => newCapturedSet.add(ptKey));
      setCapturedSet(newCapturedSet);

      // Mise à jour du score uniquement avec les nouveaux points
      setScore(s => ({
        ...s,
        [player === P1 ? 'p1' : 'p2']: s[player === P1 ? 'p1' : 'p2'] + captureResult.newlyCapturedPoints.length
      }));
    }

    setGrid(newGrid);
    setPlayer(player === P1 ? P2 : P1);
  };

  if (isAiMode === null) {
    return (
      <View style={styles.menuContainer}>
        <Text style={styles.menuTitle}>🧪 LABO-REACTION</Text>
        <TouchableOpacity style={[styles.menuBtn, {borderColor: '#38bdf8'}]} onPress={() => initGame(false)}>
          <Text style={styles.menuBtnText}>👤 JOUEUR VS JOUEUR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuBtn, {borderColor: '#fb7185'}]} onPress={() => initGame(true)}>
          <Text style={styles.menuBtnText}>🤖 JOUEUR VS IA</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.scoreRow}>
          <View style={[styles.scorePill, player === P1 && styles.activeP1]}>
            <Text style={styles.pillText}>🔵 P1: {score.p1}</Text>
          </View>
          <TouchableOpacity style={styles.resetBtn} onPress={() => setIsAiMode(null)}>
            <Text style={styles.resetText}>QUITTER</Text>
          </TouchableOpacity>
          <View style={[styles.scorePill, player === P2 && styles.activeP2]}>
            <Text style={styles.pillText}>🔴 {isAiMode ? "IA" : "P2"}: {score.p2}</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal>
        <ScrollView>
          <View style={{ width: size * CELL_SIZE, height: size * CELL_SIZE, backgroundColor: '#020617' }}>
            <Svg style={StyleSheet.absoluteFill}>
              {territories.map((t, i) => (
                <Polygon
                  key={i}
                  points={t.points.map(p => `${p.x * CELL_SIZE + CELL_SIZE/2},${p.y * CELL_SIZE + CELL_SIZE/2}`).join(" ")}
                  fill={t.owner === P1 ? "rgba(56, 189, 248, 0.2)" : "rgba(251, 113, 129, 0.2)"}
                  stroke={t.owner === P1 ? "#38bdf8" : "#fb7185"}
                  strokeWidth="1"
                />
              ))}
            </Svg>

            {grid && grid.map((row, y) => (
              <View key={y} style={styles.row}>
                {row.map((cell, x) => (
                  <Pressable key={x} onPress={() => handlePress(x, y)} style={styles.cell}>
                    <View style={styles.gridLineV} />
                    <View style={styles.gridLineH} />
                    {cell !== EMPTY && (
                      <View style={[styles.dot, cell === P1 ? styles.dotP1 : styles.dotP2]} />
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- LOGIQUE DE CAPTURE AMÉLIORÉE ---
function detectCapture(grid, startX, startY, player, alreadyCaptured) {
  const opponent = player === P1 ? P2 : P1;
  
  function findCycle(x, y, px, py, path) {
    const key = `${x},${y}`;
    const idx = path.findIndex(p => p.x === x && p.y === y);
    if (idx !== -1) return path.slice(idx);
    
    const neighbors = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (const [dx, dy] of neighbors) {
      const nx = x + dx, ny = y + dy;
      if (nx === px && ny === py) continue;
      if (grid[ny]?.[nx] === player) {
        const cycle = findCycle(nx, ny, x, y, [...path, { x, y }]);
        if (cycle) return cycle;
      }
    }
    return null;
  }

  const cycle = findCycle(startX, startY, -1, -1, []);
  if (!cycle) return { newlyCapturedPoints: [] };

  let newlyCaptured = [];
  grid.forEach((row, y) => row.forEach((cell, x) => {
    // On ne compte que si c'est un point de l'adversaire
    if (cell === opponent) {
      const ptKey = `${x},${y}`;
      // On vérifie si ce point n'a pas déjà été compté auparavant
      if (!alreadyCaptured.has(ptKey)) {
        if (isPointInPoly({ x, y }, cycle)) {
          newlyCaptured.push(ptKey);
        }
      }
    }
  }));

  return { cycle, newlyCapturedPoints: newlyCaptured };
}

function isPointInPoly(point, polygon) {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x, yi = polygon[i].y;
    let xj = polygon[j].x, yj = polygon[j].y;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  menuContainer: { flex: 1, backgroundColor: "#020617", justifyContent: "center", alignItems: "center", padding: 20 },
  menuTitle: { fontSize: 36, fontWeight: "bold", color: "#38bdf8", marginBottom: 30 },
  menuBtn: { width: '80%', padding: 20, borderRadius: 15, borderWidth: 2, marginBottom: 20, alignItems: "center" },
  menuBtnText: { color: "white", fontWeight: "bold" },
  header: { padding: 15, backgroundColor: "#0f172a" },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scorePill: { padding: 10, borderRadius: 10, backgroundColor: "#1e293b", minWidth: 90, alignItems: "center" },
  activeP1: { borderColor: "#38bdf8", borderWidth: 2 },
  activeP2: { borderColor: "#fb7185", borderWidth: 2 },
  pillText: { color: "white", fontWeight: "bold" },
  resetBtn: { padding: 8, backgroundColor: "#334155", borderRadius: 5 },
  resetText: { color: "white", fontSize: 10 },
  row: { flexDirection: "row" },
  cell: { width: CELL_SIZE, height: CELL_SIZE, justifyContent: "center", alignItems: "center" },
  gridLineV: { position: "absolute", width: 1, height: "100%", backgroundColor: "#1e293b" },
  gridLineH: { position: "absolute", width: "100%", height: 1, backgroundColor: "#1e293b" },
  dot: { width: 14, height: 14, borderRadius: 7, zIndex: 10 },
  dotP1: { backgroundColor: "#38bdf8" },
  dotP2: { backgroundColor: "#fb7185" },
});