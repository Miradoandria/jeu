import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Rect,
  G,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Path,
} from "react-native-svg";

const { width: SW } = Dimensions.get("window");

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const COLS = 9;
const ROWS = 5;
const EMPTY = 0;
const WHITE = 1; // Changed from RED to WHITE
const DARK = 2;

const BOARD_W = Math.min(SW - 16, 440);
const PAD_H = 32;
const PAD_V = 30;
const BOARD_H = BOARD_W * 0.55 + PAD_V * 2;
const CW = (BOARD_W - PAD_H * 2) / (COLS - 1);
const CH = (BOARD_H - PAD_V * 2) / (ROWS - 1);
const PR = Math.min(CW, CH) * 0.38;

const gx = (c) => PAD_H + c * CW;
const gy = (r) => PAD_V + r * CH;
const key = (c, r) => `${c},${r}`;
const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

// ─── DIAGONALES ────────────────────────────────────────────────────────────────
const hasDiag = (c, r) => {
  if ((c + r) % 2 !== 0) return false;
  if (c === 4 && r === 2) return false;
  return true;
};

const diagSegExists = (c1, r1, c2, r2) => hasDiag(c1, r1) || hasDiag(c2, r2);

const getDirs = (c, r) => {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  if (hasDiag(c, r)) dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  return dirs;
};

// ─── SEGMENTS À DESSINER ────────────────────────────────────────────────────────
const buildSegments = () => {
  const segs = [];
  const seen = new Set();
  const add = (c1, r1, c2, r2) => {
    const a = `${c1},${r1},${c2},${r2}`,
      b = `${c2},${r2},${c1},${r1}`;
    if (seen.has(a) || seen.has(b)) return;
    seen.add(a);
    segs.push([c1, r1, c2, r2]);
  };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (inBounds(c + 1, r)) add(c, r, c + 1, r);
      if (inBounds(c, r + 1)) add(c, r, c, r + 1);
      [
        [1, 1],
        [1, -1],
      ].forEach(([dc, dr]) => {
        const nc = c + dc,
          nr = r + dr;
        if (inBounds(nc, nr) && diagSegExists(c, r, nc, nr)) add(c, r, nc, nr);
      });
    }
  return segs;
};
const SEGMENTS = buildSegments();
const SEG_ORTHO = SEGMENTS.filter(([c1, r1, c2, r2]) => c1 === c2 || r1 === r2);
const SEG_DIAG = SEGMENTS.filter(([c1, r1, c2, r2]) => c1 !== c2 && r1 !== r2);

// ─── POSITION INITIALE ─────────────────────────────────────────────────────────
// row=2 milieu: N,W,N,W,VIDE,N,W,N,W  (changed from RED to WHITE)
const MID_ROW = [DARK, WHITE, DARK, WHITE, EMPTY, DARK, WHITE, DARK, WHITE];

const initBoard = () => {
  const b = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
  for (let c = 0; c < COLS; c++) {
    b[0][c] = DARK;
    b[1][c] = DARK;
    b[2][c] = MID_ROW[c];
    b[3][c] = WHITE; // Changed from RED to WHITE
    b[4][c] = WHITE; // Changed from RED to WHITE
  }
  return b;
};

// ─── LOGIQUE DE JEU (identique à l'original) ───────────────────────────────────
const opp = (p) => (p === WHITE ? DARK : WHITE); // Changed from RED to WHITE

const collectLine = (board, sc, sr, dc, dr, enemy) => {
  const list = [];
  let nc = sc + dc,
    nr = sr + dr;
  while (inBounds(nc, nr) && board[nr][nc] === enemy) {
    list.push([nc, nr]);
    nc += dc;
    nr += dr;
  }
  return list;
};

const getCaptures = (board, fc, fr, tc, tr, player) => {
  const enemy = opp(player),
    dc = tc - fc,
    dr = tr - fr;
  return {
    approach: collectLine(board, tc, tr, dc, dr, enemy),
    retreat: collectLine(board, fc, fr, -dc, -dr, enemy),
  };
};

const canMove = (board, fc, fr, tc, tr) => {
  if (!inBounds(tc, tr) || board[tr][tc] !== EMPTY) return false;
  const dc = tc - fc,
    dr = tr - fr;
  if (Math.abs(dc) > 1 || Math.abs(dr) > 1) return false;
  if (dc === 0 || dr === 0) return true;
  return diagSegExists(fc, fr, tc, tr);
};

const allCaptureMoves = (board, player) => {
  const moves = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dc, dr] of getDirs(c, r)) {
        const tc = c + dc,
          tr = r + dr;
        if (!canMove(board, c, r, tc, tr)) continue;
        const { approach, retreat } = getCaptures(board, c, r, tc, tr, player);
        if (approach.length > 0)
          moves.push({
            from: [c, r],
            to: [tc, tr],
            type: "approach",
            captured: approach,
          });
        if (retreat.length > 0)
          moves.push({
            from: [c, r],
            to: [tc, tr],
            type: "retreat",
            captured: retreat,
          });
      }
    }
  return moves;
};

const allPaikaMoves = (board, player) => {
  const moves = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dc, dr] of getDirs(c, r)) {
        const tc = c + dc,
          tr = r + dr;
        if (canMove(board, c, r, tc, tr))
          moves.push({
            from: [c, r],
            to: [tc, tr],
            type: "paika",
            captured: [],
          });
      }
    }
  return moves;
};

const applyMove = (board, from, to, captured) => {
  const nb = board.map((r) => [...r]);
  nb[to[1]][to[0]] = nb[from[1]][from[0]];
  nb[from[1]][from[0]] = EMPTY;
  for (const [cc, cr] of captured) nb[cr][cc] = EMPTY;
  return nb;
};

const getContinuations = (board, c, r, player, lastDC, lastDR, lastType) => {
  const moves = [];
  for (const [dc, dr] of getDirs(c, r)) {
    if (dc === -lastDC && dr === -lastDR) continue;
    const tc = c + dc,
      tr = r + dr;
    if (!canMove(board, c, r, tc, tr)) continue;
    const { approach, retreat } = getCaptures(board, c, r, tc, tr, player);
    if (
      approach.length > 0 &&
      !(dc === lastDC && dr === lastDR && lastType === "approach")
    )
      moves.push({
        from: [c, r],
        to: [tc, tr],
        type: "approach",
        captured: approach,
      });
    if (
      retreat.length > 0 &&
      !(dc === lastDC && dr === lastDR && lastType === "retreat")
    )
      moves.push({
        from: [c, r],
        to: [tc, tr],
        type: "retreat",
        captured: retreat,
      });
  }
  return moves;
};

const countPieces = (board) => {
  let white = 0, // Changed from red to white
    dark = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === WHITE) white++; // Changed from RED to WHITE
      if (board[r][c] === DARK) dark++;
    }
  return { white, dark }; // Changed from red to white
};

// ─── PIÈCE SVG AVEC COULEUR BLANCHE ────────────────────────────────────────────────
const Piece = ({ cx, cy, color, selected, canCapture }) => {
  const isWhite = color === WHITE; // Changed from isRed to isWhite
  const mainColor = isWhite ? "#FFFFFF" : "#2D3748";
  const gradientStart = isWhite ? "#FFFFFF" : "#4A5568";
  const gradientEnd = isWhite ? "#E0E0E0" : "#1A202C";
  const shadowColor = isWhite ? "#B0B0B0" : "#000000";
  const strokeColor = isWhite ? "#CCCCCC" : "#000000";

  return (
    <G>
      {selected && (
        <Circle
          cx={cx}
          cy={cy}
          r={PR + 8}
          fill="none"
          stroke="#FBBF24"
          strokeWidth={3}
          strokeDasharray="8,4"
        />
      )}
      {canCapture && !selected && (
        <Circle
          cx={cx}
          cy={cy}
          r={PR + 6}
          fill="rgba(251, 146, 60, 0.3)"
          stroke="#F97316"
          strokeWidth={2}
        />
      )}
      {/* Ombre */}
      <Circle cx={cx + 2} cy={cy + 2} r={PR} fill="rgba(0,0,0,0.3)" />
      {/* Corps principal avec gradient */}
      <Circle
        cx={cx}
        cy={cy}
        r={PR}
        fill={`url(#grad${isWhite ? "W" : "D"})`}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={PR}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
      />
      {/* Effet de brillance - plus prononcé pour les pièces blanches */}
      <Circle
        cx={cx - PR * 0.25}
        cy={cy - PR * 0.25}
        r={PR * 0.35}
        fill="rgba(255,255,255,0.8)"
      />
      {/* Détail central */}
      <Circle
        cx={cx}
        cy={cy}
        r={PR * 0.45}
        fill="none"
        stroke={isWhite ? "rgba(100,100,100,0.4)" : "rgba(255,255,255,0.6)"}
        strokeWidth={1.5}
      />
    </G>
  );
};

// ─── INDICATEURS MODERNES ─────────────────────────────────────────────────────────
const MoveHint = ({ cx, cy, hintType }) => {
  if (hintType === "paika")
    return (
      <G>
        <Circle
          cx={cx}
          cy={cy}
          r={PR * 0.6}
          fill="rgba(72, 187, 120, 0.35)"
          stroke="#48BB78"
          strokeWidth={2.5}
        />
        <Circle cx={cx} cy={cy} r={PR * 0.28} fill="#48BB78" />
      </G>
    );
  if (hintType === "capture")
    return (
      <G>
        <Circle
          cx={cx}
          cy={cy}
          r={PR * 0.65}
          fill="rgba(245, 101, 101, 0.4)"
          stroke="#F56565"
          strokeWidth={2.5}
        />
        <Path
          d={`M ${cx - PR * 0.25} ${cy - PR * 0.25} L ${cx + PR * 0.25} ${cy + PR * 0.25} M ${cx + PR * 0.25} ${cy - PR * 0.25} L ${cx - PR * 0.25} ${cy + PR * 0.25}`}
          stroke="#F56565"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </G>
    );
  if (hintType === "continuation")
    return (
      <G>
        <Circle
          cx={cx}
          cy={cy}
          r={PR * 0.7}
          fill="rgba(236, 72, 153, 0.35)"
          stroke="#EC489A"
          strokeWidth={2.5}
          strokeDasharray="5,3"
        />
        <Circle cx={cx} cy={cy} r={PR * 0.32} fill="#EC489A" />
      </G>
    );
  return null;
};

const VictimMark = ({ cx, cy, victimType }) => {
  const color = victimType === "retreat" ? "#4299E1" : "#F56565";
  return (
    <G>
      <Circle
        cx={cx}
        cy={cy}
        r={PR * 0.7}
        fill={`${color}20`}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="5,3"
      />
      <Path
        d={`M ${cx - PR * 0.4} ${cy - PR * 0.4} L ${cx + PR * 0.4} ${cy + PR * 0.4} M ${cx + PR * 0.4} ${cy - PR * 0.4} L ${cx - PR * 0.4} ${cy + PR * 0.4}`}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </G>
  );
};

// ─── PLATEAU SVG AVEC NOUVEAU DESIGN ─────────────────────────────────────────────
const Board = ({ board, selected, hints, victims, capturingSet, onPress }) => (
  <Svg width={BOARD_W} height={BOARD_H}>
    <Defs>
      {/* Gradient de fond principal */}
      <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#F7E6C4" />
        <Stop offset="100%" stopColor="#E8D4B0" />
      </LinearGradient>

      {/* Gradients pour les pièces */}
      <RadialGradient id="gradW" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#FFFFFF" />
        <Stop offset="100%" stopColor="#E0E0E0" />
      </RadialGradient>
      <RadialGradient id="gradD" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#4A5568" />
        <Stop offset="100%" stopColor="#1A202C" />
      </RadialGradient>

      {/* Motifs décoratifs */}
      <LinearGradient id="woodGrain" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0%" stopColor="#D4B88C" />
        <Stop offset="50%" stopColor="#C4A86C" />
        <Stop offset="100%" stopColor="#B8985C" />
      </LinearGradient>
    </Defs>

    {/* Fond avec texture bois */}
    <Rect
      x={0}
      y={0}
      width={BOARD_W}
      height={BOARD_H}
      rx={16}
      fill="url(#bgGrad)"
    />
    <Rect
      x={2}
      y={2}
      width={BOARD_W - 4}
      height={BOARD_H - 4}
      rx={14}
      fill="none"
      stroke="#9B7E54"
      strokeWidth={3}
    />

    {/* Détail bois (lignes décoratives) */}
    {[...Array(5)].map((_, i) => (
      <Line
        key={`grain-${i}`}
        x1={10 + i * 15}
        y1={5}
        x2={10 + i * 15}
        y2={BOARD_H - 5}
        stroke="rgba(155, 126, 84, 0.2)"
        strokeWidth={1.5}
      />
    ))}

    {/* Zones colorées semi-transparentes */}
    <Rect
      x={4}
      y={4}
      width={BOARD_W / 2 - 4}
      height={BOARD_H - 8}
      rx={12}
      fill="rgba(255, 255, 255, 0.1)"
    />
    <Rect
      x={BOARD_W / 2}
      y={4}
      width={BOARD_W / 2 - 8}
      height={BOARD_H - 8}
      rx={12}
      fill="rgba(45, 55, 72, 0.08)"
    />

    {/* Zone centrale avec effet lumineux */}
    <Rect
      x={gx(3) - CW * 0.5 + 1}
      y={gy(1) - CH * 0.5 + 1}
      width={CW * 3 - 2}
      height={CH * 3 - 2}
      rx={6}
      fill="rgba(251, 191, 36, 0.15)"
      stroke="rgba(251, 191, 36, 0.4)"
      strokeWidth={1.5}
    />

    {/* Lignes diagonales */}
    {SEG_DIAG.map(([c1, r1, c2, r2], i) => (
      <Line
        key={"d" + i}
        x1={gx(c1)}
        y1={gy(r1)}
        x2={gx(c2)}
        y2={gy(r2)}
        stroke="#B87C4A"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
    ))}

    {/* Lignes orthogonales */}
    {SEG_ORTHO.map(([c1, r1, c2, r2], i) => (
      <Line
        key={"o" + i}
        x1={gx(c1)}
        y1={gy(r1)}
        x2={gx(c2)}
        y2={gy(r2)}
        stroke="#8B6946"
        strokeWidth={2}
        strokeLinecap="round"
      />
    ))}

    {/* Points d'intersection */}
    {Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => (
        <Circle
          key={`dot-${c}-${r}`}
          cx={gx(c)}
          cy={gy(r)}
          r={3}
          fill="#B87C4A"
          opacity={0.4}
        />
      )),
    )}

    {/* Indicateurs de coups */}
    {Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const h = hints?.get(key(c, r));
        return h ? (
          <MoveHint key={"h" + key(c, r)} cx={gx(c)} cy={gy(r)} hintType={h} />
        ) : null;
      }),
    )}

    {/* Pièces */}
    {Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const cell = board[r][c];
        if (cell === EMPTY) {
          if (c === 4 && r === 2)
            return (
              <Circle
                key="ctr"
                cx={gx(4)}
                cy={gy(2)}
                r={PR * 0.35}
                fill="#FBBF24"
                opacity={0.5}
              />
            );
          return null;
        }
        const k = key(c, r);
        return (
          <Piece
            key={k}
            cx={gx(c)}
            cy={gy(r)}
            color={cell}
            selected={selected && selected[0] === c && selected[1] === r}
            canCapture={
              capturingSet?.has(k) &&
              !(selected && selected[0] === c && selected[1] === r)
            }
          />
        );
      }),
    )}

    {/* Marques sur victimes */}
    {victims &&
      Array.from(victims).map(([k, t]) => {
        const [c, r] = k.split(",").map(Number);
        return (
          <VictimMark key={"v" + k} cx={gx(c)} cy={gy(r)} victimType={t} />
        );
      })}

    {/* Zones tactiles */}
    {Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => (
        <Rect
          key={"t" + key(c, r)}
          x={gx(c) - CW / 2}
          y={gy(r) - CH / 2}
          width={CW}
          height={CH}
          fill="transparent"
          onPress={() => onPress(c, r)}
        />
      )),
    )}
  </Svg>
);

// ─── PANEL DE CHOIX DE CAPTURE MODERNE ────────────────────────────────────────────────
const CaptureChoicePanel = ({ appMove, retMove, onChoose, onCancel }) => (
  <View style={S.choicePanel}>
    <Text style={S.choiceTitle}>⚔️ Choisissez votre stratégie</Text>
    <View style={S.choiceRow}>
      <TouchableOpacity
        style={[S.choiceBtn, S.choiceBtnRed]}
        onPress={() => onChoose(appMove)}>
        <Text style={S.choiceBtnIcon}>⬆️</Text>
        <Text style={S.choiceBtnLabel}>Attaque Frontale</Text>
        <Text style={S.choiceBtnCount}>
          −{appMove.captured.length} adversaire
          {appMove.captured.length > 1 ? "s" : ""}
        </Text>
        <View style={S.choiceVictimRow}>
          {appMove.captured.map(([cc, cr], i) => (
            <View
              key={i}
              style={[S.choiceVictimDot, { backgroundColor: "#F56565" }]}
            />
          ))}
        </View>
        <Text style={S.choiceBtnSub}>Approche</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[S.choiceBtn, S.choiceBtnBlue]}
        onPress={() => onChoose(retMove)}>
        <Text style={S.choiceBtnIcon}>⬇️</Text>
        <Text style={S.choiceBtnLabel}>Embuscade</Text>
        <Text style={S.choiceBtnCount}>
          −{retMove.captured.length} adversaire
          {retMove.captured.length > 1 ? "s" : ""}
        </Text>
        <View style={S.choiceVictimRow}>
          {retMove.captured.map(([cc, cr], i) => (
            <View
              key={i}
              style={[S.choiceVictimDot, { backgroundColor: "#4299E1" }]}
            />
          ))}
        </View>
        <Text style={S.choiceBtnSub}>Retrait</Text>
      </TouchableOpacity>
    </View>
    <TouchableOpacity style={S.choiceCancelBtn} onPress={onCancel}>
      <Text style={S.choiceCancelTxt}>Annuler</Text>
    </TouchableOpacity>
  </View>
);

// ─── COMPOSANT PRINCIPAL AVEC NOUVEAU STYLE ──────────────────────────────────────
export default function FanoronaGame() {
  const [board, setBoard] = useState(initBoard);
  const [player, setPlayer] = useState(WHITE); // Changed from RED to WHITE
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState("select");
  const [hints, setHints] = useState(new Map());
  const [victims, setVictims] = useState([]);
  const [capturingSet, setCapturingSet] = useState(new Set());
  const [pendingChoice, setPendingChoice] = useState(null);
  const [contMoves, setContMoves] = useState([]);
  const [chainInfo, setChainInfo] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState("⚪ Blanc commence !"); // Changed from red to white
  const [scores, setScores] = useState({ white: 0, dark: 0 }); // Changed from red to white
  const [history, setHistory] = useState([]);
  const [showRules, setShowRules] = useState(false);

  // Helper functions (identiques à l'original)
  const globalHints = useCallback((b, pl) => {
    const caps = allCaptureMoves(b, pl);
    const pks = caps.length === 0 ? allPaikaMoves(b, pl) : [];
    const h = new Map(),
      cs = new Set();
    if (caps.length > 0) {
      caps.forEach((m) => {
        h.set(key(m.to[0], m.to[1]), "capture");
        cs.add(key(m.from[0], m.from[1]));
      });
    } else {
      pks.forEach((m) => h.set(key(m.to[0], m.to[1]), "paika"));
    }
    return { h, cs };
  }, []);

  const pieceHints = useCallback((b, pl, pc, pr) => {
    const caps = allCaptureMoves(b, pl);
    const pks = caps.length === 0 ? allPaikaMoves(b, pl) : [];
    const h = new Map();
    const pieceCaps = caps.filter((m) => m.from[0] === pc && m.from[1] === pr);
    const piecePks = pks.filter((m) => m.from[0] === pc && m.from[1] === pr);
    const victimMap = new Map();
    for (const m of pieceCaps) {
      h.set(key(m.to[0], m.to[1]), "capture");
      const dk = key(m.to[0], m.to[1]);
      if (!victimMap.has(dk)) victimMap.set(dk, { app: [], ret: [] });
      if (m.type === "approach") victimMap.get(dk).app.push(...m.captured);
      if (m.type === "retreat") victimMap.get(dk).ret.push(...m.captured);
    }
    for (const m of piecePks) h.set(key(m.to[0], m.to[1]), "paika");

    const vlist = [];
    for (const [, { app, ret }] of victimMap) {
      for (const [vc, vr] of app) vlist.push([key(vc, vr), "approach"]);
      for (const [vc, vr] of ret) vlist.push([key(vc, vr), "retreat"]);
    }
    const seen = new Map();
    for (const [k, t] of vlist) {
      if (!seen.has(k)) seen.set(k, t);
    }
    const victims = Array.from(seen.entries());

    return { h, victims, pieceCaps, piecePks };
  }, []);

  const contHints = useCallback((contList) => {
    const h = new Map();
    const victimMap = new Map();
    for (const m of contList) {
      h.set(key(m.to[0], m.to[1]), "continuation");
      const dk = key(m.to[0], m.to[1]);
      if (!victimMap.has(dk)) victimMap.set(dk, { app: [], ret: [] });
      if (m.type === "approach") victimMap.get(dk).app.push(...m.captured);
      if (m.type === "retreat") victimMap.get(dk).ret.push(...m.captured);
    }
    const vlist = [];
    for (const [, { app, ret }] of victimMap) {
      for (const [vc, vr] of app) vlist.push([key(vc, vr), "approach"]);
      for (const [vc, vr] of ret) vlist.push([key(vc, vr), "retreat"]);
    }
    const seen = new Map();
    for (const [k, t] of vlist) {
      if (!seen.has(k)) seen.set(k, t);
    }
    return { h, victims: Array.from(seen.entries()) };
  }, []);

  useEffect(() => {
    const b = initBoard();
    const { h, cs } = globalHints(b, WHITE); // Changed from RED to WHITE
    setHints(h);
    setCapturingSet(cs);
  }, []);

  const endTurn = useCallback(
    (nb) => {
      const next = player === WHITE ? DARK : WHITE; // Changed from RED to WHITE
      const { white, dark } = countPieces(nb); // Changed from red to white
      const checkWin = (w) => {
        setGameOver(true);
        setMessage(
          w === WHITE // Changed from RED to WHITE
            ? "🏆 Blanc remporte la victoire ! 🏆"
            : "🏆 Noir remporte la victoire ! 🏆",
        );
        setScores((s) => ({
          white: s.white + (w === WHITE ? 1 : 0), // Changed from red to white
          dark: s.dark + (w === DARK ? 1 : 0),
        }));
        setHints(new Map());
        setVictims([]);
        setCapturingSet(new Set());
      };
      if (white === 0) {
        // Changed from red to white
        checkWin(DARK);
        return;
      }
      if (dark === 0) {
        checkWin(WHITE); // Changed from RED to WHITE
        return;
      }
      const nc = allCaptureMoves(nb, next),
        np = nc.length === 0 ? allPaikaMoves(nb, next) : [];
      if (nc.length === 0 && np.length === 0) {
        checkWin(player);
        return;
      }
      setPlayer(next);
      setPhase("select");
      setSelected(null);
      setChainInfo(null);
      setContMoves([]);
      setPendingChoice(null);
      const { h, cs } = globalHints(nb, next);
      setHints(h);
      setVictims([]);
      setCapturingSet(cs);
      setMessage(next === WHITE ? "⚪ Tour de Blanc" : "⚫ Tour de Noir"); // Changed from red to white
    },
    [player, globalHints],
  );

  const doCapture = useCallback(
    (b, move) => {
      const nb = applyMove(b, move.from, move.to, move.captured);
      setBoard(nb);
      setHistory((h) => [...h.slice(-19), move]);
      setPendingChoice(null);
      const dc = move.to[0] - move.from[0],
        dr = move.to[1] - move.from[1];
      const cont = getContinuations(
        nb,
        move.to[0],
        move.to[1],
        player,
        dc,
        dr,
        move.type,
      );
      if (cont.length === 0) {
        endTurn(nb);
      } else {
        setSelected(move.to);
        setPhase("continue");
        setContMoves(cont);
        setChainInfo({ dc, dr, type: move.type });
        const { h, victims } = contHints(cont);
        setHints(h);
        setVictims(victims);
        setCapturingSet(new Set());
        setMessage(
          "⚡ Enchaînement possible ! Continuez ou touchez votre pièce pour terminer.",
        );
      }
    },
    [player, endTurn, contHints],
  );

  const handlePress = useCallback(
    (c, r) => {
      if (gameOver) return;
      if (pendingChoice) {
        setPendingChoice(null);
        setMessage("Choix annulé. Sélectionnez à nouveau.");
        return;
      }

      if (phase === "continue") {
        if (selected && selected[0] === c && selected[1] === r) {
          endTurn(board);
          return;
        }
        const move = contMoves.find((m) => m.to[0] === c && m.to[1] === r);
        if (!move) {
          setMessage(
            "Touchez une destination rose ou votre pièce pour terminer.",
          );
          return;
        }
        const appM = contMoves.find(
          (m) => m.to[0] === c && m.to[1] === r && m.type === "approach",
        );
        const retM = contMoves.find(
          (m) => m.to[0] === c && m.to[1] === r && m.type === "retreat",
        );
        if (appM && retM) {
          setPendingChoice({ appMove: appM, retMove: retM });
          const v = [];
          appM.captured.forEach(([vc, vr]) =>
            v.push([key(vc, vr), "approach"]),
          );
          retM.captured.forEach(([vc, vr]) => v.push([key(vc, vr), "retreat"]));
          setVictims(v);
          setMessage("Choisissez votre stratégie ci-dessous.");
        } else {
          doCapture(board, move);
        }
        return;
      }

      if (phase === "select") {
        if (board[r][c] !== player) {
          if (board[r][c] !== EMPTY)
            setMessage("⚠️ Ce n'est pas votre pièce !");
          return;
        }
        const caps = allCaptureMoves(board, player);
        const pks = caps.length === 0 ? allPaikaMoves(board, player) : [];
        const pieceCaps = caps.filter(
          (m) => m.from[0] === c && m.from[1] === r,
        );
        const piecePks = pks.filter((m) => m.from[0] === c && m.from[1] === r);
        if (caps.length > 0 && pieceCaps.length === 0) {
          setMessage(
            "⚠️ Capture obligatoire ! Choisissez une pièce avec un halo orange.",
          );
          return;
        }
        if (pieceCaps.length === 0 && piecePks.length === 0) {
          setMessage("Cette pièce est bloquée.");
          return;
        }
        setSelected([c, r]);
        setPhase("move");
        const { h, victims } = pieceHints(board, player, c, r);
        setHints(h);
        setVictims(victims);
        setCapturingSet(new Set());
        if (pieceCaps.length > 0)
          setMessage("🎯 Touchez une destination rouge pour capturer.");
        else setMessage("🕊️ Paika — déplacement simple vers une case verte.");
        return;
      }

      if (phase === "move") {
        if (selected && selected[0] === c && selected[1] === r) {
          setSelected(null);
          setPhase("select");
          const { h, cs } = globalHints(board, player);
          setHints(h);
          setVictims([]);
          setCapturingSet(cs);
          return;
        }
        if (board[r][c] === player) {
          setSelected(null);
          setPhase("select");
          const caps = allCaptureMoves(board, player);
          const pks = caps.length === 0 ? allPaikaMoves(board, player) : [];
          const pieceCaps = caps.filter(
            (m) => m.from[0] === c && m.from[1] === r,
          );
          if (caps.length > 0 && pieceCaps.length === 0) {
            setMessage("⚠️ Capture obligatoire !");
            const { h, cs } = globalHints(board, player);
            setHints(h);
            setVictims([]);
            setCapturingSet(cs);
            return;
          }
          setSelected([c, r]);
          setPhase("move");
          const { h, victims } = pieceHints(board, player, c, r);
          setHints(h);
          setVictims(victims);
          setCapturingSet(new Set());
          if (pieceCaps.length > 0)
            setMessage("🎯 Touchez une destination rouge.");
          else setMessage("🕊️ Paika — touchez où bouger.");
          return;
        }

        const caps = allCaptureMoves(board, player);
        const isPaika = caps.length === 0;

        if (isPaika) {
          if (!canMove(board, selected[0], selected[1], c, r)) {
            setMessage("Destination invalide. Choisissez une case verte.");
            return;
          }
          const nb = applyMove(board, selected, [c, r], []);
          setBoard(nb);
          setHistory((h) => [
            ...h.slice(-19),
            { from: selected, to: [c, r], type: "paika", captured: [] },
          ]);
          endTurn(nb);
          return;
        }

        const destCaps = caps.filter(
          (m) =>
            m.from[0] === selected[0] &&
            m.from[1] === selected[1] &&
            m.to[0] === c &&
            m.to[1] === r,
        );
        if (destCaps.length === 0) {
          setMessage("Destination invalide. Choisissez une case rouge.");
          return;
        }

        const appM = destCaps.find((m) => m.type === "approach");
        const retM = destCaps.find((m) => m.type === "retreat");

        if (appM && retM) {
          setPendingChoice({ appMove: appM, retMove: retM });
          const v = [];
          appM.captured.forEach(([vc, vr]) =>
            v.push([key(vc, vr), "approach"]),
          );
          retM.captured.forEach(([vc, vr]) => v.push([key(vc, vr), "retreat"]));
          setVictims(v);
          setMessage("Choisissez votre stratégie ci-dessous ↓");
        } else {
          doCapture(board, appM || retM);
        }
      }
    },
    [
      board,
      player,
      selected,
      phase,
      contMoves,
      pendingChoice,
      gameOver,
      endTurn,
      doCapture,
      globalHints,
      pieceHints,
    ],
  );

  const resetGame = () => {
    const b = initBoard();
    setBoard(b);
    setPlayer(WHITE); // Changed from RED to WHITE
    setSelected(null);
    setPhase("select");
    setGameOver(false);
    setHistory([]);
    setChainInfo(null);
    setContMoves([]);
    setPendingChoice(null);
    const { h, cs } = globalHints(b, WHITE); // Changed from RED to WHITE
    setHints(h);
    setVictims([]);
    setCapturingSet(cs);
    setMessage("⚪ Blanc commence !"); // Changed from red to white
  };

  const { white: whiteC, dark: darkC } = countPieces(board); // Changed from red to white

  return (
    <SafeAreaView style={S.safe}>
      <ScrollView
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={S.header}>
          <Text style={S.title}>⚔️ FANORONA ⚔️</Text>
          <Text style={S.subtitle}>Jeu Traditionnel Malgache</Text>
        </View>

        <View style={S.scoreRow}>
          <ScoreCard
            label="Blanc"
            count={whiteC}
            wins={scores.white}
            dotColor="#FFFFFF"
            active={player === WHITE && !gameOver}
          />
          <Text style={S.vs}>VS</Text>
          <ScoreCard
            label="Noir"
            count={darkC}
            wins={scores.dark}
            dotColor="#2D3748"
            active={player === DARK && !gameOver}
          />
        </View>

        <View style={[S.msg, gameOver && S.msgWin]}>
          <Text style={S.msgTxt}>{message}</Text>
        </View>

        <View style={S.boardWrap}>
          <Board
            board={board}
            selected={selected}
            hints={hints}
            victims={victims}
            capturingSet={capturingSet}
            onPress={handlePress}
          />
        </View>

        {pendingChoice && (
          <CaptureChoicePanel
            appMove={pendingChoice.appMove}
            retMove={pendingChoice.retMove}
            onChoose={(move) => doCapture(board, move)}
            onCancel={() => {
              setPendingChoice(null);
              setMessage("Choix annulé. Resélectionnez.");
              if (selected) {
                const { h, victims } = pieceHints(
                  board,
                  player,
                  selected[0],
                  selected[1],
                );
                setHints(h);
                setVictims(victims);
              }
            }}
          />
        )}

        <View style={S.legendRow}>
          <LegItem
            color="rgba(72,187,120,0.35)"
            border="#48BB78"
            label="Paika"
          />
          <LegItem
            color="rgba(245,101,101,0.4)"
            border="#F56565"
            label="Capture"
          />
          <LegItem
            color="rgba(236,72,153,0.35)"
            border="#EC489A"
            label="Chaîne"
          />
        </View>
        <View style={S.legendRow}>
          <LegItem
            color="rgba(245,101,101,0.2)"
            border="#F56565"
            label="Victime approche"
            dashed
          />
          <LegItem
            color="rgba(66,153,225,0.2)"
            border="#4299E1"
            label="Victime retrait"
            dashed
          />
        </View>

        <View style={S.btnRow}>
          <TouchableOpacity style={S.btnPrimary} onPress={resetGame}>
            <Text style={S.btnPrimaryText}>🔄 Nouvelle Partie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={S.btnSecondary}
            onPress={() => setShowRules((v) => !v)}>
            <Text style={S.btnSecondaryText}>
              {showRules ? "📖 Masquer" : "📖 Règles"}
            </Text>
          </TouchableOpacity>
        </View>

        {showRules && <RulesPanel />}

        {history.length > 0 && (
          <View style={S.hist}>
            <Text style={S.histTitle}>📜 Historique des mouvements</Text>
            {[...history]
              .reverse()
              .slice(0, 8)
              .map((m, i) => (
                <Text key={i} style={S.histItem}>
                  {m.type === "paika" ? "🕊️" : "⚔️"} ({m.from[0]},{m.from[1]}) →
                  ({m.to[0]},{m.to[1]}){" "}
                  {m.captured?.length > 0 ? `-${m.captured.length}p` : ""}
                </Text>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SOUS-COMPOSANTS AVEC NOUVEAUX STYLES ─────────────────────────────────────────
const ScoreCard = ({ label, count, wins, dotColor, active }) => (
  <View style={[S.scoreCard, active && S.scoreActive]}>
    <View style={[S.scoreDot, { backgroundColor: dotColor }]} />
    <Text style={S.scoreLabel}>{label}</Text>
    <Text style={[S.scoreNum, { color: dotColor }]}>{count}</Text>
    <Text style={S.scoreWins}>🏆 {wins}</Text>
  </View>
);

const LegItem = ({ color, border, label, dashed }) => (
  <View style={S.legItem}>
    <View
      style={[
        S.legDot,
        {
          backgroundColor: color,
          borderColor: border,
          borderStyle: dashed ? "dashed" : "solid",
        },
      ]}
    />
    <Text style={S.legTxt}>{label}</Text>
  </View>
);

const RC = ({ icon, title, color, text }) => (
  <View style={[S.ruleCard, { borderLeftColor: color }]}>
    <Text style={[S.ruleTitle, { color }]}>
      {icon} {title}
    </Text>
    <Text style={S.ruleTxt}>{text}</Text>
  </View>
);

const RulesPanel = () => (
  <View style={S.rulesWrap}>
    <Text style={S.rulesH}>📜 Règles du Jeu</Text>
    <RC
      icon="🎯"
      title="Objectif"
      color="#FFFFFF"
      text="Capturer toutes les pièces adverses ou bloquer l'adversaire."
    />
    <RC
      icon="🏁"
      title="Position Initiale"
      color="#9B59B6"
      text="Rangées 1-2: Noirs\nRangée 3: N B N B VIDE N B N B\nRangées 4-5: Blancs\n22 pièces chacun."
    />
    <RC
      icon="♟"
      title="Déplacement"
      color="#48BB78"
      text="Une case vers intersection adjacente libre. Horizontal, vertical ou diagonal selon les lignes."
    />
    <RC
      icon="⬆️"
      title="Capture par Approche"
      color="#F56565"
      text="Avancez VERS l'ennemi → capture toutes les pièces ennemies devant."
    />
    <RC
      icon="⬇️"
      title="Capture par Retrait"
      color="#4299E1"
      text="Éloignez-vous de l'ennemi → capture toutes les pièces ennemies derrière."
    />
    <RC
      icon="⚡"
      title="Capture en Chaîne"
      color="#EC489A"
      text="Après capture, même pièce peut continuer. Pas de retour arrière."
    />
    <RC
      icon="🕊️"
      title="Coup Paika"
      color="#A0AEC0"
      text="Si aucune capture possible: déplacement simple vers case adjacente libre."
    />
  </View>
);

// ─── STYLES MODERNES ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1A202C" },
  scroll: { padding: 16, alignItems: "center", paddingBottom: 40 },

  header: { alignItems: "center", marginBottom: 16 },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: { fontSize: 12, color: "#A0AEC0", marginTop: 4, letterSpacing: 1 },

  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
    width: "100%",
  },
  scoreCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#2D3748",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#4A5568",
  },
  scoreActive: {
    borderColor: "#FBBF24",
    backgroundColor: "#2A3A4A",
    shadowColor: "#FBBF24",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scoreDot: { width: 20, height: 20, borderRadius: 10, marginBottom: 6 },
  scoreLabel: { fontSize: 12, color: "#CBD5E0", fontWeight: "600" },
  scoreNum: { fontSize: 28, fontWeight: "800", marginVertical: 4 },
  scoreWins: { fontSize: 11, color: "#FBBF24", fontWeight: "600" },
  vs: { fontSize: 20, fontWeight: "700", color: "#FBBF24" },

  msg: {
    backgroundColor: "#2D3748",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4A5568",
  },
  msgWin: { backgroundColor: "#2A3A4A", borderColor: "#FBBF24" },
  msgTxt: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F7FAFC",
    textAlign: "center",
  },

  boardWrap: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    marginBottom: 12,
  },

  choicePanel: {
    width: "100%",
    backgroundColor: "#2D3748",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#4A5568",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FBBF24",
    textAlign: "center",
    marginBottom: 14,
  },
  choiceRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  choiceBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 2,
  },
  choiceBtnRed: {
    backgroundColor: "rgba(245, 101, 101, 0.1)",
    borderColor: "#F56565",
  },
  choiceBtnBlue: {
    backgroundColor: "rgba(66, 153, 225, 0.1)",
    borderColor: "#4299E1",
  },
  choiceBtnIcon: { fontSize: 28, marginBottom: 6 },
  choiceBtnLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F7FAFC",
    marginBottom: 4,
  },
  choiceBtnCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#CBD5E0",
    marginBottom: 6,
  },
  choiceVictimRow: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 4,
  },
  choiceVictimDot: { width: 8, height: 8, borderRadius: 4 },
  choiceBtnSub: { fontSize: 10, color: "#A0AEC0" },
  choiceCancelBtn: { alignItems: "center", paddingVertical: 8, marginTop: 4 },
  choiceCancelTxt: { fontSize: 12, color: "#A0AEC0" },

  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
    justifyContent: "center",
  },
  legItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  legTxt: { fontSize: 11, color: "#CBD5E0" },

  btnRow: { flexDirection: "row", gap: 12, marginBottom: 16, width: "100%" },
  btnPrimary: {
    flex: 1,
    backgroundColor: "#F56565",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#F56565",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#2D3748",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4A5568",
  },
  btnPrimaryText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  btnSecondaryText: { color: "#FBBF24", fontWeight: "600", fontSize: 14 },

  rulesWrap: { width: "100%", marginBottom: 20 },
  rulesH: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FBBF24",
    marginBottom: 12,
    textAlign: "center",
  },
  ruleCard: {
    backgroundColor: "#2D3748",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  ruleTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  ruleTxt: { fontSize: 12, color: "#CBD5E0", lineHeight: 20 },

  hist: {
    width: "100%",
    backgroundColor: "#2D3748",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#4A5568",
  },
  histTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FBBF24",
    marginBottom: 8,
  },
  histItem: { fontSize: 11, color: "#CBD5E0", paddingVertical: 3 },
});
