import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Clock } from 'lucide-react';

// Generador de casillas para 75 o 90 bolas intercalando letras y columnas
const generatePockets = (mode) => {
  const total = mode === 90 ? 90 : 75;
  const columns = mode === 75 ? 5 : 6;
  const perCol = total / columns; // 15
  const result = [];
  for (let r = 0; r < perCol; r++) {
    for (let c = 0; c < columns; c++) {
      const num = c * perCol + r + 1;
      if (num <= total) {
        result.push(num);
      }
    }
  }
  return result;
};

const getBallLetter = (num, mode) => {
  if (mode !== 75) return '';
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
};

// Geometría para arcos de casillas en SVG
const getPocketPath = (cx, cy, innerR, outerR, startAngle, endAngle) => {
  const toRad = Math.PI / 180;
  const p1 = { x: cx + outerR * Math.cos(startAngle * toRad), y: cy + outerR * Math.sin(startAngle * toRad) };
  const p2 = { x: cx + outerR * Math.cos(endAngle * toRad), y: cy + outerR * Math.sin(endAngle * toRad) };
  const p3 = { x: cx + innerR * Math.cos(endAngle * toRad), y: cy + innerR * Math.sin(endAngle * toRad) };
  const p4 = { x: cx + innerR * Math.cos(startAngle * toRad), y: cy + innerR * Math.sin(startAngle * toRad) };
  return `M ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerR} ${innerR} 0 0 0 ${p4.x} ${p4.y} Z`;
};

const VintageRoulette = ({
  isSpinning,
  onSpin,
  currentNumber,
  currentLetter,
  disabled,
  remainingCount,
  gameMode = 75,
  spinDuration = 3,
  onDurationChange,
  readOnly = false
}) => {
  const pockets = useMemo(() => generatePockets(gameMode), [gameMode]);
  const totalSlices = pockets.length;
  const sliceDeg = 360 / totalSlices;

  // Ángulo de rotación del rotor y de la bola
  const [rotation, setRotation] = useState(0);
  const [ballAngle, setBallAngle] = useState(0);
  const [revealedBall, setRevealedBall] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const prevNumberRef = useRef(null);

  // Inicializar Web Audio context para clics mecánicos procedurales
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  };

  const playClickSound = (volume = 0.25) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch (e) {}
  };

  const playChimeSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.08); // B5

      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.75);
    } catch (e) {}
  };

  // Función reutilizable para ejecutar la física y sonido de giro
  const triggerSpinAnimation = (nextNum) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setIsAnimating(true);
    setRevealedBall(null);

    const letLetter = getBallLetter(nextNum, gameMode);
    const targetIndex = pockets.indexOf(nextNum);

    const desiredMod = ((- (targetIndex * sliceDeg + sliceDeg / 2)) % 360 + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    let diff = desiredMod - currentMod;
    if (diff <= 0) diff += 360;

    const extraTurns = Math.max(3, Math.round(spinDuration * 1.8)) * 360;
    const targetRot = rotation + extraTurns + diff;
    const duration = Math.max(500, Math.round(spinDuration * 1000 - 50));
    const startTime = performance.now();
    const initialRot = rotation;

    let clickInterval = Math.max(25, 45 / (spinDuration / 3));
    lastClickTimeRef.current = startTime;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Desaceleración física de ruleta
      const easeOut = 1 - Math.pow(1 - progress, 3.8);
      const currentRot = initialRot + (targetRot - initialRot) * easeOut;
      setRotation(currentRot);

      // Bola de marfil orbitando en sentido inverso
      const ballRot = -(currentRot * 1.5);
      setBallAngle(ballRot);

      // Clics rítmicos mecánicos que van espaciándose
      if (currentTime - lastClickTimeRef.current > clickInterval) {
        playClickSound(Math.max(0.08, 0.3 * (1 - progress * 0.8)));
        lastClickTimeRef.current = currentTime;
        clickInterval = 35 + Math.pow(progress, 2) * (spinDuration * 85);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setRotation(targetRot);
        setIsAnimating(false);
        playChimeSound();
        setRevealedBall({ number: nextNum, letter: letLetter });

        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#D4AF37', '#80141D', '#F4E7CB', '#166534']
        });
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  // Posicionar o girar automáticamente cuando cambia currentNumber
  useEffect(() => {
    if (!currentNumber) {
      setRevealedBall(null);
      prevNumberRef.current = null;
      return;
    }

    // Primera carga o reconexión: colocación directa
    if (prevNumberRef.current === null) {
      prevNumberRef.current = currentNumber;
      const idx = pockets.indexOf(currentNumber);
      if (idx !== -1) {
        const exactAngle = - (idx * sliceDeg + sliceDeg / 2);
        setRotation(exactAngle);
      }
      setRevealedBall({ number: currentNumber, letter: currentLetter });
      return;
    }

    // Modo Jugador / Observador (readOnly): Si llega una nueva bola del Dealer, girar con animación
    if (readOnly && prevNumberRef.current !== currentNumber) {
      prevNumberRef.current = currentNumber;
      triggerSpinAnimation(currentNumber);
      return;
    }

    // Si ya terminó de animar o no está en readOnly
    if (!isAnimating) {
      prevNumberRef.current = currentNumber;
      const idx = pockets.indexOf(currentNumber);
      if (idx !== -1) {
        const exactAngle = - (idx * sliceDeg + sliceDeg / 2);
        setRotation(exactAngle);
      }
      setRevealedBall({ number: currentNumber, letter: currentLetter });
    }
  }, [currentNumber, currentLetter, readOnly, isAnimating, pockets, sliceDeg]);

  // Manejar el giro de ruleta manual (Host)
  const handleTriggerSpin = async () => {
    if (readOnly || disabled || isSpinning || isAnimating) return;

    setIsAnimating(true);
    setRevealedBall(null);

    // Obtener el número sorteado desde el Host
    const nextNum = await onSpin();
    if (!nextNum) {
      setIsAnimating(false);
      return;
    }

    triggerSpinAnimation(nextNum);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Cálculo de la casilla actualmente bajo la aguja para la LUPA DE ZOOM
  const currentNormalizedDeg = ((-rotation - sliceDeg / 2) % 360 + 360) % 360;
  const currentFloatIdx = currentNormalizedDeg / sliceDeg;
  const centerIdx = Math.round(currentFloatIdx) % totalSlices;
  const offsetFrac = currentFloatIdx - Math.round(currentFloatIdx);

  // Casillas visibles en la lente de zoom (-2 a +2 alrededor de la aguja)
  const zoomPocketOffsets = [-2, -1, 0, 1, 2];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      
      {/* CONTENEDOR FLEX: RULETA + LUPA DE ZOOM LADO A LADO */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.85rem',
        width: '100%',
        flexWrap: 'wrap',
        marginBottom: '1rem'
      }}>

        {/* 1. RUEDA DE RULETA VINTAGE */}
        <div 
          onClick={handleTriggerSpin}
          style={{
            position: 'relative',
            width: '240px',
            height: '240px',
            maxWidth: '100%',
            cursor: readOnly || disabled || isAnimating ? 'default' : 'pointer',
            userSelect: 'none',
            filter: 'drop-shadow(0 12px 20px rgba(0, 0, 0, 0.65))'
          }}
          title={readOnly ? 'Ruleta del Salón' : disabled || isAnimating ? '' : '¡Haz clic para girar la ruleta!'}
        >
          <svg 
            viewBox="0 0 400 400" 
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            <defs>
              {/* Gradientes de Caoba, Bronce y Pergamino */}
              <radialGradient id="mahoganyBowl" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4A1E11" />
                <stop offset="60%" stopColor="#2E1107" />
                <stop offset="100%" stopColor="#150602" />
              </radialGradient>

              <radialGradient id="brassBezel" cx="35%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#FFF2B2" />
                <stop offset="35%" stopColor="#E6BE57" />
                <stop offset="70%" stopColor="#AA822A" />
                <stop offset="100%" stopColor="#63470F" />
              </radialGradient>

              <radialGradient id="turretCone" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#6E2B16" />
                <stop offset="50%" stopColor="#3B150A" />
                <stop offset="100%" stopColor="#1B0703" />
              </radialGradient>

              <radialGradient id="ballParchment" cx="35%" cy="30%" r="65%">
                <stop offset="0%" stopColor="#FFFDF8" />
                <stop offset="35%" stopColor="#F9EFCF" />
                <stop offset="75%" stopColor="#E5CE9F" />
                <stop offset="100%" stopColor="#B89452" />
              </radialGradient>

              <radialGradient id="ivoryBall" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="45%" stopColor="#F9F5EA" />
                <stop offset="85%" stopColor="#D5CBB0" />
                <stop offset="100%" stopColor="#8A7E64" />
              </radialGradient>
            </defs>

            {/* MARCO EXTERIOR DE CAOBA */}
            <circle cx="200" cy="200" r="198" fill="url(#mahoganyBowl)" stroke="#4A2612" strokeWidth="4" />
            
            {/* Anillo de remaches de latón */}
            {Array.from({ length: 24 }).map((_, i) => {
              const ang = (i * (360 / 24)) * (Math.PI / 180);
              const rx = 200 + 190 * Math.cos(ang);
              const ry = 200 + 190 * Math.sin(ang);
              return (
                <circle key={i} cx={rx} cy={ry} r="3" fill="#D4AF37" stroke="#48320B" strokeWidth="1" />
              );
            })}

            {/* BISEL DORADO EXTERIOR */}
            <circle cx="200" cy="200" r="180" fill="none" stroke="url(#brassBezel)" strokeWidth="6" />
            
            {/* Pista exterior de la bola (Track) */}
            <circle cx="200" cy="200" r="172" fill="#1A0D07" stroke="#3D2012" strokeWidth="3" />

            {/* ROTOR GIRATORIO DE CASILLAS */}
            <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '200px 200px' }}>
              
              {/* Anillo de casillas */}
              {pockets.map((num, idx) => {
                const startA = idx * sliceDeg - 90;
                const endA = startA + sliceDeg;
                const midA = startA + sliceDeg / 2;

                const pocketColor = idx % 2 === 1 ? '#80141D' : '#1C1514';

                const pathD = getPocketPath(200, 200, 114, 166, startA, endA);
                const textRad = (midA * Math.PI) / 180;
                const tx = 200 + 140 * Math.cos(textRad);
                const ty = 200 + 140 * Math.sin(textRad);

                return (
                  <g key={num}>
                    <path 
                      d={pathD} 
                      fill={pocketColor} 
                      stroke="#D4AF37" 
                      strokeWidth="1.1"
                    />
                    {/* Número grabado en la casilla */}
                    <text
                      x={tx}
                      y={ty}
                      fill="#FDF8ED"
                      fontSize={totalSlices > 75 ? "8" : "9"}
                      fontFamily="var(--font-serif)"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${midA + 90}, ${tx}, ${ty})`}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                    >
                      {num}
                    </text>
                  </g>
                );
              })}

              {/* Borde interior de latón */}
              <circle cx="200" cy="200" r="114" fill="none" stroke="url(#brassBezel)" strokeWidth="3.5" />

              {/* Cono central de madera tallada */}
              <circle cx="200" cy="200" r="112" fill="url(#turretCone)" />

              {/* 8 Diamantes deflectores de latón */}
              {Array.from({ length: 8 }).map((_, i) => {
                const dAng = (i * (360 / 8)) * (Math.PI / 180);
                const dx = 200 + 96 * Math.cos(dAng);
                const dy = 200 + 96 * Math.sin(dAng);
                return (
                  <polygon
                    key={i}
                    points={`${dx},${dy - 4} ${dx + 4},${dy} ${dx},${dy + 4} ${dx - 4},${dy}`}
                    fill="#F5DE88"
                    stroke="#5C4212"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Anillo intermedio con bisel */}
              <circle cx="200" cy="200" r="78" fill="none" stroke="url(#brassBezel)" strokeWidth="4" />

              {/* MANIVELAS EN CRUZ DE LA TORRETA */}
              <g>
                <line x1="200" y1="125" x2="200" y2="275" stroke="url(#brassBezel)" strokeWidth="5" strokeLinecap="round" />
                <line x1="125" y1="200" x2="275" y2="200" stroke="url(#brassBezel)" strokeWidth="5" strokeLinecap="round" />
                <circle cx="200" cy="125" r="6.5" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
                <circle cx="200" cy="275" r="6.5" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
                <circle cx="125" cy="200" r="6.5" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
                <circle cx="275" cy="200" r="6.5" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
              </g>

            </g>

            {/* BOLA DE MARFIL ANIMADA */}
            {isAnimating && (
              <g style={{ transform: `rotate(${ballAngle}deg)`, transformOrigin: '200px 200px' }}>
                <circle 
                  cx="200" 
                  cy="32" 
                  r="7.5" 
                  fill="url(#ivoryBall)" 
                  stroke="#6B5C3D" 
                  strokeWidth="1"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                />
              </g>
            )}

            {/* AGUJA / BIELA SUPERIOR (12 EN PUNTO) */}
            <g>
              <polygon 
                points="200,42 191,18 209,18" 
                fill="url(#brassBezel)" 
                stroke="#4F350C" 
                strokeWidth="1.5"
                filter="drop-shadow(0 3px 5px rgba(0,0,0,0.75))"
              />
              <circle cx="200" cy="20" r="3.5" fill="#B71C1C" stroke="#4F350C" strokeWidth="1" />
            </g>

            {/* DOMO CENTRAL: BOLA DE BINGO REVELADA EN ALTA DEFINICIÓN */}
            <g>
              <circle cx="200" cy="200" r="62" fill="url(#mahoganyBowl)" stroke="url(#brassBezel)" strokeWidth="4.5" />

              {revealedBall && !isAnimating ? (
                /* BOLA DE BINGO CON FONDO PERGAMINO DE ALTO CONTRASTE */
                <g className="animate-pop">
                  <circle 
                    cx="200" 
                    cy="200" 
                    r="54" 
                    fill="url(#ballParchment)" 
                    stroke="url(#brassBezel)" 
                    strokeWidth="3.5"
                    filter="drop-shadow(0 2px 5px rgba(0,0,0,0.5))"
                  />
                  {revealedBall.letter && (
                    <text
                      x="200"
                      y="172"
                      fill="#80141D"
                      fontSize="24"
                      fontFamily="var(--font-serif)"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
                    >
                      {revealedBall.letter}
                    </text>
                  )}
                  <text
                    x="200"
                    y={revealedBall.letter ? "210" : "200"}
                    fill="#3A1208"
                    fontSize={revealedBall.letter ? "36" : "44"}
                    fontFamily="var(--font-serif)"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ textShadow: '0 1px 2px rgba(255,255,255,0.7)' }}
                  >
                    {revealedBall.number}
                  </text>
                </g>
              ) : (
                /* MEDALLÓN DE ESPERA */
                <g>
                  <circle cx="200" cy="200" r="54" fill="url(#turretCone)" stroke="#C59B27" strokeWidth="2.5" />
                  <path 
                    d="M200 166 L207 186 L226 190 L211 203 L215 222 L200 211 L185 222 L189 203 L174 190 L193 186 Z" 
                    fill="#D4AF37" 
                    stroke="#573E11" 
                    strokeWidth="1.5"
                  />
                  <circle cx="200" cy="200" r="8" fill="#80141D" stroke="#D4AF37" strokeWidth="1" />
                </g>
              )}
            </g>

          </svg>
        </div>

        {/* 2. LUPA DE PRECISIÓN (ZOOM DE LA BIELA / AGUJA) */}
        <div 
          onClick={handleTriggerSpin}
          style={{
            background: 'linear-gradient(180deg, #FFFDF8 0%, #F5E8CB 100%)',
            border: '2px solid var(--gold-primary)',
            borderRadius: '12px',
            padding: '0.65rem 0.75rem',
            boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '135px',
            textAlign: 'center',
            cursor: disabled || isAnimating ? 'default' : 'pointer',
            userSelect: 'none'
          }}
          title="Zoom de precisión para verificar la casilla bajo la biela"
        >
          {/* Título de la lupa */}
          <div style={{
            fontSize: '0.68rem',
            fontFamily: 'var(--font-serif)',
            color: 'var(--text-vintage-dark)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight: '900',
            marginBottom: '0.45rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            <span>🔍</span> Zoom Biela
          </div>

          {/* Lente circular magnificador */}
          <div style={{
            position: 'relative',
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3.5px solid #C59B27',
            boxShadow: 'inset 0 0 14px rgba(0,0,0,0.7), 0 4px 8px rgba(0,0,0,0.3)',
            backgroundColor: '#1E0D06'
          }}>
            <svg viewBox="0 0 110 110" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="lensGleam" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                  <stop offset="35%" stopColor="rgba(255,255,255,0.08)" />
                  <stop offset="70%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>

              {/* Pista de casillas magnificada que desliza horizontalmente */}
              {zoomPocketOffsets.map((offset) => {
                const pIdx = (centerIdx + offset + totalSlices) % totalSlices;
                const pNum = pockets[pIdx];
                const pLetter = getBallLetter(pNum, gameMode);
                const pColor = pIdx % 2 === 1 ? '#80141D' : '#1C1514';
                
                // Ancho de cada casilla en zoom = 52px
                const xPos = 55 + (offset - offsetFrac) * 52 - 26;

                return (
                  <g key={offset}>
                    {/* Fondo de la casilla en zoom */}
                    <rect 
                      x={xPos} 
                      y="18" 
                      width="52" 
                      height="74" 
                      fill={pColor} 
                      stroke="#D4AF37" 
                      strokeWidth="2" 
                    />
                    
                    {/* Letra de la columna */}
                    {pLetter && (
                      <text
                        x={xPos + 26}
                        y="38"
                        fill="#FDE68A"
                        fontSize="12"
                        fontFamily="var(--font-serif)"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                      >
                        {pLetter}
                      </text>
                    )}

                    {/* Número magnificado */}
                    <text
                      x={xPos + 26}
                      y={pLetter ? "66" : "55"}
                      fill="#FFFDF8"
                      fontSize={pLetter ? "22" : "26"}
                      fontFamily="var(--font-serif)"
                      fontWeight="900"
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.95)' }}
                    >
                      {pNum}
                    </text>
                  </g>
                );
              })}

              {/* AGUJA / BIELA SUPERIOR MAGNIFICADA */}
              <polygon 
                points="55,24 47,4 63,4" 
                fill="#F7DE88" 
                stroke="#4F350C" 
                strokeWidth="1.5"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
              />
              <circle cx="55" cy="7" r="3" fill="#B71C1C" stroke="#4F350C" strokeWidth="1" />

              {/* Reflejo de cristal de la lente */}
              <circle cx="55" cy="55" r="54" fill="url(#lensGleam)" pointerEvents="none" />
            </svg>
          </div>

          {/* Plaquita de confirmación inferior */}
          <div 
            className="vintage-brass-plaque" 
            style={{ 
              margin: '0.45rem 0 0', 
              padding: '0.2rem 0.6rem', 
              fontSize: '0.8rem',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {isAnimating ? (
              <span style={{ fontSize: '0.72rem' }}>Verificando...</span>
            ) : revealedBall ? (
              <span style={{ fontWeight: '900', color: '#1B5E20' }}>
                {revealedBall.letter ? `${revealedBall.letter}-` : ''}{revealedBall.number} ✓
              </span>
            ) : (
              <span style={{ fontSize: '0.72rem' }}>Listo</span>
            )}
          </div>
        </div>

      </div>

      {!readOnly ? (
        <>
          {/* SELECTOR VINTAGE DE DURACIÓN DEL GIRO */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '0.45rem', 
            marginBottom: '0.65rem',
            background: '#FAF4E5',
            border: '1.5px solid var(--gold-brass)',
            borderRadius: '8px',
            padding: '0.35rem 0.75rem',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}>
            <Clock size={15} color="#8C6B23" />
            <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-serif)', fontWeight: 'bold', color: 'var(--text-vintage-dark)' }}>
              Duración del Giro:
            </span>
            <select
              value={spinDuration}
              onChange={(e) => onDurationChange && onDurationChange(Number(e.target.value))}
              disabled={disabled || isAnimating}
              style={{
                background: '#fff',
                border: '1.5px solid var(--gold-brass)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: 'bold',
                padding: '0.2rem 0.5rem',
                cursor: disabled || isAnimating ? 'not-allowed' : 'pointer',
                color: 'var(--burgundy-primary)'
              }}
            >
              <option value={1.5}>Rápido (1.5 seg)</option>
              <option value={2}>Ágil (2 seg)</option>
              <option value={3}>Estándar (3 seg)</option>
              <option value={4}>Suspenso (4 seg)</option>
              <option value={5}>Dramático (5 seg)</option>
              <option value={7}>Casino Real (7 seg)</option>
            </select>
          </div>

          {/* BOTÓN 3D DE GIRO DE RULETA */}
          <button
            onClick={handleTriggerSpin}
            disabled={disabled || isAnimating}
            className="btn-vintage-burgundy animate-pop"
            style={{
              width: '100%',
              maxWidth: '360px',
              fontSize: '1.25rem',
              padding: '0.85rem 1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              opacity: disabled || isAnimating ? 0.75 : 1,
              cursor: disabled || isAnimating ? 'not-allowed' : 'pointer'
            }}
            title="Extraer el siguiente número girando la ruleta vintage"
          >
            <span style={{ fontSize: '1.4rem' }}>🎰</span>
            <span>{isAnimating ? 'Girando Ruleta...' : 'Girar Ruleta Manual'}</span>
          </button>
        </>
      ) : (
        /* ETIQUETA ELEGANTE PARA EL PANEL DEL JUGADOR / OBSERVADOR */
        <div style={{ 
          margin: '0.2rem 0 0.4rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '0.45rem',
          background: isAnimating ? '#FDF2E9' : '#FAF4E5',
          border: '1.5px solid var(--gold-brass)',
          borderRadius: '8px',
          padding: '0.4rem 0.85rem',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}>
          <span style={{ fontSize: '1rem' }}>{isAnimating ? '🎲' : '⚜️'}</span>
          <span style={{ 
            fontSize: '0.85rem', 
            fontFamily: 'var(--font-serif)', 
            fontWeight: 'bold', 
            color: isAnimating ? '#B71C1C' : 'var(--burgundy-primary)' 
          }}>
            {isAnimating ? '¡El anfitrión está extrayendo balota!' : 'Ruleta en sincronía con la mesa'}
          </span>
        </div>
      )}

      {/* Indicador sutil de bolas restantes */}
      <div style={{ marginTop: '0.45rem', fontSize: '0.82rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic' }}>
        {remainingCount !== undefined ? `${remainingCount} bolas disponibles en la tolva` : ''}
      </div>

    </div>
  );
};

export default VintageRoulette;
