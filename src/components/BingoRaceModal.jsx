import React from 'react';
import { X, Flame, Trophy, Sparkles, CheckCircle2 } from 'lucide-react';
import { calculateCardProgress } from '../utils/bingo';

const BingoRaceModal = ({
  isOpen,
  onClose,
  players = [],
  calledNumbers = [],
  mode = 75,
  currentUserId = null
}) => {
  if (!isOpen) return null;

  // Filtrar jugadores activos que tienen cartón
  const activePlayers = players
    .filter(p => p.role !== 'spectator' && p.card)
    .map(p => {
      const progress = calculateCardProgress(p.card, mode, calledNumbers);
      return {
        ...p,
        progress
      };
    })
    // Ordenar de mayor porcentaje a menor
    .sort((a, b) => b.progress.percentage - a.progress.percentage);

  // Encontrar al jugador actual si aplica
  const myPlayer = currentUserId ? activePlayers.find(p => p.id === currentUserId) : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(20, 10, 5, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="vintage-parchment-card animate-pop"
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem 1.5rem',
          position: 'relative',
          border: '3px solid var(--gold-primary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-vintage-dark)',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Cerrar y volver al cartón"
        >
          <X size={22} />
        </button>

        {/* Encabezado */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
            <Flame size={24} color="#E65100" />
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.6rem',
              fontWeight: '900',
              margin: 0,
              color: 'var(--text-vintage-dark)'
            }}>
              Carrera hacia el Bingo
            </h2>
            <Flame size={24} color="#E65100" />
          </div>
          <p style={{
            fontSize: '0.88rem',
            color: 'var(--text-vintage-muted)',
            fontStyle: 'italic',
            margin: '0.25rem 0 0'
          }}>
            Quién está más cerca de cantar Bingo en la ronda actual
          </p>
        </div>

        {/* Resumen rápido para el participante que consulta */}
        {myPlayer && (
          <div
            style={{
              background: 'linear-gradient(180deg, #FAF4E5 0%, #EFE1C6 100%)',
              border: '2px solid var(--gold-primary)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 3px 8px rgba(0,0,0,0.12)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #7E252D 0%, #3F1015 100%)',
                border: '1.5px solid var(--gold-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                overflow: 'hidden'
              }}>
                {myPlayer.isCustomAvatar ? (
                  <img src={myPlayer.avatar} alt="Tú" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  myPlayer.avatar || '👤'
                )}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: '800', fontSize: '0.95rem', color: 'var(--burgundy-primary)' }}>
                  Tu Posición Actual: {activePlayers.findIndex(p => p.id === myPlayer.id) + 1}º Lugar
                </div>
                <div style={{ fontSize: '0.78rem', color: '#4A2810' }}>
                  Llevas {myPlayer.progress.matched} de {myPlayer.progress.total} bolas ({myPlayer.progress.percentage}%)
                </div>
              </div>
            </div>

            <span style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: '900',
              fontSize: '1.2rem',
              color: myPlayer.progress.missing <= 2 ? '#B71C1C' : 'var(--burgundy-primary)'
            }}>
              {myPlayer.progress.missing === 1 ? '¡A 1 bola! 🔥' : myPlayer.progress.missing === 2 ? '¡A 2 bolas! 🤞' : `Faltan ${myPlayer.progress.missing}`}
            </span>
          </div>
        )}

        {/* Lista de Jugadores y Barras de Progreso */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            paddingRight: '4px',
            maxHeight: '52vh'
          }}
        >
          {activePlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-vintage-muted)' }}>
              Aún no hay cartones activos en juego.
            </div>
          ) : (
            activePlayers.map((player, idx) => {
              const isMe = currentUserId === player.id;
              const { percentage, missing, matched, total } = player.progress;
              const isClose = missing <= 2 && percentage > 0;
              const isWinnerCandidate = missing === 1;

              return (
                <div
                  key={player.id}
                  style={{
                    backgroundColor: isMe ? '#FFF9EE' : '#FFFDF9',
                    border: isMe ? '2px solid var(--gold-primary)' : '1.5px solid var(--gold-brass)',
                    borderRadius: '10px',
                    padding: '0.75rem 0.9rem',
                    boxShadow: isMe ? '0 4px 10px rgba(197, 155, 39, 0.35)' : '0 2px 5px rgba(0,0,0,0.08)',
                    transition: 'transform 0.2s',
                    position: 'relative'
                  }}
                >
                  {/* Fila superior: Rango, Avatar, Nombre y Porcentaje */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      {/* Medalla o número */}
                      <span style={{
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '900',
                        fontSize: '1rem',
                        width: '24px',
                        textAlign: 'center',
                        color: idx === 0 ? '#C59B27' : idx === 1 ? '#78909C' : idx === 2 ? '#8D6E63' : 'var(--text-vintage-muted)'
                      }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}
                      </span>

                      {/* Avatar */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, #7E252D 0%, #3F1015 100%)',
                        border: '1.5px solid var(--gold-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {player.isCustomAvatar ? (
                          <img src={player.avatar} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          player.avatar || '👤'
                        )}
                      </div>

                      {/* Nombre */}
                      <div>
                        <span style={{
                          fontFamily: 'var(--font-serif)',
                          fontWeight: '800',
                          fontSize: '0.98rem',
                          color: 'var(--text-vintage-dark)'
                        }}>
                          {player.name}
                        </span>
                        {isMe && (
                          <span style={{
                            marginLeft: '0.4rem',
                            backgroundColor: 'var(--burgundy-primary)',
                            color: '#fff',
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '999px',
                            fontWeight: 'bold'
                          }}>
                            TÚ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Porcentaje y Alerta de Proximidad */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isWinnerCandidate ? (
                        <span style={{
                          backgroundColor: '#B71C1C',
                          color: '#FFF',
                          fontSize: '0.72rem',
                          padding: '2px 7px',
                          borderRadius: '999px',
                          fontWeight: '900',
                          fontFamily: 'var(--font-serif)',
                          animation: 'pulse 1s infinite'
                        }}>
                          🔥 ¡A 1 BOLA!
                        </span>
                      ) : missing === 2 ? (
                        <span style={{
                          backgroundColor: '#FEF3C7',
                          color: '#92400E',
                          fontSize: '0.72rem',
                          padding: '2px 7px',
                          borderRadius: '999px',
                          fontWeight: '800',
                          fontFamily: 'var(--font-serif)',
                          border: '1px solid #F59E0B'
                        }}>
                          🤞 ¡A 2 BOLAS!
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-vintage-muted)' }}>
                          Faltan {missing}
                        </span>
                      )}

                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '900',
                        fontSize: '1.05rem',
                        color: isClose ? '#B71C1C' : 'var(--burgundy-primary)'
                      }}>
                        {percentage}%
                      </span>
                    </div>

                  </div>

                  {/* Barra de Progreso */}
                  <div
                    style={{
                      height: '10px',
                      borderRadius: '999px',
                      backgroundColor: '#E6D7BE',
                      border: '1px solid #C4B18F',
                      overflow: 'hidden',
                      position: 'relative'
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
                        boxShadow: '0 0 6px rgba(0,0,0,0.2)',
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-vintage-muted)', marginTop: '2px' }}>
                    <span>{matched} acertadas</span>
                    <span>{total} requeridas</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Botón para volver al cartón */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          <button
            className="btn-vintage-burgundy"
            onClick={onClose}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1.05rem' }}
          >
            Volver a mi Cartón
          </button>
        </div>

      </div>
    </div>
  );
};

export default BingoRaceModal;
