import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Clock } from 'lucide-react';
import cageImg from '../assets/vintage-bingo-cage.jpg';

const getBallLetter = (num, mode) => {
  if (mode !== 75) return '';
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
};

const VintageCage = ({
  isSpinning = false,
  onSpin,
  currentNumber,
  currentLetter,
  activeSpin = null,
  disabled = false,
  remainingCount,
  gameMode = 75,
  spinDuration = 3,
  lastSpinAt = null,
  onDurationChange,
  readOnly = false,
  onSpinComplete = null
}) => {
  const maxNumber = gameMode === 75 ? 75 : 90;
  const [isAnimating, setIsAnimating] = useState(false);
  const [crankAngle, setCrankAngle] = useState(0);
  const [cageTumble, setCageTumble] = useState(0);
  const [chuteBallProgress, setChuteBallProgress] = useState(0); // 0: inside, 1: rolled into portal
  const [revealedBall, setRevealedBall] = useState(null);

  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const lastActiveSpinIdRef = useRef(null);

  // Generar posiciones aleatorias y números para las balotas visibles dentro de la jaula
  const internalBalls = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: 20 + Math.sin(i * 1.3) * 22,
      y: 35 + Math.cos(i * 1.5) * 16,
      num: ((i * 7) % maxNumber) + 1,
      size: 14 + (i % 3) * 2
    }));
  }, [maxNumber]);

  // Audio Context procedural para efectos mecánicos
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

  // Sonido de choque de bolas de madera y trinquete metálico
  const playCrankTick = (vol = 0.22) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      // Combinación de tono de madera y click mecánico
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420 + Math.random() * 120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {}
  };

  // Sonido de rodada por el canal de latón
  const playChuteRoll = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch (e) {}
  };

  // Campana triunfal al encajar en el portal
  const playChimeSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, ctx.currentTime); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.09); // C6

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) {}
  };

  const triggerCageSpinAnimation = (nextNum, overrideDuration = null, startTimestamp = null) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    setIsAnimating(true);
    setRevealedBall(null);
    setChuteBallProgress(0);

    const letLetter = getBallLetter(nextNum, gameMode);
    const currentDur = overrideDuration || spinDuration;
    const durationMs = Math.max(800, Math.round(currentDur * 1000 - 50));

    let initialElapsed = 0;
    if (startTimestamp) {
      const ping = Date.now() - startTimestamp;
      if (ping > 0 && ping < 350) initialElapsed = ping;
    }

    const startTime = performance.now() - initialElapsed;
    const totalCrankTurns = Math.max(3, Math.round(currentDur * 2.2));
    const targetCrankDeg = crankAngle + totalCrankTurns * 360;
    const initialCrank = crankAngle;

    let clickInterval = Math.max(30, 60 / (currentDur / 3));
    lastClickTimeRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Desaceleración suave (easeOutCubic)
      const ease = 1 - Math.pow(1 - progress, 3.2);
      const curCrank = initialCrank + (targetCrankDeg - initialCrank) * ease;
      setCrankAngle(curCrank);
      setCageTumble(curCrank * 1.25);

      // Clics y choques de bolas espaciados
      if (now - lastClickTimeRef.current > clickInterval) {
        playCrankTick(Math.max(0.06, 0.28 * (1 - progress * 0.75)));
        lastClickTimeRef.current = now;
        clickInterval = 40 + Math.pow(progress, 2.2) * (currentDur * 95);
      }

      // Último 18% del tiempo: la balota se desliza por el canal hacia el portal de salida
      if (progress > 0.82) {
        const chuteProg = (progress - 0.82) / 0.18;
        setChuteBallProgress(chuteProg);
        if (chuteProg > 0.05 && chuteProg < 0.15) {
          playChuteRoll();
        }
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        setCrankAngle(targetCrankDeg);
        setChuteBallProgress(1);
        setIsAnimating(false);
        playChimeSound();
        setRevealedBall({ number: nextNum, letter: letLetter });

        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#D4AF37', '#80141D', '#F4E7CB', '#15803D']
        });

        if (onSpinComplete) {
          onSpinComplete({ number: nextNum, letter: letLetter });
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  // Escuchar giros activos en tiempo real
  useEffect(() => {
    if (activeSpin && activeSpin.number && activeSpin.startedAt) {
      if (lastActiveSpinIdRef.current !== activeSpin.startedAt) {
        lastActiveSpinIdRef.current = activeSpin.startedAt;
        triggerCageSpinAnimation(
          activeSpin.number,
          activeSpin.spinDuration || spinDuration,
          activeSpin.startedAt
        );
      }
    }
  }, [activeSpin, spinDuration]);

  // Si no está animando y cambia el currentNumber externamente, mostrarlo directamente
  useEffect(() => {
    if (!isAnimating && currentNumber) {
      setRevealedBall({
        number: currentNumber,
        letter: currentLetter || getBallLetter(currentNumber, gameMode)
      });
      setChuteBallProgress(1);
    }
  }, [currentNumber, currentLetter, isAnimating, gameMode]);

  const displayedBall = revealedBall || (currentNumber ? {
    number: currentNumber,
    letter: currentLetter || getBallLetter(currentNumber, gameMode)
  } : null);

  return (
    <div 
      className="vintage-cage-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {/* Título Elegante */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '1.2rem' }}>⚜️</span>
        <h3 style={{
          fontFamily: 'var(--font-serif)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          fontSize: '0.95rem',
          color: 'var(--text-vintage-dark)',
          fontWeight: '900',
          margin: 0
        }}>
          Jaula de Salón Vintage
        </h3>
        <span style={{ fontSize: '1.2rem' }}>⚜️</span>
      </div>

      {/* Escenario de la Jaula y el Portal de Salida */}
      <div style={{
        position: 'relative',
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '3px solid var(--gold-primary)',
        boxShadow: '0 12px 28px rgba(0,0,0,0.5), inset 0 0 15px rgba(197, 155, 39, 0.25)',
        background: 'radial-gradient(ellipse at center, #FDF7EA 0%, #E8D5B5 100%)',
        padding: '0.85rem'
      }}>
        
        {/* Imagen base realista del bolillero de caoba y latón */}
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          maxHeight: '360px',
          margin: '0 auto',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img 
            src={cageImg} 
            alt="Jaula de Bingo Vintage" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: isAnimating ? 'contrast(1.05) brightness(1.02)' : 'none',
              transition: 'filter 0.3s ease'
            }}
          />

          {/* OVERLAY 1: Placa de Latón Dinámica "Faltan X bolas" */}
          <div style={{
            position: 'absolute',
            top: '36.5%',
            left: '52%',
            transform: 'translate(-50%, -50%)',
            background: 'linear-gradient(180deg, #F8E39D 0%, #D4AF37 40%, #AA8022 100%)',
            border: '1.5px solid #664614',
            borderRadius: '999px',
            padding: '0.2rem 0.75rem',
            boxShadow: '0 3px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(0.72rem, 1.2vw, 0.88rem)',
              fontWeight: '900',
              color: '#3B1F08',
              letterSpacing: '0.5px',
              textShadow: '0 1px 1px rgba(255,255,255,0.4)',
              whiteSpace: 'nowrap'
            }}>
              Faltan {remainingCount ?? (maxNumber - (currentNumber ? 1 : 0))} bolas
            </span>
          </div>

          {/* OVERLAY 2: Manivela giratoria dinámica a la izquierda */}
          <div style={{
            position: 'absolute',
            top: '51%',
            left: '14.5%',
            width: '80px',
            height: '80px',
            transform: `translate(-50%, -50%) rotate(${crankAngle}deg)`,
            transformOrigin: '50% 50%',
            pointerEvents: 'none',
            zIndex: 15,
            opacity: isAnimating ? 0.95 : 0.01,
            transition: isAnimating ? 'none' : 'opacity 0.3s ease'
          }}>
            {/* Eje y brazo de manivela animado */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '45px',
              height: '11px',
              background: 'linear-gradient(180deg, #E6C687 0%, #AA8022 100%)',
              borderRadius: '6px',
              border: '1.5px solid #4A2E0E',
              boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
              transform: 'translate(-10%, -50%)'
            }}>
              {/* Pomo de madera tallada */}
              <div style={{
                position: 'absolute',
                right: '-14px',
                top: '-7px',
                width: '26px',
                height: '24px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #8D3A1B 0%, #4A1A0C 70%, #200804 100%)',
                border: '1.5px solid #E6C687',
                boxShadow: '0 2px 5px rgba(0,0,0,0.6)'
              }} />
            </div>
          </div>

          {/* OVERLAY 3: Agitación de balotas dentro de la jaula durante el giro */}
          {isAnimating && (
            <div style={{
              position: 'absolute',
              top: '44%',
              left: '46%',
              transform: 'translate(-50%, -50%)',
              width: '130px',
              height: '110px',
              borderRadius: '50%',
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 12
            }}>
              {internalBalls.map((b) => {
                const tumbleOffset = Math.sin((cageTumble + b.id * 35) * Math.PI / 180) * 18;
                const tumbleScale = 0.85 + Math.cos((cageTumble + b.id * 40) * Math.PI / 180) * 0.25;
                return (
                  <div
                    key={b.id}
                    style={{
                      position: 'absolute',
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      width: `${b.size}px`,
                      height: `${b.size}px`,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 30%, #F5E2B8 0%, #C99B27 60%, #5A3D14 100%)',
                      border: '1px solid #FFE8A3',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                      transform: `translate(${tumbleOffset}px, ${-tumbleOffset * 0.6}px) scale(${tumbleScale})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '7px',
                      fontWeight: 'bold',
                      color: '#2A1707',
                      fontFamily: 'var(--font-serif)'
                    }}
                  >
                    {b.num}
                  </div>
                );
              })}
            </div>
          )}

          {/* OVERLAY 4: Bola rodando por el canal de salida en los últimos instantes */}
          {isAnimating && chuteBallProgress > 0 && chuteBallProgress < 1 && (
            <div
              style={{
                position: 'absolute',
                left: `${46 + chuteBallProgress * 24}%`,
                top: `${68 + chuteBallProgress * 6}%`,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F5E2B8 45%, #B8860B 100%)',
                border: '1.5px solid var(--gold-primary)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                transform: `translate(-50%, -50%) rotate(${chuteBallProgress * 720}deg)`,
                pointerEvents: 'none',
                zIndex: 20
              }}
            />
          )}

          {/* OVERLAY 5: Portal de Exhibición "Canal de Salida" (Esquina inferior derecha) */}
          <div style={{
            position: 'absolute',
            bottom: '4.5%',
            right: '4.5%',
            width: '32%',
            maxWidth: '120px',
            aspectRatio: '1',
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 25,
            pointerEvents: 'none'
          }}>
            {displayedBall ? (
              <div 
                className="animate-pop"
                style={{
                  width: '84%',
                  height: '84%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #F5E2B8 40%, #B8860B 80%, #68480F 100%)',
                  border: '2.5px solid var(--gold-primary)',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.6), inset 0 2px 5px rgba(255,255,255,0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'bounceIn 0.35s ease'
                }}
              >
                {displayedBall.letter && (
                  <span style={{
                    fontSize: 'clamp(0.65rem, 1.1vw, 0.85rem)',
                    fontWeight: '900',
                    color: 'var(--burgundy-primary)',
                    fontFamily: 'var(--font-serif)',
                    letterSpacing: '1px',
                    lineHeight: 1
                  }}>
                    {displayedBall.letter}
                  </span>
                )}
                <span style={{
                  fontSize: displayedBall.letter ? 'clamp(1.3rem, 2.2vw, 1.8rem)' : 'clamp(1.5rem, 2.6vw, 2.1rem)',
                  fontWeight: '900',
                  color: '#1F1610',
                  fontFamily: 'var(--font-serif)',
                  lineHeight: 1
                }}>
                  {displayedBall.number}
                </span>
              </div>
            ) : (
              <div style={{
                width: '75%',
                height: '75%',
                borderRadius: '50%',
                border: '1.5px dashed rgba(184, 134, 11, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(74, 40, 16, 0.5)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: 'bold'
              }}>
                --
              </div>
            )}
          </div>

        </div>

      </div>

      {/* BOTÓN PRINCIPAL: Girar Jaula Manual */}
      {!readOnly && (
        <div style={{ width: '100%', marginTop: '0.85rem', textAlign: 'center' }}>
          <button
            type="button"
            className="btn-vintage-burgundy animate-pop"
            onClick={onSpin}
            disabled={disabled || isAnimating}
            style={{
              width: '100%',
              maxWidth: '380px',
              margin: '0 auto',
              padding: '0.85rem 1.8rem',
              fontSize: '1.2rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
              opacity: (disabled || isAnimating) ? 0.65 : 1,
              cursor: (disabled || isAnimating) ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 18px rgba(0,0,0,0.45)'
            }}
          >
            <span style={{ fontSize: '1.35rem' }}>🎰</span>
            <span>{isAnimating ? 'Girando Jaula...' : 'Girar Jaula Manual'}</span>
          </button>

          {/* Subtítulo de bolas disponibles */}
          <div style={{
            fontSize: '0.82rem',
            color: 'var(--text-vintage-muted)',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            marginTop: '0.45rem',
            fontWeight: '600'
          }}>
            {remainingCount ?? maxNumber} / {maxNumber} bolas disponibles en la jaula
          </div>

          {/* Selector de Duración de Giro de la Jaula */}
          {onDurationChange && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              marginTop: '0.65rem',
              fontSize: '0.82rem',
              fontFamily: 'var(--font-serif)',
              color: 'var(--text-vintage-dark)'
            }}>
              <Clock size={15} color="var(--gold-brass)" />
              <span>Duración del giro:</span>
              <select
                value={spinDuration}
                onChange={(e) => onDurationChange(Number(e.target.value))}
                disabled={disabled || isAnimating}
                style={{
                  background: '#FFFDF9',
                  border: '1.5px solid var(--gold-brass)',
                  borderRadius: '6px',
                  padding: '0.2rem 0.5rem',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  color: 'var(--text-vintage-dark)',
                  cursor: (disabled || isAnimating) ? 'not-allowed' : 'pointer'
                }}
              >
                <option value={3}>Rápido (3 seg)</option>
                <option value={4}>Suspenso (4 seg)</option>
                <option value={5}>Dramático (5 seg)</option>
                <option value={7}>Casino Real (7 seg)</option>
                <option value={14}>Doble Casino Real (14 seg)</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Pie de solo lectura para jugadores */}
      {readOnly && (
        <div style={{
          marginTop: '0.6rem',
          fontSize: '0.85rem',
          color: 'var(--text-vintage-muted)',
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          {isAnimating ? '🎰 Girando la jaula y extrayendo balota...' : 'Balota extraída en el Canal de Salida'}
        </div>
      )}

    </div>
  );
};

export default VintageCage;
