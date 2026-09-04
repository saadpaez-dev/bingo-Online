import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, loginAnonymously } from '../firebase';
import { generateCard75, generateCard90, validateBingo75, validateBingo90, calculateCardProgress } from '../utils/bingo';
import BingoCard75 from '../components/BingoCard75';
import BingoCard90 from '../components/BingoCard90';
import ChatBox from '../components/Chat/ChatBox';
import LiveCommentsOverlay from '../components/Chat/LiveCommentsOverlay';
import BingoRaceModal from '../components/BingoRaceModal';
import { Trophy, RefreshCw, Image as ImageIcon, Lock, CheckCircle, Clock, ShieldCheck, CreditCard, Eye, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '../context/SettingsContext';

const FiligreeCorner = ({ position }) => (
  <svg 
    className={`filigree-corner ${position}`} 
    viewBox="0 0 60 60" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M5 5 C 18 5, 32 10, 42 22 C 34 22, 28 28, 28 36 C 20 28, 14 18, 5 14 Z" 
      fill="#C59B27" 
      opacity="0.85" 
    />
    <path 
      d="M5 5 L 5 45 C 8 36, 14 30, 20 22 C 28 14, 36 8, 48 5 Z" 
      stroke="#8C6B23" 
      strokeWidth="2" 
      fill="none" 
    />
    <circle cx="16" cy="16" r="3.5" fill="#D4AF37" stroke="#573E11" strokeWidth="1" />
  </svg>
);

const PlayerPanel = () => {
  const { gameId } = useParams();
  const [name, setName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [markedNumbers, setMarkedNumbers] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { playSound } = useSettings();

  const [avatar] = useState(() => {
    const emojis = ['🎩', '👑', '🎲', '⚜️', '🪙', '🦊', '🦁', '🦉'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  });
  const [customAvatar, setCustomAvatar] = useState(null);

  const [lastCalledCount, setLastCalledCount] = useState(0);
  const [allPlayers, setAllPlayers] = useState([]);
  const [showRaceModal, setShowRaceModal] = useState(false);
  const [selectedObservedPlayerId, setSelectedObservedPlayerId] = useState(null);
  const winAnimationPlayedRef = useRef(false);
  const prevApprovedRef = useRef(false);

  // Listener de todos los jugadores de la sala (para la Carrera al Bingo y para el Observador)
  useEffect(() => {
    if (!gameId) return;
    const playersRef = collection(db, 'games', gameId, 'players');
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      const pList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllPlayers(pList);
    });
    return () => unsubscribe();
  }, [gameId]);

  // Inicialización y auto-reconexión si el jugador ya estaba registrado en la sala
  useEffect(() => {
    loginAnonymously().then(async (user) => {
      setUserId(user.uid);
      try {
        const playerSnap = await getDoc(doc(db, 'games', gameId, 'players', user.uid));
        if (playerSnap.exists()) {
          const pData = playerSnap.data();
          setName(pData.name || '');
          setPlayerData(pData);
          setHasJoined(true);
        }
      } catch (err) {
        console.error("Error auto-reconectando jugador:", err);
      }
    });

    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState(data);
        
        if (data.calledNumbers && data.calledNumbers.length > lastCalledCount && data.status === 'playing') {
          playSound('pop');
          setLastCalledCount(data.calledNumbers.length);
        }

        if (data.status === 'finished' && data.winners?.includes(name)) {
          if (!winAnimationPlayedRef.current) {
            winAnimationPlayedRef.current = true;
            triggerWinAnimation();
          }
        } else if (data.status !== 'finished') {
          winAnimationPlayedRef.current = false;
        }

      } else {
        setErrorMsg('La sala no existe.');
      }
    });

    return () => unsubscribe();
  }, [gameId, name, lastCalledCount, playSound]);

  // Listener de los datos del jugador en tiempo real
  useEffect(() => {
    if (!userId || !hasJoined) return;

    const playerRef = doc(db, 'games', gameId, 'players', userId);
    const unsubscribe = onSnapshot(playerRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlayerData(data);

        // Sonido triunfal de desbloqueo cuando el anfitrión aprueba la inscripción
        if (data.paymentStatus === 'approved' && !prevApprovedRef.current) {
          playSound('start');
          prevApprovedRef.current = true;
        }
      }
    });

    return () => unsubscribe();
  }, [userId, hasJoined, gameId, playSound]);

  const triggerWinAnimation = useCallback(() => {
    playSound('win');
    // Disparo único y liviano de confeti
    confetti({
      particleCount: 70,
      spread: 65,
      origin: { y: 0.6 },
      colors: ['#5C1D24', '#D4AF37', '#2E7D32', '#F4E7CB']
    });
  }, [playSound]);

  const handleJoin = async (e, joinRole = 'paid') => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    const isSpectator = joinRole === 'spectator';
    const isPaymentRequired = !!gameState.paymentMode;
    const card = isSpectator ? null : (gameState.mode === 75 ? generateCard75() : generateCard90());
    
    // Si es observador no requiere pago; si es jugador de pago pasa a pending_approval; si es gratis approved
    const initialPaymentStatus = isSpectator ? 'spectator' : (!isPaymentRequired ? 'approved' : 'pending_approval');
    
    await setDoc(doc(db, 'games', gameId, 'players', userId), {
      name: name.trim(),
      avatar: customAvatar ? customAvatar : avatar,
      isCustomAvatar: !!customAvatar,
      card: card,
      bingoClaimed: false,
      isValidated: false,
      wins: 0,
      role: isSpectator ? 'spectator' : 'player',
      paymentStatus: initialPaymentStatus
    });
    
    setHasJoined(true);
  };

  const upgradeToPlayer = async () => {
    playSound('pop');
    const card = gameState.mode === 75 ? generateCard75() : generateCard90();
    await updateDoc(doc(db, 'games', gameId, 'players', userId), {
      card: card,
      role: 'player',
      paymentStatus: 'pending_approval'
    });
  };

  const notifyPayment = async () => {
    playSound('pop');
    await updateDoc(doc(db, 'games', gameId, 'players', userId), {
      paymentStatus: 'pending_approval'
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCustomAvatar(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const changeCard = async () => {
    if (gameState.status !== 'waiting') return;
    const newCard = gameState.mode === 75 ? generateCard75() : generateCard90();
    setMarkedNumbers(new Set());
    await updateDoc(doc(db, 'games', gameId, 'players', userId), {
      card: newCard
    });
  };

  const toggleMark = (num) => {
    if (num === 'FREE' || num === null) return;
    
    playSound('draw');
    setMarkedNumbers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(num)) newSet.delete(num);
      else newSet.add(num);
      return newSet;
    });
  };

  const claimBingo = async () => {
    if (gameState.status !== 'playing') {
      alert("La partida no está en curso.");
      return;
    }

    const isValid = gameState.mode === 75 
      ? validateBingo75(playerData.card, gameState.calledNumbers)
      : validateBingo90(playerData.card, gameState.calledNumbers);

    if (isValid) {
      await updateDoc(doc(db, 'games', gameId, 'players', userId), {
        bingoClaimed: true,
        isValidated: true
      });
    } else {
      alert("¡Bingo Inválido! Revisa bien tu cartón.");
      await updateDoc(doc(db, 'games', gameId, 'players', userId), {
        bingoClaimed: true,
        isValidated: false
      });
      setTimeout(() => {
        updateDoc(doc(db, 'games', gameId, 'players', userId), {
          bingoClaimed: false
        });
      }, 3000);
    }
  };

  const sendReaction = async (emoji) => {
    playSound('pop');
    try {
      const messagesRef = collection(db, 'games', gameId, 'messages');
      await addDoc(messagesRef, {
        text: emoji,
        isReaction: true,
        senderName: name || 'Jugador',
        avatar: playerData?.avatar || avatar,
        isCustomAvatar: !!playerData?.isCustomAvatar,
        isHost: false,
        timestamp: serverTimestamp(),
        createdAt: Date.now()
      });
    } catch (e) {
      console.error('Error enviando reacción en streaming:', e);
    }
  };

  if (errorMsg) return <div className="text-center mt-4" style={{ color: '#fff' }}><h3>{errorMsg}</h3></div>;
  if (!gameState) return <div className="text-center mt-4" style={{ color: '#fff' }}>Cargando sala...</div>;

  // =========================================================================
  // ESTADO 1: PANTALLA DE INGRESO Y REGISTRO AL TORNEO (!hasJoined)
  // =========================================================================
  if (!hasJoined) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="vintage-parchment-card animate-pop" style={{ maxWidth: '460px', padding: '2.5rem 2rem' }}>
          
          <FiligreeCorner position="top-left" />
          <FiligreeCorner position="top-right" />
          <FiligreeCorner position="bottom-left" />
          <FiligreeCorner position="bottom-right" />

          {/* Medallón con foto de perfil o avatar */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ 
              width: '105px', 
              height: '105px', 
              margin: '0 auto 1rem',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #8b2834 0%, var(--burgundy-primary) 60%, var(--burgundy-dark) 100%)',
              border: '4px solid var(--gold-primary)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '3.5rem', 
              overflow: 'hidden',
              boxShadow: '0 8px 18px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.4)',
              position: 'relative'
            }}>
              {customAvatar ? (
                <img src={customAvatar} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                avatar
              )}
              
              <label style={{
                position: 'absolute', bottom: 0, right: 0, left: 0,
                backgroundColor: 'rgba(20, 10, 5, 0.75)', color: 'var(--text-gold-emboss)',
                fontSize: '0.75rem', padding: '0.25rem', cursor: 'pointer',
                textAlign: 'center', borderTop: '1px solid var(--gold-brass)'
              }}>
                <ImageIcon size={14} style={{ margin: '0 auto' }} />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
            </div>
            
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--text-vintage-dark)', fontWeight: '800', margin: 0 }}>
              Recepción del Torneo
            </h2>
            <span className="vintage-brass-plaque" style={{ display: 'inline-block', marginTop: '0.3rem', padding: '0.15rem 0.75rem' }}>
              Sala {gameId}
            </span>
          </div>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            
            {/* Input Nombre */}
            <div className="vintage-brass-slot" style={{ width: '100%', maxWidth: '340px' }}>
              <div className="slot-screw tl" />
              <div className="slot-screw tr" />
              <div className="slot-screw bl" />
              <div className="slot-screw br" />
              <div className="vintage-slot-window">
                <input 
                  type="text" 
                  className="vintage-slot-input" 
                  placeholder="ESCRIBE TU NOMBRE" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={15}
                />
              </div>
            </div>

            {/* Caja Destacada de Inscripción al Torneo si es de pago */}
            {gameState.paymentMode ? (
              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: '340px',
                  background: 'linear-gradient(180deg, #FAF4E5 0%, #E8D5B7 100%)',
                  border: '2px solid var(--gold-brass)',
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'center',
                  boxShadow: '0 3px 8px rgba(0,0,0,0.12)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#5C1D24', fontWeight: '800', fontFamily: 'var(--font-serif)', fontSize: '1.1rem' }}>
                  <Trophy size={18} />
                  <span>Torneo Oficial ({gameState.targetWins} Victorias)</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#2C1A0E', margin: '0.4rem 0' }}>
                  Inscripción única por jugador:
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: '900', color: 'var(--burgundy-primary)' }}>
                  {gameState.cardPrice}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic', marginTop: '0.3rem' }}>
                  * Cubre todas las rondas del torneo hasta disputar el premio.
                </div>

                {/* Botones de Entrada de Pago */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
                  <button 
                    type="button" 
                    className="btn-vintage-burgundy" 
                    disabled={!name.trim()}
                    onClick={(e) => handleJoin(e, 'paid')}
                    style={{ width: '100%', padding: '0.85rem 0.5rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <CheckCircle size={18} /> Ya realicé mi pago
                  </button>

                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    disabled={!name.trim()}
                    onClick={(e) => handleJoin(e, 'spectator')}
                    style={{ 
                      width: '100%',
                      padding: '0.65rem 0.5rem',
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      fontFamily: 'var(--font-serif)',
                      fontWeight: '700'
                    }}
                  >
                    <Eye size={17} /> Solo Observador (Ver en Vivo)
                  </button>
                </div>
              </div>
            ) : (
              <button 
                type="button" 
                className="btn-vintage-burgundy" 
                disabled={!name.trim()}
                onClick={(e) => handleJoin(e, 'paid')}
                style={{ width: '100%', maxWidth: '340px' }}
              >
                Entrar a Jugar Gratis
              </button>
            )}

          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ESTADO 2: SALA DE ESPERA VIP DE VALIDACIÓN (hasJoined && !isApproved)
  // =========================================================================
  const isPaymentRequired = !!gameState.paymentMode;
  const isSpectator = playerData?.role === 'spectator';
  const isApproved = isSpectator || !isPaymentRequired || playerData?.paymentStatus === 'approved';
  const isPaymentPending = playerData?.paymentStatus === 'pending_approval';

  if (!isApproved) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        
        {/* Comentarios en vivo para hablar con el anfitrión mientras espera */}
        <LiveCommentsOverlay gameId={gameId} />

        <div className="vintage-parchment-card animate-pop" style={{ maxWidth: '480px', padding: '2.5rem 2rem', textAlign: 'center' }}>
          <FiligreeCorner position="top-left" />
          <FiligreeCorner position="top-right" />
          <FiligreeCorner position="bottom-left" />
          <FiligreeCorner position="bottom-right" />

          {/* Avatar del jugador */}
          <div style={{
            width: '85px',
            height: '85px',
            margin: '0 auto 1rem',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #8b2834 0%, var(--burgundy-primary) 60%, var(--burgundy-dark) 100%)',
            border: '3px solid var(--gold-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.8rem',
            overflow: 'hidden',
            boxShadow: '0 8px 18px rgba(0,0,0,0.4)'
          }}>
            {playerData?.isCustomAvatar ? (
              <img src={playerData.avatar} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              playerData?.avatar || avatar
            )}
          </div>

          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-vintage-dark)', margin: 0 }}>
            Hola, {name} 👋
          </h3>

          <div style={{ margin: '1.25rem 0', padding: '1.25rem', borderRadius: '12px', background: '#FFFDF9', border: '1.5px solid var(--gold-brass)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 0.75rem',
              borderRadius: '50%',
              background: isPaymentPending ? '#FEF3C7' : '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isPaymentPending ? '#D97706' : '#DC2626'
            }}>
              {isPaymentPending ? <Clock size={32} /> : <Lock size={32} />}
            </div>

            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', fontWeight: '800', margin: '0 0 0.5rem', color: '#3A1015' }}>
              {isPaymentPending ? 'Inscripción Notificada al Anfitrión' : 'Inscripción Pendiente de Pago'}
            </h4>

            <p style={{ fontSize: '0.95rem', color: '#4A2810', lineHeight: 1.4, margin: '0 0 1rem' }}>
              {isPaymentPending
                ? `El anfitrión de la sala está confirmando tu aporte (${gameState.cardPrice}). Tu cartón se cargará automáticamente en esta pantalla en cuanto te habilite.`
                : `Para habilitar tu cartón en el torneo (${gameState.cardPrice}), transfiere tu aporte y pulsa el botón de abajo.`
              }
            </p>

            {isPaymentPending ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                background: '#FEF3C7',
                color: '#92400E',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                fontFamily: 'var(--font-serif)'
              }}>
                <Clock size={16} /> Esperando aprobación del anfitrión...
              </div>
            ) : (
              <button
                type="button"
                className="btn-vintage-burgundy"
                onClick={notifyPayment}
                style={{ width: '100%', padding: '0.85rem' }}
              >
                <CheckCircle size={18} /> Ya realicé mi pago / Confirmar
              </button>
            )}
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic', margin: 0 }}>
            💡 Puedes usar el chat de la mesa para avisarle al anfitrión.
          </p>
        </div>

        {/* Chat disponible para avisarle al anfitrión */}
        <ChatBox
          gameId={gameId}
          currentUser={{
            name: name,
            avatar: playerData?.avatar || avatar,
            isCustomAvatar: playerData?.isCustomAvatar,
            isHost: false
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // ESTADO 3: ¡MESA DE JUEGO Y CARTÓN HABILITADO AL 100%!
  // =========================================================================
  const called = gameState.calledNumbers || [];
  const currentNumber = called.length > 0 ? called[called.length - 1] : null;
  const targetWins = gameState.targetWins || 3;
  const currentRound = gameState.currentRound || 1;

  let currentLetter = '';
  if (gameState.mode === 75 && currentNumber) {
    if (currentNumber <= 15) currentLetter = 'B';
    else if (currentNumber <= 30) currentLetter = 'I';
    else if (currentNumber <= 45) currentLetter = 'N';
    else if (currentNumber <= 60) currentLetter = 'G';
    else currentLetter = 'O';
  }

  // Jugadores activos con cartón en la sala
  const playingPlayers = allPlayers.filter(p => p.role !== 'spectator' && p.card);
  
  // Jugador seleccionado para inspeccionar en modo observador
  const observedPlayer = playingPlayers.find(p => p.id === selectedObservedPlayerId) || playingPlayers[0] || null;
  const observedProgress = observedPlayer ? calculateCardProgress(observedPlayer.card, gameState.mode, called) : null;

  const currentObservedIndex = playingPlayers.findIndex(p => p.id === observedPlayer?.id);
  const handlePrevObserved = () => {
    if (playingPlayers.length <= 1) return;
    const newIdx = (currentObservedIndex - 1 + playingPlayers.length) % playingPlayers.length;
    setSelectedObservedPlayerId(playingPlayers[newIdx].id);
  };
  const handleNextObserved = () => {
    if (playingPlayers.length <= 1) return;
    const newIdx = (currentObservedIndex + 1) % playingPlayers.length;
    setSelectedObservedPlayerId(playingPlayers[newIdx].id);
  };

  return (
    <div className="app-container animate-pop" style={{ position: 'relative' }}>
      
      {/* Comentarios y Reacciones en vivo estilo Streamer */}
      <LiveCommentsOverlay gameId={gameId} />

      {/* HEADER DEL JUGADOR CON MARCADOR DE TORNEO */}
      <div className="card flex justify-between items-center" style={{
        padding: '0.85rem 1.5rem',
        borderRadius: '12px',
        border: '3px solid var(--burgundy-primary)'
      }}>
        <div className="flex items-center gap-4">
          <div style={{ 
            width: '56px', 
            height: '56px', 
            borderRadius: '50%', 
            border: '2.5px solid var(--gold-primary)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '2.2rem',
            background: 'radial-gradient(circle at 35% 30%, #7E252D 0%, var(--burgundy-primary) 100%)',
            color: '#fff'
          }}>
            {playerData?.isCustomAvatar ? (
              <img src={playerData.avatar} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              playerData?.avatar || avatar
            )}
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', margin: 0, fontWeight: '800' }}>{name}</h2>
            <div style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="vintage-brass-plaque" style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem', margin: 0 }}>
                Sala {gameId}
              </span>
              <span style={{ 
                color: gameState.status === 'playing' ? 'var(--success)' : gameState.status === 'waiting' ? 'var(--burgundy-primary)' : 'var(--gold-dark)',
                fontWeight: '700',
                fontFamily: 'var(--font-serif)'
              }}>
                Ronda {currentRound} • {gameState.status === 'playing' ? 'En Curso' : gameState.status === 'waiting' ? 'Esperando sorteo' : 'Finalizada'}
              </span>
            </div>
          </div>
        </div>

        {/* Marcador de Victorias del Jugador en el Torneo o Modo Observador y Botón Carrera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          
          {/* Botón para abrir la Carrera hacia el Bingo (Consultar rivales y cerrar) */}
          {playingPlayers.length > 0 && (
            <button
              onClick={() => setShowRaceModal(true)}
              className="vintage-brass-plaque animate-pop"
              style={{
                cursor: 'pointer',
                padding: '0.4rem 0.75rem',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#FAF4E5',
                color: '#3A1015'
              }}
              title="Consultar cómo van tus rivales hacia el Bingo"
            >
              <Flame size={16} color="#E65100" />
              <span>Carrera al Bingo</span>
            </button>
          )}

          {isSpectator ? (
            <div style={{ textAlign: 'right' }}>
              <span className="vintage-brass-plaque" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>
                <Eye size={15} /> Modo Observador
              </span>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                En Vivo
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                <Trophy size={18} color="#C59B27" />
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: '900', fontSize: '1.2rem', color: 'var(--burgundy-primary)' }}>
                  {playerData?.wins || 0} / {targetWins}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic' }}>
                Meta del Torneo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ÁREA DE ÚLTIMA BOLA (BOLA 3D DE MADERA TALLADA) */}
      {gameState.status === 'playing' && (
        <div className="card text-center" style={{
          padding: '1.75rem 1rem',
          border: '3px solid var(--burgundy-primary)'
        }}>
          <h3 style={{
            fontFamily: 'var(--font-serif)',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontSize: '0.95rem',
            color: 'var(--text-vintage-muted)',
            marginBottom: '1rem',
            fontWeight: '800'
          }}>
            Última Bola Sorteada
          </h3>
          
          <div key={currentNumber} className="animate-pop" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '135px',
            height: '135px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 32%, var(--wood-grain-light) 0%, var(--wood-grain-mid) 48%, var(--wood-grain-dark) 78%, var(--wood-grain-deep) 100%)',
            color: 'var(--text-gold-emboss)',
            boxShadow: '0 12px 25px rgba(0, 0, 0, 0.6), inset 0 3px 6px rgba(255, 255, 255, 0.35), inset 0 -6px 14px rgba(0, 0, 0, 0.85)',
            border: '4px solid var(--gold-primary)',
            marginBottom: '1.25rem',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1' }}>
              {currentLetter && (
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', fontWeight: '900', color: 'var(--gold-highlight)', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                  {currentLetter}
                </span>
              )}
              <span style={{ 
                fontFamily: 'var(--font-serif)', 
                fontSize: '4.2rem', 
                fontWeight: '900', 
                textShadow: '0 2px 4px rgba(0,0,0,0.95)' 
              }}>
                {currentNumber}
              </span>
            </div>
          </div>

          {/* Historial de bolas previas como fichas de madera */}
          <div className="flex justify-center gap-2" style={{ flexWrap: 'wrap' }}>
            {called.slice(-6, -1).reverse().map((num, i) => (
              <div key={`${num}-${i}`} className="animate-pop" style={{
                padding: '0.35rem 0.85rem',
                background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)',
                border: '1.5px solid var(--gold-brass)',
                borderRadius: '999px',
                fontFamily: 'var(--font-serif)',
                fontWeight: '800',
                color: 'var(--text-vintage-dark)',
                boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                fontSize: '0.9rem'
              }}>
                {num}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
         CARTÓN DE BINGO O LOBBY DE OBSERVADOR
         ========================================================= */}
      <div style={{ margin: '0 auto', width: '100%' }}>
        {isSpectator ? (
          playingPlayers.length === 0 ? (
            <div className="vintage-parchment-card text-center animate-pop" style={{
              padding: '2rem 1.5rem',
              margin: '0.5rem auto',
              maxWidth: '520px',
              border: '2px dashed var(--gold-brass)',
              background: 'linear-gradient(180deg, #FAF4E5 0%, #E8D5B7 100%)'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                margin: '0 auto 0.75rem',
                background: '#FEF3C7',
                color: '#92400E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Eye size={30} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-vintage-dark)', margin: '0 0 0.4rem' }}>
                Modo Observador en Vivo
              </h3>
              <p style={{ fontSize: '0.92rem', color: '#4A2810', maxWidth: '400px', margin: '0 auto 1.25rem', lineHeight: 1.4 }}>
                Esperando que los jugadores conecten sus cartones a la mesa para comenzar a inspeccionar la partida.
              </p>
              {gameState.paymentMode && (
                <button 
                  className="btn-vintage-burgundy"
                  onClick={upgradeToPlayer}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.85rem 1.6rem',
                    fontSize: '1.05rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                  }}
                >
                  <Trophy size={18} /> Inscribirme para Jugar ({gameState.cardPrice})
                </button>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: '540px', margin: '0 auto' }}>
              
              {/* Barra de Selección de Cartones de Jugadores */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.4rem',
                  padding: '0 0.25rem'
                }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-vintage-muted)' }}>
                    👁️ SELECCIONA EL CARTÓN A INSPECCIONAR:
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--burgundy-primary)', fontWeight: 'bold' }}>
                    {playingPlayers.length} Jugadores
                  </span>
                </div>

                {/* Chips de Jugadores */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  overflowX: 'auto',
                  padding: '0.35rem 0.2rem',
                  scrollbarWidth: 'thin'
                }}>
                  {playingPlayers.map(p => {
                    const isSelected = p.id === observedPlayer?.id;
                    const pProg = calculateCardProgress(p.card, gameState.mode, called);

                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedObservedPlayerId(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '999px',
                          background: isSelected 
                            ? 'linear-gradient(180deg, #7E252D 0%, #3F1015 100%)' 
                            : 'linear-gradient(180deg, #FFFDF9 0%, #FAF4E5 100%)',
                          color: isSelected ? '#FAF4E5' : 'var(--text-vintage-dark)',
                          border: isSelected ? '2px solid var(--gold-primary)' : '1.5px solid var(--gold-brass)',
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 4px 10px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.08)',
                          flexShrink: 0,
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem'
                        }}>
                          {p.isCustomAvatar ? (
                            <img src={p.avatar} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            p.avatar || '👤'
                          )}
                        </div>

                        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {p.name}
                        </span>

                        <span style={{
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#E6D2AE',
                          color: isSelected ? '#FFF' : '#3A1015',
                          fontSize: '0.7rem',
                          padding: '1px 5px',
                          borderRadius: '999px',
                          fontWeight: '900'
                        }}>
                          {pProg.percentage}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cabecera del Cartón Seleccionado con Navegación Anterior / Siguiente */}
              {observedPlayer && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)',
                  borderRadius: '10px',
                  border: '2px solid var(--gold-brass)',
                  padding: '0.55rem 0.85rem',
                  marginBottom: '0.75rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handlePrevObserved}
                    disabled={playingPlayers.length <= 1}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    title="Ver cartón anterior"
                  >
                    <ChevronLeft size={16} /> Ant.
                  </button>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      <Eye size={16} color="#7E252D" />
                      <span style={{ fontFamily: 'var(--font-serif)', fontWeight: '900', fontSize: '1rem', color: '#3A1015' }}>
                        Cartón de {observedPlayer.name}
                      </span>
                      {observedProgress?.missing === 1 ? (
                        <span style={{ backgroundColor: '#B71C1C', color: '#FFF', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '999px', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>
                          🔥 ¡A 1 BOLA!
                        </span>
                      ) : observedProgress?.missing === 2 ? (
                        <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '999px', fontWeight: 'bold', border: '1px solid #F59E0B' }}>
                          🤞 ¡A 2 BOLAS!
                        </span>
                      ) : (
                        <span style={{ backgroundColor: '#7E252D', color: '#FFF', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '999px', fontWeight: 'bold' }}>
                          {observedProgress?.percentage}%
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic', marginTop: '1px' }}>
                      {observedProgress?.matched} de {observedProgress?.total} bolas acertadas en vivo (Faltan {observedProgress?.missing})
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    onClick={handleNextObserved}
                    disabled={playingPlayers.length <= 1}
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    title="Ver cartón siguiente"
                  >
                    Sig. <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Render del Cartón del Jugador Observado en Modo Solo Lectura (Estampado en Vivo) */}
              {observedPlayer && (
                gameState.mode === 75 
                  ? <BingoCard75 card={observedPlayer.card} markedNumbers={new Set(called)} toggleMark={() => {}} calledNumbers={called} />
                  : <BingoCard90 grid={observedPlayer.card} markedNumbers={new Set(called)} toggleMark={() => {}} calledNumbers={called} />
              )}

              {/* Botón de Inscripción si decide jugar */}
              {gameState.paymentMode && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button 
                    className="btn-vintage-burgundy"
                    onClick={upgradeToPlayer}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.6rem',
                      fontSize: '1rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                    }}
                  >
                    <Trophy size={18} /> Inscribirme para Jugar ({gameState.cardPrice})
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          playerData?.card && (
            gameState.mode === 75 
              ? <BingoCard75 card={playerData.card} markedNumbers={markedNumbers} toggleMark={toggleMark} calledNumbers={called} />
              : <BingoCard90 grid={playerData.card} markedNumbers={markedNumbers} toggleMark={toggleMark} calledNumbers={called} />
          )
        )}
      </div>

      {/* REACCIONES Y CONTROLES INFERIORES */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', marginTop: '1rem', marginBottom: '2rem' }}>
        
        {/* Barra de Reacciones para el Live Streaming */}
        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          padding: '0.5rem 1.25rem', 
          borderRadius: '999px',
          background: 'linear-gradient(180deg, #F4E7CB 0%, #E6D2AE 100%)',
          border: '2px solid var(--gold-brass)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
        }}>
          {['👏', '😂', '😲', '🎉', '❤️', '🍀'].map(emoji => (
            <button 
              key={emoji}
              onClick={() => sendReaction(emoji)}
              style={{
                background: 'none', 
                border: 'none', 
                fontSize: '1.6rem', 
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

        {/* Botones de acción (sólo para jugadores con cartón) */}
        {!isSpectator && (
          <div className="flex justify-center gap-4" style={{ width: '100%', flexWrap: 'wrap' }}>
            {gameState.status === 'waiting' && (
              <button 
                className="btn btn-secondary" 
                onClick={changeCard} 
                style={{ padding: '0.85rem 1.75rem', fontSize: '1.1rem' }}
              >
                <RefreshCw size={18} /> Cambiar Cartón
              </button>
            )}

            <button 
              className="btn-vintage-burgundy" 
              onClick={claimBingo}
              disabled={gameState.status !== 'playing' || playerData?.bingoClaimed}
              style={{ 
                maxWidth: '340px',
                padding: '0.95rem 2rem',
                fontSize: '1.35rem'
              }}
            >
              <Trophy size={24} /> 
              {playerData?.bingoClaimed && !playerData?.isValidated ? 'Verificando...' : '¡BINGO!'}
            </button>
          </div>
        )}
      </div>

      {/* Chat Familiar en tiempo real */}
      <ChatBox
        gameId={gameId}
        currentUser={{
          name: name,
          avatar: playerData?.avatar || avatar,
          isCustomAvatar: playerData?.isCustomAvatar,
          isHost: false
        }}
      />

      {/* Modal Desplegable de la Carrera hacia el Bingo */}
      <BingoRaceModal
        isOpen={showRaceModal}
        onClose={() => setShowRaceModal(false)}
        players={allPlayers}
        calledNumbers={called}
        mode={gameState.mode}
        currentUserId={userId}
      />
    </div>
  );
};

export default PlayerPanel;
