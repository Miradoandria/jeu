/**
 * FANORONA 9 — Jeu Traditionnel Malgasy
 * Premium Dark Edition — React Native + react-native-svg
 * Modes : Joueur vs Joueur | Joueur vs IA (Minimax + Alpha-Beta + Heuristique)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Dimensions, Animated, Platform,
} from 'react-native';
import Svg, { Circle, Line, Rect, G, Defs, RadialGradient, LinearGradient, Stop } from 'react-native-svg';

const { width: SW } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:          '#0D0D0F',
  surface:     '#141418',
  panel:       '#1A1A20',
  border:      '#2A2A35',
  borderGlow:  '#3D3D52',
  gold:        '#C9A84C',
  goldLight:   '#E8C96A',
  goldDark:    '#8B6914',
  cream:       '#F5EFD6',
  red:         '#C0392B',
  redLight:    '#E74C3C',
  dark:        '#1C1C1E',
  accent:      '#4A90A4',
  hint:        '#27AE60',
  textPrimary: '#F0EAD6',
  textSec:     '#8B8578',
  textDim:     '#4A4540',
  aiColor:     '#7B5EA7',
  aiLight:     '#9B7EC7',
};

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const COLS  = 9;
const ROWS  = 5;
const EMPTY = 0;
const RED   = 1;
const DARK  = 2;

const BOARD_W = Math.min(SW - 24, 460);
const PAD_H   = 28;
const PAD_V   = 28;
const BOARD_H = BOARD_W * 0.55 + PAD_V * 2;
const CW      = (BOARD_W - PAD_H * 2) / (COLS - 1);
const CH      = (BOARD_H - PAD_V * 2) / (ROWS - 1);
const PR      = Math.min(CW, CH) * 0.36;

const gx = (c) => PAD_H + c * CW;
const gy = (r) => PAD_V + r * CH;
const key = (c, r) => `${c},${r}`;
const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

const MODE_PVP = 'pvp';
const MODE_PVA = 'pva';

const AI_LEVELS = {
  easy:   { depth: 1, label: 'FACILE',  desc: 'Débutant',      color: C.hint },
  medium: { depth: 3, label: 'MOYEN',   desc: 'Intermédiaire', color: C.gold },
  expert: { depth: 5, label: 'EXPERT',  desc: 'Maître',        color: C.red  },
};

// ─── LOGIQUE PLATEAU ──────────────────────────────────────────────────────────
const hasDiag = (c, r) => {
  if ((c + r) % 2 !== 0) return false;
  if (c === 4 && r === 2) return false;
  return true;
};
const diagSegExists = (c1, r1, c2, r2) => hasDiag(c1, r1) || hasDiag(c2, r2);
const getDirs = (c, r) => {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  if (hasDiag(c, r)) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  return dirs;
};

const buildSegments = () => {
  const segs = [], seen = new Set();
  const add = (c1,r1,c2,r2) => {
    const a=`${c1},${r1},${c2},${r2}`, b=`${c2},${r2},${c1},${r1}`;
    if (seen.has(a)||seen.has(b)) return;
    seen.add(a); segs.push([c1,r1,c2,r2]);
  };
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (inBounds(c+1,r)) add(c,r,c+1,r);
    if (inBounds(c,r+1)) add(c,r,c,r+1);
    [[1,1],[1,-1]].forEach(([dc,dr])=>{
      const nc=c+dc,nr=r+dr;
      if (inBounds(nc,nr)&&diagSegExists(c,r,nc,nr)) add(c,r,nc,nr);
    });
  }
  return segs;
};
const SEGMENTS  = buildSegments();
const SEG_ORTHO = SEGMENTS.filter(([c1,r1,c2,r2])=>c1===c2||r1===r2);
const SEG_DIAG  = SEGMENTS.filter(([c1,r1,c2,r2])=>c1!==c2&&r1!==r2);

const MID_ROW = [DARK,RED,DARK,RED,EMPTY,DARK,RED,DARK,RED];
const initBoard = () => {
  const b = Array.from({length:ROWS},()=>Array(COLS).fill(EMPTY));
  for (let c=0;c<COLS;c++) {
    b[0][c]=DARK; b[1][c]=DARK;
    b[2][c]=MID_ROW[c];
    b[3][c]=RED;  b[4][c]=RED;
  }
  return b;
};

const opp = p => p===RED?DARK:RED;

const collectLine = (board,sc,sr,dc,dr,enemy) => {
  const list=[]; let nc=sc+dc,nr=sr+dr;
  while (inBounds(nc,nr)&&board[nr][nc]===enemy) { list.push([nc,nr]); nc+=dc; nr+=dr; }
  return list;
};

const getCaptures = (board,fc,fr,tc,tr,player) => {
  const enemy=opp(player),dc=tc-fc,dr=tr-fr;
  return {
    approach: collectLine(board,tc,tr, dc, dr,enemy),
    retreat:  collectLine(board,fc,fr,-dc,-dr,enemy),
  };
};

const canMove = (board,fc,fr,tc,tr) => {
  if (!inBounds(tc,tr)||board[tr][tc]!==EMPTY) return false;
  const dc=tc-fc,dr=tr-fr;
  if (Math.abs(dc)>1||Math.abs(dr)>1) return false;
  if (dc===0||dr===0) return true;
  return diagSegExists(fc,fr,tc,tr);
};

const allCaptureMoves = (board,player) => {
  const moves=[];
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (board[r][c]!==player) continue;
    for (const [dc,dr] of getDirs(c,r)) {
      const tc=c+dc,tr=r+dr;
      if (!canMove(board,c,r,tc,tr)) continue;
      const {approach,retreat}=getCaptures(board,c,r,tc,tr,player);
      if (approach.length>0) moves.push({from:[c,r],to:[tc,tr],type:'approach',captured:approach});
      if (retreat.length>0)  moves.push({from:[c,r],to:[tc,tr],type:'retreat', captured:retreat});
    }
  }
  return moves;
};

const allPaikaMoves = (board,player) => {
  const moves=[];
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (board[r][c]!==player) continue;
    for (const [dc,dr] of getDirs(c,r)) {
      const tc=c+dc,tr=r+dr;
      if (canMove(board,c,r,tc,tr)) moves.push({from:[c,r],to:[tc,tr],type:'paika',captured:[]});
    }
  }
  return moves;
};

const applyMove = (board,from,to,captured) => {
  const nb=board.map(r=>[...r]);
  nb[to[1]][to[0]]=nb[from[1]][from[0]];
  nb[from[1]][from[0]]=EMPTY;
  for (const [cc,cr] of captured) nb[cr][cc]=EMPTY;
  return nb;
};

const getContinuations = (board,c,r,player,lastDC,lastDR,lastType) => {
  const moves=[];
  for (const [dc,dr] of getDirs(c,r)) {
    if (dc===-lastDC&&dr===-lastDR) continue;
    const tc=c+dc,tr=r+dr;
    if (!canMove(board,c,r,tc,tr)) continue;
    const {approach,retreat}=getCaptures(board,c,r,tc,tr,player);
    if (approach.length>0&&!(dc===lastDC&&dr===lastDR&&lastType==='approach'))
      moves.push({from:[c,r],to:[tc,tr],type:'approach',captured:approach});
    if (retreat.length>0&&!(dc===lastDC&&dr===lastDR&&lastType==='retreat'))
      moves.push({from:[c,r],to:[tc,tr],type:'retreat',captured:retreat});
  }
  return moves;
};

const countPieces = board => {
  let red=0,dark=0;
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (board[r][c]===RED)  red++;
    if (board[r][c]===DARK) dark++;
  }
  return {red,dark};
};

const getAllMoves = (board,player) => {
  const caps=allCaptureMoves(board,player);
  return caps.length>0 ? caps : allPaikaMoves(board,player);
};

// ─── IA : HEURISTIQUE ─────────────────────────────────────────────────────────
const CENTER_W = [
  [0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,0],
  [0,1,2,2,3,2,2,1,0],
  [0,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0],
];

const evaluateBoard = (board) => {
  const {red,dark}=countPieces(board);
  if (red===0)  return  100000;
  if (dark===0) return -100000;

  let score = (dark - red) * 10;

  let darkPos=0, redPos=0;
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (board[r][c]===DARK) darkPos+=CENTER_W[r][c];
    if (board[r][c]===RED)  redPos +=CENTER_W[r][c];
  }
  score += (darkPos - redPos) * 0.3;

  const darkMoves=getAllMoves(board,DARK).length;
  const redMoves =getAllMoves(board,RED).length;
  score += (darkMoves - redMoves) * 0.5;

  const darkCaps=allCaptureMoves(board,DARK);
  const redCaps =allCaptureMoves(board,RED);
  const dThreat=darkCaps.reduce((s,m)=>s+m.captured.length,0);
  const rThreat=redCaps.reduce((s,m)=>s+m.captured.length,0);
  score += (dThreat - rThreat) * 1.5;

  const isIso=(board,c,r,p)=>{
    for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nc=c+dc,nr=r+dr;
      if (inBounds(nc,nr)&&board[nr][nc]===p) return false;
    }
    return true;
  };
  let dIso=0,rIso=0;
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (board[r][c]===DARK&&isIso(board,c,r,DARK)) dIso++;
    if (board[r][c]===RED &&isIso(board,c,r,RED))  rIso++;
  }
  score -= (dIso - rIso) * 0.8;

  return score;
};

// ─── IA : MINIMAX + ALPHA-BETA ────────────────────────────────────────────────
const minimax = (board,depth,alpha,beta,isMax,contPiece=null,lastDC=0,lastDR=0,lastType=null) => {
  const {red,dark}=countPieces(board);
  if (red===0)  return {score: 100000};
  if (dark===0) return {score:-100000};
  if (depth===0) return {score:evaluateBoard(board)};

  const player=isMax?DARK:RED;
  let moves;

  if (contPiece) {
    const [cc,cr]=contPiece;
    moves=getContinuations(board,cc,cr,player,lastDC,lastDR,lastType);
    if (moves.length===0) return minimax(board,depth-1,alpha,beta,!isMax);
  } else {
    moves=getAllMoves(board,player);
    if (moves.length===0) return {score:evaluateBoard(board)};
  }

  moves.sort((a,b)=>b.captured.length-a.captured.length);

  let bestMove=null;
  if (isMax) {
    let maxScore=-Infinity;
    for (const move of moves) {
      const nb=applyMove(board,move.from,move.to,move.captured);
      let result;
      if (move.captured.length>0) {
        const dc=move.to[0]-move.from[0],dr=move.to[1]-move.from[1];
        const conts=getContinuations(nb,move.to[0],move.to[1],DARK,dc,dr,move.type);
        result=conts.length>0
          ? minimax(nb,depth,alpha,beta,true,move.to,dc,dr,move.type)
          : minimax(nb,depth-1,alpha,beta,false);
      } else {
        result=minimax(nb,depth-1,alpha,beta,false);
      }
      if (result.score>maxScore){maxScore=result.score;bestMove=move;}
      alpha=Math.max(alpha,maxScore);
      if (beta<=alpha) break;
    }
    return {score:maxScore,move:bestMove};
  } else {
    let minScore=Infinity;
    for (const move of moves) {
      const nb=applyMove(board,move.from,move.to,move.captured);
      let result;
      if (move.captured.length>0) {
        const dc=move.to[0]-move.from[0],dr=move.to[1]-move.from[1];
        const conts=getContinuations(nb,move.to[0],move.to[1],RED,dc,dr,move.type);
        result=conts.length>0
          ? minimax(nb,depth,alpha,beta,false,move.to,dc,dr,move.type)
          : minimax(nb,depth-1,alpha,beta,true);
      } else {
        result=minimax(nb,depth-1,alpha,beta,true);
      }
      if (result.score<minScore){minScore=result.score;bestMove=move;}
      beta=Math.min(beta,minScore);
      if (beta<=alpha) break;
    }
    return {score:minScore,move:bestMove};
  }
};

const computeAIMove = (board,depth) => {
  if (depth===1) {
    const moves=getAllMoves(board,DARK);
    if (!moves.length) return null;
    moves.sort((a,b)=>b.captured.length-a.captured.length);
    const pool=moves.slice(0,Math.max(1,Math.floor(moves.length*0.6)));
    return pool[Math.floor(Math.random()*pool.length)];
  }
  const result=minimax(board,depth,-Infinity,Infinity,true);
  return result.move||null;
};

// ─── SVG COMPONENTS ───────────────────────────────────────────────────────────
const IntersectionDot = ({cx,cy}) => (
  <Circle cx={cx} cy={cy} r={2} fill={C.gold} opacity={0.4}/>
);

const Piece = ({cx,cy,color,selected,canCapture,isAI}) => {
  const isRed=color===RED;
  const selColor=isAI?C.aiLight:(isRed?C.gold:C.cream);
  if (isRed) return (
    <G>
      {selected&&<G>
        <Circle cx={cx} cy={cy} r={PR+9} fill="none" stroke={selColor} strokeWidth={1} opacity={0.3}/>
        <Circle cx={cx} cy={cy} r={PR+6} fill="none" stroke={selColor} strokeWidth={1.5} strokeDasharray="3,2"/>
      </G>}
      {canCapture&&!selected&&<Circle cx={cx} cy={cy} r={PR+7} fill="none" stroke={selColor} strokeWidth={1} opacity={0.5} strokeDasharray="4,3"/>}
      <Circle cx={cx+2} cy={cy+2.5} r={PR} fill="rgba(0,0,0,0.5)"/>
      <Circle cx={cx} cy={cy} r={PR} fill="url(#redGrad)"/>
      <Circle cx={cx} cy={cy} r={PR*0.72} fill="none" stroke="rgba(255,80,60,0.25)" strokeWidth={1}/>
      <Circle cx={cx-PR*0.22} cy={cy-PR*0.28} r={PR*0.32} fill="rgba(255,200,180,0.35)"/>
      <Circle cx={cx} cy={cy} r={PR} fill="none" stroke="rgba(255,60,40,0.4)" strokeWidth={1.2}/>
      <Circle cx={cx} cy={cy} r={PR*0.12} fill="rgba(255,100,80,0.5)"/>
    </G>
  );
  const fill=isAI?'url(#aiGrad)':'url(#darkGrad)';
  const rim=isAI?'rgba(155,126,199,0.3)':'rgba(255,255,255,0.12)';
  return (
    <G>
      {selected&&<G>
        <Circle cx={cx} cy={cy} r={PR+9} fill="none" stroke={selColor} strokeWidth={1} opacity={0.3}/>
        <Circle cx={cx} cy={cy} r={PR+6} fill="none" stroke={selColor} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.8}/>
      </G>}
      {canCapture&&!selected&&<Circle cx={cx} cy={cy} r={PR+7} fill="none" stroke={selColor} strokeWidth={1} opacity={0.4} strokeDasharray="4,3"/>}
      <Circle cx={cx+2} cy={cy+2.5} r={PR} fill="rgba(0,0,0,0.6)"/>
      <Circle cx={cx} cy={cy} r={PR} fill={fill}/>
      <Circle cx={cx} cy={cy} r={PR*0.72} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1}/>
      <Circle cx={cx-PR*0.22} cy={cy-PR*0.28} r={PR*0.28} fill="rgba(255,255,255,0.18)"/>
      <Circle cx={cx} cy={cy} r={PR} fill="none" stroke={rim} strokeWidth={1.2}/>
      <Circle cx={cx} cy={cy} r={PR*0.12} fill="rgba(255,255,255,0.15)"/>
    </G>
  );
};

const MoveHint = ({cx,cy,hintType}) => {
  if (hintType==='paika') return <G>
    <Circle cx={cx} cy={cy} r={PR*0.58} fill="rgba(39,174,96,0.12)" stroke={C.hint} strokeWidth={1.5} opacity={0.8}/>
    <Circle cx={cx} cy={cy} r={PR*0.2} fill={C.hint} opacity={0.9}/>
  </G>;
  if (hintType==='capture') return <G>
    <Circle cx={cx} cy={cy} r={PR*0.62} fill="rgba(192,57,43,0.15)" stroke={C.redLight} strokeWidth={1.5} opacity={0.9}/>
    <Circle cx={cx} cy={cy} r={PR*0.22} fill={C.redLight} opacity={0.9}/>
  </G>;
  if (hintType==='continuation') return <G>
    <Circle cx={cx} cy={cy} r={PR*0.65} fill="rgba(74,144,164,0.18)" stroke={C.accent} strokeWidth={1.5} opacity={0.9}/>
    <Circle cx={cx} cy={cy} r={PR*0.2} fill={C.accent} opacity={0.9}/>
  </G>;
  return null;
};

const VictimMark = ({cx,cy,victimType}) => {
  const stroke=victimType==='retreat'?C.accent:C.redLight;
  const fill=victimType==='retreat'?'rgba(74,144,164,0.1)':'rgba(192,57,43,0.1)';
  const s=PR*0.36;
  return <G>
    <Circle cx={cx} cy={cy} r={PR*0.6} fill={fill} stroke={stroke} strokeWidth={1} strokeDasharray="3,2"/>
    <Line x1={cx-s} y1={cy-s} x2={cx+s} y2={cy+s} stroke={stroke} strokeWidth={2} strokeLinecap="round"/>
    <Line x1={cx+s} y1={cy-s} x2={cx-s} y2={cy+s} stroke={stroke} strokeWidth={2} strokeLinecap="round"/>
  </G>;
};

const Board = ({board,selected,hints,victims,capturingSet,onPress,mode}) => (
  <Svg width={BOARD_W} height={BOARD_H}>
    <Defs>
      <RadialGradient id="boardBg" cx="50%" cy="45%" rx="65%" ry="65%">
        <Stop offset="0%"   stopColor="#1F1A12"/>
        <Stop offset="60%"  stopColor="#17130C"/>
        <Stop offset="100%" stopColor="#100E08"/>
      </RadialGradient>
      <RadialGradient id="redGrad" cx="35%" cy="28%" rx="70%" ry="70%">
        <Stop offset="0%"   stopColor="#E85B4A"/>
        <Stop offset="45%"  stopColor="#C0392B"/>
        <Stop offset="100%" stopColor="#7A1010"/>
      </RadialGradient>
      <RadialGradient id="darkGrad" cx="32%" cy="25%" rx="70%" ry="70%">
        <Stop offset="0%"   stopColor="#484848"/>
        <Stop offset="45%"  stopColor="#2A2A2A"/>
        <Stop offset="100%" stopColor="#101010"/>
      </RadialGradient>
      <RadialGradient id="aiGrad" cx="32%" cy="25%" rx="70%" ry="70%">
        <Stop offset="0%"   stopColor="#9B7EC7"/>
        <Stop offset="45%"  stopColor="#5C3D8F"/>
        <Stop offset="100%" stopColor="#2A1A50"/>
      </RadialGradient>
      <LinearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%"   stopColor={C.gold} stopOpacity={0.6}/>
        <Stop offset="50%"  stopColor={C.goldDark} stopOpacity={0.2}/>
        <Stop offset="100%" stopColor={C.gold} stopOpacity={0.5}/>
      </LinearGradient>
      <RadialGradient id="cornerGlow" cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0%"   stopColor={C.gold} stopOpacity={0.3}/>
        <Stop offset="100%" stopColor={C.gold} stopOpacity={0}/>
      </RadialGradient>
    </Defs>
    <Rect x={0} y={0} width={BOARD_W} height={BOARD_H} rx={12} fill="url(#boardBg)"/>
    <Rect x={0.5} y={0.5} width={BOARD_W-1} height={BOARD_H-1} rx={12} fill="none" stroke="url(#borderGrad)" strokeWidth={1.5}/>
    <Rect x={8} y={8} width={BOARD_W-16} height={BOARD_H-16} rx={8} fill="none" stroke={C.gold} strokeWidth={0.5} opacity={0.12}/>
    {[[PAD_H-10,PAD_V-10],[BOARD_W-PAD_H+10,PAD_V-10],[PAD_H-10,BOARD_H-PAD_V+10],[BOARD_W-PAD_H+10,BOARD_H-PAD_V+10]].map(([ox,oy],i)=>(
      <Circle key={`co${i}`} cx={ox} cy={oy} r={10} fill="url(#cornerGlow)"/>
    ))}
    {[[PAD_H,PAD_V],[BOARD_W-PAD_H,PAD_V],[PAD_H,BOARD_H-PAD_V],[BOARD_W-PAD_H,BOARD_H-PAD_V]].map(([ox,oy],i)=>(
      <Circle key={`cd${i}`} cx={ox} cy={oy} r={2.5} fill={C.gold} opacity={0.6}/>
    ))}
    {SEG_DIAG.map(([c1,r1,c2,r2],i)=>(
      <Line key={'d'+i} x1={gx(c1)} y1={gy(r1)} x2={gx(c2)} y2={gy(r2)} stroke={C.gold} strokeWidth={0.6} opacity={0.2}/>
    ))}
    {SEG_ORTHO.map(([c1,r1,c2,r2],i)=>(
      <Line key={'o'+i} x1={gx(c1)} y1={gy(r1)} x2={gx(c2)} y2={gy(r2)} stroke={C.gold} strokeWidth={1} opacity={0.45}/>
    ))}
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>(
      board[r][c]===EMPTY&&!hints?.get(key(c,r))&&<IntersectionDot key={`dot${key(c,r)}`} cx={gx(c)} cy={gy(r)}/>
    )))}
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
      const h=hints?.get(key(c,r));
      return h?<MoveHint key={'h'+key(c,r)} cx={gx(c)} cy={gy(r)} hintType={h}/>:null;
    }))}
    <G>
      <Circle cx={gx(4)} cy={gy(2)} r={4} fill="none" stroke={C.gold} strokeWidth={0.8} opacity={0.35}/>
      <Circle cx={gx(4)} cy={gy(2)} r={1.5} fill={C.gold} opacity={0.3}/>
    </G>
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>{
      const cell=board[r][c];
      if (cell===EMPTY) return null;
      const isAIPiece=mode===MODE_PVA&&cell===DARK;
      return <Piece key={key(c,r)} cx={gx(c)} cy={gy(r)} color={cell} isAI={isAIPiece}
               selected={selected&&selected[0]===c&&selected[1]===r}
               canCapture={capturingSet?.has(key(c,r))}/>;
    }))}
    {victims&&Array.from(victims).map(([k,t])=>{
      const [c,r]=k.split(',').map(Number);
      return <VictimMark key={'v'+k} cx={gx(c)} cy={gy(r)} victimType={t}/>;
    })}
    {Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>(
      <Rect key={'t'+key(c,r)} x={gx(c)-CW/2} y={gy(r)-CH/2} width={CW} height={CH}
            fill="transparent" onPress={()=>onPress(c,r)}/>
    )))}
  </Svg>
);

// ─── ÉCRAN MENU ───────────────────────────────────────────────────────────────
const ModeSelectScreen = ({onSelect}) => {
  const [selMode,setSelMode]=useState(null);
  const [selLevel,setSelLevel]=useState('medium');
  const fade=useRef(new Animated.Value(0)).current;
  useEffect(()=>{ Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start(); },[]);

  return (
    <Animated.View style={[MS.container,{opacity:fade}]}>
      <View style={MS.header}>
        <Text style={MS.titleSmall}>ᱵ FANORONA ᱵ</Text>
        <Text style={MS.titleMain}>CHOISIR UN MODE</Text>
        <View style={MS.divider}/>
      </View>

      {/* PvP */}
      <TouchableOpacity style={[MS.modeCard,selMode===MODE_PVP&&MS.modeCardActive]} onPress={()=>setSelMode(MODE_PVP)} activeOpacity={0.8}>
        <View style={MS.modeCardLeft}><Text style={MS.modeIcon}>⚔️</Text></View>
        <View style={MS.modeCardBody}>
          <Text style={[MS.modeTitle,selMode===MODE_PVP&&{color:C.gold}]}>JOUEUR vs JOUEUR</Text>
          <Text style={MS.modeDesc}>Deux joueurs sur le même appareil</Text>
          <View style={MS.modeTags}>
            <View style={MS.tag}><Text style={MS.tagText}>LOCAL</Text></View>
            <View style={MS.tag}><Text style={MS.tagText}>2 JOUEURS</Text></View>
          </View>
        </View>
        {selMode===MODE_PVP&&<View style={MS.checkDot}/>}
      </TouchableOpacity>

      {/* PvA */}
      <TouchableOpacity style={[MS.modeCard,selMode===MODE_PVA&&MS.modeCardActiveAI]} onPress={()=>setSelMode(MODE_PVA)} activeOpacity={0.8}>
        <View style={MS.modeCardLeft}><Text style={MS.modeIcon}>🤖</Text></View>
        <View style={MS.modeCardBody}>
          <Text style={[MS.modeTitle,selMode===MODE_PVA&&{color:C.aiLight}]}>JOUEUR vs IA</Text>
          <Text style={MS.modeDesc}>Affrontez l'intelligence artificielle</Text>
          <View style={MS.modeTags}>
            <View style={MS.tag}><Text style={MS.tagText}>MINIMAX</Text></View>
            <View style={MS.tag}><Text style={MS.tagText}>ALPHA-BETA</Text></View>
          </View>
        </View>
        {selMode===MODE_PVA&&<View style={[MS.checkDot,{backgroundColor:C.aiLight}]}/>}
      </TouchableOpacity>

      {/* Niveau IA */}
      {selMode===MODE_PVA&&(
        <View style={MS.levelSection}>
          <Text style={MS.levelTitle}>NIVEAU DE DIFFICULTÉ</Text>
          <View style={MS.levelRow}>
            {Object.entries(AI_LEVELS).map(([lvl,info])=>(
              <TouchableOpacity key={lvl}
                style={[MS.levelBtn,selLevel===lvl&&{borderColor:info.color,backgroundColor:'rgba(0,0,0,0.3)'}]}
                onPress={()=>setSelLevel(lvl)} activeOpacity={0.75}>
                <Text style={[MS.levelBtnLabel,selLevel===lvl&&{color:info.color}]}>{info.label}</Text>
                <Text style={MS.levelBtnDesc}>{info.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[MS.startBtn,!selMode&&MS.startBtnDisabled]}
        onPress={()=>selMode&&onSelect(selMode,selMode===MODE_PVA?selLevel:null)}
        activeOpacity={0.8} disabled={!selMode}>
        <Text style={[MS.startBtnText,!selMode&&{color:C.textDim}]}>
          {selMode?'DÉMARRER LA PARTIE':'CHOISIR UN MODE'}
        </Text>
      </TouchableOpacity>

      <Text style={MS.footer}>Jeu de plateau traditionnel malgasy</Text>
    </Animated.View>
  );
};

// ─── UI PANELS ────────────────────────────────────────────────────────────────
const CaptureChoicePanel = ({appMove,retMove,onChoose,onCancel}) => {
  const fade=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(fade,{toValue:1,duration:200,useNativeDriver:true}).start();},[]);
  return (
    <Animated.View style={[S.choicePanel,{opacity:fade}]}>
      <View style={S.choicePanelInner}>
        <Text style={S.choiceDivider}>──────────────────────</Text>
        <Text style={S.choiceTitle}>CHOISIR LA CAPTURE</Text>
        <Text style={S.choiceDivider}>──────────────────────</Text>
        <View style={S.choiceRow}>
          <TouchableOpacity style={S.choiceBtnApproach} onPress={()=>onChoose(appMove)} activeOpacity={0.75}>
            <Text style={S.choiceBtnIcon}>▲</Text>
            <Text style={S.choiceBtnLabel}>APPROCHE</Text>
            <Text style={S.choiceBtnCount}>−{appMove.captured.length} pièce{appMove.captured.length>1?'s':''}</Text>
          </TouchableOpacity>
          <View style={S.choiceSep}/>
          <TouchableOpacity style={S.choiceBtnRetreat} onPress={()=>onChoose(retMove)} activeOpacity={0.75}>
            <Text style={S.choiceBtnIcon}>▼</Text>
            <Text style={S.choiceBtnLabel}>RETRAIT</Text>
            <Text style={S.choiceBtnCount}>−{retMove.captured.length} pièce{retMove.captured.length>1?'s':''}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={S.choiceCancelBtn} onPress={onCancel} activeOpacity={0.6}>
          <Text style={S.choiceCancelText}>ANNULER</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const AIThinkingBar = ({level}) => {
  const dot=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const a=Animated.loop(Animated.sequence([
      Animated.timing(dot,{toValue:1,duration:600,useNativeDriver:true}),
      Animated.timing(dot,{toValue:0,duration:600,useNativeDriver:true}),
    ]));
    a.start(); return ()=>a.stop();
  },[]);
  const info=AI_LEVELS[level]||AI_LEVELS.medium;
  return (
    <View style={[S.aiBar,{borderColor:info.color}]}>
      <Animated.View style={[S.aiPulse,{opacity:dot,backgroundColor:info.color}]}/>
      <Text style={[S.aiBarText,{color:info.color}]}>IA RÉFLÉCHIT...</Text>
      <View style={[S.aiLevelTag,{borderColor:info.color}]}>
        <Text style={[S.aiLevelTagText,{color:info.color}]}>{info.label}</Text>
      </View>
    </View>
  );
};

const ScoreBadge = ({color,count,label,active,isAI}) => {
  const bc=isAI?C.aiColor:(active?C.gold:C.border);
  const bg=isAI?'rgba(91,62,143,0.15)':(active?'#1E1C14':C.panel);
  const dc=color===RED?C.red:(isAI?C.aiColor:C.textSec);
  return (
    <View style={[S.scoreBadge,{borderColor:bc,backgroundColor:bg}]}>
      <View style={[S.scoreColorDot,{backgroundColor:dc}]}/>
      <Text style={S.scoreLabel}>{label}</Text>
      <Text style={S.scoreCount}>{count}</Text>
      {active&&<View style={[S.activePip,{backgroundColor:isAI?C.aiLight:C.gold}]}/>}
    </View>
  );
};

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────
export default function FanoronaGame() {
  const [screen,setScreen]             = useState('menu');
  const [mode,setMode]                 = useState(MODE_PVP);
  const [aiLevel,setAiLevel]           = useState('medium');
  const [board,setBoard]               = useState(initBoard);
  const [player,setPlayer]             = useState(RED);
  const [selected,setSelected]         = useState(null);
  const [phase,setPhase]               = useState('select');
  const [hints,setHints]               = useState(new Map());
  const [victims,setVictims]           = useState([]);
  const [capturingSet,setCapturingSet] = useState(new Set());
  const [pendingChoice,setPendingChoice] = useState(null);
  const [gameOver,setGameOver]         = useState(false);
  const [message,setMessage]           = useState('');
  const [messageType,setMessageType]   = useState('red');
  const [history,setHistory]           = useState([]);
  const [moveCount,setMoveCount]       = useState(0);
  const [aiThinking,setAiThinking]     = useState(false);
  const aiThinkingRef = useRef(false); // true quand l'IA est déjà en train de calculer
  const boardRef      = useRef(initBoard()); // toujours à jour, lisible dans les timeouts

  const msgAnim=useRef(new Animated.Value(1)).current;
  const aiTimer=useRef(null);

  const pulse=()=>{
    Animated.sequence([
      Animated.timing(msgAnim,{toValue:0.7,duration:80,useNativeDriver:true}),
      Animated.timing(msgAnim,{toValue:1,duration:130,useNativeDriver:true}),
    ]).start();
  };
  const setMsg=useCallback((txt,type='info')=>{ pulse(); setMessage(txt); setMessageType(type); },[]);

  const globalHints=useCallback((b,pl)=>{
    const caps=allCaptureMoves(b,pl);
    const pks=caps.length===0?allPaikaMoves(b,pl):[];
    const h=new Map(),cs=new Set();
    if (caps.length>0) caps.forEach(m=>{ h.set(key(m.to[0],m.to[1]),'capture'); cs.add(key(m.from[0],m.from[1])); });
    else pks.forEach(m=>h.set(key(m.to[0],m.to[1]),'paika'));
    return {h,cs};
  },[]);

  const pieceHints=useCallback((b,pl,pc,pr)=>{
    const caps=allCaptureMoves(b,pl);
    const pks=caps.length===0?allPaikaMoves(b,pl):[];
    const h=new Map();
    const pieceCaps=caps.filter(m=>m.from[0]===pc&&m.from[1]===pr);
    const vm=new Map();
    for (const m of pieceCaps) {
      h.set(key(m.to[0],m.to[1]),'capture');
      const dk=key(m.to[0],m.to[1]);
      if (!vm.has(dk)) vm.set(dk,{app:[],ret:[]});
      if (m.type==='approach') vm.get(dk).app.push(...m.captured);
      if (m.type==='retreat')  vm.get(dk).ret.push(...m.captured);
    }
    for (const m of pks.filter(m=>m.from[0]===pc&&m.from[1]===pr))
      h.set(key(m.to[0],m.to[1]),'paika');
    const vlist=[];
    for (const [,{app,ret}] of vm) {
      for (const [vc,vr] of app) vlist.push([key(vc,vr),'approach']);
      for (const [vc,vr] of ret) vlist.push([key(vc,vr),'retreat']);
    }
    return {h,victims:vlist};
  },[]);

  const endTurn=useCallback((nb,currentPlayer)=>{
    boardRef.current = nb; // sync ref
    const next=currentPlayer===RED?DARK:RED;
    const {red,dark}=countPieces(nb);
    if (red===0||dark===0) {
      setGameOver(true);
      setMsg(red===0?'NOIR REMPORTE LA VICTOIRE':'ROUGE REMPORTE LA VICTOIRE','win');
      return;
    }
    setPlayer(next); setPhase('select'); setSelected(null); setPendingChoice(null);
    const {h,cs}=globalHints(nb,next);
    setHints(h); setVictims([]); setCapturingSet(cs);
    setMoveCount(n=>n+1);
    const isNextAI=mode===MODE_PVA&&next===DARK;
    if (isNextAI) setMsg("TOUR DE L'IA",'ai');
    else setMsg(next===RED?'TOUR DE ROUGE':'TOUR DE NOIR',next===RED?'red':'dark');
  },[globalHints,mode,setMsg]);

  const doCapture=useCallback((b,move,currentPlayer)=>{
    const nb=applyMove(b,move.from,move.to,move.captured);
    boardRef.current = nb; // sync ref
    setBoard(nb); setHistory(h=>[...h,move]);
    setMsg(`CAPTURE × ${move.captured.length}`,'capture');
    const cont=getContinuations(nb,move.to[0],move.to[1],currentPlayer,
      move.to[0]-move.from[0],move.to[1]-move.from[1],move.type);
    if (cont.length===0) endTurn(nb,currentPlayer);
    else { setSelected(move.to); setPhase('continue'); setMsg('CONTINUER LA CAPTURE','capture'); }
  },[endTurn,setMsg]);

  const startGame=useCallback((selMode,selLevel)=>{
    clearTimeout(aiTimer.current);
    aiThinkingRef.current = false;
    const nb=initBoard();
    boardRef.current = nb; // sync ref
    setMode(selMode); setAiLevel(selLevel||'medium');
    setBoard(nb); setPlayer(RED); setSelected(null); setPhase('select');
    setPendingChoice(null); setGameOver(false); setHistory([]); setMoveCount(0); setAiThinking(false);
    const {h,cs}=globalHints(nb,RED);
    setHints(h); setVictims([]); setCapturingSet(cs);
    setMsg('ROUGE COMMENCE','red');
    setScreen('game');
  },[globalHints,setMsg]);

  // IA auto-play
  // On utilise boardRef pour lire le plateau sans le mettre dans les deps (évite boucle infinie)
  // On utilise aiThinkingRef comme guard sans le mettre dans les deps non plus
  useEffect(()=>{
    if (screen!=='game' || mode!==MODE_PVA || player!==DARK || gameOver) return;
    if (aiThinkingRef.current) return; // déjà en cours

    aiThinkingRef.current = true;
    setAiThinking(true);

    const depth = AI_LEVELS[aiLevel]?.depth || 3;
    const delay = aiLevel==='easy' ? 400 : aiLevel==='medium' ? 700 : 1100;

    aiTimer.current = setTimeout(()=>{
      const currentBoard = boardRef.current; // lecture fraîche sans dep
      const move = computeAIMove(currentBoard, depth);

      aiThinkingRef.current = false;
      setAiThinking(false);

      if (!move) { endTurn(currentBoard, DARK); return; }

      const nb = applyMove(currentBoard, move.from, move.to, move.captured);
      boardRef.current = nb;
      setBoard(nb);
      setHistory(h=>[...h, move]);

      const dc = move.to[0]-move.from[0], dr = move.to[1]-move.from[1];
      const cont = move.captured.length > 0
        ? getContinuations(nb, move.to[0], move.to[1], DARK, dc, dr, move.type)
        : [];

      if (cont.length > 0) {
        const best = cont.sort((a,b)=>b.captured.length-a.captured.length)[0];
        const nb2 = applyMove(nb, best.from, best.to, best.captured);
        boardRef.current = nb2;
        setBoard(nb2);
        setHistory(h=>[...h, best]);
        endTurn(nb2, DARK);
      } else {
        endTurn(nb, DARK);
      }
    }, delay);

    return ()=>{ clearTimeout(aiTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen, mode, player, gameOver, aiLevel, endTurn]);

  const handlePress=useCallback((c,r)=>{
    if (gameOver||aiThinking) return;
    if (mode===MODE_PVA&&player===DARK) return;
    if (phase==='select'&&board[r][c]===player) {
      setSelected([c,r]); setPhase('move');
      const {h,victims}=pieceHints(board,player,c,r);
      setHints(h); setVictims(victims);
    } else if (phase==='move') {
      const caps=allCaptureMoves(board,player);
      const m=caps.find(m=>m.from[0]===selected[0]&&m.from[1]===selected[1]&&m.to[0]===c&&m.to[1]===r);
      if (m) {
        const alt=caps.find(x=>x.from[0]===m.from[0]&&x.from[1]===m.from[1]&&x.to[0]===m.to[0]&&x.to[1]===m.to[1]&&x.type!==m.type);
        if (alt) setPendingChoice({appMove:m.type==='approach'?m:alt,retMove:m.type==='retreat'?m:alt});
        else doCapture(board,m,player);
      } else if (caps.length===0&&canMove(board,selected[0],selected[1],c,r)) {
        const nb=applyMove(board,selected,[c,r],[]);
        boardRef.current = nb;
        setBoard(nb); endTurn(nb,player);
      } else {
        setSelected(null); setPhase('select');
        const {h,cs}=globalHints(board,player);
        setHints(h); setCapturingSet(cs);
      }
    }
  },[board,player,selected,phase,gameOver,mode,aiThinking,doCapture,endTurn,pieceHints,globalHints]);

  const goMenu=()=>{ clearTimeout(aiTimer.current); aiThinkingRef.current=false; setAiThinking(false); setScreen('menu'); };

  // ── Menu screen ──
  if (screen==='menu') return (
    <SafeAreaView style={S.safe}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <ModeSelectScreen onSelect={startGame}/>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Game screen ──
  const {red:redCount,dark:darkCount}=countPieces(board);
  const msgColor=messageType==='red'?C.red:messageType==='dark'?C.textSec:messageType==='win'?C.gold:messageType==='ai'?C.aiLight:messageType==='capture'?C.accent:C.textPrimary;
  const isAIMode=mode===MODE_PVA;
  const darkLabel=isAIMode?`IA · ${AI_LEVELS[aiLevel]?.label}`:'NOIR';

  return (
    <SafeAreaView style={S.safe}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        <View style={S.header}>
          <TouchableOpacity style={S.backBtn} onPress={goMenu} activeOpacity={0.7}>
            <Text style={S.backBtnText}>← MENU</Text>
          </TouchableOpacity>
          <View style={S.headerCenter}>
            <Text style={S.title}>FANORONA</Text>
            <View style={[S.modeBadge,isAIMode&&S.modeBadgeAI]}>
              <Text style={[S.modeBadgeText,isAIMode&&{color:C.aiLight}]}>
                {isAIMode?`IA · ${AI_LEVELS[aiLevel]?.label}`:'JOUEUR vs JOUEUR'}
              </Text>
            </View>
          </View>
          <View style={{width:60}}/>
        </View>

        <View style={S.headerDivider}/>

        <View style={S.scoreRow}>
          <ScoreBadge color={RED}  count={redCount}  label="ROUGE"    active={player===RED&&!gameOver}  isAI={false}/>
          <View style={S.scoreMid}>
            <Text style={S.moveLabel}>COUP</Text>
            <Text style={S.moveNum}>{moveCount}</Text>
          </View>
          <ScoreBadge color={DARK} count={darkCount} label={darkLabel} active={(isAIMode?player===DARK:player===DARK)&&!gameOver} isAI={isAIMode}/>
        </View>

        {aiThinking ? (
          <AIThinkingBar level={aiLevel}/>
        ) : (
          <Animated.View style={[S.statusBar,{opacity:msgAnim}]}>
            <View style={[S.statusDot,{backgroundColor:msgColor}]}/>
            <Text style={[S.statusText,{color:msgColor}]}>{message}</Text>
            <View style={[S.statusDot,{backgroundColor:msgColor}]}/>
          </Animated.View>
        )}

        <View style={S.boardWrap}>
          <Board board={board} selected={selected} hints={hints} victims={victims}
                 capturingSet={capturingSet} onPress={handlePress} mode={mode}/>
        </View>

        {pendingChoice&&(
          <CaptureChoicePanel
            appMove={pendingChoice.appMove} retMove={pendingChoice.retMove}
            onChoose={(m)=>{setPendingChoice(null);doCapture(board,m,player);}}
            onCancel={()=>setPendingChoice(null)}/>
        )}

        {gameOver&&(
          <View style={S.gameOverBanner}>
            <Text style={S.gameOverText}>{message}</Text>
          </View>
        )}

        <View style={S.controls}>
          <TouchableOpacity style={S.resetBtn} onPress={goMenu} activeOpacity={0.8}>
            <View style={S.resetBtnInner}>
              <Text style={S.resetBtnText}>← RETOUR AU MENU</Text>
            </View>
          </TouchableOpacity>
        </View>

        {history.length>0&&(
          <View style={S.histSection}>
            <Text style={S.histTitle}>DERNIERS COUPS</Text>
            <View style={S.histList}>
              {history.slice(-4).reverse().map((h,i)=>(
                <View key={i} style={[S.histItem,i===0&&S.histItemLatest]}>
                  <Text style={S.histItemText}>
                    {h.type==='approach'?'▲ Approche':'▼ Retrait'} · {h.captured.length} prise{h.captured.length>1?'s':''}
                  </Text>
                  <Text style={S.histItemSub}>[{h.from[0]},{h.from[1]}]→[{h.to[0]},{h.to[1]}]</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={S.legend}>
          <View style={S.legendRow}>
            <View style={[S.legendDot,{backgroundColor:C.hint}]}/><Text style={S.legendText}>Libre </Text>
            <View style={[S.legendDot,{backgroundColor:C.red}]}/><Text style={S.legendText}>Capture </Text>
            <View style={[S.legendDot,{backgroundColor:C.accent}]}/><Text style={S.legendText}>Continuation</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES MENU ──────────────────────────────────────────────────────────────
const MS = StyleSheet.create({
  container: { width:'100%', alignItems:'center', paddingTop:20 },
  header:    { alignItems:'center', marginBottom:28, width:'100%' },
  titleSmall:{ color:C.gold, fontSize:11, letterSpacing:5, fontFamily:Platform.OS==='ios'?'Georgia':'serif', opacity:0.7 },
  titleMain: { color:C.textPrimary, fontSize:22, fontWeight:'700', letterSpacing:4, marginVertical:6, fontFamily:Platform.OS==='ios'?'Georgia':'serif' },
  divider:   { width:80, height:1, backgroundColor:C.gold, opacity:0.3, marginTop:8 },

  modeCard:        { width:BOARD_W, flexDirection:'row', backgroundColor:C.panel, borderWidth:1, borderColor:C.border, borderRadius:10, padding:16, marginBottom:12, alignItems:'center' },
  modeCardActive:  { borderColor:C.gold, backgroundColor:'#1E1B10' },
  modeCardActiveAI:{ borderColor:C.aiColor, backgroundColor:'#160F22' },
  modeCardLeft:    { width:44, alignItems:'center' },
  modeIcon:        { fontSize:26 },
  modeCardBody:    { flex:1, paddingLeft:12 },
  modeTitle:       { color:C.textPrimary, fontSize:13, fontWeight:'700', letterSpacing:2, marginBottom:4 },
  modeDesc:        { color:C.textSec, fontSize:11, letterSpacing:0.5, marginBottom:8 },
  modeTags:        { flexDirection:'row', gap:6 },
  tag:             { borderWidth:1, borderColor:C.border, borderRadius:3, paddingHorizontal:6, paddingVertical:2 },
  tagText:         { color:C.textDim, fontSize:8, letterSpacing:1 },
  checkDot:        { width:10, height:10, borderRadius:5, backgroundColor:C.gold, marginLeft:8 },

  levelSection:    { width:BOARD_W, marginBottom:16, padding:16, backgroundColor:C.surface, borderWidth:1, borderColor:C.aiColor, borderRadius:8 },
  levelTitle:      { color:C.aiLight, fontSize:10, letterSpacing:3, marginBottom:12, textAlign:'center' },
  levelRow:        { flexDirection:'row', gap:8 },
  levelBtn:        { flex:1, alignItems:'center', paddingVertical:10, backgroundColor:C.panel, borderWidth:1, borderColor:C.border, borderRadius:6 },
  levelBtnLabel:   { color:C.textSec, fontSize:10, letterSpacing:2, fontWeight:'700', marginBottom:3 },
  levelBtnDesc:    { color:C.textDim, fontSize:9, letterSpacing:0.5 },

  startBtn:        { width:BOARD_W, borderWidth:1, borderColor:C.gold, borderRadius:8, paddingVertical:15, alignItems:'center', backgroundColor:'rgba(201,168,76,0.08)', marginBottom:20 },
  startBtnDisabled:{ borderColor:C.border, backgroundColor:C.surface },
  startBtnText:    { color:C.gold, fontSize:12, letterSpacing:4, fontWeight:'700' },
  footer:          { color:C.textDim, fontSize:10, letterSpacing:2, marginBottom:20 },
});

// ─── STYLES JEU ───────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe:   { flex:1, backgroundColor:C.bg },
  scroll: { paddingVertical:16, paddingHorizontal:12, alignItems:'center' },

  header:       { flexDirection:'row', alignItems:'center', width:BOARD_W, marginBottom:8 },
  backBtn:      { width:60, paddingVertical:6 },
  backBtnText:  { color:C.textDim, fontSize:10, letterSpacing:1 },
  headerCenter: { flex:1, alignItems:'center' },
  title:        { fontFamily:Platform.OS==='ios'?'Georgia':'serif', fontSize:22, fontWeight:'700', color:C.gold, letterSpacing:6 },
  modeBadge:    { marginTop:4, paddingHorizontal:10, paddingVertical:3, backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:4 },
  modeBadgeAI:  { borderColor:C.aiColor, backgroundColor:'rgba(91,62,143,0.1)' },
  modeBadgeText:{ color:C.textDim, fontSize:8, letterSpacing:2 },
  headerDivider:{ width:BOARD_W, height:1, backgroundColor:C.gold, opacity:0.15, marginBottom:12 },

  scoreRow:      { flexDirection:'row', alignItems:'center', width:BOARD_W, marginBottom:10 },
  scoreBadge:    { flex:1, flexDirection:'row', alignItems:'center', borderWidth:1, borderRadius:6, paddingHorizontal:10, paddingVertical:8, position:'relative' },
  scoreColorDot: { width:8, height:8, borderRadius:4, marginRight:7 },
  scoreLabel:    { flex:1, color:C.textSec, fontSize:9, letterSpacing:1, fontWeight:'600' },
  scoreCount:    { color:C.textPrimary, fontSize:18, fontWeight:'700', fontFamily:Platform.OS==='ios'?'Menlo':'monospace' },
  activePip:     { position:'absolute', top:-2, right:-2, width:6, height:6, borderRadius:3 },
  scoreMid:      { alignItems:'center', paddingHorizontal:12 },
  moveLabel:     { color:C.textDim, fontSize:8, letterSpacing:2 },
  moveNum:       { color:C.gold, fontSize:16, fontWeight:'700', fontFamily:Platform.OS==='ios'?'Menlo':'monospace' },

  statusBar:  { flexDirection:'row', alignItems:'center', marginBottom:10, paddingHorizontal:12, paddingVertical:7, backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:4, width:BOARD_W },
  statusDot:  { width:4, height:4, borderRadius:2, marginHorizontal:6, opacity:0.8 },
  statusText: { flex:1, textAlign:'center', fontSize:11, letterSpacing:3, fontWeight:'600' },

  aiBar:        { flexDirection:'row', alignItems:'center', marginBottom:10, paddingHorizontal:14, paddingVertical:9, backgroundColor:'rgba(91,62,143,0.12)', borderWidth:1, borderRadius:4, width:BOARD_W },
  aiPulse:      { width:8, height:8, borderRadius:4, marginRight:10 },
  aiBarText:    { flex:1, fontSize:11, letterSpacing:3, fontWeight:'700' },
  aiLevelTag:   { borderWidth:1, borderRadius:3, paddingHorizontal:6, paddingVertical:2 },
  aiLevelTagText:{ fontSize:9, letterSpacing:2, fontWeight:'600' },

  boardWrap: { shadowColor:C.gold, shadowOffset:{width:0,height:0}, shadowOpacity:0.12, shadowRadius:20, elevation:12, marginBottom:10 },

  choicePanel:      { width:BOARD_W, marginBottom:10 },
  choicePanelInner: { backgroundColor:C.panel, borderWidth:1, borderColor:C.gold, borderRadius:8, padding:16 },
  choiceDivider:    { textAlign:'center', color:C.goldDark, fontSize:9, letterSpacing:1 },
  choiceTitle:      { textAlign:'center', color:C.gold, fontSize:12, letterSpacing:4, fontWeight:'700', marginVertical:8 },
  choiceRow:        { flexDirection:'row', marginVertical:12 },
  choiceBtnApproach:{ flex:1, alignItems:'center', paddingVertical:12, backgroundColor:'rgba(192,57,43,0.1)', borderWidth:1, borderColor:C.red, borderRadius:6 },
  choiceBtnRetreat: { flex:1, alignItems:'center', paddingVertical:12, backgroundColor:'rgba(74,144,164,0.1)', borderWidth:1, borderColor:C.accent, borderRadius:6 },
  choiceSep:        { width:10 },
  choiceBtnIcon:    { fontSize:16, color:C.textSec, marginBottom:4 },
  choiceBtnLabel:   { fontSize:11, letterSpacing:2, fontWeight:'700', color:C.textPrimary },
  choiceBtnCount:   { fontSize:10, color:C.textSec, marginTop:3, letterSpacing:1 },
  choiceCancelBtn:  { alignItems:'center', paddingTop:8 },
  choiceCancelText: { color:C.textDim, fontSize:10, letterSpacing:2 },

  gameOverBanner: { width:BOARD_W, backgroundColor:'#1C1800', borderWidth:1, borderColor:C.gold, borderRadius:6, paddingVertical:14, alignItems:'center', marginBottom:10 },
  gameOverText:   { color:C.gold, fontSize:14, letterSpacing:4, fontWeight:'700', fontFamily:Platform.OS==='ios'?'Georgia':'serif' },

  controls:       { width:BOARD_W, marginBottom:14 },
  resetBtn:       { borderWidth:1, borderColor:C.border, borderRadius:6, overflow:'hidden' },
  resetBtnInner:  { paddingVertical:12, alignItems:'center', backgroundColor:C.surface },
  resetBtnText:   { color:C.textSec, fontSize:10, letterSpacing:3, fontWeight:'600' },

  histSection:    { width:BOARD_W, marginBottom:14 },
  histTitle:      { color:C.textDim, fontSize:9, letterSpacing:3, marginBottom:8, textAlign:'center' },
  histList:       { gap:4 },
  histItem:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:12, paddingVertical:7, backgroundColor:C.surface, borderWidth:1, borderColor:C.border, borderRadius:4 },
  histItemLatest: { borderColor:C.borderGlow },
  histItemText:   { color:C.textSec, fontSize:11, letterSpacing:0.5 },
  histItemSub:    { color:C.textDim, fontSize:10, fontFamily:Platform.OS==='ios'?'Menlo':'monospace' },

  legend:    { width:BOARD_W, paddingHorizontal:4, marginBottom:20 },
  legendRow: { flexDirection:'row', alignItems:'center' },
  legendDot: { width:7, height:7, borderRadius:3.5, marginRight:6 },
  legendText:{ color:C.textDim, fontSize:10, letterSpacing:1, marginRight:8 },
});