import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, loginAnonymously } from '../firebase';
import { generateCard75, generateCard90, validateBingo75, validateBingo90 } from '../utils/bingo';
import BingoCard75 from '../components/BingoCard75';
import BingoCard90 from '../components/BingoCard90';
import { Trophy, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSettings } from '../context/SettingsContext';

const PlayerPanel = () => {
  const { gameId } = useParams();
  const [name, setName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [markedNumbers, setMarkedNumbers] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Reacciones locales para mostrar en pantalla
  const [activeReactions, setActiveReactions] = useState([]);
  
  const { playSound } = useSettings();

  const [avatar] = useState(() => {
    const emojis = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🦄', '🐲'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  });
  const [customAvatar, setCustomAvatar] = useState(null); // Para la foto de perfil en Base64

  // Sound for new numbers
  const [lastCalledCount, setLastCalledCount] = useState(0);

  useEffect(() => {
    loginAnonymously().then(user => setUserId(user.uid));

    const gameRef = doc(db, 'games', gameId);
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameState(data);
        
        // Comprobar si hay un nuevo número
        if (data.calledNumbers && data.calledNumbers.length > lastCalledCount && data.status === 'playing') {
          playSound('pop');
          setLastCalledCount(data.calledNumbers.length);
        }

        if (data.status === 'finished' && data.winners?.includes(name)) {
          triggerWinAnimation();
        }
        
        // Manejar reacciones entrantes
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
      confetti({ particleCount: 8, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#4F46E5', '#FACC15', '#22C55E'] });
      confetti({ particleCount: 8, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#4F46E5', '#FACC15', '#22C55E'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [playSound]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const card = gameState.mode === 75 ? generateCard75() : generateCard90();
    
    await setDoc(doc(db, 'games', gameId, 'players', userId), {
      name: name.trim(),
      avatar: customAvatar ? customAvatar : avatar, // Enviar foto en base64 si existe, sino el emoji
      isCustomAvatar: !!customAvatar,
      card: card,
      bingoClaimed: false,
      isValidated: false
    });
    
    setHasJoined(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Comprimir imagen usando canvas para no saturar Firestore
        const canvas = document.createElement('canvas');
        const maxSize = 150; // Tamaño máximo de 150x150
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
        
        // Convertir a Base64
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
    playSound('draw'); // Sonido sutil al marcar
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
    // Mostrar localmente de inmediato para que se sienta instantáneo
    showFloatingReaction(emoji);
    
    // Guardar en Firestore para que los demás lo vean
    await updateDoc(doc(db, 'games', gameId), {
      latestReaction: {
        emoji,
        userId,
        timestamp: Date.now()
      }
    });
  };

  const showFloatingReaction = (emoji) => {
    const id = Date.now() + Math.random();
    setActiveReactions(prev => [...prev, { id, emoji }]);
    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  };

  if (errorMsg) return <div className="text-center mt-4"><h3>{errorMsg}</h3></div>;
  if (!gameState) return <div className="text-center mt-4">Cargando sala...</div>;

  if (!hasJoined) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card animate-pop" style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            
            {/* Mostrar preview de la foto o el emoji */}
            <div style={{ 
              width: '120px', height: '120px', margin: '0 auto 1rem',
              backgroundColor: 'var(--bg-app)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '4rem', overflow: 'hidden', border: '4px solid var(--primary)',
              position: 'relative'
            }}>
              {customAvatar ? (
                <img src={customAvatar} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                avatar
              )}
              
              {/* Botón oculto para subir foto */}
              <label style={{
                position: 'absolute', bottom: 0, right: 0, left: 0,
                backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
                fontSize: '0.8rem', padding: '0.2rem', cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.2s'
              }}>
                <ImageIcon size={16} style={{ margin: '0 auto' }} />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
            </div>
            
            <h2 style={{ fontSize: '1.5rem' }}>Unirse a Sala <span style={{ color: 'var(--primary)' }}>{gameId}</span></h2>
          </div>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Escribe tu nombre" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={15}
              style={{ textAlign: 'center' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '1rem', fontSize: '1.1rem' }}>
              Entrar a la partida
            </button>
          </form>
        </div>
      </div>
    );
  }

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
    <div className="app-container animate-pop" style={{ position: 'relative' }}>
      
      {/* Contenedor de reacciones flotantes */}
      <div style={{ position: 'fixed', bottom: '100px', right: '20px', pointerEvents: 'none', zIndex: 100 }}>
        {activeReactions.map(r => (
          <div key={r.id} style={{
            fontSize: '3rem',
            position: 'absolute',
            bottom: '0',
            right: `${Math.random() * 50}px`,
            animation: 'floatUp 2s ease-out forwards',
            opacity: 1
          }}>
            {r.emoji}
          </div>
        ))}
      </div>

      <div className="card flex justify-between items-center" style={{ padding: '1rem 1.5rem', borderRadius: '1rem' }}>
        <div className="flex items-center gap-4">
          <div style={{ 
            width: '60px', height: '60px', 
            backgroundColor: 'var(--bg-app)', borderRadius: '50%', 
            boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem'
          }}>
            {playerData?.isCustomAvatar ? (
              <img src={playerData.avatar} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              playerData?.avatar || avatar
            )}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{name}</h2>

            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold' }}>Sala {gameId}</span>
              <span>•</span>
              <span style={{ 
                color: gameState.status === 'playing' ? 'var(--success)' : gameState.status === 'waiting' ? 'var(--warning)' : 'var(--primary)',
                fontWeight: '600'
              }}>
                {gameState.status === 'playing' ? 'En curso' : gameState.status === 'waiting' ? 'Esperando...' : 'Finalizada'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {gameState.status === 'playing' && (
        <div className="card text-center" style={{ padding: '2rem 1rem', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-app))' }}>
          
          <h3 className="text-muted" style={{ marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.9rem' }}>
            Última Bola
          </h3>
          
          <div key={currentNumber} className="animate-pop" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            color: 'white',
            boxShadow: '0 10px 25px rgba(79, 70, 229, 0.4)',
            border: '8px solid white',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1' }}>
              {currentLetter && <span style={{ fontSize: '1.5rem', fontWeight: 'bold', opacity: 0.9 }}>{currentLetter}</span>}
              <span style={{ fontSize: '4.5rem', fontWeight: '800' }}>{currentNumber}</span>
            </div>
          </div>

          <div className="flex justify-center gap-2" style={{ flexWrap: 'wrap' }}>
            {called.slice(-6, -1).reverse().map((num, i) => (
              <div key={`${num}-${i}`} className="animate-pop" style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--bg-card)',
                border: '2px solid var(--border-color)',
                borderRadius: '999px',
                fontWeight: 'bold',
                color: 'var(--text-muted)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {num}
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState.status === 'finished' && (
        <div className="card text-center animate-pop" style={{ padding: '3rem 1rem', background: 'linear-gradient(135deg, var(--success), #059669)', color: 'white' }}>
          <Trophy size={64} style={{ margin: '0 auto 1rem', animation: 'pulse 2s infinite' }} />
          <h2 style={{ fontSize: '2.5rem', color: 'white', marginBottom: '1rem' }}>¡Juego Terminado!</h2>
          {gameState.winners?.includes(name) ? (
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>¡ERES EL GANADOR! 🎉</p>
          ) : (
            <p style={{ fontSize: '1.2rem' }}>Ha ganado: <strong>{gameState.winners?.join(', ')}</strong></p>
          )}
        </div>
      )}

      <div className="card" style={{ padding: '1.5rem 1rem' }}>
        {playerData?.card && (
          gameState.mode === 75 
            ? <BingoCard75 card={playerData.card} markedNumbers={markedNumbers} toggleMark={toggleMark} calledNumbers={called} />
            : <BingoCard90 grid={playerData.card} markedNumbers={markedNumbers} toggleMark={toggleMark} calledNumbers={called} />
        )}
      </div>

      {/* REACCIONES Y CONTROLES */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '2rem' }}>
        
        {/* Barra de Reacciones */}
        <div className="card" style={{ display: 'flex', gap: '1rem', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
          {['👏', '😂', '😲', '🎉', '❤️'].map(emoji => (
            <button 
              key={emoji}
              onClick={() => sendReaction(emoji)}
              style={{
                background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.3)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          {gameState.status === 'waiting' && (
            <button className="btn btn-secondary" onClick={changeCard} style={{ padding: '1rem 1.5rem', fontSize: '1.1rem' }}>
              <RefreshCw size={20} /> Cambiar Cartón
            </button>
          )}

          <button 
            className="btn" 
            onClick={claimBingo}
            disabled={gameState.status !== 'playing' || playerData?.bingoClaimed}
            style={{ 
              padding: '1rem 2rem', 
              fontSize: '1.25rem', 
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: 'white',
              boxShadow: '0 8px 20px rgba(245, 158, 11, 0.4)',
              border: 'none',
              borderRadius: 'var(--radius-full)'
            }}
          >
            <Trophy size={24} /> 
            {playerData?.bingoClaimed && !playerData?.isValidated ? 'Verificando...' : '¡BINGO!'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default PlayerPanel;
