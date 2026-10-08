import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, deleteDoc, getDocs, query, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { MessageCircle, X, Send, Zap, ChevronDown, ChevronUp, Check, ArrowLeftRight, Move } from 'lucide-react';
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

const ChatBox = ({ 
  gameId, 
  currentUser, 
  defaultSide = 'left',
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
  hideFloatingButton = false
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (nextVal) => {
    if (externalOnToggle) {
      externalOnToggle(typeof nextVal === 'function' ? nextVal(isOpen) : nextVal);
    } else {
      setInternalIsOpen(nextVal);
    }
  };
  const [inputMessage, setInputMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isPhrasesExpanded, setIsPhrasesExpanded] = useState(false);
  const [sentFeedback, setSentFeedback] = useState(false);
  const { playSound } = useSettings();

  // Ubicación inteligente: 'left' por defecto para que NUNCA tape la ventana de Carrera hacia el Bingo
  const [dockSide, setDockSide] = useState(() => {
    return localStorage.getItem('bingo_chat_dock_side') || defaultSide || 'left';
  });
  const [dragPos, setDragPos] = useState(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });

  const toggleDockSide = (e) => {
    e.stopPropagation();
    const nextSide = dockSide === 'left' ? 'right' : 'left';
    setDockSide(nextSide);
    setDragPos(null);
    localStorage.setItem('bingo_chat_dock_side', nextSide);
  };

  const handleMouseDownHeader = (e) => {
    if (e.target.closest('button') || e.target.closest('input')) return;
    isDraggingRef.current = true;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;

    const panelElem = e.currentTarget.parentElement;
    const rect = panelElem.getBoundingClientRect();

    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      initialX: rect.left,
      initialY: rect.top
    };

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const curX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
      const curY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
      const deltaX = curX - dragStartRef.current.mouseX;
      const deltaY = curY - dragStartRef.current.mouseY;

      const newX = Math.max(8, Math.min(window.innerWidth - 360, dragStartRef.current.initialX + deltaX));
      const newY = Math.max(8, Math.min(window.innerHeight - 140, dragStartRef.current.initialY + deltaY));
      setDragPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
  };

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
      setTimeout(async () => {
        try {
          await deleteDoc(docRef);
        } catch (e) {}
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

  // Posicionamiento dinámico del panel
  const panelStyle = dragPos
    ? {
        position: 'fixed',
        left: `${dragPos.x}px`,
        top: `${dragPos.y}px`,
        bottom: 'auto',
        right: 'auto',
        width: 'min(435px, calc(100vw - 24px))',
        padding: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '16px',
        background: 'radial-gradient(ellipse at center, #FAF4E5 0%, #F4E7CB 100%)',
        border: '3.5px solid var(--burgundy-primary)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.75)'
      }
    : {
        position: 'fixed',
        bottom: '24px',
        ...(dockSide === 'left' ? { left: '24px', right: 'auto' } : { right: '24px', left: 'auto' }),
        width: 'min(435px, calc(100vw - 32px))',
        padding: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '16px',
        background: 'radial-gradient(ellipse at center, #FAF4E5 0%, #F4E7CB 100%)',
        border: '3.5px solid var(--burgundy-primary)',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.75)'
      };

  return (
    <>
      {/* Botón flotante para abrir (ubicado en el lado configurado, por defecto a la izquierda) */}
      {!isOpen && !hideFloatingButton && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            ...(dockSide === 'left' ? { left: '24px', right: 'auto' } : { right: '24px', left: 'auto' }),
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
          title={`Abrir Chat y Frases Rápidas (${dockSide === 'left' ? 'Lado Izquierdo' : 'Lado Derecho'})`}
          aria-label="Abrir Mensajes"
        >
          <MessageCircle size={28} />
        </button>
      )}

      {/* Ventana de Mensajes Rápidos (Con cabecera arrastrable y botón para alternar de lado) */}
      {isOpen && (
        <div className="animate-pop" style={panelStyle}>
          {/* Encabezado (Arrastrable) */}
          <div
            onMouseDown={handleMouseDownHeader}
            onTouchStart={handleMouseDownHeader}
            style={{
              padding: '0.65rem 1rem',
              background: 'linear-gradient(180deg, var(--burgundy-light) 0%, var(--burgundy-primary) 100%)',
              color: 'var(--text-gold-emboss)',
              borderBottom: '2px solid var(--gold-brass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              userSelect: 'none'
            }}
            title="Mantén presionado para arrastrar la ventana a cualquier lugar de la pantalla"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Move size={15} color="var(--gold-highlight)" style={{ opacity: 0.8 }} />
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', margin: 0, fontWeight: '800' }}>
                  Chat de la Mesa
                </h3>
                <span style={{ fontSize: '0.68rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
                  Sala {gameId} • Arrastrable
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {/* Botón para alternar lado (Izquierda / Derecha) */}
              <button
                type="button"
                onClick={toggleDockSide}
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--gold-brass)',
                  borderRadius: '6px',
                  padding: '3px 7px',
                  color: 'var(--gold-highlight)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 'bold'
                }}
                title={dockSide === 'left' ? 'Mover al lado derecho' : 'Mover al lado izquierdo'}
              >
                <ArrowLeftRight size={12} />
                <span>{dockSide === 'left' ? 'Derecha' : 'Izquierda'}</span>
              </button>

              {/* Botón cerrar */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--gold-brass)',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Cerrar"
              >
                <X size={14} />
              </button>
            </div>
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
              padding: '0.6rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              borderBottom: '1.5px solid var(--gold-brass)'
            }}
          >
            {/* Cabecera de la sección Frases Rápidas y botón expandir */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Zap size={15} color="#5C1D24" />
                <span
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '0.84rem',
                    fontWeight: '800',
                    color: '#4A121A'
                  }}
                >
                  Frases Rápidas
                </span>
                <span style={{ fontSize: '0.72rem', color: '#6A4020', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                  ({currentPhrases.length})
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsPhrasesExpanded((prev) => !prev)}
                style={{
                  background: '#FAF4E5',
                  border: '1px solid var(--gold-brass)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.74rem',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: 'bold',
                  color: '#4A121A',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
                title={isPhrasesExpanded ? 'Ver modo compacto' : 'Ver todas las frases'}
              >
                <span>{isPhrasesExpanded ? 'Compactar' : 'Ver más'}</span>
                {isPhrasesExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {/* Categorías de filtro en fila dedicada (sin barra gris nativa) */}
            <div 
              className="no-scrollbar"
              style={{ 
                display: 'flex', 
                gap: '0.35rem', 
                flexWrap: 'wrap', 
                alignItems: 'center' 
              }}
            >
              {Object.keys(QUICK_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    fontSize: '0.74rem',
                    fontFamily: 'var(--font-serif)',
                    fontWeight: selectedCategory === cat ? '800' : '600',
                    padding: '0.22rem 0.65rem',
                    borderRadius: '999px',
                    border: selectedCategory === cat ? '1.5px solid var(--gold-primary)' : '1px solid #C4B18F',
                    backgroundColor: selectedCategory === cat ? 'var(--burgundy-primary)' : '#FAF4E5',
                    color: selectedCategory === cat ? 'var(--text-gold-emboss)' : '#3F1015',
                    cursor: 'pointer',
                    boxShadow: selectedCategory === cat ? '0 2px 5px rgba(0,0,0,0.25)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Listado envolvente de frases (Texto completo, sin cortes) */}
            <div
              className="vintage-scrollbar"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.38rem',
                maxHeight: isPhrasesExpanded ? '210px' : '98px',
                overflowY: 'auto',
                padding: '0.2rem 0.1rem',
                transition: 'max-height 0.25s ease'
              }}
            >
              {currentPhrases.map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(phrase)}
                  style={{
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-serif)',
                    fontWeight: '700',
                    padding: '0.34rem 0.72rem',
                    borderRadius: '999px',
                    backgroundColor: '#FAF4E5',
                    color: '#2C1A0E',
                    border: '1.5px solid var(--gold-brass)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1.25,
                    whiteSpace: 'normal',
                    textAlign: 'left'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.2)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#FAF4E5';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.12)';
                  }}
                  title={`Enviar: "${phrase}"`}
                >
                  {phrase}
                </button>
              ))}
            </div>
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
