import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Share2, Play, Square, Dices, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '../context/SettingsContext';
import ChatBox from '../components/Chat/ChatBox';

const HostPanel = () => {
  const { gameId } = useParams();
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [intervalTime, setIntervalTime] = useState(5);
  const [activeReactions, setActiveReactions] = useState([]);
  const [autoDrawInterval, setAutoDrawInterval] = useState(null);
  const { playSound } = useSettings();

  const gameStateRef = useRef(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const gameRef = doc(db, 'games', gameId);
    const unsubscribeGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState(data);
        if (data.status === 'finished' && data.winners?.length > 0) {
          triggerWinAnimation();
        }

        if (data.latestReaction && data.latestReaction.timestamp > Date.now() - 3000) {
          const id = Date.now() + Math.random();
          setActiveReactions(prev => [...prev, { id, emoji: data.latestReaction.emoji }]);
          setTimeout(() => {
            setActiveReactions(prev => prev.filter(r => r.id !== id));
          }, 2000);
        }
      }
    });

    const playersRef = collection(db, 'games', gameId, 'players');
    const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
      const playersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlayers(playersData);

      const newWinners = playersData.filter(p => p.bingoClaimed && p.isValidated);
      if (newWinners.length > 0 && gameStateRef.current?.status !== 'finished') {
        endGame(newWinners);
      }
    });

    return () => {
      unsubscribeGame();
      unsubscribePlayers();
    };
  }, [gameId]);

  const triggerWinAnimation = () => {
    playSound('win');
    const duration = 5 * 1000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 10, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#5C1D24', '#D4AF37', '#2E7D32'] });
      confetti({ particleCount: 10, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#5C1D24', '#D4AF37', '#2E7D32'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const startGame = async () => {
    playSound('start');
    await updateDoc(doc(db, 'games', gameId), { status: 'playing', calledNumbers: [] });
  };

  const endGame = async (winners = []) => {
    setAutoDrawInterval(prev => {
      if (prev) clearInterval(prev);
      return null;
    });
    await updateDoc(doc(db, 'games', gameId), {
      status: 'finished',
      winners: winners.map(w => w.name)
    });
  };

  const resetGame = async () => {
    await updateDoc(doc(db, 'games', gameId), { status: 'waiting', calledNumbers: [], winners: [] });
    const playersRef = collection(db, 'games', gameId, 'players');
    const snap = await getDocs(playersRef);
    snap.docs.forEach(async (d) => {
      await updateDoc(doc(db, 'games', gameId, 'players', d.id), { bingoClaimed: false, isValidated: false });
    });
  };

  const drawNumber = useCallback(async () => {
    const gameRef = doc(db, 'games', gameId);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;

    const freshState = snap.data();
    if (freshState.status !== 'playing') return;

    const maxNumber = freshState.mode === 75 ? 75 : 90;
    const called = freshState.calledNumbers || [];

    if (called.length >= maxNumber) {
      endGame();
      return;
    }

    let nextNum;
    const calledSet = new Set(called);
    do {
      nextNum = Math.floor(Math.random() * maxNumber) + 1;
    } while (calledSet.has(nextNum));

    playSound('pop');
    await updateDoc(gameRef, { calledNumbers: [...called, nextNum] });
  }, [gameId, playSound]);

  const toggleAutoDraw = () => {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
    } else {
      drawNumber();
      const interval = setInterval(() => {
        drawNumber();
      }, intervalTime * 1000);
      setAutoDrawInterval(interval);
    }
  };

  useEffect(() => {
    return () => {
      if (autoDrawInterval) clearInterval(autoDrawInterval);
    };
  }, [autoDrawInterval]);

  const shareWhatsApp = () => {
    const url = `${window.location.origin}/play/${gameId}`;
    const text = `¡Únete a mi partida de Bingo Familiar! Código de sala: ${gameId}. Ingresa aquí: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (!gameState) return <div className="text-center mt-4" style={{ color: '#fff' }}>Cargando sala...</div>;

  const maxNumber = gameState.mode === 75 ? 75 : 90;
  const called = gameState.calledNumbers || [];
  const currentNumber = called.length > 0 ? called[called.length - 1] : null;

  let currentLetter = '';
  if (gameState.mode === 75 && currentNumber) {
    if (currentNumber <= 15) currentLetter = 'B';
    else if (currentNumber <= 30) currentLetter = 'I';
    else if (currentNumber <= 45) currentLetter = 'N';
    else if (currentNumber <= 60) currentLetter = 'G';
    else currentLetter = 'O';
  }

  return (
    <div className="app-container" style={{ maxWidth: '1080px', position: 'relative' }}>
      
      {/* Reacciones flotantes */}
      <div style={{ position: 'fixed', bottom: '10px', left: '20px', pointerEvents: 'none', zIndex: 100 }}>
        {activeReactions.map(r => (
          <div key={r.id} style={{
            fontSize: '4rem',
            position: 'absolute',
            bottom: '0',
            left: `${Math.random() * 100}px`,
            animation: 'floatUp 2s ease-out forwards',
            opacity: 1
          }}>
            {r.emoji}
          </div>
        ))}
      </div>

      {/* HEADER DEL ANFITRIÓN */}
      <div className="card flex justify-between items-center animate-pop" style={{ 
        padding: '1.25rem 2rem',
        border: '3px solid var(--burgundy-primary)'
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', margin: 0, fontWeight: '900', color: 'var(--text-vintage-dark)' }}>
            Mesa del Anfitrión
          </h2>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-vintage-muted)' }}>
            Club Clásico de Bingo
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-serif)', color: 'var(--text-vintage-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Código de Sala
          </div>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: '900', 
            fontFamily: 'var(--font-mono)', 
            color: 'var(--burgundy-primary)', 
            letterSpacing: '5px', 
            lineHeight: 1 
          }}>
            {gameId}
          </div>
        </div>

        <div className="flex gap-4 items-center">
          <div className="vintage-brass-plaque" style={{ padding: '0.5rem 1rem', fontSize: '1.1rem', margin: 0 }}>
            <Users size={18} />
            <span>{players.length} Socios</span>
          </div>
          <button className="btn btn-secondary" onClick={shareWhatsApp} style={{ borderRadius: '50%', padding: '0.65rem' }} title="Compartir">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL MODO SALA / TV */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* PANEL IZQUIERDO: SORTEO Y BOLA ACTIVA */}
        <div className="card animate-pop flex flex-col items-center justify-center" style={{ 
          minHeight: '440px', 
          border: '3px solid var(--burgundy-primary)'
        }}>
          
          {gameState.status === 'waiting' && (
            <div className="text-center">
              <div style={{ fontSize: '4rem', marginBottom: '0.75rem' }}>🎟️</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '0.5rem' }}>Mesa Lista</h2>
              <p className="vintage-subtitle" style={{ marginBottom: '1.5rem' }}>Esperando a los participantes familiares...</p>
              <button 
                className="btn-vintage-burgundy" 
                onClick={startGame} 
                disabled={players.length === 0}
              >
                <Play size={22} /> Iniciar Partida ({gameState.mode} Bolas)
              </button>
            </div>
          )}

          {gameState.status === 'playing' && (
            <div className="text-center" style={{ width: '100%' }}>
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                fontSize: '0.95rem',
                color: 'var(--text-vintage-muted)',
                marginBottom: '1rem',
                fontWeight: '800'
              }}>
                Última Bola Extraída
              </h3>
              
              {currentNumber ? (
                <div className="animate-pop" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '185px',
                  height: '185px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 38% 32%, var(--wood-grain-light) 0%, var(--wood-grain-mid) 48%, var(--wood-grain-dark) 78%, var(--wood-grain-deep) 100%)',
                  color: 'var(--text-gold-emboss)',
                  boxShadow: '0 16px 35px rgba(0, 0, 0, 0.75), inset 0 4px 8px rgba(255, 255, 255, 0.4), inset 0 -8px 18px rgba(0, 0, 0, 0.9)',
                  border: '5px solid var(--gold-primary)',
                  marginBottom: '1.5rem',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1' }}>
                    {currentLetter && (
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: '2.1rem', fontWeight: '900', color: 'var(--gold-highlight)', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                        {currentLetter}
                      </span>
                    )}
                    <span style={{ 
                      fontFamily: 'var(--font-serif)', 
                      fontSize: '5.8rem', 
                      fontWeight: '900', 
                      textShadow: '0 3px 6px rgba(0,0,0,0.95)' 
                    }}>
                      {currentNumber}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ height: '185px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontStyle: 'italic', color: 'var(--text-vintage-muted)' }}>
                    ¡Listo para comenzar el sorteo de bolas!
                  </p>
                </div>
              )}

              {/* Controles del bolillero */}
              <div style={{ 
                background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)', 
                padding: '1.25rem', 
                borderRadius: '12px',
                border: '1.5px solid var(--gold-brass)'
              }}>
                <button
                  className="btn-vintage-burgundy"
                  onClick={drawNumber}
                  disabled={autoDrawInterval !== null}
                  style={{ width: '100%', marginBottom: '0.75rem', fontSize: '1.2rem' }}
                >
                  <Dices size={22} /> Extraer Número Manual
                </button>

                <div className="flex items-center gap-2">
                  <select
                    className="vintage-slot-input"
                    style={{ 
                      flex: 1, 
                      padding: '0.6rem', 
                      fontSize: '0.95rem',
                      background: '#fff',
                      border: '1.5px solid var(--gold-brass)',
                      borderRadius: '8px' 
                    }}
                    value={intervalTime}
                    onChange={(e) => setIntervalTime(Number(e.target.value))}
                    disabled={autoDrawInterval !== null}
                  >
                    <option value={3}>Cada 3 seg</option>
                    <option value={5}>Cada 5 seg</option>
                    <option value={8}>Cada 8 seg</option>
                    <option value={10}>Cada 10 seg</option>
                  </select>
                  
                  <button
                    className={`btn ${autoDrawInterval ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={toggleAutoDraw}
                    style={{ flex: 1.4, padding: '0.65rem 1rem', fontSize: '0.95rem' }}
                  >
                    {autoDrawInterval ? <Square size={16} /> : <Play size={16} />}
                    {autoDrawInterval ? 'Pausar' : 'Sorteo Automático'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState.status === 'finished' && (
            <div className="text-center">
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--burgundy-primary)', marginBottom: '1rem', fontWeight: '900' }}>
                ¡Tenemos Ganador!
              </h2>
              {gameState.winners && gameState.winners.length > 0 ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 'bold' }}>
                    🏆 {gameState.winners.join(', ')}
                  </p>
                </div>
              ) : (
                <p className="vintage-subtitle" style={{ marginBottom: '1rem' }}>Partida concluida sin reclamaciones.</p>
              )}
              <button className="btn-vintage-burgundy" onClick={resetGame} style={{ maxWidth: '280px' }}>
                Nueva Partida
              </button>
            </div>
          )}

        </div>

        {/* PANEL DERECHO: TABLERO GENERAL MAESTRO DE CAOBA */}
        <div className="card animate-pop" style={{ 
          display: 'flex', 
          flexDirection: 'column',
          border: '3px solid var(--burgundy-primary)'
        }}>
          <div className="flex justify-between items-center mb-3">
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: '800' }}>
              Tablero Maestro
            </h3>
            <span className="vintage-brass-plaque" style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', margin: 0 }}>
              Faltan {maxNumber - called.length} bolas
            </span>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: gameState.mode === 75 ? 'repeat(5, 1fr)' : 'repeat(10, 1fr)',
            gap: '0.3rem',
            flex: 1,
            alignContent: 'start',
            padding: '0.5rem',
            background: 'radial-gradient(circle at center, #3A1C11 0%, #200D07 100%)',
            borderRadius: '10px',
            border: '2px solid var(--gold-antique)',
            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)'
          }}>
            {Array.from({ length: maxNumber }, (_, i) => i + 1).map(num => {
              const isCalled = called.includes(num);
              const isLast = num === currentNumber;
              
              return (
                <div key={num} style={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: gameState.mode === 75 ? '1.15rem' : '0.82rem',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: '800',
                  borderRadius: '6px',
                  background: isLast 
                    ? 'radial-gradient(circle at 35% 30%, #7E252D 0%, #5C1D24 60%, #3B1015 100%)' 
                    : isCalled 
                    ? 'radial-gradient(circle at center, #2E7D32 0%, #1B5E20 100%)' 
                    : 'rgba(255, 255, 255, 0.06)',
                  color: isCalled ? 'var(--text-gold-emboss)' : 'rgba(212, 175, 55, 0.4)',
                  border: isLast 
                    ? '2px solid var(--gold-primary)' 
                    : isCalled 
                    ? '1.5px solid #81C784' 
                    : '1px solid rgba(140, 107, 35, 0.2)',
                  opacity: isCalled ? 1 : 0.65,
                  transform: isLast ? 'scale(1.15)' : 'scale(1)',
                  zIndex: isLast ? 10 : 1,
                  boxShadow: isLast 
                    ? '0 0 14px rgba(212, 175, 55, 0.9)' 
                    : isCalled 
                    ? '0 2px 4px rgba(0,0,0,0.4)' 
                    : 'none',
                  textShadow: isCalled ? '0 1px 2px rgba(0,0,0,0.8)' : 'none'
                }}>
                  {num}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Chat Familiar para el Anfitrión */}
      <ChatBox
        gameId={gameId}
        currentUser={{
          name: 'Anfitrión',
          avatar: '👑',
          isHost: true
        }}
      />
    </div>
  );
};

export default HostPanel;
