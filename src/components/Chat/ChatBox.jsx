import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { MessageCircle, X, Send, Sparkles, ChevronUp, ChevronDown, Zap } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

const QUICK_CATEGORIES = {
  'Todos': [
    '¡Me falta solo una! 😱',
    '¡Casi canto Bingo! 🎯',
    '¡BIIINGO! 🎉',
    '¡A dos números! 🤞',
    '¡Buena suerte a todos! 🍀',
    '¡Vamos con todo! 🔥',
    '¡Ese número era el mío! 🥳',
    '¡No sale mi número! 🙈',
    '¡Felicidades al ganador! 👏',
    '¡Que gane el mejor! 🎩',
    '¡Otra partida, por favor! 🔄',
    '¡Qué nervios! 😬',
    '¡Atentos a la bola! 🎱',
    '¡Hoy estoy con suerte! ✨',
    '¡Tengo el cartón casi lleno! 📋',
    '¡Ese número no lo tengo! 😅'
  ],
  'Partida 🎯': [
    '¡Me falta solo una! 😱',
    '¡Casi canto Bingo! 🎯',
    '¡BIIINGO! 🎉',
    '¡A dos números! 🤞',
    '¡Tengo el cartón casi lleno! 📋',
    '¡Ese número era el mío! 🥳',
    '¡No sale mi número! 🙈',
    '¡Atentos a la bola! 🎱'
  ],
  'Ánimo 🔥': [
    '¡Buena suerte a todos! 🍀',
    '¡Vamos con todo! 🔥',
    '¡Felicidades al ganador! 👏',
    '¡Que gane el mejor! 🎩',
    '¡Hoy estoy con suerte! ✨',
    '¡Otra partida, por favor! 🔄'
  ],
  'Risas 😂': [
    '¡Qué nervios! 😬',
    '¡Ese número no lo tengo! 😅',
    '¡No sale mi número! 🙈',
    '¡Ese número era el mío! 🥳'
  ]
};

const ChatBox = ({ gameId, currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isPhrasesExpanded, setIsPhrasesExpanded] = useState(false);
  const messagesEndRef = useRef(null);
  const { playSound } = useSettings();
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!gameId) return;

    const messagesRef = collection(db, 'games', gameId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(80));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(m => !m.isReaction);
      setMessages(msgs);

      if (initialLoadDone.current && !isOpen && snapshot.docChanges().some(c => c.type === 'added' && !c.doc.data().isReaction)) {
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

  const currentPhrases = QUICK_CATEGORIES[selectedCategory] || QUICK_CATEGORIES['Todos'];

  // Dividir frases en 2 filas para el modo compacto
  const half = Math.ceil(currentPhrases.length / 2);
  const row1 = currentPhrases.slice(0, half);
  const row2 = currentPhrases.slice(half);

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
            width: 'min(400px, calc(100vw - 28px))',
            height: 'min(580px, calc(100vh - 80px))',
            padding: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '14px',
            background: 'radial-gradient(ellipse at center, #FAF4E5 0%, #F4E7CB 100%)',
            border: '3.5px solid var(--burgundy-primary)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.75)'
          }}
        >
          {/* Header de Cuero / Burdeos */}
          <div
            style={{
              padding: '0.85rem 1.2rem',
              background: 'linear-gradient(180deg, var(--burgundy-light) 0%, var(--burgundy-primary) 100%)',
              color: 'var(--text-gold-emboss)',
              borderBottom: '2px solid var(--gold-brass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={22} color="var(--gold-highlight)" />
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', margin: 0, fontWeight: '800' }}>
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
                <p style={{ fontSize: '0.82rem', fontStyle: 'italic', marginTop: '0.2rem' }}>
                  Toca una frase abajo para saludar a tu familia 👋
                </p>
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
                          fontSize: '0.78rem',
                          fontFamily: 'var(--font-serif)',
                          color: 'var(--text-vintage-muted)',
                          marginBottom: '3px',
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
                          : 'linear-gradient(180deg, #FFFFFF 0%, #F8EFE2 100%)',
                        color: isMe ? 'var(--text-gold-emboss)' : 'var(--text-vintage-dark)',
                        border: isMe ? '1.5px solid var(--gold-primary)' : '1.5px solid #C4B18F',
                        boxShadow: '0 3px 6px rgba(0,0,0,0.18)',
                        wordBreak: 'break-word',
                        fontSize: '0.94rem',
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

          {/* =========================================================
             PANEL FIJADO DE FRASES RÁPIDAS (AMPLIADO Y BIEN VISIBLE)
             ========================================================= */}
          <div
            style={{
              backgroundColor: '#E8D5B7',
              borderTop: '2px solid var(--gold-brass)',
              borderBottom: '1.5px solid var(--gold-brass)',
              padding: '0.45rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              flexShrink: 0
            }}
          >
            {/* Barra superior de categorías y botón de expandir */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Zap size={14} color="#5C1D24" />
                <span style={{ 
                  fontFamily: 'var(--font-serif)', 
                  fontSize: '0.78rem', 
                  fontWeight: '800', 
                  color: '#4A121A' 
                }}>
                  Frases Rápidas
                </span>
              </div>

              {/* Categorías de filtro */}
              <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
                {Object.keys(QUICK_CATEGORIES).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-serif)',
                      fontWeight: selectedCategory === cat ? '800' : '600',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      border: selectedCategory === cat ? '1.5px solid var(--gold-primary)' : '1px solid #C4B18F',
                      backgroundColor: selectedCategory === cat ? 'var(--burgundy-primary)' : '#FAF4E5',
                      color: selectedCategory === cat ? 'var(--text-gold-emboss)' : '#3F1015',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Botón para expandir todas o ver 2 filas */}
              <button
                onClick={() => setIsPhrasesExpanded(prev => !prev)}
                style={{
                  background: '#FAF4E5',
                  border: '1px solid var(--gold-brass)',
                  borderRadius: '4px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#4A121A'
                }}
                title={isPhrasesExpanded ? 'Ver compacto' : 'Ver todas las frases'}
              >
                {isPhrasesExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>

            {/* Vista Expandida (Grid completo) o Compacta (2 filas bien visibles) */}
            {isPhrasesExpanded ? (
              <div
                style={{
                  maxHeight: '140px',
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '0.35rem',
                  padding: '0.35rem 0'
                }}
              >
                {currentPhrases.map((phrase, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(phrase)}
                    style={{
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-serif)',
                      fontWeight: '700',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '8px',
                      backgroundColor: '#FAF4E5',
                      color: '#2C1A0E',
                      border: '1.5px solid var(--gold-brass)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
                      transition: 'all 0.15s'
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#FFFDF8'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#FAF4E5'}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {/* Fila 1 */}
                <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
                  {row1.map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(phrase)}
                      style={{
                        whiteSpace: 'nowrap',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '700',
                        padding: '0.32rem 0.75rem',
                        borderRadius: '999px',
                        backgroundColor: '#FAF4E5',
                        color: '#2C1A0E',
                        border: '1.5px solid var(--gold-brass)',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        flexShrink: 0
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>

                {/* Fila 2 */}
                <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
                  {row2.map((phrase, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(phrase)}
                      style={{
                        whiteSpace: 'nowrap',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '700',
                        padding: '0.32rem 0.75rem',
                        borderRadius: '999px',
                        backgroundColor: '#FAF4E5',
                        color: '#2C1A0E',
                        border: '1.5px solid var(--gold-brass)',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        flexShrink: 0
                      }}
                      onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Formulario de Entrada */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: '#FAF4E5',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <input
              type="text"
              style={{
                padding: '0.65rem 1rem',
                fontSize: '0.92rem',
                borderRadius: '999px',
                flex: 1,
                border: '1.5px solid var(--gold-brass)',
                background: '#FFFDF9',
                color: 'var(--text-vintage-dark)',
                outline: 'none',
                fontFamily: 'var(--font-sans)'
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
                width: '40px',
                height: '40px',
                padding: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: 'linear-gradient(180deg, var(--burgundy-light) 0%, var(--burgundy-primary) 100%)',
                color: 'var(--text-gold-emboss)',
                border: '1.5px solid var(--gold-primary)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                cursor: 'pointer'
              }}
              title="Enviar"
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBox;
