import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';

const LiveCommentsOverlay = ({ gameId }) => {
  const [activeComments, setActiveComments] = useState([]);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!gameId) return;

    const messagesRef = collection(db, 'games', gameId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(5));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Ignorar la primera carga para no bombardear la pantalla con mensajes antiguos
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const comment = {
            id: change.doc.id + '-' + Date.now(),
            senderName: data.senderName || 'Jugador',
            avatar: data.avatar || '👤',
            isHost: !!data.isHost,
            text: data.text || '',
            createdAt: Date.now()
          };

          setActiveComments((prev) => [comment, ...prev.slice(0, 3)]);

          // Desvanecer automáticamente tras 7 segundos
          setTimeout(() => {
            setActiveComments((prev) => prev.filter((c) => c.id !== comment.id));
          }, 7000);
        }
      });
    });

    return () => unsubscribe();
  }, [gameId]);

  if (activeComments.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: '20px',
        bottom: '100px',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '0.6rem',
        maxWidth: '320px',
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
            gap: '0.6rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, rgba(46, 21, 12, 0.92) 0%, rgba(22, 10, 6, 0.94) 100%)',
            backdropFilter: 'blur(6px)',
            border: '1.5px solid var(--gold-brass, #C59B27)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
            color: '#FAF4E5',
            animation: 'slideInLeft 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            wordBreak: 'break-word'
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #7E252D 0%, #3F1015 100%)',
              border: '1.5px solid var(--gold-primary, #D4AF37)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
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

          {/* Texto del comentario en vivo */}
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
        </div>
      ))}

      <style>{`
        @keyframes slideInLeft {
          0% { transform: translateX(-40px) scale(0.9); opacity: 0; }
          100% { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LiveCommentsOverlay;
