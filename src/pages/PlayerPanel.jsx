import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, loginAnonymously } from '../firebase';
import { generateCard75, generateCard90, validateBingo75, validateBingo90 } from '../utils/bingo';
import BingoCard75 from '../components/BingoCard75';
import BingoCard90 from '../components/BingoCard90';
import ChatBox from '../components/Chat/ChatBox';
import LiveCommentsOverlay from '../components/Chat/LiveCommentsOverlay';
import { Trophy, RefreshCw, Image as ImageIcon, Lock, CheckCircle, Clock, ShieldAlert } from 'lucide-react';
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
  
  const [activeReactions, setActiveReactions] = useState([]);
  const { playSound } = useSettings();

  const [avatar] = useState(() => {
    const emojis = ['🎩', '👑', '🎲', '⚜️', '🪙', '🦊', '🦁', '🦉'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  });
  const [customAvatar, setCustomAvatar] = useState(null);

  const [lastCalledCount, setLastCalledCount] = useState(0);

  useEffect(() => {
    loginAnonymously().then(user => setUserId(user.uid));

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
          triggerWinAnimation();
        }
        
        if (data.latestReaction && data.latestReaction.timestamp > Date.now() - 3000) {
          showFloatingReaction(data.latestReaction.emoji);
        }

      } else {
        setErrorMsg('La sala no existe.');
      }
    });

    return () => unsubscribe();
  }, [gameId, name, lastCalledCount, playSound]);

  useEffect(() => {
    if (!userId || !hasJoined) return;

    const playerRef = doc(db, 'games', gameId, 'players', userId);
    const unsubscribe = onSnapshot(playerRef, (docSnap) => {
      if (docSnap.exists()) {
        setPlayerData(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [userId, hasJoined, gameId]);

  const triggerWinAnimation = useCallback(() => {
    playSound('win');
    const duration = 5 * 1000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 8, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#5C1D24', '#D4AF37', '#2E7D32'] });
      confetti({ particleCount: 8, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#5C1D24', '#D4AF37', '#2E7D32'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [playSound]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const card = gameState.mode === 75 ? generateCard75() : generateCard90();
    const isPaymentRequired = !!gameState.paymentMode;
    
    await setDoc(doc(db, 'games', gameId, 'players', userId), {
      name: name.trim(),
      avatar: customAvatar ? customAvatar : avatar,
      isCustomAvatar: !!customAvatar,
      card: card,
      bingoClaimed: false,
      isValidated: false,
      wins: 0,
      paymentStatus: isPaymentRequired ? 'unpaid' : 'approved'
    });
    
    setHasJoined(true);
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
    
    // Bloquear marcado si el cartón no está pagado/aprobado
    if (gameState?.paymentMode && playerData?.paymentStatus !== 'approved') {
      alert("Tu cartón está bloqueado. Debes confirmar tu pago y esperar la aprobación del anfitrión.");
      return;
    }

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

    if (gameState?.paymentMode && playerData?.paymentStatus !== 'approved') {
      alert("No puedes cantar Bingo con un cartón bloqueado pendiente de pago.");
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

  // PANTALLA DE INGRESO (PERGAMINO VINTAGE)
  if (!hasJoined) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="vintage-parchment-card animate-pop" style={{ maxWidth: '440px', padding: '2.5rem 2rem' }}>
          
          <FiligreeCorner position="top-left" />
          <FiligreeCorner position="top-right" />
          <FiligreeCorner position="bottom-left" />
          <FiligreeCorner position="bottom-right" />

          {/* Medallón con foto de perfil o avatar */}
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ 
              width: '110px', 
              height: '110px', 
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
            
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--text-vintage-dark)', fontWeight: '800' }}>
              Unirse a Sala <span style={{ color: 'var(--burgundy-primary)' }}>{gameId}</span>
            </h2>
            <p className="vintage-subtitle">
              {gameState.paymentMode ? `Modalidad: De Pago (${gameState.cardPrice})` : 'Modalidad: Fichas de Casino (Gratis)'}
            </p>
          </div>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
            <div className="vintage-brass-slot" style={{ maxWidth: '320px' }}>
              <div className="slot-screw tl" />
              <div className="slot-screw tr" />
              <div className="slot-screw bl" />
              <div className="slot-screw br" />
              <div className="vintage-slot-window">
                <input 
                  type="text" 
                  className="vintage-slot-input" 
                  placeholder="TU NOMBRE" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={15}
                />
              </div>
            </div>

            <button type="submit" className="btn-vintage-burgundy" style={{ width: '100%', maxWidth: '320px' }}>
              Entrar a la Partida
            </button>
          </form>
        </div>
      </div>
    );
  }

  const called = gameState.calledNumbers || [];
  const currentNumber = called.length > 0 ? called[called.length - 1] : null;
  const targetWins = gameState.targetWins || 3;
  const currentRound = gameState.currentRound || 1;
  const isCardLocked = gameState.paymentMode && playerData?.paymentStatus !== 'approved';
  const isPaymentPending = playerData?.paymentStatus === 'pending_approval';

  let currentLetter = '';
  if (gameState.mode === 75 && currentNumber) {
    if (currentNumber <= 15) currentLetter = 'B';
    else if (currentNumber <= 30) currentLetter = 'I';
    else if (currentNumber <= 45) currentLetter = 'N';
    else if (currentNumber <= 60) currentLetter = 'G';
    else currentLetter = 'O';
  }

  return (
    <div className="app-container animate-pop" style={{ position: 'relative' }}>
      
      {/* Comentarios en vivo estilo Streamer en el lateral */}
      <LiveCommentsOverlay gameId={gameId} />

      {/* HEADER DEL JUGADOR CON PODIO PERSONAL Y SALA */}
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

        {/* Marcador de Victorias del Jugador */}
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
         CARTÓN DE BINGO CON CANDADO/BLOQUEO DE PAGO
         ========================================================= */}
      <div style={{ margin: '0 auto', width: '100%', position: 'relative' }}>
        
        {/* Capa de Bloqueo si requiere pago y no está aprobado */}
        {isCardLocked && (
          <div 
            className="animate-pop"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(30, 15, 8, 0.88)',
              backdropFilter: 'blur(6px)',
              borderRadius: '14px',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              textAlign: 'center',
              border: '3px solid var(--gold-primary)'
            }}
          >
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #8B2834 0%, var(--burgundy-primary) 65%, var(--burgundy-dark) 100%)',
              border: '3px solid var(--gold-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 8px 20px rgba(0,0,0,0.6)'
            }}>
              <Lock size={36} color="var(--gold-highlight)" />
            </div>

            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', color: 'var(--text-gold-emboss)', fontWeight: '900', marginBottom: '0.3rem' }}>
              Cartón Bloqueado
            </h3>

            <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: '#E8D5B7', maxWidth: '340px', marginBottom: '1.25rem', lineHeight: 1.35 }}>
              Esta partida requiere el pago de tu entrada <strong style={{ color: 'var(--gold-highlight)' }}>({gameState.cardPrice})</strong> para poder jugar y marcar números.
            </p>

            {isPaymentPending ? (
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                border: '1.5px solid #F59E0B',
                borderRadius: '8px',
                padding: '0.75rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                color: '#FDE68A'
              }}>
                <Clock size={20} />
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.92rem', fontWeight: '700' }}>
                  Esperando que el anfitrión apruebe tu pago...
                </span>
              </div>
            ) : (
              <button 
                className="btn-vintage-burgundy"
                onClick={notifyPayment}
                style={{ width: '100%', maxWidth: '320px', padding: '0.9rem' }}
              >
                <CheckCircle size={20} /> Ya realicé mi pago / Confirmar
              </button>
            )}
          </div>
        )}

        {/* Componente del Cartón */}
        {playerData?.card && (
          gameState.mode === 75 
            ? <BingoCard75 card={playerData.card} markedNumbers={markedNumbers} toggleMark={toggleMark} calledNumbers={called} />
            : <BingoCard90 grid={playerData.card} markedNumbers={markedNumbers} toggleMark={toggleMark} calledNumbers={called} />
        )}
      </div>

      {/* REACCIONES Y CONTROLES INFERIORES */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', marginTop: '1rem', marginBottom: '2rem' }}>
        
        {/* Barra de Reacciones estilo latón */}
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
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-center gap-4" style={{ width: '100%', flexWrap: 'wrap' }}>
          {gameState.status === 'waiting' && (
            <button 
              className="btn btn-secondary" 
              onClick={changeCard} 
              disabled={isCardLocked}
              style={{ padding: '0.85rem 1.75rem', fontSize: '1.1rem' }}
            >
              <RefreshCw size={18} /> Cambiar Cartón
            </button>
          )}

          <button 
            className="btn-vintage-burgundy" 
            onClick={claimBingo}
            disabled={gameState.status !== 'playing' || playerData?.bingoClaimed || isCardLocked}
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
    </div>
  );
};

export default PlayerPanel;
