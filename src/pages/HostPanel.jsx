import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Share2, Play, Square, Dices, Users, Settings } from 'lucide-react';
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

        // Manejar reacciones entrantes
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
      confetti({ particleCount: 10, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#4F46E5', '#FACC15', '#22C55E'] });
      confetti({ particleCount: 10, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#4F46E5', '#FACC15', '#22C55E'] });
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

  if (!gameState) return <div className="text-center mt-4">Cargando sala...</div>;

  const maxNumber = gameState.mode === 75 ? 75 : 90;
  const called = gameState.calledNumbers || [];
  const currentNumber = called.length > 0 ? called[called.length - 1] : null;

  // Letra para 75 bolas
  let currentLetter = '';
  if (gameState.mode === 75 && currentNumber) {
    if (currentNumber <= 15) currentLetter = 'B';
    else if (currentNumber <= 30) currentLetter = 'I';
    else if (currentNumber <= 45) currentLetter = 'N';
    else if (currentNumber <= 60) currentLetter = 'G';
    else currentLetter = 'O';
  }

  return (
    <div className="app-container" style={{ maxWidth: '1000px', position: 'relative' }}>
      
      {/* Contenedor de reacciones flotantes para el anfitrión */}
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

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
        }
      `}</style>

      {/* HEADER DEL ANFITRIÓN */}
      <div className="card flex justify-between items-center animate-pop" style={{ padding: '1.5rem 2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-main)' }}>Panel de Anfitrión</h2>
          <div style={{ color: 'var(--text-muted)' }}>Administra la partida</div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Código de Sala</div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '4px', lineHeight: 1 }}>{gameId}</div>
        </div>

        <div className="flex gap-4 items-center">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-app)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-full)' }}>
            <Users size={20} color="var(--secondary)" />
            <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{players.length}</span>
          </div>
          <button className="btn btn-secondary" onClick={shareWhatsApp} style={{ borderRadius: 'var(--radius-full)', padding: '0.75rem' }}>
            <Share2 size={20} />
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL TV MODE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* IZQUIERDA: ESTADO Y SORTEO */}
        <div className="card animate-pop flex flex-col items-center justify-center" style={{ minHeight: '400px', animationDelay: '0.1s' }}>
          
          {gameState.status === 'waiting' && (
            <div className="text-center">
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👋</div>
              <h2 style={{ marginBottom: '0.5rem' }}>Sala Lista</h2>
              <p className="text-muted mb-4">Esperando a que los jugadores se unan...</p>
              <button className="btn btn-primary" onClick={startGame} disabled={players.length === 0} style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
                <Play size={24} /> Iniciar ({gameState.mode} Bolas)
              </button>
            </div>
          )}

          {gameState.status === 'playing' && (
            <div className="text-center" style={{ width: '100%' }}>
              <h3 className="text-muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.9rem' }}>Última Bola</h3>
              
              {currentNumber ? (
                <div className="animate-pop" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  color: 'white',
                  boxShadow: '0 10px 30px rgba(79, 70, 229, 0.4)',
                  border: '10px solid white',
                  marginBottom: '2rem'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1' }}>
                    {currentLetter && <span style={{ fontSize: '2rem', fontWeight: 'bold', opacity: 0.9 }}>{currentLetter}</span>}
                    <span style={{ fontSize: '7rem', fontWeight: '800' }}>{currentNumber}</span>
                  </div>
                </div>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                  <p style={{ fontSize: '1.5rem' }}>¡Listo para comenzar el sorteo!</p>
                </div>
              )}

              {/* Controles de Sorteo */}
              <div className="flex flex-col gap-4" style={{ backgroundColor: 'var(--bg-app)', padding: '1.5rem', borderRadius: '1rem' }}>
                <button
                  className="btn"
                  onClick={drawNumber}
                  disabled={autoDrawInterval !== null}
                  style={{ 
                    padding: '1rem', 
                    fontSize: '1.2rem', 
                    width: '100%',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: 'white'
                  }}
                >
                  <Dices size={24} /> Sacar Número Manual
                </button>

                <div className="flex items-center gap-2">
                  <select
                    className="input"
                    style={{ flex: 1, padding: '0.75rem', borderRadius: 'var(--radius-md)' }}
                    value={intervalTime}
                    onChange={(e) => setIntervalTime(Number(e.target.value))}
                    disabled={autoDrawInterval !== null}
                  >
                    <option value={3}>3 seg</option>
                    <option value={5}>5 seg</option>
                    <option value={8}>8 seg</option>
                  </select>
                  
                  <button
                    className={`btn ${autoDrawInterval ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={toggleAutoDraw}
                    style={{ flex: 2, padding: '0.75rem', borderRadius: 'var(--radius-md)' }}
                  >
                    {autoDrawInterval ? <Square size={20} color="var(--danger)" /> : <Play size={20} />}
                    {autoDrawInterval ? 'Detener' : 'Auto'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {gameState.status === 'finished' && (
            <div className="text-center">
              <h2 style={{ fontSize: '2.5rem', color: 'var(--success)', marginBottom: '1rem' }}>
                ¡Tenemos Ganador!
              </h2>
              {gameState.winners && gameState.winners.length > 0 ? (
                <div style={{ marginBottom: '2rem' }}>
                  <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>🏆 {gameState.winners.join(', ')}</p>
                </div>
              ) : (
                <p className="mb-4">Partida terminada sin ganadores.</p>
              )}
              <button className="btn btn-primary" onClick={resetGame} style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
                Jugar de Nuevo
              </button>
            </div>
          )}

        </div>

        {/* DERECHA: TABLERO GENERAL */}
        <div className="card animate-pop" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: '1.2rem' }}>Tablero General</h3>
            <span className="text-muted" style={{ fontSize: '0.9rem' }}>Faltan {maxNumber - called.length}</span>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: gameState.mode === 75 ? 'repeat(5, 1fr)' : 'repeat(10, 1fr)',
            gap: '0.25rem',
            flex: 1,
            alignContent: 'start'
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
                  fontSize: gameState.mode === 75 ? '1.2rem' : '0.9rem',
                  fontWeight: 'bold',
                  borderRadius: '0.25rem',
                  backgroundColor: isLast ? 'var(--primary)' : isCalled ? 'var(--success)' : 'var(--bg-app)',
                  color: isCalled ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${isCalled ? 'transparent' : 'var(--border-color)'}`,
                  opacity: isCalled ? 1 : 0.5,
                  transition: 'all 0.3s ease',
                  transform: isLast ? 'scale(1.1)' : 'scale(1)',
                  zIndex: isLast ? 10 : 1,
                  boxShadow: isLast ? '0 4px 10px rgba(79, 70, 229, 0.5)' : 'none'
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
