import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';

const LiveCommentsOverlay = ({ gameId }) => {
  const [activeComments, setActiveComments] = useState([]);
  const [streamParticles, setStreamParticles] = useState([]);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!gameId) return;

    const messagesRef = collection(db, 'games', gameId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(6));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const isReaction = !!data.isReaction;

          const item = {
            id: change.doc.id + '-' + Date.now(),
            senderName: data.senderName || 'Jugador',
            avatar: data.avatar || '👤',
            isHost: !!data.isHost,
            text: data.text || '',
            isReaction: isReaction,
            createdAt: Date.now()
          };

          // Si es una reacción (emoji), lanzar chorro de partículas flotantes estilo TikTok/Instagram Live
          if (isReaction) {
            spawnStreamParticles(data.text);
          }

          // Agregar al feed de streaming lateral
          setActiveComments((prev) => [item, ...prev.slice(0, 3)]);

          setTimeout(() => {
            setActiveComments((prev) => prev.filter((c) => c.id !== item.id));
          }, isReaction ? 5000 : 7000);
        }
      });
    });

    return () => unsubscribe();
  }, [gameId]);

  // Generar ráfaga de partículas ascendentes estilo Stream
  const spawnStreamParticles = (emoji) => {
    const burstCount = 4;
    const newParticles = Array.from({ length: burstCount }, (_, i) => ({
      id: Math.random() + '-' + Date.now() + '-' + i,
      emoji: emoji,
      offset: (Math.random() - 0.5) * 80, // Desplazamiento lateral aleatorio
      size: Math.floor(Math.random() * 16) + 32, // 32px a 48px
      duration: (Math.random() * 0.8 + 2.2).toFixed(1) // 2.2s a 3s
    }));

    setStreamParticles((prev) => [...prev, ...newParticles]);

    setTimeout(() => {
      setStreamParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)));
    }, 3200);
  };

  return (
    <>
      {/* 1. FEED DE COMENTARIOS Y REACCIONES LATERAL (TIPO STREAMER) */}
      {activeComments.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: '20px',
            bottom: '100px',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '0.6rem',
            maxWidth: '340px',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          {activeComments.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: c.isReaction ? '0.45rem 0.9rem' : '0.55rem 0.9rem',
                borderRadius: '999px',
                background: c.isReaction 
                  ? 'linear-gradient(135deg, rgba(126, 37, 45, 0.95) 0%, rgba(63, 16, 21, 0.96) 100%)' 
                  : 'linear-gradient(135deg, rgba(46, 21, 12, 0.93) 0%, rgba(22, 10, 6, 0.95) 100%)',
                backdropFilter: 'blur(8px)',
                border: c.isReaction ? '2px solid var(--gold-primary, #D4AF37)' : '1.5px solid var(--gold-brass, #C59B27)',
                boxShadow: '0 8px 25px rgba(0,0,0,0.6)',
                color: '#FAF4E5',
                animation: 'slideInLeft 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                wordBreak: 'break-word'
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, #7E252D 0%, #3F1015 100%)',
                  border: '1.5px solid var(--gold-primary, #D4AF37)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  flexShrink: 0,
                  overflow: 'hidden'
                }}
              >
                {c.avatar.startsWith('data:image') ? (
                  <img src={c.avatar} alt={c.senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  c.avatar
                )}
              </div>

              {/* Contenido: Si es reacción vs Comentario de texto */}
              {c.isReaction ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontWeight: '800',
                      fontSize: '0.82rem',
                      color: 'var(--gold-highlight, #FFF1C5)'
                    }}
                  >
                    {c.senderName}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.85, fontStyle: 'italic' }}>reaccionó</span>
                  <span style={{ fontSize: '1.65rem', lineHeight: 1, animation: 'heartPop 0.4s ease' }}>
                    {c.text}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '800',
                        fontSize: '0.78rem',
                        color: 'var(--gold-highlight, #FFF1C5)'
                      }}
                    >
                      {c.senderName}
                    </span>
                    {c.isHost && (
                      <span
                        style={{
                          backgroundColor: '#7E252D',
                          color: '#fff',
                          fontSize: '0.6rem',
                          padding: '0px 4px',
                          borderRadius: '4px',
                          border: '1px solid #D4AF37',
                          fontWeight: 'bold'
                        }}
                      >
                        Anfitrión
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.85rem',
                      color: '#FAF4E5',
                      fontWeight: '500'
                    }}
                  >
                    {c.text}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2. CHORRO DE REACCIONES FLOTANTES VERTICALES (TIKTOK / LIVE STREAM STREAMING) */}
      {streamParticles.length > 0 && (
        <div
          style={{
            position: 'fixed',
            right: '90px',
            bottom: '90px',
            width: '120px',
            height: '350px',
            pointerEvents: 'none',
            zIndex: 950,
            overflow: 'visible'
          }}
        >
          {streamParticles.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                bottom: 0,
                left: `calc(50% + ${p.offset}px)`,
                fontSize: `${p.size}px`,
                animation: `liveStreamRise ${p.duration}s ease-out forwards`,
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'
              }}
            >
              {p.emoji}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          0% { transform: translateX(-40px) scale(0.9); opacity: 0; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }

        @keyframes heartPop {
          0% { transform: scale(0.5); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }

        @keyframes liveStreamRise {
          0% {
            transform: translateY(0) scale(0.6) rotate(0deg);
            opacity: 1;
          }
          30% {
            transform: translateY(-90px) scale(1.15) rotate(12deg);
            opacity: 0.95;
          }
          65% {
            transform: translateY(-200px) scale(1.25) rotate(-15deg);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-320px) scale(1.35) rotate(10deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
};

export default LiveCommentsOverlay;
