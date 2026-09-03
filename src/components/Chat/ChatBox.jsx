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

      if (initialLoadDone.current && !isOpen && snapshot.docChanges().some(c => c.type === 'added')) {
        setUnreadCount(prev => prev + 1);
        playSound('pop');
      }
      initialLoadDone.current = true;
    });

    return () => unsubscribe();
  }, [gameId, isOpen, playSound]);

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
      {/* Botón flotante estilo sello de cera / latón */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '62px',
            height: '62px',
            borderRadius: '50%',
            padding: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 35% 30%, #8b2834 0%, var(--burgundy-primary) 65%, var(--burgundy-dark) 100%)',
            border: '3px solid var(--gold-primary)',
            color: 'var(--text-gold-emboss)',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255,255,255,0.4)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
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
                backgroundColor: '#B71C1C',
                color: '#fff',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: 'bold',
                borderRadius: '9999px',
                minWidth: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--gold-primary)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Ventana de Chat estilo Cuaderno / Pergamino de Club */}
      {isOpen && (
        <div
          className="animate-pop"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(540px, calc(100vh - 100px))',
            padding: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '12px',
            background: 'radial-gradient(ellipse at center, #FAF4E5 0%, #F4E7CB 100%)',
            border: '3.5px solid var(--burgundy-primary)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.75)'
          }}
        >
          {/* Header de Cuero / Burdeos */}
          <div
            style={{
              padding: '0.9rem 1.2rem',
              background: 'linear-gradient(180deg, var(--burgundy-light) 0%, var(--burgundy-primary) 100%)',
              color: 'var(--text-gold-emboss)',
              borderBottom: '2px solid var(--gold-brass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={22} color="var(--gold-highlight)" />
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', margin: 0, fontWeight: '800' }}>
                  Chat de la Mesa
                </h3>
                <span style={{ fontSize: '0.75rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>Sala {gameId}</span>
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--gold-brass)',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cerrar chat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Lista de Mensajes sobre pergamino */}
          <div
            style={{
              flex: 1,
              padding: '1rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: 'radial-gradient(circle at center, #FAF4E5 0%, #F4E7CB 85%, #EADBBE 100%)'
            }}
          >
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-vintage-muted)' }}>
                <Sparkles size={32} style={{ margin: '0 auto 0.5rem', color: 'var(--gold-brass)' }} />
                <p style={{ fontFamily: 'var(--font-serif)', fontWeight: '700' }}>Mesa de conversación vacía</p>
                <p style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>Envía un saludo a los demás socios 👋</p>
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
                          fontFamily: 'var(--font-serif)',
                          color: 'var(--text-vintage-muted)',
                          marginBottom: '2px',
                          paddingLeft: '4px'
                        }}
                      >
                        <span style={{ fontWeight: '700', color: 'var(--text-vintage-dark)' }}>{msg.senderName}</span>
                        {msg.isHost && (
                          <span
                            style={{
                              backgroundColor: 'var(--burgundy-primary)',
                              color: 'var(--text-gold-emboss)',
                              fontSize: '0.62rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              border: '1px solid var(--gold-brass)',
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
                        padding: '0.65rem 0.95rem',
                        borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        background: isMe 
                          ? 'linear-gradient(180deg, var(--burgundy-light) 0%, var(--burgundy-primary) 100%)' 
                          : 'linear-gradient(180deg, #FFFFFF 0%, #F5EADA 100%)',
                        color: isMe ? 'var(--text-gold-emboss)' : 'var(--text-vintage-dark)',
                        border: isMe ? '1.5px solid var(--gold-primary)' : '1.5px solid #C4B18F',
                        boxShadow: '0 3px 6px rgba(0,0,0,0.18)',
                        wordBreak: 'break-word',
                        fontSize: '0.92rem',
                        lineHeight: 1.35
                      }}
                    >
                      {msg.text}
                    </div>

                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-vintage-muted)',
                        marginTop: '2px',
                        padding: '0 4px',
                        fontFamily: 'var(--font-mono)'
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

          {/* Frases Rápidas estilo fichas */}
          <div
            style={{
              padding: '0.4rem 0.75rem',
              display: 'flex',
              gap: '0.35rem',
              overflowX: 'auto',
              backgroundColor: '#EAD7BA',
              borderTop: '1px solid var(--gold-brass)',
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
                  fontFamily: 'var(--font-serif)',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  backgroundColor: '#FAF4E5',
                  color: 'var(--text-vintage-dark)',
                  border: '1px solid var(--gold-brass)',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                }}
              >
                {phrase}
              </button>
            ))}
          </div>

          {/* Formulario de Entrada */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '0.65rem 0.75rem',
              backgroundColor: '#FAF4E5',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              borderTop: '1.5px solid var(--gold-brass)'
            }}
          >
            <input
              type="text"
              style={{
                padding: '0.6rem 0.9rem',
                fontSize: '0.9rem',
                borderRadius: '999px',
                flex: 1,
                border: '1.5px solid var(--gold-brass)',
                background: '#FFFDF9',
                color: 'var(--text-vintage-dark)',
                outline: 'none'
              }}
              placeholder="Escribe un mensaje..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={160}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              style={{
                width: '38px',
                height: '38px',
                padding: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: 'linear-gradient(180deg, var(--burgundy-light) 0%, var(--burgundy-primary) 100%)',
                color: 'var(--text-gold-emboss)',
                border: '1.5px solid var(--gold-primary)',
                cursor: 'pointer'
              }}
              title="Enviar"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBox;
