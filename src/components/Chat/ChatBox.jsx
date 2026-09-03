import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

const QUICK_PHRASES = [
  '¡Buena suerte a todos! 🍀',
  '¡Me falta solo una! 😱',
  '¡Casi canto Bingo! 🎯',
  '¡Felicidades al ganador! 👏',
  '¡Vamos con todo! 🔥'
];

const ChatBox = ({ gameId, currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const { playSound } = useSettings();
  const initialLoadDone = useRef(false);

  // Escuchar mensajes en tiempo real
  useEffect(() => {
    if (!gameId) return;

    const messagesRef = collection(db, 'games', gameId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(80));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);

      // Si el chat está cerrado y llegan mensajes nuevos después de la carga inicial, sumar no leídos
      if (initialLoadDone.current && !isOpen && snapshot.docChanges().some(c => c.type === 'added')) {
        setUnreadCount(prev => prev + 1);
        playSound('pop');
      }
      initialLoadDone.current = true;
    });

    return () => unsubscribe();
  }, [gameId, isOpen, playSound]);

  // Scroll automático hacia el último mensaje
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const sendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || !gameId) return;

    try {
      setInputMessage('');
      const messagesRef = collection(db, 'games', gameId, 'messages');
      await addDoc(messagesRef, {
        text,
        senderName: currentUser?.name || 'Jugador',
        avatar: currentUser?.avatar || '👤',
        isCustomAvatar: !!currentUser?.isCustomAvatar,
        isHost: !!currentUser?.isHost,
        timestamp: serverTimestamp(),
        createdAt: Date.now()
      });
      playSound('draw');
    } catch (err) {
      console.error('Error enviando mensaje:', err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const formatTime = (ts, createdAt) => {
    try {
      const date = ts?.toDate ? ts.toDate() : (createdAt ? new Date(createdAt) : new Date());
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <>
      {/* Botón flotante para abrir chat */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="btn-primary animate-pop"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            padding: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 25px rgba(79, 70, 229, 0.45)',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}
          title="Abrir Chat Familiar"
          aria-label="Abrir Chat"
        >
          <MessageCircle size={28} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--danger, #EF4444)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                borderRadius: '9999px',
                minWidth: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid white',
                animation: 'pulse 1.5s infinite'
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Ventana de Chat */}
      {isOpen && (
        <div
          className="card animate-pop"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(540px, calc(100vh - 100px))',
            padding: '0',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-color)'
          }}
        >
          {/* Header del Chat */}
          <div
            style={{
              padding: '1rem 1.25rem',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={22} />
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0, color: '#fff', fontWeight: '700' }}>
                  Chat Familiar
                </h3>
                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sala {gameId}</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              title="Cerrar chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mensajes */}
          <div
            style={{
              flex: 1,
              padding: '1rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-app)'
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <Sparkles size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p>¡El chat está listo!</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Envía un saludo a tu familia 👋</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderName === currentUser?.name;
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start'
                    }}
                  >
                    {!isMe && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginBottom: '2px',
                          paddingLeft: '4px'
                        }}
                      >
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{msg.senderName}</span>
                        {msg.isHost && (
                          <span
                            style={{
                              backgroundColor: 'var(--primary)',
                              color: '#fff',
                              fontSize: '0.65rem',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              fontWeight: 'bold'
                            }}
                          >
                            Anfitrión
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        backgroundColor: isMe ? 'var(--primary)' : 'var(--bg-card)',
                        color: isMe ? '#fff' : 'var(--text-main)',
                        border: isMe ? 'none' : '1px solid var(--border-color)',
                        boxShadow: 'var(--shadow-sm)',
                        wordBreak: 'break-word',
                        fontSize: '0.92rem',
                        lineHeight: 1.35
                      }}
                    >
                      {msg.text}
                    </div>

                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        padding: '0 4px'
                      }}
                    >
                      {formatTime(msg.timestamp, msg.createdAt)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Frases Rápidas */}
          <div
            style={{
              padding: '0.4rem 0.75rem',
              display: 'flex',
              gap: '0.35rem',
              overflowX: 'auto',
              backgroundColor: 'var(--bg-card)',
              borderTop: '1px solid var(--border-color)',
              scrollbarWidth: 'none'
            }}
          >
            {QUICK_PHRASES.map((phrase, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(phrase)}
                style={{
                  whiteSpace: 'nowrap',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Formulario de Entrada */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              borderTop: '1px solid var(--border-color)'
            }}
          >
            <input
              type="text"
              className="input"
              style={{
                padding: '0.65rem 1rem',
                fontSize: '0.9rem',
                borderRadius: '999px',
                flex: 1
              }}
              placeholder="Escribe un mensaje..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={160}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!inputMessage.trim()}
              style={{
                width: '40px',
                height: '40px',
                padding: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Enviar"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBox;
