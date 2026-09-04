import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, getDocs, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Share2, Play, Square, Dices, Users, Trophy, Coins, DollarSign, CheckCircle, Clock, X, ShieldCheck, Eye } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '../context/SettingsContext';
import ChatBox from '../components/Chat/ChatBox';
import LiveCommentsOverlay from '../components/Chat/LiveCommentsOverlay';
import BingoRaceHostWidget from '../components/BingoRaceHostWidget';

const HostPanel = () => {
  const { gameId } = useParams();
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [intervalTime, setIntervalTime] = useState(5);
  const [activeReactions, setActiveReactions] = useState([]);
  const [autoDrawInterval, setAutoDrawInterval] = useState(null);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const { playSound } = useSettings();

  const roundEndingRef = useRef(false);
  const winAnimationPlayedRef = useRef(false);

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
          if (!winAnimationPlayedRef.current) {
            winAnimationPlayedRef.current = true;
            triggerWinAnimation();
          }
        } else if (data.status !== 'finished') {
          winAnimationPlayedRef.current = false;
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
      if (newWinners.length > 0 && gameStateRef.current?.status === 'playing' && !roundEndingRef.current) {
        roundEndingRef.current = true;
        endRound(newWinners);
      }
    });

    return () => {
      unsubscribeGame();
      unsubscribePlayers();
    };
  }, [gameId]);

  const triggerWinAnimation = () => {
    playSound('win');
    // Disparo único y liviano de confeti (sin bucles continuos)
    confetti({
      particleCount: 70,
      spread: 65,
      origin: { y: 0.6 },
      colors: ['#5C1D24', '#D4AF37', '#2E7D32', '#F4E7CB']
    });
  };

  const startGame = async () => {
    playSound('start');
    roundEndingRef.current = false;
    winAnimationPlayedRef.current = false;
    await updateDoc(doc(db, 'games', gameId), { status: 'playing', calledNumbers: [] });
  };

  const endRound = async (winners = []) => {
    roundEndingRef.current = true;
    setAutoDrawInterval(prev => {
      if (prev) clearInterval(prev);
      return null;
    });

    const targetWins = gameStateRef.current?.targetWins || 3;
    let tournamentWinner = null;

    // 1. Cambiar estado a finished para frenar cualquier llamada concurrente
    await updateDoc(doc(db, 'games', gameId), {
      status: 'finished',
      winners: winners.map(w => w.name)
    });

    // 2. Incrementar +1 victoria exactamente una vez por ganador
    for (const w of winners) {
      const currentWins = (w.wins || 0) + 1;
      if (currentWins >= targetWins && !tournamentWinner) {
        tournamentWinner = w.name;
      }
      await updateDoc(doc(db, 'games', gameId, 'players', w.id), {
        wins: currentWins
      });
    }

    if (tournamentWinner) {
      await updateDoc(doc(db, 'games', gameId), {
        tournamentWinner: tournamentWinner,
        isTournamentOver: true
      });
    }
  };

  // Siguiente ronda (conserva victorias y pagos)
  const nextRound = async () => {
    roundEndingRef.current = false;
    winAnimationPlayedRef.current = false;
    const currentRound = gameState?.currentRound || 1;
    await updateDoc(doc(db, 'games', gameId), { 
      status: 'waiting', 
      calledNumbers: [], 
      winners: [],
      currentRound: currentRound + 1
    });

    const playersRef = collection(db, 'games', gameId, 'players');
    const snap = await getDocs(playersRef);
    snap.docs.forEach(async (d) => {
      await updateDoc(doc(db, 'games', gameId, 'players', d.id), { 
        bingoClaimed: false, 
        isValidated: false 
      });
    });
  };

  // Reiniciar todo el torneo desde cero
  const resetEntireTournament = async () => {
    roundEndingRef.current = false;
    winAnimationPlayedRef.current = false;
    await updateDoc(doc(db, 'games', gameId), { 
      status: 'waiting', 
      calledNumbers: [], 
      winners: [],
      currentRound: 1,
      tournamentWinner: null,
      isTournamentOver: false
    });

    const playersRef = collection(db, 'games', gameId, 'players');
    const snap = await getDocs(playersRef);
    snap.docs.forEach(async (d) => {
      await updateDoc(doc(db, 'games', gameId, 'players', d.id), { 
        bingoClaimed: false, 
        isValidated: false,
        wins: 0
      });
    });
  };

  // Validaciones de Pago
  const approvePlayerPayment = async (playerId) => {
    playSound('pop');
    await updateDoc(doc(db, 'games', gameId, 'players', playerId), {
      paymentStatus: 'approved'
    });
  };

  const approveAllPayments = async () => {
    playSound('pop');
    for (const p of players) {
      if (p.role !== 'spectator') {
        await updateDoc(doc(db, 'games', gameId, 'players', p.id), {
          paymentStatus: 'approved'
        });
      }
    }
  };

  const sendReaction = async (emoji) => {
    playSound('pop');
    try {
      const messagesRef = collection(db, 'games', gameId, 'messages');
      await addDoc(messagesRef, {
        text: emoji,
        isReaction: true,
        senderName: 'Anfitrión',
        avatar: '👑',
        isHost: true,
        timestamp: serverTimestamp(),
        createdAt: Date.now()
      });
    } catch (e) {
      console.error('Error enviando reacción desde Host:', e);
    }
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
      endRound([]);
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
  const targetWins = gameState.targetWins || 3;
  const currentRound = gameState.currentRound || 1;
  const paymentMode = gameState.paymentMode || false;
  const cardPrice = gameState.cardPrice || 'Gratis';

  let currentLetter = '';
  if (gameState.mode === 75 && currentNumber) {
    if (currentNumber <= 15) currentLetter = 'B';
    else if (currentNumber <= 30) currentLetter = 'I';
    else if (currentNumber <= 45) currentLetter = 'N';
    else if (currentNumber <= 60) currentLetter = 'G';
    else currentLetter = 'O';
  }

  // Ordenar socios por victorias para la tabla de posiciones (excluyendo observadores)
  const leaderboard = [...players].filter(p => p.role !== 'spectator').sort((a, b) => (b.wins || 0) - (a.wins || 0));

  // Conteo de pagos pendientes (sólo jugadores inscritos, no observadores)
  const pendingPaymentsCount = players.filter(p => p.role !== 'spectator' && p.paymentStatus === 'pending_approval').length;

  return (
    <div className="app-container" style={{ maxWidth: '1080px', position: 'relative' }}>
      
      {/* Comentarios en vivo estilo Streamer a un lado */}
      <LiveCommentsOverlay gameId={gameId} />

      {/* HEADER DEL ANFITRIÓN */}
      <div className="card flex justify-between items-center animate-pop" style={{ 
        padding: '1.25rem 2rem',
        border: '3px solid var(--burgundy-primary)'
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', margin: 0, fontWeight: '900', color: 'var(--text-vintage-dark)' }}>
            Mesa del Anfitrión
          </h2>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-vintage-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Club Clásico</span>
            <span>•</span>
            <span style={{ color: 'var(--burgundy-primary)', fontWeight: 'bold' }}>
              Ronda {currentRound} | Meta: {targetWins} Wins
            </span>
          </div>
        </div>
        
        {/* Código de Sala */}
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

        {/* Botón de Socios y Compartir */}
        <div className="flex gap-3 items-center">
          <button 
            className="vintage-brass-plaque" 
            onClick={() => setShowPlayersModal(true)}
            style={{ 
              padding: '0.55rem 1.1rem', 
              fontSize: '1.05rem', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              position: 'relative'
            }}
            title="Ver lista de socios y estado de pago"
          >
            <Users size={18} />
            <span>{players.length} Socios</span>

            {/* Badge si hay pagos pendientes por aprobar */}
            {paymentMode && pendingPaymentsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                backgroundColor: '#B71C1C',
                color: '#fff',
                borderRadius: '999px',
                padding: '2px 7px',
                fontSize: '0.7rem',
                fontWeight: '900',
                border: '1.5px solid var(--gold-primary)',
                animation: 'pulse 1.5s infinite'
              }}>
                {pendingPaymentsCount} PAGO
              </span>
            )}
          </button>

          <button className="btn btn-secondary" onClick={shareWhatsApp} style={{ borderRadius: '50%', padding: '0.65rem' }} title="Compartir invitación por WhatsApp">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* BARRA DE ESTADO DEL TORNEO & PODIO RÁPIDO */}
      <div 
        style={{
          background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)',
          borderRadius: '10px',
          border: '2px solid var(--gold-brass)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 4px 10px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Trophy size={22} color="#8C6B23" />
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: '800', fontSize: '0.95rem' }}>
            Torneo Familiar: {targetWins} Victorias para el Gran Premio
          </span>
          <span style={{
            fontSize: '0.78rem',
            padding: '2px 8px',
            borderRadius: '999px',
            backgroundColor: paymentMode ? '#7E252D' : '#2E7D32',
            color: '#FFF',
            fontWeight: 'bold',
            fontFamily: 'var(--font-serif)'
          }}>
            {paymentMode ? `Inscripción al Torneo (${cardPrice})` : 'Fichas de Casino (Gratis)'}
          </span>
        </div>

        {/* Podio rápido de líderes */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {leaderboard.slice(0, 3).map((p, i) => (
            <div 
              key={p.id}
              style={{
                fontSize: '0.8rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#FFF',
                border: '1px solid var(--gold-brass)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span>{p.name}</span>
              <span style={{ color: 'var(--burgundy-primary)', fontWeight: '900' }}>
                ({p.wins || 0}w)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CARRERA HACIA EL BINGO EN VIVO (PORCENTAJE POR CADA JUGADOR) */}
      <BingoRaceHostWidget
        players={players}
        calledNumbers={called}
        mode={gameState.mode}
      />

      {/* ÁREA PRINCIPAL MODO SALA / TV */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* PANEL IZQUIERDO: SORTEO Y BOLA ACTIVA */}
        <div className="card animate-pop flex flex-col items-center justify-center" style={{ 
          minHeight: '440px', 
          border: '3px solid var(--burgundy-primary)'
        }}>
          
          {gameState.status === 'waiting' && (
            <div className="text-center" style={{ width: '100%' }}>
              <div style={{ fontSize: '4rem', marginBottom: '0.75rem' }}>🎟️</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '0.3rem' }}>
                Mesa Lista - Ronda {currentRound}
              </h2>
              <p className="vintage-subtitle" style={{ marginBottom: '1.25rem' }}>
                {players.length === 0 
                  ? 'Esperando a los participantes...' 
                  : `${players.length} socios en la mesa listos para el sorteo.`
                }
              </p>

              {paymentMode && pendingPaymentsCount > 0 && (
                <div style={{ 
                  backgroundColor: '#FFF4E5', 
                  border: '1.5px solid #F59E0B', 
                  borderRadius: '8px', 
                  padding: '0.5rem 1rem', 
                  marginBottom: '1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Clock size={16} color="#D97706" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#92400E' }}>
                    {pendingPaymentsCount} socio(s) esperando aprobación de inscripción al torneo.
                  </span>
                  <button 
                    onClick={() => setShowPlayersModal(true)}
                    style={{ textDecoration: 'underline', background: 'none', border: 'none', color: '#B45309', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                  >
                    Ver lista
                  </button>
                </div>
              )}

              <button 
                className="btn-vintage-burgundy" 
                onClick={startGame} 
                disabled={players.length === 0}
                style={{ width: '100%', maxWidth: '340px' }}
              >
                <Play size={22} /> Iniciar Ronda {currentRound} ({gameState.mode} Bolas)
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

                {/* Barra de Reacciones Live Stream para el Anfitrión */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.85rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    padding: '0.35rem 1rem', 
                    borderRadius: '999px',
                    background: '#FFF',
                    border: '1.5px solid var(--gold-brass)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                  }}>
                    {['👏', '😂', '😲', '🎉', '❤️', '🍀'].map(emoji => (
                      <button 
                        key={emoji}
                        onClick={() => sendReaction(emoji)}
                        style={{
                          background: 'none', 
                          border: 'none', 
                          fontSize: '1.4rem', 
                          cursor: 'pointer',
                          transition: 'transform 0.15s',
                        }}
                        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.3)'}
                        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                        title={`Enviar ${emoji} al streaming`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {gameState.status === 'finished' && (
            <div className="text-center animate-pop" style={{ width: '100%' }}>
              
              {gameState.isTournamentOver ? (
                /* Gran Campeón del Torneo */
                <div>
                  <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>👑🏆</div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', color: 'var(--burgundy-primary)', fontWeight: '900' }}>
                    ¡GRAN CAMPEÓN DEL TORNEO!
                  </h2>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontWeight: 'bold', margin: '0.75rem 0' }}>
                    {gameState.tournamentWinner}
                  </p>
                  <p className="vintage-subtitle" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                    Alcanzó la meta de {targetWins} victorias acumuladas en el torneo.
                  </p>
                  <button className="btn-vintage-burgundy" onClick={resetEntireTournament} style={{ maxWidth: '320px' }}>
                    Iniciar Nuevo Torneo
                  </button>
                </div>
              ) : (
                /* Ganador de la Ronda Actual */
                <div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', color: 'var(--burgundy-primary)', marginBottom: '0.75rem', fontWeight: '900' }}>
                    ¡Ganador de la Ronda {currentRound}!
                  </h2>
                  {gameState.winners && gameState.winners.length > 0 ? (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <p style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 'bold' }}>
                        🎉 {gameState.winners.join(', ')}
                      </p>
                      <p className="vintage-subtitle">
                        +1 Victoria sumada a la tabla del torneo
                      </p>
                    </div>
                  ) : (
                    <p className="vintage-subtitle" style={{ marginBottom: '1rem' }}>Ronda concluida sin reclamaciones.</p>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn-vintage-burgundy" onClick={nextRound} style={{ maxWidth: '280px' }}>
                      <Play size={18} /> Iniciar Ronda {currentRound + 1}
                    </button>
                    <button className="btn btn-secondary" onClick={resetEntireTournament} style={{ padding: '0.8rem 1.5rem' }}>
                      Reiniciar Torneo
                    </button>
                  </div>
                </div>
              )}

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

      {/* =========================================================
         MODAL / DRAWER DE SOCIOS Y ESTADO DE PAGO
         ========================================================= */}
      {showPlayersModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div 
            className="vintage-parchment-card animate-pop" 
            style={{ 
              maxWidth: '540px', 
              width: '100%', 
              maxHeight: '85vh', 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '1.5rem',
              overflow: 'hidden' 
            }}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid var(--gold-brass)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0, fontWeight: '900' }}>
                  Socios en la Mesa ({players.length})
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-vintage-muted)' }}>
                  {paymentMode ? `Inscripción al Torneo: ${cardPrice}` : 'Modalidad: Fichas de Casino (Gratis)'}
                </span>
              </div>
              <button 
                onClick={() => setShowPlayersModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--burgundy-primary)' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Acciones globales de pago */}
            {paymentMode && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#FFF8EA', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--gold-brass)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                  Aprobar inscripción a todos los socios:
                </span>
                <button 
                  onClick={approveAllPayments}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <ShieldCheck size={16} /> Habilitar a Todos
                </button>
              </div>
            )}

            {/* Lista de Socios */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '4px' }}>
              {players.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-vintage-muted)' }}>
                  Aún no se ha unido ningún socio con el código {gameId}.
                </div>
              ) : (
                players.map((p) => {
                  const isApproved = !paymentMode || p.paymentStatus === 'approved';
                  const isPending = p.paymentStatus === 'pending_approval';

                  return (
                    <div 
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.9rem',
                        backgroundColor: '#FFF',
                        borderRadius: '8px',
                        border: '1.5px solid var(--gold-brass)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      {/* Avatar y Nombre */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #7E252D 0%, #3F1015 100%)',
                          border: '2px solid var(--gold-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem',
                          overflow: 'hidden'
                        }}>
                          {p.avatar && p.avatar.startsWith('data:image') ? (
                            <img src={p.avatar} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            p.avatar || '👤'
                          )}
                        </div>

                        <div>
                          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-vintage-dark)' }}>
                            {p.name}
                          </div>
                          {p.role === 'spectator' ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic' }}>
                              Espectador en vivo
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: 'var(--burgundy-primary)', fontWeight: 'bold' }}>
                              🏆 {p.wins || 0} / {targetWins} Victorias
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Estado y Botón de Habilitación de Pago */}
                      {p.role === 'spectator' ? (
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.3rem', 
                          color: '#555', 
                          fontSize: '0.8rem', 
                          fontWeight: 'bold',
                          backgroundColor: '#F0E6D2',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          border: '1px solid var(--gold-brass)'
                        }}>
                          <Eye size={15} /> Solo Observador
                        </span>
                      ) : paymentMode ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isApproved ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#1B5E20', fontSize: '0.8rem', fontWeight: 'bold' }}>
                              <CheckCircle size={16} /> Inscrito al Torneo
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: isPending ? '#B45309' : '#B71C1C', 
                                fontWeight: 'bold',
                                backgroundColor: isPending ? '#FEF3C7' : '#FEE2E2',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                {isPending ? 'Inscripción Notificada' : 'Inscripción Pendiente'}
                              </span>
                              <button
                                onClick={() => approvePlayerPayment(p.id)}
                                className="btn btn-primary"
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                              >
                                Habilitar al Torneo
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#1B5E20', fontWeight: 'bold' }}>
                          🟢 Listo para Jugar
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

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
