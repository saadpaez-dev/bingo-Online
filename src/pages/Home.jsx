import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db, loginAnonymously } from '../firebase';
import { Play, Sparkles } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

// Filigrana barroca ornamental para las esquinas de la tarjeta
const FiligreeCorner = ({ position }) => (
  <svg 
    className={`filigree-corner ${position}`} 
    viewBox="0 0 60 60" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M5 5 C 18 5, 32 10, 42 22 C 34 22, 28 28, 28 36 C 20 28, 14 18, 5 14 Z" 
      fill="#C59B27" 
      opacity="0.85" 
    />
    <path 
      d="M5 5 L 5 45 C 8 36, 14 30, 20 22 C 28 14, 36 8, 48 5 Z" 
      stroke="#8C6B23" 
      strokeWidth="2" 
      fill="none" 
    />
    <path 
      d="M12 12 C 18 12, 24 16, 28 22 C 22 22, 18 26, 18 32 C 14 26, 12 20, 12 12 Z" 
      fill="#E6BE57" 
    />
    <circle cx="16" cy="16" r="3.5" fill="#D4AF37" stroke="#573E11" strokeWidth="1" />
    <circle cx="28" cy="8" r="2" fill="#D4AF37" />
    <circle cx="8" cy="28" r="2" fill="#D4AF37" />
  </svg>
);

// Separador de cuentas de ábaco con varilla de bronce
const AbacusDivider = () => {
  const beadSizes = [
    'small', 'small', 'medium', 'medium', 'medium', 
    'medium', 'medium', 'large', 
    'medium', 'medium', 'medium', 'medium', 'medium', 
    'small', 'small'
  ];

  return (
    <div className="vintage-abacus-divider">
      <div className="vintage-abacus-beads">
        {beadSizes.map((size, idx) => (
          <div key={idx} className={`abacus-bead ${size}`} />
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  const [gameMode, setGameMode] = useState(75);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { playSound } = useSettings();

  const generateGameId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateGame = async () => {
    playSound('pop');
    setLoading(true);
    try {
      const user = await loginAnonymously();
      const gameId = generateGameId();
      
      await setDoc(doc(db, "games", gameId), {
        hostId: user.uid,
        status: 'waiting',
        mode: gameMode,
        calledNumbers: [],
        createdAt: new Date().toISOString()
      });

      navigate(`/host/${gameId}`);
    } catch (error) {
      console.error("Error creating game", error);
      let msg = error?.message || "Error desconocido";
      if (msg.includes("permission") || msg.includes("permissions") || error?.code === "permission-denied") {
        alert("⚠️ Error de Permisos en la Base de Datos:\nLas reglas de prueba de Firebase Firestore expiraron. Debes ingresar a console.firebase.google.com -> Firestore Database -> pestaña Reglas y actualizarlas.");
      } else {
        alert(`Hubo un error al crear la partida:\n${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = (e) => {
    e.preventDefault();
    if (joinCode.trim().length > 0) {
      playSound('pop');
      navigate(`/play/${joinCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
      
      {/* TARJETA DE PERGAMINO VINTAGE */}
      <div className="vintage-parchment-card animate-pop">
        
        {/* Filigranas doradas barrocas en las 4 esquinas */}
        <FiligreeCorner position="top-left" />
        <FiligreeCorner position="top-right" />
        <FiligreeCorner position="bottom-left" />
        <FiligreeCorner position="bottom-right" />

        {/* Medallón central superior en oro y esmalte burdeos */}
        <div className="vintage-medallion">
          <svg className="vintage-medallion-star" width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 L14 9 L21 11 L15 15 L17 22 L12 18 L7 22 L9 15 L3 11 L10 9 Z" />
          </svg>
        </div>

        {/* Título Principal */}
        <div className="vintage-title-container">
          <div>
            <span className="vintage-title-bingo">Bingo</span>
            <span className="vintage-title-familiar">Familiar</span>
          </div>
          <p className="vintage-subtitle">La mejor experiencia multijugador en tiempo real</p>
        </div>

        {/* SECCIÓN CREAR PARTIDA */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="vintage-section-header">
            {/* Icono de engranajes dorados */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C59B27" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="vintage-section-icon">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Crear Partida</span>
          </div>

          {/* Bolas 3D de madera tallada (75 & 90) */}
          <div className="vintage-balls-selector">
            
            {/* Bola 75 */}
            <div 
              className={`vintage-ball-wrapper ${gameMode === 75 ? 'active' : ''}`}
              onClick={() => { setGameMode(75); playSound('draw'); }}
            >
              <div className="vintage-wood-sphere">
                <span className="vintage-wood-number">75</span>
              </div>
              <div className="vintage-brass-plaque">
                Bolas (Letras)
              </div>
            </div>

            {/* Bola 90 */}
            <div 
              className={`vintage-ball-wrapper ${gameMode === 90 ? 'active' : ''}`}
              onClick={() => { setGameMode(90); playSound('draw'); }}
            >
              <div className="vintage-wood-sphere">
                <span className="vintage-wood-number">90</span>
              </div>
              <div className="vintage-brass-plaque">
                Bolas (Cartón)
              </div>
            </div>

          </div>

          {/* Botón 3D Burdeos Imperial */}
          <button 
            className="btn-vintage-burgundy"
            onClick={handleCreateGame}
            disabled={loading}
          >
            {loading ? 'Preparando sala...' : 'Crear Sala Ahora'}
          </button>
        </div>

        {/* Separador de Cuentas de Ábaco */}
        <AbacusDivider />

        {/* SECCIÓN UNIRSE CON CÓDIGO */}
        <div style={{ marginTop: '1.25rem' }}>
          <div className="vintage-section-header" style={{ marginBottom: '1rem' }}>
            {/* Florón decorativo */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#5C1D24" stroke="#C59B27" strokeWidth="1.5" className="vintage-section-icon">
              <circle cx="12" cy="7" r="4" />
              <circle cx="12" cy="17" r="4" />
              <circle cx="7" cy="12" r="4" />
              <circle cx="17" cy="12" r="4" />
              <circle cx="12" cy="12" r="2.5" fill="#D4AF37" />
            </svg>
            <span>Unirse con Código</span>
          </div>

          {/* Formulario con ventanilla de latón */}
          <form onSubmit={handleJoinGame} className="vintage-code-slot-container">
            <div className="vintage-brass-slot">
              {/* 4 tornillos en esquinas */}
              <div className="slot-screw tl" />
              <div className="slot-screw tr" />
              <div className="slot-screw bl" />
              <div className="slot-screw br" />

              {/* Ventanilla interior con papel estarcido */}
              <div className="vintage-slot-window">
                <input 
                  type="text" 
                  className="vintage-slot-input" 
                  placeholder="EJ: GG2LYX" 
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-secondary" 
              style={{ 
                padding: '0.75rem 2rem', 
                fontSize: '1.05rem',
                fontFamily: 'var(--font-serif)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Entrar a Jugar <Play size={16} />
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};

export default Home;
