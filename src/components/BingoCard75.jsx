import React from 'react';
import { Check, Star } from 'lucide-react';

const BingoCard75 = ({ card, markedNumbers, toggleMark, calledNumbers }) => {
  if (!card) return null;

  const headers = ['B', 'I', 'N', 'G', 'O'];
  
  // Placas de encabezado estilo bronce esmaltado clásico
  const headerStyles = [
    'linear-gradient(180deg, #5C1D24 0%, #3F1015 100%)', // Burdeos
    'linear-gradient(180deg, #7E252D 0%, #4D1318 100%)', // Vino
    'linear-gradient(180deg, #8C6B23 0%, #573E11 100%)', // Oro envejecido
    'linear-gradient(180deg, #243526 0%, #152217 100%)', // Verde club
    'linear-gradient(180deg, #4A2415 0%, #2A1208 100%)', // Caoba noble
  ];
  
  // Transformar columnas a filas para renderizar cuadrícula
  const rows = Array(5).fill(null).map(() => Array(5).fill(null));
  headers.forEach((h, colIndex) => {
    card[h].forEach((val, rowIndex) => {
      rows[rowIndex][colIndex] = val;
    });
  });

  return (
    <div style={{
      maxWidth: '520px',
      margin: '0 auto',
      userSelect: 'none',
      background: 'radial-gradient(ellipse at center, #FAF4E5 0%, #F4E7CB 80%, #E6D2AE 100%)',
      padding: '1.25rem',
      borderRadius: '12px',
      border: '3px solid var(--burgundy-primary)',
      boxShadow: '0 12px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(140, 107, 35, 0.25)',
      position: 'relative'
    }}>
      {/* Filete dorado interior */}
      <div style={{
        position: 'absolute',
        top: '6px',
        left: '6px',
        right: '6px',
        bottom: '6px',
        border: '1.5px solid var(--gold-brass)',
        borderRadius: '8px',
        pointerEvents: 'none'
      }} />

      {/* Encabezados B - I - N - G - O */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '0.45rem',
        marginBottom: '0.55rem',
        position: 'relative',
        zIndex: 2
      }}>
        {headers.map((h, i) => (
          <div key={h} style={{
            background: headerStyles[i],
            color: 'var(--text-gold-emboss)',
            fontFamily: 'var(--font-serif)',
            fontWeight: '900',
            fontSize: '1.6rem',
            textAlign: 'center',
            padding: '0.6rem 0',
            borderRadius: '8px',
            border: '2px solid var(--gold-primary)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)',
            textShadow: '0 2px 3px rgba(0,0,0,0.8)'
          }}>
            {h}
          </div>
        ))}
      </div>
      
      {/* Casillas de juego (Fichas de Marfil Grabado / Madera) */}
      {rows.map((row, rIndex) => (
        <div key={rIndex} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.45rem',
          marginBottom: '0.45rem',
          position: 'relative',
          zIndex: 2
        }}>
          {row.map((cellValue, cIndex) => {
            const isFree = cellValue === 'FREE';
            const isMarked = markedNumbers.has(cellValue) || isFree;
            const isCalled = calledNumbers.includes(cellValue) && !isMarked;
            
            return (
              <div 
                key={`${rIndex}-${cIndex}`} 
                onClick={() => toggleMark(cellValue)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  aspectRatio: '1',
                  borderRadius: '10px',
                  fontFamily: 'var(--font-serif)',
                  fontWeight: '800',
                  fontSize: isFree ? '0.75rem' : '1.45rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  
                  // Ficha sin marcar vs marcada (Sello de cera burdeos)
                  background: isFree 
                    ? 'radial-gradient(circle at 35% 30%, #E6BE57 0%, #C59B27 60%, #8C6B23 100%)'
                    : isMarked 
                    ? 'radial-gradient(circle at 35% 30%, #7E252D 0%, #5C1D24 65%, #380C11 100%)' 
                    : isCalled 
                    ? 'radial-gradient(circle at center, #FFF9EB 0%, #F5E9CC 100%)'
                    : 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #F7EEDB 65%, #EADBBE 100%)',
                  
                  color: (isMarked || isFree) ? 'var(--text-gold-emboss)' : '#2C1A0E',
                  
                  border: isFree 
                    ? '2px solid #573E11'
                    : isMarked 
                    ? '2.5px solid var(--gold-primary)' 
                    : isCalled 
                    ? '2.5px solid var(--gold-brass)' 
                    : '2px solid #C4B18F',
                  
                  boxShadow: isFree 
                    ? '0 4px 10px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.5)'
                    : isMarked 
                    ? '0 6px 14px rgba(60, 16, 21, 0.6), inset 0 2px 4px rgba(255,255,255,0.3)' 
                    : isCalled 
                    ? '0 0 12px rgba(212, 175, 55, 0.65)' 
                    : '0 3px 6px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.8)',
                  
                  transform: isMarked ? 'scale(1.04)' : 'scale(1)',
                  textShadow: (isMarked || isFree) ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 0 rgba(255,255,255,0.6)'
                }}
              >
                {/* Casilla Central GRATIS */}
                {isFree ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1' }}>
                    <Star size={20} fill="#FFF1C5" color="#573E11" style={{ animation: 'starPulse 2s infinite' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', letterSpacing: '1px', marginTop: '2px', color: '#3A2006' }}>GRATIS</span>
                  </div>
                ) : (
                  <span>{cellValue}</span>
                )}

                {/* Sello de tinta / Check vintage al marcar */}
                {isMarked && !isFree && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'rgba(255, 241, 197, 0.22)',
                    pointerEvents: 'none'
                  }}>
                    <Check size={42} strokeWidth={4} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default BingoCard75;
