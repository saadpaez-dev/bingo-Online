import React from 'react';
import { Check } from 'lucide-react';

const BingoCard75 = ({ card, markedNumbers, toggleMark, calledNumbers }) => {
  if (!card) return null;

  const headers = ['B', 'I', 'N', 'G', 'O'];
  // Gradient colors for columns
  const colColors = [
    'linear-gradient(135deg, #3b82f6, #2563eb)', // Blue
    'linear-gradient(135deg, #ef4444, #dc2626)', // Red
    'linear-gradient(135deg, #f59e0b, #d97706)', // Yellow
    'linear-gradient(135deg, #10b981, #059669)', // Green
    'linear-gradient(135deg, #8b5cf6, #7c3aed)', // Purple
  ];
  
  // Transform columns into rows for easier rendering
  const rows = Array(5).fill(null).map(() => Array(5).fill(null));
  headers.forEach((h, colIndex) => {
    card[h].forEach((val, rowIndex) => {
      rows[rowIndex][colIndex] = val;
    });
  });

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', userSelect: 'none' }}>
      
      {/* Encabezados */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '0.5rem',
        marginBottom: '0.5rem',
      }}>
        {headers.map((h, i) => (
          <div key={h} style={{
            background: colColors[i],
            color: 'white',
            fontWeight: '800',
            fontSize: '1.5rem',
            textAlign: 'center',
            padding: '0.75rem 0',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            {h}
          </div>
        ))}
      </div>
      
      {/* Casillas */}
      {rows.map((row, rIndex) => (
        <div key={rIndex} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.5rem',
          marginBottom: '0.5rem',
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
                  borderRadius: '0.75rem',
                  fontWeight: '700',
                  fontSize: isFree ? '0.7rem' : '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  
                  // Styling based on state
                  backgroundColor: isFree ? '#FACC15' : isMarked ? '#22C55E' : isCalled ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-card)',
                  color: (isMarked || isFree) ? 'white' : 'var(--text-main)',
                  border: isFree ? '3px solid #EAB308' : isMarked ? 'none' : isCalled ? '3px solid #22C55E' : '2px solid var(--border-color)',
                  boxShadow: isFree ? '0 0 15px rgba(250, 204, 21, 0.5)' : isMarked ? '0 8px 15px rgba(34, 197, 94, 0.3)' : 'none',
                  transform: isMarked ? 'scale(1.05)' : 'scale(1)',
                  zIndex: isMarked ? 10 : 1,
                  overflow: 'hidden'
                }}
              >
                {/* Contenido de la casilla */}
                {isFree ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem', animation: 'starShine 2s infinite' }}>⭐</span>
                    <span style={{ marginTop: '2px', letterSpacing: '1px' }}>GRATIS</span>
                  </div>
                ) : (
                  <span>{cellValue}</span>
                )}

                {/* Check animado si está marcado (excepto en FREE) */}
                {isMarked && !isFree && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'rgba(255,255,255,0.2)', // Check muy tenue de fondo
                  }}>
                     <Check size={40} strokeWidth={4} />
                  </div>
                )}
                
                {/* Brillo diagonal animado cuando se marca */}
                {isMarked && !isFree && (
                  <div style={{
                    position: 'absolute',
                    top: '-50%',
                    left: '-50%',
                    width: '200%',
                    height: '200%',
                    background: 'linear-gradient(45deg, transparent, rgba(255,255,255,0.3), transparent)',
                    transform: 'rotate(45deg)',
                    animation: 'shine 0.5s ease-out forwards',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Estilos locales para las animaciones únicas del cartón */}
      <style>{`
        @keyframes shine {
          0% { left: -150%; top: -150%; }
          100% { left: 150%; top: 150%; }
        }
      `}</style>
    </div>
  );
};

export default BingoCard75;
