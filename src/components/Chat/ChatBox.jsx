import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, getDocs, query, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { MessageCircle, X, Send, Zap, ChevronDown, ChevronUp, Check } from 'lucide-react';
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
  const [inputMessage, setInputMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isPhrasesExpanded, setIsPhrasesExpanded] = useState(false);
  const [sentFeedback, setSentFeedback] = useState(false);
  const { playSound } = useSettings();

  // Limpieza inicial de mensajes viejos en la sala para que no queden guardados
  useEffect(() => {
    if (!gameId) return;
    const cleanOldMessages = async () => {
      try {
        const messagesRef = collection(db, 'games', gameId, 'messages');
        const snap = await getDocs(query(messagesRef, limit(40)));
        snap.docs.forEach((d) => {
          deleteDoc(d.ref).catch(() => {});
        });
      } catch (err) {
        // Silencioso
      }
    };
    cleanOldMessages();
  }, [gameId]);

  const sendMessage = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || !gameId) return;

    try {
      setInputMessage('');
      setSentFeedback(true);
      setTimeout(() => setSentFeedback(false), 2400);

      const messagesRef = collection(db, 'games', gameId, 'messages');
      const docRef = await addDoc(messagesRef, {
        text,
        senderName: currentUser?.name || 'Jugador',
        avatar: currentUser?.avatar || '👤',
        isCustomAvatar: !!currentUser?.isCustomAvatar,
        isHost: !!currentUser?.isHost,
        timestamp: serverTimestamp(),
        createdAt: Date.now()
      });

      playSound('draw');

      // Auto-limpieza de la base de datos: eliminar el mensaje de Firestore después de 12s
      // para que solo aparezca en vivo flotando en las pantallas y no se guarde ningún historial
      setTimeout(async () => {
        try {
          await deleteDoc(docRef);
        } catch (e) {
          // Ya eliminado
        }
      }, 12000);
    } catch (err) {
      console.error('Error enviando mensaje:', err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const currentPhrases = QUICK_CATEGORIES[selectedCategory] || QUICK_CATEGORIES['Todos'];
  const half = Math.ceil(currentPhrases.length / 2);
  const row1 = currentPhrases.slice(0, half);
  const row2 = currentPhrases.slice(half);

  return (
    <>
      {/* Botón flotante para abrir */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
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
            background: 'radial-gradient(circle at 35% 30%, #8b2834 0%, var(--burgundy-primary) 65%, var(--burgundy-dark) 100%)',
            border: '3px solid var(--gold-primary)',
            color: 'var(--text-gold-emboss)',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255,255,255,0.4)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          title="Enviar mensaje o frase rápida"
          aria-label="Abrir Mensajes"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* Ventana Compacta de Envío de Mensajes (Sin historial acumulado) */}
      {isOpen && (
        <div
          className="animate-pop"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: 'min(420px, calc(100vw - 32px))',
            padding: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '16px',
            background: 'radial-gradient(ellipse at center, #FAF4E5 0%, #F4E7CB 100%)',
            border: '3.5px solid var(--burgundy-primary)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.75)'
          }}
        >
          {/* Encabezado */}
          <div
            style={{
              padding: '0.75rem 1.1rem',
              background: 'linear-gradient(180deg, var(--burgundy-light) 0%, var(--burgundy-primary) 100%)',
              color: 'var(--text-gold-emboss)',
              borderBottom: '2px solid var(--gold-brass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={20} color="var(--gold-highlight)" />
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', margin: 0, fontWeight: '800' }}>
                  Chat de la Mesa
                </h3>
                <span style={{ fontSize: '0.7rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
                  Sala {gameId} • Mensajes en pantalla
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--gold-brass)',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cerrar"
            >
              <X size={15} />
            </button>
          </div>

          {/* Feedback temporal de envío */}
          {sentFeedback && (
            <div
              style={{
                padding: '0.4rem 0.8rem',
                background: 'linear-gradient(90deg, #1B5E20 0%, #2E7D32 100%)',
                color: '#FAF4E5',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-serif)',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                borderBottom: '1px solid var(--gold-brass)'
              }}
            >
              <Check size={14} />
              ¡Mensaje lanzado a la pantalla de la sala!
            </div>
          )}

          {/* Panel de Frases Rápidas */}
          <div
            style={{
              backgroundColor: '#E8D5B7',
              padding: '0.55rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              borderBottom: '1.5px solid var(--gold-brass)'
            }}
          >
            {/* Categorías de filtro */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Zap size={14} color="#5C1D24" />
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    color: '#4A121A'
                  }}
                >
                  Frases Rápidas
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
                {Object.keys(QUICK_CATEGORIES).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-serif)',
                      fontWeight: selectedCategory === cat ? '800' : '600',
                      padding: '0.18rem 0.55rem',
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

              <button
                onClick={() => setIsPhrasesExpanded((prev) => !prev)}
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

            {/* Listado de frases */}
            {isPhrasesExpanded ? (
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: '0.35rem',
                  padding: '0.3rem 0'
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
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FFFDF8')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FAF4E5')}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
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
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                      onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>
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
                      onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                      onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
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
              padding: '0.7rem 0.85rem',
              backgroundColor: '#FAF4E5',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
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
              placeholder="Escribe un mensaje para todos..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={160}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              style={{
                width: '42px',
                height: '42px',
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
                cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                opacity: inputMessage.trim() ? 1 : 0.6
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
