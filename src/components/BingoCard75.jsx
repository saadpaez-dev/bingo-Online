import React from 'react';
import { Check, Star } from 'lucide-react';
import { isCellInPattern } from '../utils/bingo';

// Billete de dólar estilo grabado vintage para partidas de pago
const VintageDollarBill = () => (
  <svg 
    viewBox="0 0 60 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ 
      width: '84%', 
      maxWidth: '48px', 
      height: 'auto',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
      animation: 'starPulse 2.5s infinite ease-in-out'
    }}
  >
    {/* Fondo del billete verde grabado con borde dorado */}
    <rect x="1" y="1" width="58" height="30" rx="3.5" fill="#173E20" stroke="#C59B27" strokeWidth="1.6" />
    <rect x="3.5" y="3.5" width="53" height="25" rx="2.5" fill="#204E2B" stroke="#77B886" strokeWidth="0.8" strokeDasharray="2 1" />
    
    {/* Motivos en las esquinas con mini signo $ */}
    <text x="6.5" y="9.5" fill="#FFF1C5" fontSize="5.5" fontWeight="900" fontFamily="serif" textAnchor="middle">$</text>
    <text x="53.5" y="9.5" fill="#FFF1C5" fontSize="5.5" fontWeight="900" fontFamily="serif" textAnchor="middle">$</text>
    <text x="6.5" y="27" fill="#FFF1C5" fontSize="5.5" fontWeight="900" fontFamily="serif" textAnchor="middle">$</text>
    <text x="53.5" y="27" fill="#FFF1C5" fontSize="5.5" fontWeight="900" fontFamily="serif" textAnchor="middle">$</text>
    
    {/* Medallón central grabado en relieve */}
    <ellipse cx="30" cy="16" rx="14.5" ry="10" fill="#12321A" stroke="#C59B27" strokeWidth="1.2" />
    <ellipse cx="30" cy="16" rx="12.5" ry="8" fill="#1B4525" stroke="#5EA46E" strokeWidth="0.7" />
    
    {/* Signo $ central en relieve de oro vintage */}
    <text 
      x="30" 
      y="21" 
      fill="#FFE082" 
      fontSize="14" 
      fontWeight="900" 
      fontFamily="serif" 
      textAnchor="middle"
      style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.85))' }}
    >
      $
    </text>
  </svg>
);

const BingoCard75 = ({ card, markedNumbers, toggleMark, calledNumbers, winningPattern = 'full', showPatternGuide = false, paymentMode = false }) => {
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
      padding: 'clamp(0.6rem, 2.5vw, 1.25rem)',
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
        gap: 'clamp(0.25rem, 1.2vw, 0.45rem)',
        marginBottom: 'clamp(0.3rem, 1.3vw, 0.55rem)',
        position: 'relative',
        zIndex: 2
      }}>
        {headers.map((h, i) => (
          <div key={h} style={{
            background: headerStyles[i],
            color: 'var(--text-gold-emboss)',
            fontFamily: 'var(--font-serif)',
            fontWeight: '900',
            fontSize: 'clamp(1.2rem, 3.8vw, 1.6rem)',
            textAlign: 'center',
            padding: 'clamp(0.35rem, 1.5vw, 0.6rem) 0',
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
          gap: 'clamp(0.25rem, 1.2vw, 0.45rem)',
          marginBottom: 'clamp(0.25rem, 1.2vw, 0.45rem)',
          position: 'relative',
          zIndex: 2
        }}>
          {row.map((cellValue, cIndex) => {
            const isFree = cellValue === 'FREE';
            const numVal = isFree ? 'FREE' : Number(cellValue);
            const isMarked = markedNumbers.has(cellValue) || markedNumbers.has(numVal) || isFree;
            const isCalled = (calledNumbers.includes(cellValue) || calledNumbers.includes(numVal)) && !isMarked;
            const inPattern = isCellInPattern(winningPattern, rIndex, cIndex);
            const isPatternActive = showPatternGuide && winningPattern && winningPattern !== 'full';
            
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
                  fontSize: isFree ? 'clamp(0.65rem, 2vw, 0.75rem)' : 'clamp(1.1rem, 3.6vw, 1.45rem)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: (!isPatternActive || inPattern || isMarked || isCalled) ? 1 : 0.65,
                  
                  // Ficha sin marcar vs marcada (Sello de cera burdeos)
                  background: isFree 
                    ? 'radial-gradient(circle at 35% 30%, #E6BE57 0%, #C59B27 60%, #8C6B23 100%)'
                    : isMarked 
                    ? 'radial-gradient(circle at 35% 30%, #7E252D 0%, #5C1D24 65%, #380C11 100%)' 
                    : isCalled 
                    ? 'radial-gradient(circle at center, #FFF9EB 0%, #F5E9CC 100%)'
                    : inPattern && isPatternActive
                    ? 'radial-gradient(circle at 35% 35%, #FFFDF5 0%, #FDF4DE 65%, #F4E2BD 100%)'
                    : 'radial-gradient(circle at 35% 35%, #FFFFFF 0%, #F7EEDB 65%, #EADBBE 100%)',
                  
                  color: (isMarked || isFree) ? 'var(--text-gold-emboss)' : '#2C1A0E',
                  
                  border: isFree 
                    ? (paymentMode ? '2px solid #173E20' : '2px solid #573E11')
                    : isMarked 
                    ? '2.5px solid var(--gold-primary)' 
                    : isCalled 
                    ? '2.5px solid var(--gold-brass)' 
                    : (inPattern && isPatternActive)
                    ? '2.5px solid #D4AF37'
                    : '2px solid #C4B18F',
                  
                  boxShadow: isFree 
                    ? (paymentMode 
                        ? '0 4px 10px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.6)' 
                        : '0 4px 10px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,255,255,0.5)')
                    : isMarked 
                    ? '0 6px 14px rgba(60, 16, 21, 0.6), inset 0 2px 4px rgba(255,255,255,0.3)' 
                    : isCalled 
                    ? '0 0 12px rgba(212, 175, 55, 0.65)' 
                    : (inPattern && isPatternActive)
                    ? '0 0 9px rgba(212, 175, 55, 0.5), inset 0 1px 1px rgba(255,255,255,0.8)'
                    : '0 3px 6px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.8)',
                  
                  transform: isMarked ? 'scale(1.04)' : (inPattern && isPatternActive) ? 'scale(1.02)' : 'scale(1)',
                  textShadow: (isMarked || isFree) ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 0 rgba(255,255,255,0.6)'
                }}
              >
                {/* Casilla Central GRATIS (Modo Tradicional) o BILLETE DE DÓLAR (Modo Pago) */}
                {isFree ? (
                  paymentMode ? (
                    <div 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%'
                      }}
                      title="Casilla comodín (Partida de Pago)"
                    >
                      <VintageDollarBill />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.1' }}>
                      <Star size={20} fill="#FFF1C5" color="#573E11" style={{ animation: 'starPulse 2s infinite' }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: '900', letterSpacing: '1px', marginTop: '2px', color: '#3A2006' }}>GRATIS</span>
                    </div>
                  )
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
