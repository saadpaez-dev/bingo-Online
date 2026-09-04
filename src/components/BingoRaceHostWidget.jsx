import React, { useState } from 'react';
import { Flame, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { calculateCardProgress } from '../utils/bingo';

const BingoRaceHostWidget = ({
  players = [],
  calledNumbers = [],
  mode = 75,
  currentUserId = null
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Filtrar jugadores activos que tienen cartón
  const activePlayers = players
    .filter(p => p.role !== 'spectator' && p.card)
    .map(p => ({
      ...p,
      progress: calculateCardProgress(p.card, mode, calledNumbers)
    }))
    .sort((a, b) => b.progress.percentage - a.progress.percentage);

  if (activePlayers.length === 0) return null;

  const topLeader = activePlayers[0];

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #FAF4E5 0%, #EFE1C6 100%)',
        borderRadius: '10px',
        border: '2px solid var(--gold-brass)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Barra de Encabezado con Botón de Alternar */}
      <div
        onClick={() => setIsExpanded(prev => !prev)}
        style={{
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1.5px solid var(--gold-brass)' : 'none',
          backgroundColor: '#FAF4E5',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Flame size={20} color="#E65100" />
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: '900', fontSize: '1rem', color: '#3A1015' }}>
            Carrera hacia el Bingo (En Vivo)
          </span>
          {topLeader && (
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--burgundy-primary)',
              fontStyle: 'italic',
              fontWeight: 'bold',
              marginLeft: '0.3rem'
            }}>
              Líder: {topLeader.name} ({topLeader.progress.percentage}%)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#5C1D24', fontSize: '0.82rem', fontWeight: 'bold' }}>
          <span>{isExpanded ? 'Ocultar' : 'Mostrar'}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Contenido Desplegable */}
      {isExpanded && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.75rem',
            maxHeight: '260px',
            overflowY: 'auto'
          }}
        >
          {activePlayers.map((player, idx) => {
            const isMe = currentUserId === player.id;
            const { percentage, missing, matched, total } = player.progress;
            const isWinnerCandidate = missing === 1;
            const isClose = missing <= 2 && percentage > 0;

            return (
              <div
                key={player.id}
                style={{
                  backgroundColor: isMe ? '#FFF9EE' : '#FFFDF9',
                  border: isMe 
                    ? '2px solid var(--gold-primary)' 
                    : isWinnerCandidate 
                    ? '2px solid #B71C1C' 
                    : '1.5px solid var(--gold-brass)',
                  borderRadius: '8px',
                  padding: '0.55rem 0.8rem',
                  boxShadow: isMe ? '0 2px 8px rgba(197, 155, 39, 0.3)' : '0 2px 4px rgba(0,0,0,0.08)'
                }}
              >
                {/* Rango, Nombre y Alerta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                    <span style={{
                      fontFamily: 'var(--font-serif)',
                      fontWeight: '900',
                      fontSize: '0.9rem',
                      color: idx === 0 ? '#C59B27' : idx === 1 ? '#78909C' : idx === 2 ? '#8D6E63' : 'var(--text-vintage-muted)'
                    }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                    </span>

                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #7E252D 0%, #3F1015 100%)',
                      border: '1px solid var(--gold-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {player.isCustomAvatar ? (
                        <img src={player.avatar} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        player.avatar || '👤'
                      )}
                    </div>

                    <span style={{
                      fontFamily: 'var(--font-serif)',
                      fontWeight: '800',
                      fontSize: '0.88rem',
                      color: 'var(--text-vintage-dark)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {player.name}
                    </span>

                    {isMe && (
                      <span style={{
                        backgroundColor: 'var(--burgundy-primary)',
                        color: '#fff',
                        fontSize: '0.62rem',
                        padding: '1px 5px',
                        borderRadius: '999px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        TÚ
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                    {isWinnerCandidate ? (
                      <span style={{
                        backgroundColor: '#B71C1C',
                        color: '#FFF',
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '999px',
                        fontWeight: '900',
                        animation: 'pulse 1s infinite'
                      }}>
                        🔥 ¡A 1!
                      </span>
                    ) : missing === 2 ? (
                      <span style={{
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        borderRadius: '999px',
                        fontWeight: '800'
                      }}>
                        🤞 ¡A 2!
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-vintage-muted)' }}>
                        Faltan {missing}
                      </span>
                    )}

                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '900',
                      fontSize: '0.95rem',
                      color: isClose ? '#B71C1C' : 'var(--burgundy-primary)'
                    }}>
                      {percentage}%
                    </span>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div
                  style={{
                    height: '8px',
                    borderRadius: '999px',
                    backgroundColor: '#E6D7BE',
                    border: '1px solid #C4B18F',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${percentage}%`,
                      borderRadius: '999px',
                      background: isWinnerCandidate
                        ? 'linear-gradient(90deg, #D4AF37 0%, #E65100 50%, #B71C1C 100%)'
                        : isClose
                        ? 'linear-gradient(90deg, #C59B27 0%, #D97706 100%)'
                        : 'linear-gradient(90deg, #8C6B23 0%, var(--burgundy-primary) 100%)',
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BingoRaceHostWidget;
