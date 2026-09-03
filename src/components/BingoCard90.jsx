import React from 'react';
import { Check } from 'lucide-react';

const BingoCard90 = ({ grid, markedNumbers, toggleMark, calledNumbers }) => {
  if (!grid || grid.length !== 15) return null;

  const headers = ['1-18', '19-36', '37-54', '55-72', '73-90'];
  
  // Placas de latón grabadas para columnas de 90 bolas
  const headerStyles = [
    'linear-gradient(180deg, #5C1D24 0%, #3F1015 100%)',
    'linear-gradient(180deg, #7E252D 0%, #4D1318 100%)',
    'linear-gradient(180deg, #8C6B23 0%, #573E11 100%)',
    'linear-gradient(180deg, #243526 0%, #152217 100%)',
    'linear-gradient(180deg, #4A2415 0%, #2A1208 100%)',
  ];

  // Dividir en 3 filas de 5
  const rows = [
    grid.slice(0, 5),
    grid.slice(5, 10),
    grid.slice(10, 15),
  ];

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

      {/* Encabezados de rangos */}
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
            fontWeight: '800',
            fontSize: '0.85rem',
            textAlign: 'center',
            padding: '0.5rem 0',
            borderRadius: '8px',
            border: '2px solid var(--gold-primary)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)',
            textShadow: '0 2px 3px rgba(0,0,0,0.8)'
          }}>
            {h}
          </div>
        ))}
      </div>

      {/* Filas del cartón (Fichas de Marfil/Madera) */}
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
            const isMarked = markedNumbers.has(cellValue);
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
                  fontSize: '1.45rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',

                  background: isMarked 
                    ? 'radial-gradient(circle at 35% 30%, #7E252D 0%, #5C1D24 65%, #380C11 100%)' 
                    : isCalled 
                    ? 'radial-gradient(circle at center, #FFF9EB 0%, #F5E9CC 100%)'
                    : 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #F7EEDB 65%, #EADBBE 100%)',
                  
                  color: isMarked ? 'var(--text-gold-emboss)' : '#2C1A0E',
                  
                  border: isMarked 
                    ? '2.5px solid var(--gold-primary)' 
                    : isCalled 
                    ? '2.5px solid var(--gold-brass)' 
                    : '2px solid #C4B18F',
                  
                  boxShadow: isMarked 
                    ? '0 6px 14px rgba(60, 16, 21, 0.6), inset 0 2px 4px rgba(255,255,255,0.3)' 
                    : isCalled 
                    ? '0 0 12px rgba(212, 175, 55, 0.65)' 
                    : '0 3px 6px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.8)',
                  
                  transform: isMarked ? 'scale(1.04)' : 'scale(1)',
                  textShadow: isMarked ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 0 rgba(255,255,255,0.6)'
                }}
              >
                <span>{cellValue}</span>

                {isMarked && (
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

export default BingoCard90;
