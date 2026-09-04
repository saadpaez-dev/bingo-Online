import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

// Orden clásico de ruleta europea (37 casillas: 0 al 36)
const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Generador de geometría para cada casilla
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
  gameMode = 75
}) => {
  const [rotation, setRotation] = useState(0);
  const [ballAngle, setBallAngle] = useState(0);
  const [revealedBall, setRevealedBall] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastClickTimeRef = useRef(0);

  // Inicializar Web Audio context para los clics de la ruleta
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
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

  // Mantener actualizado el número actual cuando no esté girando
  useEffect(() => {
    if (!isAnimating && currentNumber) {
      setRevealedBall({ number: currentNumber, letter: currentLetter });
    }
  }, [currentNumber, currentLetter, isAnimating]);

  // Manejar el giro animado
  const handleTriggerSpin = async () => {
    if (disabled || isSpinning || isAnimating) return;

    setIsAnimating(true);
    setRevealedBall(null);

    // Obtener el nuevo número mediante el callback del Host
    const nextNum = await onSpin();
    if (!nextNum) {
      setIsAnimating(false);
      return;
    }

    // Calcular letra si es 75 bolas
    let letLetter = '';
    if (gameMode === 75) {
      if (nextNum <= 15) letLetter = 'B';
      else if (nextNum <= 30) letLetter = 'I';
      else if (nextNum <= 45) letLetter = 'N';
      else if (nextNum <= 60) letLetter = 'G';
      else letLetter = 'O';
    }

    const duration = 3000; // 3 segundos de emoción
    const startTime = performance.now();
    const initialRot = rotation;
    const extraRotations = (5 + Math.floor(Math.random() * 3)) * 360;
    const targetRandomOffset = Math.floor(Math.random() * 360);
    const targetRot = initialRot + extraRotations + targetRandomOffset;

    let clickInterval = 45; // ms inicial entre clics
    lastClickTimeRef.current = startTime;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Curva de desaceleración física de ruleta
      const easeOut = 1 - Math.pow(1 - progress, 3.5);
      const currentRot = initialRot + (targetRot - initialRot) * easeOut;
      setRotation(currentRot);

      // La bola viaja en dirección opuesta
      const ballRot = -(currentRot * 1.6);
      setBallAngle(ballRot);

      // Sonido de clic según la velocidad
      if (currentTime - lastClickTimeRef.current > clickInterval) {
        playClickSound(Math.max(0.08, 0.3 * (1 - progress * 0.8)));
        lastClickTimeRef.current = currentTime;
        clickInterval = 40 + Math.pow(progress, 2) * 280; // se desacelera el ritmo de clic
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Fin del giro: Revelación triunfal
        setIsAnimating(false);
        playChimeSound();
        setRevealedBall({ number: nextNum, letter: letLetter });

        // Confeti festivo de casino
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#D4AF37', '#80141D', '#F4E7CB', '#166534']
        });
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const totalSlices = ROULETTE_NUMBERS.length;
  const sliceDeg = 360 / totalSlices;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      
      {/* RUEDA DE RULETA VINTAGE */}
      <div 
        onClick={handleTriggerSpin}
        style={{
          position: 'relative',
          width: '280px',
          height: '280px',
          maxWidth: '100%',
          cursor: disabled || isAnimating ? 'default' : 'pointer',
          userSelect: 'none',
          marginBottom: '1rem',
          filter: 'drop-shadow(0 14px 22px rgba(0, 0, 0, 0.65))'
        }}
        title={disabled || isAnimating ? '' : '¡Haz clic para girar la ruleta!'}
      >
        <svg 
          viewBox="0 0 400 400" 
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            {/* Gradientes de Caoba y Bronce */}
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

            <radialGradient id="ivoryBall" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="45%" stopColor="#F9F5EA" />
              <stop offset="85%" stopColor="#D5CBB0" />
              <stop offset="100%" stopColor="#8A7E64" />
            </radialGradient>

            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. MARCO EXTERIOR DE CAOBA */}
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

          {/* 2. BISEL DORADO EXTERIOR */}
          <circle cx="200" cy="200" r="180" fill="none" stroke="url(#brassBezel)" strokeWidth="6" />
          
          {/* Pista exterior de la bola (Track) */}
          <circle cx="200" cy="200" r="172" fill="#1A0D07" stroke="#3D2012" strokeWidth="3" />

          {/* 3. ROTOR GIRATORIO DE CASILLAS */}
          <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '200px 200px' }}>
            
            {/* Anillo de casillas */}
            {ROULETTE_NUMBERS.map((num, idx) => {
              const startA = idx * sliceDeg - 90;
              const endA = startA + sliceDeg;
              const midA = startA + sliceDeg / 2;

              let pocketColor = '#1C1514'; // Ébano
              if (num === 0) {
                pocketColor = '#166534'; // Verde Esmeralda
              } else if (idx % 2 === 1) {
                pocketColor = '#80141D'; // Burdeos Imperial
              }

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
                    strokeWidth="1.2"
                  />
                  {/* Número grabado en la casilla */}
                  <text
                    x={tx}
                    y={ty}
                    fill="#FDF8ED"
                    fontSize="9.5"
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

            {/* Borde interior de latón de las casillas */}
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

            {/* MANIVELAS EN CRUZ DE LA TORRETA (4 BRAZOS DE CASINO) */}
            <g>
              {/* Brazos cruzados */}
              <line x1="200" y1="125" x2="200" y2="275" stroke="url(#brassBezel)" strokeWidth="5.5" strokeLinecap="round" />
              <line x1="125" y1="200" x2="275" y2="200" stroke="url(#brassBezel)" strokeWidth="5.5" strokeLinecap="round" />
              
              {/* Pomos esféricos dorados de los 4 extremos */}
              <circle cx="200" cy="125" r="7" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
              <circle cx="200" cy="275" r="7" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
              <circle cx="125" cy="200" r="7" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
              <circle cx="275" cy="200" r="7" fill="url(#brassBezel)" stroke="#4A310A" strokeWidth="1" />
            </g>

          </g>

          {/* 4. BOLA DE MARFIL ANIMADA */}
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

          {/* 5. AGUJA / PUNTERO INDICADOR SUPERIOR (12 EN PUNTO) */}
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

          {/* 6. DOMO CENTRAL: REVELACIÓN DE LA BOLA DE BINGO O MEDALLÓN */}
          <g>
            {/* Domo de latón pulido */}
            <circle cx="200" cy="200" r="62" fill="url(#mahoganyBowl)" stroke="url(#brassBezel)" strokeWidth="4.5" />
            <circle cx="200" cy="200" r="56" fill="radial-gradient(circle at 35% 30%, #5E2416 0%, #200B06 100%)" />

            {revealedBall && !isAnimating ? (
              /* BOLA DE BINGO REVELADA */
              <g className="animate-pop">
                <circle 
                  cx="200" 
                  cy="200" 
                  r="52" 
                  fill="radial-gradient(circle at 35% 30%, #FFFDF8 0%, #F5E9CE 45%, #DFCCA2 85%, #C2A56E 100%)" 
                  stroke="url(#brassBezel)" 
                  strokeWidth="3.5"
                />
                {revealedBall.letter && (
                  <text
                    x="200"
                    y="174"
                    fill="#80141D"
                    fontSize="22"
                    fontFamily="var(--font-serif)"
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {revealedBall.letter}
                  </text>
                )}
                <text
                  x="200"
                  y={revealedBall.letter ? "210" : "200"}
                  fill="#2B1408"
                  fontSize={revealedBall.letter ? "34" : "42"}
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
              /* MEDALLÓN EN ESPERA O GIRO */
              <g>
                <circle cx="200" cy="200" r="50" fill="url(#turretCone)" stroke="#C59B27" strokeWidth="2" />
                <path 
                  d="M200 168 L206 186 L224 190 L210 202 L214 220 L200 210 L186 220 L190 202 L176 190 L194 186 Z" 
                  fill="#D4AF37" 
                  stroke="#573E11" 
                  strokeWidth="1.5"
                />
                <circle cx="200" cy="200" r="8" fill="#80141D" stroke="#D4AF37" strokeWidth="1" />
              </g>
            )}
          </g>

        </svg>

        {/* Halo de brillo interactivo */}
        {!disabled && !isAnimating && (
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              pointerEvents: 'none',
              boxShadow: 'inset 0 0 25px rgba(212, 175, 55, 0.25)'
            }} 
          />
        )}
      </div>

      {/* BOTÓN 3D DE GIRO DE RULETA */}
      <button
        onClick={handleTriggerSpin}
        disabled={disabled || isAnimating}
        className="btn-vintage-burgundy animate-pop"
        style={{
          width: '100%',
          maxWidth: '340px',
          fontSize: '1.25rem',
          padding: '0.9rem 1.5rem',
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

      {/* Indicador sutil de bolas restantes */}
      <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic' }}>
        {remainingCount !== undefined ? `${remainingCount} bolas disponibles en la tolva` : ''}
      </div>

    </div>
  );
};

export default VintageRoulette;
