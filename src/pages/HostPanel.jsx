import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, getDocs, getDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Share2, Play, Square, Dices, Users, Trophy, Coins, DollarSign, CheckCircle, Clock, X, ShieldCheck, Eye, Home, Copy, Check, Power, UserMinus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '../context/SettingsContext';
import ChatBox from '../components/Chat/ChatBox';
import LiveCommentsOverlay from '../components/Chat/LiveCommentsOverlay';
import BingoRaceHostWidget from '../components/BingoRaceHostWidget';
import VintageRoulette from '../components/VintageRoulette';
import bgTable from '../assets/bg-table.jpg';

const HostPanel = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [intervalTime, setIntervalTime] = useState(5);
  const [spinDuration, setSpinDuration] = useState(3);
  const [activeReactions, setActiveReactions] = useState([]);
  const [autoDrawInterval, setAutoDrawInterval] = useState(null);
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [showCloseRoomModal, setShowCloseRoomModal] = useState(false);
  const [departedNotification, setDepartedNotification] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const { playSound } = useSettings();

  const prevPlayersOnlineRef = useRef({});

  const roundEndingRef = useRef(false);
  const winAnimationPlayedRef = useRef(false);

  const gameStateRef = useRef(null);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (gameId) {
      localStorage.setItem('bingo_dealer_active_game', gameId);
    }
    const gameRef = doc(db, 'games', gameId);
    const unsubscribeGame = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState(data);
        if (data.spinDuration && data.spinDuration !== spinDuration) {
          setSpinDuration(data.spinDuration);
        }
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
    await updateDoc(gameRef, { 
      calledNumbers: [...called, nextNum],
      spinDuration: spinDuration,
      lastSpinAt: Date.now()
    });
  }, [gameId, playSound, spinDuration]);

  const handleManualRouletteSpin = useCallback(async () => {
    if (isRouletteSpinning || autoDrawInterval !== null) return null;

    const gameRef = doc(db, 'games', gameId);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return null;

    const freshState = snap.data();
    if (freshState.status !== 'playing') return null;

    const maxNumber = freshState.mode === 75 ? 75 : 90;
    const called = freshState.calledNumbers || [];

    if (called.length >= maxNumber) {
      endRound([]);
      return null;
    }

    let nextNum;
    const calledSet = new Set(called);
    do {
      nextNum = Math.floor(Math.random() * maxNumber) + 1;
    } while (calledSet.has(nextNum));

    setIsRouletteSpinning(true);
    playSound('pop');

    const now = Date.now();
    // ¡SINCRONIZACIÓN INMEDIATA EN TIEMPO REAL!
    // Actualizar Firestore al instante para que todos los jugadores
    // inicien el giro en el mismo milisegundo que el anfitrión (< 60ms de latencia)
    await updateDoc(gameRef, { 
      calledNumbers: [...called, nextNum],
      spinDuration: spinDuration,
      lastSpinAt: now
    });

    setTimeout(() => {
      setIsRouletteSpinning(false);
    }, Math.round(spinDuration * 1000));

    return nextNum;
  }, [gameId, playSound, isRouletteSpinning, autoDrawInterval, spinDuration]);

  const handleDurationChange = useCallback(async (newDuration) => {
    setSpinDuration(newDuration);
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, { spinDuration: newDuration });
    } catch (e) {
      console.error('Error sincronizando duración de ruleta:', e);
    }
  }, [gameId]);

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

  const getShareUrl = () => {
    // Si estamos en cualquier URL de Vercel (especialmente vistas previas de equipo con hash que exigen login),
    // forzamos el dominio oficial de producción público (bingo-online-six.vercel.app)
    // para que ningún jugador tenga que iniciar sesión en Vercel.
    if (window.location.hostname.includes('vercel.app')) {
      return `https://bingo-online-six.vercel.app/play/${gameId}`;
    }
    return `${window.location.origin}/play/${gameId}`;
  };

  const shareWhatsApp = () => {
    const url = getShareUrl();
    const text = `¡Únete a mi partida de Bingo Familiar! Código de sala: ${gameId}. Ingresa aquí: ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyShareLink = async () => {
    const url = getShareUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Error al copiar enlace:', err);
    }
  };

  const isPlayerOnline = useCallback((p) => {
    if (!p) return false;
    if (p.isOnline === false) return false;
    if (p.lastSeen && (Date.now() - p.lastSeen > 40000)) return false;
    return true;
  }, []);

  // Escuchar cuando un jugador se desconecta o sale de la sala
  useEffect(() => {
    if (!players || players.length === 0) return;

    players.forEach(p => {
      const online = isPlayerOnline(p);
      if (prevPlayersOnlineRef.current[p.id] === true && online === false) {
        setDepartedNotification(`🚪 ${p.name} ha salido de la sala`);
        playSound('pop');
        setTimeout(() => {
          setDepartedNotification(null);
        }, 5000);
      }
      prevPlayersOnlineRef.current[p.id] = online;
    });
  }, [players, isPlayerOnline, playSound]);

  const handleCloseRoom = async () => {
    try {
      if (autoDrawInterval) {
        clearInterval(autoDrawInterval);
        setAutoDrawInterval(null);
      }
      await updateDoc(doc(db, 'games', gameId), {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: 'host'
      });
      const messagesRef = collection(db, 'games', gameId, 'messages');
      await addDoc(messagesRef, {
        text: '🏛️ La sala ha sido clausurada y cerrada definitivamente por el anfitrión.',
        isReaction: false,
        isSystem: true,
        senderName: 'Anfitrión',
        isHost: true,
        timestamp: serverTimestamp(),
        createdAt: Date.now()
      });
      localStorage.removeItem('bingo_dealer_active_game');
      navigate('/');
    } catch (err) {
      console.error('Error cerrando sala:', err);
    }
  };

  const handleRemovePlayer = async (playerId, playerName) => {
    try {
      await deleteDoc(doc(db, 'games', gameId, 'players', playerId));
      const messagesRef = collection(db, 'games', gameId, 'messages');
      await addDoc(messagesRef, {
        text: `ℹ️ ${playerName} ha sido retirado de la mesa por el anfitrión.`,
        isReaction: false,
        isSystem: true,
        senderName: 'Sistema',
        isHost: false,
        timestamp: serverTimestamp(),
        createdAt: Date.now()
      });
    } catch (err) {
      console.error('Error eliminando jugador:', err);
    }
  };

  if (!gameState) {
    return (
      <div 
        className="dealer-page-wrapper"
        style={{
          backgroundImage: `radial-gradient(ellipse at center, rgba(30, 12, 6, 0.45) 0%, rgba(10, 4, 2, 0.8) 100%), url(${bgTable})`,
          justifyContent: 'center'
        }}
      >
        <div className="card text-center animate-pop" style={{ maxWidth: '350px', padding: '2rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🎲</span>
          <p style={{ fontFamily: 'var(--font-serif)', fontWeight: 'bold', marginTop: '0.75rem', color: 'var(--burgundy-primary)' }}>
            Cargando Mesa del Anfitrión...
          </p>
        </div>
      </div>
    );
  }

  const onlinePlayersCount = players.filter(isPlayerOnline).length;
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
    <div 
      className="dealer-page-wrapper"
      style={{
        backgroundImage: `radial-gradient(ellipse at center, rgba(30, 12, 6, 0.4) 0%, rgba(10, 4, 2, 0.82) 100%), url(${bgTable})`
      }}
    >
      <div className="app-container host-app-container" style={{ position: 'relative' }}>
      
      {/* Comentarios en vivo estilo Streamer a un lado */}
      <LiveCommentsOverlay gameId={gameId} />

      {/* Notificación flotante de salida de socio */}
      {departedNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          backgroundColor: '#FAF4E5',
          border: '2px solid #80141D',
          borderRadius: '10px',
          padding: '0.65rem 1.4rem',
          boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontFamily: 'var(--font-serif)',
          fontWeight: 'bold',
          color: '#80141D',
          animation: 'pop 0.3s ease'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🚪</span>
          <span>{departedNotification}</span>
        </div>
      )}

      {/* HEADER DEL ANFITRIÓN */}
      <div className="card flex justify-between items-center animate-pop" style={{ 
        padding: '1.25rem 2rem',
        border: '3px solid var(--burgundy-primary)',
        gap: '1.25rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
          <button 
            onClick={() => navigate('/')} 
            className="vintage-brass-plaque"
            style={{
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.15rem',
              fontSize: '1rem'
            }}
            title="Volver a la página principal"
          >
            <Home size={18} />
            <span>Inicio</span>
          </button>

          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.85rem', margin: 0, fontWeight: '900', color: 'var(--text-vintage-dark)' }}>
              Mesa del Anfitrión
            </h2>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-vintage-muted)', display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.95rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
              <span>Club Clásico</span>
              <span>•</span>
              <span style={{ color: 'var(--burgundy-primary)', fontWeight: 'bold' }}>
                Ronda {currentRound} | Meta: {targetWins} Wins
              </span>
              <span>•</span>
              <span style={{ color: '#1B5E20', fontWeight: 'bold' }}>
                👥 {onlinePlayersCount} {onlinePlayersCount === 1 ? 'conectado' : 'conectados'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Código de Sala */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-serif)', color: 'var(--text-vintage-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 'bold' }}>
            Código de Sala
          </div>
          <div style={{ 
            fontSize: '2.8rem', 
            fontWeight: '900', 
            fontFamily: 'var(--font-mono)', 
            color: 'var(--burgundy-primary)', 
            letterSpacing: '6px', 
            lineHeight: 1 
          }}>
            {gameId}
          </div>
        </div>

        {/* Botón de Socios, Compartir y Cerrar Sala */}
        <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
          <button 
            className="vintage-brass-plaque" 
            onClick={() => setShowPlayersModal(true)}
            style={{ 
              margin: 0,
              padding: '0.55rem 1rem', 
              fontSize: '0.95rem', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              position: 'relative'
            }}
            title="Ver lista de socios y estado de conexión"
          >
            <Users size={17} />
            <span>
              {onlinePlayersCount === players.length 
                ? `${players.length} Socios` 
                : `${onlinePlayersCount}/${players.length} Socios`}
            </span>

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

          <button 
            className="vintage-brass-plaque" 
            onClick={copyShareLink} 
            style={{ 
              margin: 0,
              padding: '0.55rem 1rem',
              fontSize: '0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }} 
            title="Copiar enlace directo a la sala (sin login)"
          >
            {copiedLink ? <Check size={17} color="#1b5e20" /> : <Copy size={17} />}
            <span>{copiedLink ? '¡Copiado!' : 'Copiar Link'}</span>
          </button>

          <button 
            className="vintage-brass-plaque" 
            onClick={shareWhatsApp} 
            style={{ 
              margin: 0,
              padding: '0.55rem 1rem',
              fontSize: '0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }} 
            title="Compartir invitación por WhatsApp"
          >
            <Share2 size={17} />
            <span className="mobile-hidden">WhatsApp</span>
          </button>

          <button 
            className="vintage-brass-plaque" 
            onClick={() => setShowCloseRoomModal(true)} 
            style={{ 
              margin: 0,
              padding: '0.55rem 1rem',
              fontSize: '0.95rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: '#80141D',
              borderColor: '#80141D'
            }} 
            title="Cerrar y clausurar definitivamente esta sala"
          >
            <Power size={17} color="#80141D" />
            <span className="mobile-hidden">Cerrar Sala</span>
          </button>
        </div>
      </div>

      {/* BARRA DE ESTADO DEL TORNEO & PODIO RÁPIDO */}
      <div 
        style={{
          background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)',
          borderRadius: '12px',
          border: '2px solid var(--gold-brass)',
          padding: '0.95rem 1.6rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Trophy size={24} color="#8C6B23" />
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: '800', fontSize: '1.05rem' }}>
            Torneo Familiar: {targetWins} Victorias para el Gran Premio
          </span>
          <span style={{
            fontSize: '0.82rem',
            padding: '3px 10px',
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
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {leaderboard.slice(0, 3).map((p, i) => (
            <div 
              key={p.id}
              style={{
                fontSize: '0.85rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: '#FFF',
                border: '1px solid var(--gold-brass)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
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
      <div className="host-game-grid">
        
        {/* PANEL IZQUIERDO: SORTEO Y BOLA ACTIVA */}
        <div className="host-controls-col">
          <div className="card animate-pop flex flex-col items-center justify-center" style={{ 
            padding: '2.5rem 2rem', 
            border: '3px solid var(--burgundy-primary)',
            minHeight: '440px'
          }}>
            
            {gameState.status === 'waiting' && (
              <div className="text-center" style={{ width: '100%' }}>
                <div style={{ fontSize: '4.5rem', marginBottom: '0.75rem' }}>🎟️</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.3rem', marginBottom: '0.5rem', color: 'var(--text-vintage-dark)', fontWeight: '900' }}>
                  Mesa Lista - Ronda {currentRound}
                </h2>
                <p className="vintage-subtitle" style={{ marginBottom: '1.75rem', fontSize: '1.15rem' }}>
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
                    padding: '0.6rem 1rem', 
                    marginBottom: '1.25rem',
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
                  style={{ 
                    width: '100%', 
                    maxWidth: '440px', 
                    fontSize: '1.25rem', 
                    padding: '1.05rem 2rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.6rem'
                  }}
                >
                  <Play size={24} /> Iniciar Ronda {currentRound} ({gameState.mode} Bolas)
                </button>
              </div>
            )}

          {gameState.status === 'playing' && (
            <div className="text-center" style={{ width: '100%' }}>
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
                  Ruleta de Salón Vintage
                </h3>
                <span style={{ fontSize: '1.2rem' }}>⚜️</span>
              </div>
              
              {/* Ruleta interactiva de casino con motor de giro, bola animada y revelación central */}
              <VintageRoulette
                currentNumber={currentNumber}
                currentLetter={currentLetter}
                onSpin={handleManualRouletteSpin}
                disabled={autoDrawInterval !== null || isRouletteSpinning}
                remainingCount={maxNumber - called.length}
                gameMode={gameState.mode}
                spinDuration={spinDuration}
                lastSpinAt={gameState.lastSpinAt || null}
                onDurationChange={handleDurationChange}
              />

              {/* Controles de velocidad y Sorteo Automático */}
              <div style={{ 
                marginTop: '1.25rem',
                background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)', 
                padding: '1rem', 
                borderRadius: '12px',
                border: '1.5px solid var(--gold-brass)'
              }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Modo Continuo / Automático
                </div>

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
                    disabled={autoDrawInterval !== null || isRouletteSpinning}
                  >
                    <option value={3}>Cada 3 seg</option>
                    <option value={5}>Cada 5 seg</option>
                    <option value={8}>Cada 8 seg</option>
                    <option value={10}>Cada 10 seg</option>
                  </select>
                  
                  <button
                    className={`btn ${autoDrawInterval ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={toggleAutoDraw}
                    disabled={isRouletteSpinning}
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
        </div>

        {/* PANEL DERECHO: TABLERO GENERAL MAESTRO DE CAOBA */}
        <div className="host-board-col">
          <div className="card animate-pop" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            border: '3px solid var(--burgundy-primary)',
            padding: '1.5rem'
          }}>
            <div className="flex justify-between items-center mb-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.55rem', fontWeight: '900', margin: 0 }}>
                  Tablero Maestro
                </h3>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic' }}>
                  ({called.length} extraídas de {maxNumber})
                </span>
              </div>
              <span className="vintage-brass-plaque" style={{ padding: '0.35rem 0.95rem', fontSize: '0.9rem', margin: 0 }}>
                Faltan {maxNumber - called.length} bolas
              </span>
            </div>
            
            <div style={{
              flex: 1,
              padding: '1rem 1.25rem',
              background: 'radial-gradient(circle at center, #3A1C11 0%, #200D07 100%)',
              borderRadius: '12px',
              border: '2px solid var(--gold-antique)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.85)',
              overflowX: 'auto'
            }}>
              {gameState.mode === 75 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '680px' }}>
                  {[
                    { letter: 'B', range: [1, 15] },
                    { letter: 'I', range: [16, 30] },
                    { letter: 'N', range: [31, 45] },
                    { letter: 'G', range: [46, 60] },
                    { letter: 'O', range: [61, 75] }
                  ].map(({ letter, range }) => (
                    <div key={letter} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'clamp(46px, 3.2vw, 56px) repeat(15, 1fr)', 
                      gap: '0.35rem',
                      alignItems: 'center'
                    }}>
                      {/* Letra de la Fila */}
                      <div style={{
                        aspectRatio: '1',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'clamp(1.2rem, 1.6vw, 1.7rem)',
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '900',
                        borderRadius: '8px',
                        background: 'radial-gradient(circle at 35% 30%, #8C222C 0%, #5C1D24 100%)',
                        color: 'var(--gold-primary)',
                        border: '2px solid var(--gold-brass)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                      }}>
                        {letter}
                      </div>

                      {/* 15 Bolas correspondientes */}
                      {Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i).map(num => {
                        const isCalled = called.includes(num);
                        const isLast = num === currentNumber;
                        return (
                          <div key={num} style={{
                            aspectRatio: '1',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'clamp(0.95rem, 1.25vw, 1.35rem)',
                            fontFamily: 'var(--font-serif)',
                            fontWeight: '800',
                            borderRadius: '7px',
                            background: isLast 
                              ? 'radial-gradient(circle at 35% 30%, #9E242F 0%, #691720 60%, #350A0E 100%)' 
                              : isCalled 
                              ? 'radial-gradient(circle at center, #2E7D32 0%, #14532D 100%)' 
                              : 'linear-gradient(180deg, #3A1C12 0%, #220E07 100%)',
                            color: isLast 
                              ? '#FFF2C6' 
                              : isCalled 
                              ? '#FFFFFF' 
                              : '#E8D1A7',
                            border: isLast 
                              ? '2.5px solid var(--gold-primary)' 
                              : isCalled 
                              ? '2px solid #86EFAC' 
                              : '1.5px solid rgba(212, 175, 55, 0.42)',
                            opacity: 1,
                            transform: isLast ? 'scale(1.15)' : isCalled ? 'scale(1.02)' : 'scale(1)',
                            zIndex: isLast ? 10 : 1,
                            boxShadow: isLast 
                              ? '0 0 16px rgba(212, 175, 55, 0.95), 0 3px 6px rgba(0,0,0,0.6)' 
                              : isCalled 
                              ? '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)' 
                              : 'inset 0 1px 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.3)',
                            textShadow: isLast 
                              ? '0 2px 4px rgba(0,0,0,0.9)' 
                              : isCalled 
                              ? '0 1px 3px rgba(0,0,0,0.9)' 
                              : '0 1px 2px rgba(0,0,0,0.95)',
                            transition: 'all 0.2s ease'
                          }}>
                            {num}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: '600px' }}>
                  {Array.from({ length: 9 }, (_, r) => ({ rowNum: r + 1, start: r * 10 + 1, end: (r + 1) * 10 })).map(({ rowNum, start, end }) => (
                    <div key={rowNum} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'clamp(54px, 3.6vw, 68px) repeat(10, 1fr)', 
                      gap: '0.35rem',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        height: '100%',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'clamp(0.78rem, 0.95vw, 1rem)',
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '900',
                        borderRadius: '7px',
                        background: 'radial-gradient(circle at 35% 30%, #8C222C 0%, #5C1D24 100%)',
                        color: 'var(--gold-primary)',
                        border: '1.5px solid var(--gold-brass)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}>
                        {start}-{end}
                      </div>

                      {Array.from({ length: 10 }, (_, i) => start + i).map(num => {
                        const isCalled = called.includes(num);
                        const isLast = num === currentNumber;
                        return (
                          <div key={num} style={{
                            aspectRatio: '1',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'clamp(0.95rem, 1.35vw, 1.45rem)',
                            fontFamily: 'var(--font-serif)',
                            fontWeight: '800',
                            borderRadius: '7px',
                            background: isLast 
                              ? 'radial-gradient(circle at 35% 30%, #9E242F 0%, #691720 60%, #350A0E 100%)' 
                              : isCalled 
                              ? 'radial-gradient(circle at center, #2E7D32 0%, #14532D 100%)' 
                              : 'linear-gradient(180deg, #3A1C12 0%, #220E07 100%)',
                            color: isLast 
                              ? '#FFF2C6' 
                              : isCalled 
                              ? '#FFFFFF' 
                              : '#E8D1A7',
                            border: isLast 
                              ? '2.5px solid var(--gold-primary)' 
                              : isCalled 
                              ? '2px solid #86EFAC' 
                              : '1.5px solid rgba(212, 175, 55, 0.42)',
                            opacity: 1,
                            transform: isLast ? 'scale(1.15)' : isCalled ? 'scale(1.02)' : 'scale(1)',
                            zIndex: isLast ? 10 : 1,
                            boxShadow: isLast 
                              ? '0 0 16px rgba(212, 175, 55, 0.95), 0 3px 6px rgba(0,0,0,0.6)' 
                              : isCalled 
                              ? '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)' 
                              : 'inset 0 1px 3px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.3)',
                            textShadow: isLast 
                              ? '0 2px 4px rgba(0,0,0,0.9)' 
                              : isCalled 
                              ? '0 1px 3px rgba(0,0,0,0.9)' 
                              : '0 1px 2px rgba(0,0,0,0.95)',
                            transition: 'all 0.2s ease'
                          }}>
                            {num}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 'bold',
                              color: isPlayerOnline(p) ? '#1B5E20' : '#854D0E',
                              backgroundColor: isPlayerOnline(p) ? '#E8F5E9' : '#FEF3C7',
                              border: `1px solid ${isPlayerOnline(p) ? '#A5D6A7' : '#FDE68A'}`,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}>
                              {isPlayerOnline(p) ? '🟢 En Sala' : '⚪ Salió de la sala'}
                            </span>

                            {p.role === 'spectator' ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic' }}>
                                Espectador
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--burgundy-primary)', fontWeight: 'bold' }}>
                                🏆 {p.wins || 0} / {targetWins} Victorias
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Estado y Botón de Habilitación de Pago / Retirar socio */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                            <Eye size={15} /> Observador
                          </span>
                        ) : paymentMode ? (
                          isApproved ? (
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
                                Habilitar
                              </button>
                            </div>
                          )
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#1B5E20', fontWeight: 'bold' }}>
                            Listo
                          </span>
                        )}

                        {/* Botón para remover socio si salió de la sala */}
                        {!isPlayerOnline(p) && (
                          <button
                            onClick={() => handleRemovePlayer(p.id, p.name)}
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.3rem 0.6rem',
                              color: '#B71C1C',
                              borderColor: '#B71C1C',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            title="Eliminar socio desconectado de la sala"
                          >
                            <UserMinus size={13} />
                            <span>Retirar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CIERRE DEFINITIVO DE SALA */}
      {showCloseRoomModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 4, 2, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          backdropFilter: 'blur(5px)'
        }}>
          <div className="vintage-parchment-card animate-pop text-center" style={{
            maxWidth: '480px',
            width: '100%',
            padding: '2.5rem 2rem',
            position: 'relative'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              background: 'radial-gradient(circle at 35% 30%, #8b2834 0%, var(--burgundy-primary) 60%, var(--burgundy-dark) 100%)',
              border: '3px solid var(--gold-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              boxShadow: '0 6px 14px rgba(0,0,0,0.35)'
            }}>
              🏛️
            </div>

            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.7rem',
              color: 'var(--burgundy-primary)',
              fontWeight: '900',
              margin: '0 0 0.6rem'
            }}>
              Cierre Definitivo de Sala
            </h2>

            <p style={{
              fontSize: '0.96rem',
              color: '#4A2810',
              lineHeight: 1.5,
              margin: '0 auto 1.5rem',
              maxWidth: '380px'
            }}>
              ¿Estás seguro de que deseas cerrar y clausurar esta sala? La partida actual se detendrá de inmediato y todos los jugadores y observadores serán notificados del cierre del torneo.
            </p>

            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCloseRoomModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-serif)'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn-vintage-burgundy"
                onClick={handleCloseRoom}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.75rem 1.6rem',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                <Power size={18} /> Sí, Cerrar Sala
              </button>
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
    </div>
  );
};

export default HostPanel;
