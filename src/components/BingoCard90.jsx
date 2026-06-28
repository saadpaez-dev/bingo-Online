import React from 'react';
import { Check } from 'lucide-react';

// Recibe un array plano de 15 números (sin nulls)
// Los muestra en una cuadrícula compacta de 5 columnas x 3 filas — sin espacios en blanco
const BingoCard90 = ({ grid, markedNumbers, toggleMark, calledNumbers }) => {
  if (!grid || grid.length !== 15) return null;

  // Encabezados de columna con gradientes
  const headers = ['1-18', '19-36', '37-54', '55-72', '73-90'];
  const colColors = [
    'linear-gradient(135deg, #3b82f6, #2563eb)', // Blue
    'linear-gradient(135deg, #ef4444, #dc2626)', // Red
    'linear-gradient(135deg, #f59e0b, #d97706)', // Yellow
    'linear-gradient(135deg, #10b981, #059669)', // Green
    'linear-gradient(135deg, #8b5cf6, #7c3aed)', // Purple
  ];
  const solidColors = ['#2563eb', '#dc2626', '#d97706', '#059669', '#7c3aed']; // Para los bordes y sombras

  // Dividir en 3 filas de 5
  const rows = [
    grid.slice(0, 5),
    grid.slice(5, 10),
    grid.slice(10, 15),
  ];

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
            fontWeight: 'bold',
            fontSize: '0.8rem',
            textAlign: 'center',
            padding: '0.5rem 0.1rem',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}>
            {h}
          </div>
        ))}
      </div>

      {/* Filas del cartón */}
      {rows.map((row, rIndex) => (
        <div key={rIndex} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}>
          {row.map((cellValue, cIndex) => {
            const isMarked = markedNumbers.has(cellValue);
            const isCalled = calledNumbers.includes(cellValue) && !isMarked;
            const gradColor = colColors[cIndex];
            const solColor = solidColors[cIndex];

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
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  
                  // Styling
                  background: isMarked ? gradColor : isCalled ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card)',
                  color: isMarked ? 'white' : 'var(--text-main)',
                  border: isMarked ? 'none' : isCalled ? '3px solid #10b981' : '2px solid var(--border-color)',
                  boxShadow: isMarked ? `0 8px 15px ${solColor}55` : 'none',
                  transform: isMarked ? 'scale(1.05)' : 'scale(1)',
                  zIndex: isMarked ? 10 : 1,
                  overflow: 'hidden'
                }}
              >
                <span>{cellValue}</span>
                
                {isMarked && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'rgba(255,255,255,0.2)', 
                  }}>
                     <Check size={40} strokeWidth={4} />
                  </div>
                )}
                
                {isMarked && (
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
      <style>{`
        @keyframes shine {
          0% { left: -150%; top: -150%; }
          100% { left: 150%; top: 150%; }
        }
      `}</style>
    </div>
  );
};

export default BingoCard90;
