import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Platform
} from "react-native";
import Svg, { Polygon, Line } from "react-native-svg";

const EMPTY = 0;
const P1 = 1;
const P2 = 2;
const CELL_SIZE = 32;

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const AMBER  = '#C9934A';
const AMBER2 = '#E8B86A';
const ROSE   = '#C0485A';
const ROSE2  = '#E06070';
const BG     = '#0C0B0A';
const SURF   = '#141210';
const PANEL  = '#1A1714';
const BORDER = '#2A2520';
const BORDHI = '#3A3028';
const TEXT   = '#EDE8DF';
const TEXTS  = '#7A7068';
const TEXTD  = '#3A3530';

export default function ChemistryGame() {
  const [size, setSize] = useState(32);
  const [grid, setGrid] = useState(null);
  const [player, setPlayer] = useState(P1);
  const [isAiMode, setIsAiMode] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [capturedSet, setCapturedSet] = useState(new Set());
  const [score, setScore] = useState({ p1: 0, p2: 0 });

  // ── LOGIQUE ORIGINALE INCHANGÉE ──────────────────────────────────────────────
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

    const captureResult = detectCapture(newGrid, x, y, player, capturedSet);

    if (captureResult.newlyCapturedPoints.length > 0) {
      setTerritories(prev => [...prev, { points: captureResult.cycle, owner: player }]);

      const newCapturedSet = new Set(capturedSet);
      captureResult.newlyCapturedPoints.forEach(ptKey => newCapturedSet.add(ptKey));
      setCapturedSet(newCapturedSet);

      setScore(s => ({
        ...s,
        [player === P1 ? 'p1' : 'p2']: s[player === P1 ? 'p1' : 'p2'] + captureResult.newlyCapturedPoints.length
      }));
    }

    setGrid(newGrid);
    setPlayer(player === P1 ? P2 : P1);
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // ── MENU ──
  if (isAiMode === null) {
    return (
      <View style={S.menu}>
        <View style={S.menuTopLine} />
        <Text style={S.menuEyebrow}>JEU DE TERRITOIRE</Text>
        <Text style={S.menuTitle}>LABO{'\n'}RÉACTION</Text>
        <View style={S.menuAccentLine} />
        <Text style={S.menuDesc}>
          Posez vos pions et encerclez{'\n'}les pièces adverses pour capturer du territoire
        </Text>

        <TouchableOpacity
          style={[S.menuBtn, { borderColor: AMBER }]}
          onPress={() => initGame(false)}
          activeOpacity={0.75}
        >
          <View style={[S.menuBtnDot, { backgroundColor: AMBER }]} />
          <View style={S.menuBtnBody}>
            <Text style={[S.menuBtnLabel, { color: AMBER }]}>JOUEUR VS JOUEUR</Text>
            <Text style={S.menuBtnSub}>Deux joueurs en local</Text>
          </View>
          <Text style={[S.menuBtnArrow, { color: AMBER }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[S.menuBtn, { borderColor: ROSE }]}
          onPress={() => initGame(true)}
          activeOpacity={0.75}
        >
          <View style={[S.menuBtnDot, { backgroundColor: ROSE }]} />
          <View style={S.menuBtnBody}>
            <Text style={[S.menuBtnLabel, { color: ROSE2 }]}>JOUEUR VS IA</Text>
            <Text style={S.menuBtnSub}>Intelligence artificielle</Text>
          </View>
          <Text style={[S.menuBtnArrow, { color: ROSE }]}>›</Text>
        </TouchableOpacity>

        <View style={S.menuBottomLine} />
        <Text style={S.menuFooter}>GRILLE 32 × 32</Text>
      </View>
    );
  }

  // ── JEU ──
  return (
    <SafeAreaView style={S.container}>

      {/* HEADER */}
      <View style={S.header}>
        <View style={S.headerRow}>

          {/* Joueur 1 */}
          <View style={[S.playerCard, player === P1 && S.playerCardActiveAmber]}>
            <View style={[S.playerDot, { backgroundColor: AMBER }]} />
            <View>
              <Text style={S.playerCardLabel}>JOUEUR 1</Text>
              <Text style={[S.playerCardScore, { color: AMBER }]}>{score.p1}</Text>
            </View>
            {player === P1 && <View style={[S.activePip, { backgroundColor: AMBER }]} />}
          </View>

          {/* Centre */}
          <View style={S.headerCenter}>
            <TouchableOpacity style={S.menuBackBtn} onPress={() => setIsAiMode(null)} activeOpacity={0.7}>
              <Text style={S.menuBackText}>← MENU</Text>
            </TouchableOpacity>
            <Text style={S.headerTurnText}>
              {player === P1
                ? 'TOUR · J1'
                : isAiMode ? 'IA JOUE…' : 'TOUR · J2'}
            </Text>
          </View>

          {/* Joueur 2 / IA */}
          <View style={[S.playerCard, S.playerCardRight, player === P2 && S.playerCardActiveRose]}>
            {player === P2 && <View style={[S.activePip, { backgroundColor: ROSE, left: undefined, right: -3 }]} />}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={S.playerCardLabel}>{isAiMode ? 'I·A' : 'JOUEUR 2'}</Text>
              <Text style={[S.playerCardScore, { color: ROSE2 }]}>{score.p2}</Text>
            </View>
            <View style={[S.playerDot, { backgroundColor: ROSE }]} />
          </View>

        </View>
        <View style={S.headerDivider} />
      </View>

      {/* GRILLE */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ width: size * CELL_SIZE, height: size * CELL_SIZE, backgroundColor: BG }}>

            <Svg width={size * CELL_SIZE} height={size * CELL_SIZE} style={StyleSheet.absoluteFill}>

              {/* Lignes grille fines */}
              {Array.from({ length: size + 1 }, (_, i) => (
                <Line key={`v${i}`}
                  x1={i * CELL_SIZE} y1={0}
                  x2={i * CELL_SIZE} y2={size * CELL_SIZE}
                  stroke="#1A1714" strokeWidth={0.6} />
              ))}
              {Array.from({ length: size + 1 }, (_, i) => (
                <Line key={`h${i}`}
                  x1={0} y1={i * CELL_SIZE}
                  x2={size * CELL_SIZE} y2={i * CELL_SIZE}
                  stroke="#1A1714" strokeWidth={0.6} />
              ))}

              {/* Territoires */}
              {territories.map((t, i) => (
                <Polygon
                  key={i}
                  points={t.points.map(p =>
                    `${p.x * CELL_SIZE + CELL_SIZE / 2},${p.y * CELL_SIZE + CELL_SIZE / 2}`
                  ).join(' ')}
                  fill={t.owner === P1
                    ? 'rgba(201,147,74,0.1)'
                    : 'rgba(192,72,90,0.1)'}
                  stroke={t.owner === P1 ? AMBER : ROSE}
                  strokeWidth="1"
                  strokeOpacity={0.5}
                />
              ))}
            </Svg>

            {/* Pions */}
            {grid && grid.map((row, y) => (
              <View key={y} style={S.row}>
                {row.map((cell, x) => (
                  <Pressable key={x} onPress={() => handlePress(x, y)} style={S.cell}>
                    <View style={S.gridLineV} />
                    <View style={S.gridLineH} />
                    {cell !== EMPTY && (
                      <View style={[S.dot, cell === P1 ? S.dotP1 : S.dotP2]}>
                        <View style={S.dotShine} />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}

          </View>
        </ScrollView>
      </ScrollView>

      {/* FOOTER */}
      <View style={S.footer}>
        <View style={[S.footerDot, { backgroundColor: AMBER }]} />
        <Text style={S.footerText}>P1 territoire</Text>
        <View style={S.footerSep} />
        <View style={[S.footerDot, { backgroundColor: ROSE }]} />
        <Text style={S.footerText}>{isAiMode ? 'IA' : 'P2'} territoire</Text>
      </View>

    </SafeAreaView>
  );
}

// ─── LOGIQUE ORIGINALE INCHANGÉE ──────────────────────────────────────────────
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
    if (cell === opponent) {
      const ptKey = `${x},${y}`;
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

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // ── Menu ──
  menu: {
    flex: 1, backgroundColor: BG,
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  menuTopLine: {
    width: 40, height: 2, backgroundColor: AMBER,
    marginBottom: 20, opacity: 0.6,
  },
  menuEyebrow: {
    color: TEXTS, fontSize: 9, letterSpacing: 4,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  menuTitle: {
    color: TEXT, fontSize: 48, fontWeight: '800',
    letterSpacing: 4, lineHeight: 52, textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 16,
  },
  menuAccentLine: {
    width: 32, height: 1, backgroundColor: AMBER,
    opacity: 0.4, marginBottom: 16,
  },
  menuDesc: {
    color: TEXTS, fontSize: 12, textAlign: 'center',
    lineHeight: 20, letterSpacing: 0.3, marginBottom: 36,
  },
  menuBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 8, padding: 16,
    marginBottom: 12, backgroundColor: SURF,
  },
  menuBtnDot: {
    width: 8, height: 8, borderRadius: 4, marginRight: 14,
  },
  menuBtnBody: { flex: 1 },
  menuBtnLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 2,
  },
  menuBtnSub: {
    color: TEXTS, fontSize: 10, letterSpacing: 1,
  },
  menuBtnArrow: {
    fontSize: 20, fontWeight: '300', marginLeft: 8,
  },
  menuBottomLine: {
    width: '100%', height: 1, backgroundColor: BORDER,
    marginTop: 32, marginBottom: 14,
  },
  menuFooter: {
    color: TEXTD, fontSize: 9, letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // ── Jeu ──
  container: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: SURF,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  playerCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: 8, backgroundColor: PANEL,
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    position: 'relative', overflow: 'hidden',
  },
  playerCardRight: { flexDirection: 'row-reverse' },
  playerCardActiveAmber: { borderColor: AMBER, backgroundColor: 'rgba(201,147,74,0.06)' },
  playerCardActiveRose:  { borderColor: ROSE,  backgroundColor: 'rgba(192,72,90,0.06)' },
  playerDot: { width: 9, height: 9, borderRadius: 4.5 },
  playerCardLabel: {
    color: TEXTS, fontSize: 8, letterSpacing: 2, marginBottom: 2,
  },
  playerCardScore: {
    fontSize: 20, fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  activePip: {
    position: 'absolute', top: -3, left: -3,
    width: 7, height: 7, borderRadius: 3.5,
  },

  headerCenter: {
    alignItems: 'center', paddingHorizontal: 12, gap: 4,
  },
  menuBackBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: PANEL, borderWidth: 1,
    borderColor: BORDER, borderRadius: 5,
  },
  menuBackText: {
    color: TEXTS, fontSize: 9, letterSpacing: 1,
  },
  headerTurnText: {
    color: TEXTD, fontSize: 8, letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  headerDivider: {
    height: 1, backgroundColor: BORDER, marginTop: 2,
  },

  // ── Grille ──
  row:  { flexDirection: 'row' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, justifyContent: 'center', alignItems: 'center' },
  gridLineV: { position: 'absolute', width: 1, height: '100%', backgroundColor: '#1A1714' },
  gridLineH: { position: 'absolute', width: '100%', height: 1, backgroundColor: '#1A1714' },
  dot: {
    width: 13, height: 13, borderRadius: 6.5, zIndex: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  dotP1: { backgroundColor: AMBER },
  dotP2: { backgroundColor: ROSE },
  dotShine: {
    position: 'absolute', top: 2, left: 2,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 8,
    backgroundColor: SURF, borderTopWidth: 1, borderTopColor: BORDER,
  },
  footerDot:  { width: 7, height: 7, borderRadius: 3.5 },
  footerText: { color: TEXTS, fontSize: 10, letterSpacing: 1 },
  footerSep:  { width: 1, height: 12, backgroundColor: BORDER, marginHorizontal: 4 },
});