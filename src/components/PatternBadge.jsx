import React from 'react';
import { getPattern } from '../utils/bingo';

/**
 * Componente PatternBadge
 * Renderiza la dinámica activa con una mini-cuadrícula 5x5 que ilustra
 * con puntos dorados iluminados la letra o figura exacta requerida para ganar.
 */
const PatternBadge = ({ 
  patternId = 'full', 
  mode = 75, 
  compact = false, 
  showDescription = true, 
  style = {} 
}) => {
  if (mode !== 75) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        background: 'linear-gradient(180deg, rgba(63, 16, 21, 0.9) 0%, rgba(35, 10, 13, 0.95) 100%)',
        border: '1.5px solid var(--gold-brass)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        color: 'var(--text-gold-emboss)',
        fontFamily: 'var(--font-serif)',
        fontSize: '0.85rem',
        ...style
      }}>
        <span style={{ color: 'var(--gold-highlight)', fontWeight: 'bold' }}>🎯 Dinámica:</span>
        <span>{patternId === 'one_line' ? '1 Línea' : patternId === 'two_lines' ? '2 Líneas' : 'Cartón Lleno (15 Bolas)'}</span>
      </div>
    );
  }

  const pattern = getPattern(patternId);
  const matrix = pattern.matrix || [
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1]
  ];

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: compact ? '8px' : '12px',
      padding: compact ? '5px 10px' : '7px 14px',
      background: 'linear-gradient(180deg, #4A1218 0%, #2B0A0E 100%)',
      border: '2px solid var(--gold-brass)',
      borderRadius: '10px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.15)',
      color: 'var(--text-gold-emboss)',
      ...style
    }}>
      {/* Mini-cuadrícula 5x5 de la letra */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: compact ? '2px' : '2.5px',
          width: compact ? '32px' : '38px',
          height: compact ? '32px' : '38px',
          padding: '3px',
          background: 'rgba(0, 0, 0, 0.65)',
          borderRadius: '6px',
          border: '1px solid rgba(212, 175, 55, 0.45)',
          flexShrink: 0
        }}
        title={`Miniatura de la ${pattern.name}`}
      >
        {matrix.map((row, rIdx) => 
          row.map((active, cIdx) => {
            const isCenter = rIdx === 2 && cIdx === 2;
            const isLit = active === 1;
            return (
              <div
                key={`${rIdx}-${cIdx}`}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '1.5px',
                  background: isLit
                    ? isCenter 
                      ? '#FFE89E' 
                      : 'linear-gradient(135deg, #FFE082 0%, #D4AF37 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: isLit 
                    ? '0 0 3px rgba(255, 215, 0, 0.8)' 
                    : 'none'
                }}
              />
            );
          })
        )}
      </div>

      {/* Textos descriptivos */}
      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.2 }}>
        <div style={{ 
          fontSize: compact ? '0.62rem' : '0.68rem', 
          fontFamily: 'var(--font-mono)', 
          letterSpacing: '1px',
          color: 'var(--gold-highlight)',
          textTransform: 'uppercase',
          opacity: 0.9
        }}>
          Dinámica de la Ronda
        </div>
        <div style={{ 
          fontSize: compact ? '0.88rem' : '1.02rem', 
          fontFamily: 'var(--font-serif)', 
          fontWeight: '900',
          color: '#FFF8EA',
          letterSpacing: '0.5px'
        }}>
          {pattern.name}
        </div>
        {showDescription && !compact && (
          <div style={{ 
            fontSize: '0.7rem', 
            color: 'rgba(244, 231, 203, 0.75)', 
            marginTop: '1px' 
          }}>
            {pattern.description}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternBadge;
