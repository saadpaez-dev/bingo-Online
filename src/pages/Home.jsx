import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, onSnapshot, collection, query, where, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, loginAnonymously } from '../firebase';
import { Play, Trophy, Coins, DollarSign, ChevronDown, ChevronUp, Eye, Crown, Radio, Shield, Power } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import bgTable from '../assets/bg-table.jpg';

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

  // Ajustes de Torneo y Modalidad de Pago
  const [showAdvancedRules, setShowAdvancedRules] = useState(false);
  const [targetWins, setTargetWins] = useState(3);
  const [paymentMode, setPaymentMode] = useState(false);
  const [cardPrice, setCardPrice] = useState('$5.000 COP');
  const [prizeType, setPrizeType] = useState('chips'); // 'chips' | 'cash'

  // Sala activa del Anfitrión (Reconexión rápida), Partida de Jugador y Salas Públicas en vivo
  const [activeHostGame, setActiveHostGame] = useState(null);
  const [hostPlayers, setHostPlayers] = useState([]);
  const [activePlayerGame, setActivePlayerGame] = useState(null);
  const [playerGamePlayers, setPlayerGamePlayers] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);

  // Modo Super Administrador (SAAD.PAEZ)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => localStorage.getItem('bingo_admin_auth') === 'true');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [showAdminConfirmAllModal, setShowAdminConfirmAllModal] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  const navigate = useNavigate();
  const { playSound } = useSettings();

  const isPlayerOnline = (p) => {
    if (!p) return false;
    if (p.isOnline === false) return false;
    if (p.lastSeen && (Date.now() - p.lastSeen > 40000)) return false;
    return true;
  };

  const hostOnlineCount = hostPlayers.filter(isPlayerOnline).length;
  const playerGameOnlineCount = playerGamePlayers.filter(isPlayerOnline).length;

  // 1. Escuchar la sala activa del Anfitrión y sus jugadores
  useEffect(() => {
    const savedHostGameId = localStorage.getItem('bingo_dealer_active_game');
    if (!savedHostGameId) {
      setActiveHostGame(null);
      setHostPlayers([]);
      return;
    }

    const unsubGame = onSnapshot(doc(db, 'games', savedHostGameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status !== 'archived' && data.status !== 'closed') {
          setActiveHostGame({ id: savedHostGameId, ...data });
        } else {
          setActiveHostGame(null);
          setHostPlayers([]);
          localStorage.removeItem('bingo_dealer_active_game');
        }
      } else {
        setActiveHostGame(null);
        setHostPlayers([]);
        localStorage.removeItem('bingo_dealer_active_game');
      }
    }, (err) => {
      console.warn('Error verificando sala de anfitrión:', err);
    });

    const unsubPlayers = onSnapshot(collection(db, 'games', savedHostGameId, 'players'), (snap) => {
      const pData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHostPlayers(pData);
    }, (err) => {
      console.warn('Error cargando jugadores del anfitrión:', err);
    });

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, []);

  // 1.1 Escuchar la partida activa de Jugador y sus jugadores
  useEffect(() => {
    const savedPlayerGameId = localStorage.getItem('bingo_player_active_game');
    const savedHostGameId = localStorage.getItem('bingo_dealer_active_game');

    // Si ya somos el anfitrión de esta misma sala, no mostramos el banner duplicado
    if (!savedPlayerGameId || savedPlayerGameId === savedHostGameId) {
      setActivePlayerGame(null);
      setPlayerGamePlayers([]);
      return;
    }

    const unsubGame = onSnapshot(doc(db, 'games', savedPlayerGameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status !== 'archived' && data.status !== 'closed') {
          setActivePlayerGame({ id: savedPlayerGameId, ...data });
        } else {
          setActivePlayerGame(null);
          setPlayerGamePlayers([]);
          localStorage.removeItem('bingo_player_active_game');
        }
      } else {
        setActivePlayerGame(null);
        setPlayerGamePlayers([]);
        localStorage.removeItem('bingo_player_active_game');
      }
    }, (err) => {
      console.warn('Error verificando partida de jugador:', err);
    });

    const unsubPlayers = onSnapshot(collection(db, 'games', savedPlayerGameId, 'players'), (snap) => {
      const pData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlayerGamePlayers(pData);
    }, (err) => {
      console.warn('Error cargando jugadores de la sala del jugador:', err);
    });

    return () => {
      unsubGame();
      unsubPlayers();
    };
  }, [activeHostGame]);

  // 2. Escuchar salas abiertas en vivo en Firestore
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'games'),
        where('status', 'in', ['waiting', 'playing']),
        limit(50)
      );
      const unsubRooms = onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        rooms.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setActiveRooms(rooms);
      }, (err) => {
        console.warn('Error cargando salas en vivo:', err);
      });

      return () => unsubRooms();
    } catch (err) {
      console.warn('Error en listener de salas:', err);
    }
  }, []);

  // Controladores de Super Administrador (SAAD.PAEZ)
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminUsername.trim().toUpperCase() === 'SAAD.PAEZ' && adminPassword === 'SAAD2026!') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('bingo_admin_auth', 'true');
      setShowAdminLoginModal(false);
      setAdminLoginError('');
      setAdminUsername('');
      setAdminPassword('');
      playSound('win');
    } else {
      setAdminLoginError('Usuario o contraseña incorrectos.');
      playSound('pop');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('bingo_admin_auth');
    playSound('pop');
  };

  const handleAdminCloseRoom = async (roomId) => {
    try {
      await updateDoc(doc(db, 'games', roomId), {
        status: 'closed',
        closedAt: serverTimestamp(),
        closedBy: 'admin'
      });
      playSound('pop');
    } catch (err) {
      console.error('Error cerrando sala por admin:', err);
    }
  };

  const handleAdminCloseAllRooms = async () => {
    setAdminActionLoading(true);
    try {
      const promises = activeRooms.map(r => 
        updateDoc(doc(db, 'games', r.id), {
          status: 'closed',
          closedAt: serverTimestamp(),
          closedBy: 'admin'
        })
      );
      await Promise.all(promises);
      setShowAdminConfirmAllModal(false);
      playSound('win');
    } catch (err) {
      console.error('Error cerrando todas las salas:', err);
    } finally {
      setAdminActionLoading(false);
    }
  };

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
        targetWins: Number(targetWins) || 3,
        paymentMode: !!paymentMode,
        cardPrice: paymentMode ? cardPrice : 'Gratis',
        prizeType: prizeType,
        currentRound: 1,
        calledNumbers: [],
        createdAt: new Date().toISOString()
      });

      localStorage.setItem('bingo_dealer_active_game', gameId);
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
    <div 
      className="home-page-wrapper"
      style={{
        backgroundImage: `radial-gradient(ellipse at center, rgba(30, 12, 6, 0.4) 0%, rgba(10, 4, 2, 0.75) 100%), url(${bgTable})`
      }}
    >
      
      {/* TARJETA DE PERGAMINO VINTAGE */}
      <div className="vintage-parchment-card animate-pop">
        
        <FiligreeCorner position="top-left" />
        <FiligreeCorner position="top-right" />
        <FiligreeCorner position="bottom-left" />
        <FiligreeCorner position="bottom-right" />

        {/* Acceso y Estado de Super Administrador (SAAD.PAEZ) */}
        <div style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 10 }}>
          {isAdminLoggedIn ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'linear-gradient(180deg, #5C1D24 0%, #3D1015 100%)',
              border: '1.5px solid var(--gold-primary)',
              borderRadius: '20px',
              padding: '4px 10px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
            }}>
              <Shield size={13} color="#F6D58E" />
              <span style={{ fontSize: '0.72rem', color: '#F6D58E', fontWeight: '800', fontFamily: 'var(--font-serif)', letterSpacing: '0.5px' }}>
                SAAD.PAEZ
              </span>
              <button
                type="button"
                onClick={handleAdminLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFB8B8',
                  fontSize: '0.68rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '0 2px'
                }}
                title="Cerrar sesión de Administrador"
              >
                Salir
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setShowAdminLoginModal(true); playSound('pop'); }}
              style={{
                background: 'rgba(255, 255, 255, 0.75)',
                border: '1px solid #C4B18F',
                borderRadius: '16px',
                padding: '3px 8px',
                fontSize: '0.68rem',
                color: '#5C1D24',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '700',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
              title="Acceso de Administrador para gestionar salas"
            >
              <Shield size={12} /> Admin
            </button>
          )}
        </div>

        {/* Medallón central */}
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

        {/* AVISO DESTACADO DE REANUDAR MESA SI EL DEALER SALIÓ AL INICIO */}
        {activeHostGame && (
          <div className="animate-pop" style={{
            background: 'linear-gradient(180deg, #FFFDF8 0%, #FAF0DA 100%)',
            border: '2px solid var(--gold-primary)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            gap: '0.65rem',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #7E252D 0%, #3F1015 100%)',
                border: '2px solid var(--gold-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}>
                👑
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-vintage-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Tu Sala como Anfitrión
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: '900', color: 'var(--burgundy-primary)', lineHeight: 1.1 }}>
                  Sala {activeHostGame.id}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#1B5E20', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                  <span>● {activeHostGame.status === 'playing' ? `En Juego (Ronda ${activeHostGame.currentRound || 1})` : 'Mesa en Espera'}</span>
                  <span>•</span>
                  <span style={{ color: '#854D0E', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    👥 {hostOnlineCount} {hostOnlineCount === 1 ? 'jugador conectado' : 'jugadores conectados'}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => navigate(`/host/${activeHostGame.id}`)}
                className="btn-vintage-burgundy"
                style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
              >
                <Play size={14} /> Volver a la Mesa
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('bingo_dealer_active_game');
                  setActiveHostGame(null);
                  setHostPlayers([]);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-vintage-muted)', padding: '0.2rem 0.4rem', fontSize: '1.1rem' }}
                title="Descartar aviso de sala"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* AVISO DESTACADO DE REANUDAR PARTIDA SI EL JUGADOR SALIÓ AL INICIO */}
        {activePlayerGame && !activeHostGame && (
          <div className="animate-pop" style={{
            background: 'linear-gradient(180deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '2px solid #2E7D32',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            gap: '0.65rem',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #2E7D32 0%, #14532D 100%)',
                border: '2px solid var(--gold-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}>
                🎟️
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#166534', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  Tu Cartón / Partida en Curso
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: '900', color: '#14532D', lineHeight: 1.1 }}>
                  Sala {activePlayerGame.id}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#15803D', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                  <span>● {activePlayerGame.status === 'playing' ? `En Juego (Ronda ${activePlayerGame.currentRound || 1})` : 'Mesa en Espera'}</span>
                  <span>•</span>
                  <span style={{ color: '#854D0E', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    👥 {playerGameOnlineCount} {playerGameOnlineCount === 1 ? 'jugador conectado' : 'jugadores conectados'}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => navigate(`/play/${activePlayerGame.id}`)}
                className="btn-vintage-burgundy"
                style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', backgroundColor: '#15803D' }}
              >
                <Play size={14} /> Volver a mi Cartón
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('bingo_player_active_game');
                  setActivePlayerGame(null);
                  setPlayerGamePlayers([]);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', padding: '0.2rem 0.4rem', fontSize: '1.1rem' }}
                title="Descartar aviso"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* SECCIÓN CREAR PARTIDA */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="vintage-section-header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C59B27" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="vintage-section-icon">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Crear Partida</span>
          </div>

          {/* Bolas 3D de madera tallada (75 & 90) */}
          <div className="vintage-balls-selector">
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

          {/* Opciones de Torneo y Pago (Expandible) */}
          <div style={{ marginBottom: '1.25rem', padding: '0 0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAdvancedRules(prev => !prev)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--burgundy-primary)',
                fontFamily: 'var(--font-serif)',
                fontWeight: '800',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                textDecoration: 'underline'
              }}
            >
              <Trophy size={16} />
              {showAdvancedRules ? 'Ocultar Reglas de Torneo & Pago' : '⚙️ Configurar Torneo & Modalidad de Pago'}
              {showAdvancedRules ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvancedRules && (
              <div 
                className="animate-pop"
                style={{
                  marginTop: '0.75rem',
                  padding: '1rem',
                  borderRadius: '10px',
                  background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)',
                  border: '1.5px solid var(--gold-brass)',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                {/* Meta de Victorias */}
                <div>
                  <label style={{ fontFamily: 'var(--font-serif)', fontSize: '0.82rem', fontWeight: '800', color: '#2C1A0E', display: 'block', marginBottom: '0.3rem' }}>
                    🏆 Meta del Torneo (El primero que gane):
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {[
                      { val: 1, label: '1 Ronda' },
                      { val: 3, label: '3 Rondas (Torneo)' },
                      { val: 5, label: '5 Rondas (Gran Final)' }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setTargetWins(opt.val)}
                        style={{
                          flex: 1,
                          padding: '0.4rem 0.2rem',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-serif)',
                          fontWeight: '800',
                          borderRadius: '6px',
                          border: targetWins === opt.val ? '2px solid var(--burgundy-primary)' : '1px solid #C4B18F',
                          backgroundColor: targetWins === opt.val ? 'var(--burgundy-primary)' : '#FFF',
                          color: targetWins === opt.val ? 'var(--text-gold-emboss)' : '#2C1A0E',
                          cursor: 'pointer'
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modalidad de Pago */}
                <div>
                  <label style={{ fontFamily: 'var(--font-serif)', fontSize: '0.82rem', fontWeight: '800', color: '#2C1A0E', display: 'block', marginBottom: '0.3rem' }}>
                    🪙 Modalidad de Entrada:
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => { setPaymentMode(false); setPrizeType('chips'); }}
                      style={{
                        flex: 1,
                        padding: '0.45rem',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '800',
                        borderRadius: '6px',
                        border: !paymentMode ? '2px solid var(--burgundy-primary)' : '1px solid #C4B18F',
                        backgroundColor: !paymentMode ? 'var(--burgundy-primary)' : '#FFF',
                        color: !paymentMode ? 'var(--text-gold-emboss)' : '#2C1A0E',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Coins size={15} /> Fichas de Casino (Gratis)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentMode(true); setPrizeType('cash'); }}
                      style={{
                        flex: 1,
                        padding: '0.45rem',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-serif)',
                        fontWeight: '800',
                        borderRadius: '6px',
                        border: paymentMode ? '2px solid var(--burgundy-primary)' : '1px solid #C4B18F',
                        backgroundColor: paymentMode ? 'var(--burgundy-primary)' : '#FFF',
                        color: paymentMode ? 'var(--text-gold-emboss)' : '#2C1A0E',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <DollarSign size={15} /> De Pago (Torneo)
                    </button>
                  </div>
                </div>

                {/* Valor del Torneo (si es de pago) */}
                {paymentMode && (
                  <div className="animate-pop">
                    <label style={{ fontFamily: 'var(--font-serif)', fontSize: '0.8rem', fontWeight: '800', color: '#2C1A0E', display: 'block', marginBottom: '0.2rem' }}>
                      🏆 Valor de Inscripción al Torneo:
                    </label>
                    <input
                      type="text"
                      value={cardPrice}
                      onChange={e => setCardPrice(e.target.value)}
                      placeholder="Ej: $10.000 COP o $20 USD por jugador"
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.85rem',
                        borderRadius: '6px',
                        border: '1.5px solid var(--gold-brass)',
                        backgroundColor: '#FFF',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: '700'
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic', marginTop: '0.2rem', display: 'block' }}>
                      * Pago único por jugador para participar en todas las rondas del torneo. El acceso quedará bloqueado hasta que reporten el pago y tú lo apruebes.
                    </span>
                  </div>
                )}
              </div>
            )}
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#5C1D24" stroke="#C59B27" strokeWidth="1.5" className="vintage-section-icon">
              <circle cx="12" cy="7" r="4" />
              <circle cx="12" cy="17" r="4" />
              <circle cx="7" cy="12" r="4" />
              <circle cx="17" cy="12" r="4" />
              <circle cx="12" cy="12" r="2.5" fill="#D4AF37" />
            </svg>
            <span>Unirse con Código</span>
          </div>

          <form onSubmit={handleJoinGame} className="vintage-code-slot-container">
            <div className="vintage-brass-slot">
              <div className="slot-screw tl" />
              <div className="slot-screw tr" />
              <div className="slot-screw bl" />
              <div className="slot-screw br" />

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

        {/* SECCIÓN DE MESAS ABIERTAS EN VIVO */}
        {(activeRooms.length > 0 || isAdminLoggedIn) && (
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <AbacusDivider />
            
            <div className="vintage-section-header" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              <Radio size={20} color="#C59B27" />
              <span>Mesas en Vivo ({activeRooms.length})</span>
            </div>
            
            {/* Panel de Control Super Administrador (SAAD.PAEZ) */}
            {isAdminLoggedIn && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(92, 29, 36, 0.08) 0%, rgba(197, 155, 39, 0.12) 100%)',
                border: '1.5px dashed var(--gold-primary)',
                borderRadius: '8px',
                padding: '0.6rem 0.85rem',
                marginBottom: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textAlign: 'left' }}>
                  <Shield size={16} color="var(--burgundy-primary)" />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--burgundy-primary)' }}>
                      Super Admin: SAAD.PAEZ
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-vintage-muted)' }}>
                      {activeRooms.length === 0 ? 'Sin salas abiertas activas' : `${activeRooms.length} salas abiertas activas en el sistema`}
                    </div>
                  </div>
                </div>

                {activeRooms.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { setShowAdminConfirmAllModal(true); playSound('pop'); }}
                    className="btn-vintage-burgundy"
                    style={{
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backgroundColor: '#8B1E26'
                    }}
                  >
                    <Power size={13} /> Cerrar Todas las Salas
                  </button>
                )}
              </div>
            )}

            {activeRooms.length === 0 && isAdminLoggedIn && (
              <div style={{
                padding: '1rem',
                background: 'rgba(46, 125, 50, 0.08)',
                border: '1px solid #2E7D32',
                borderRadius: '8px',
                color: '#2E7D32',
                fontSize: '0.85rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <span>✓</span> Todas las salas han sido cerradas. Historial limpio.
              </div>
            )}

            {activeRooms.length > 0 && (
              <>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-vintage-muted)', fontStyle: 'italic', marginBottom: '0.85rem' }}>
                  Salas abiertas para jugar o entrar a observar en tiempo real:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                  {activeRooms.map((room) => {
                    const isHost = activeHostGame?.id === room.id;
                    const isPlaying = room.status === 'playing';

                    return (
                      <div
                        key={room.id}
                        style={{
                          background: '#FFFDF9',
                          border: isHost ? '2px solid var(--gold-primary)' : '1.5px solid var(--gold-brass)',
                          borderRadius: '8px',
                          padding: '0.65rem 0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        {/* Información de la Sala */}
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '900', fontSize: '1.1rem', color: 'var(--burgundy-primary)' }}>
                              Sala {room.id}
                            </span>
                            <span style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              backgroundColor: isPlaying ? '#2E7D32' : '#F59E0B',
                              color: '#fff',
                              fontWeight: 'bold'
                            }}>
                              {isPlaying ? '● En Juego' : 'Esperando'}
                            </span>
                            {isHost && (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 'bold' }}>
                                👑 Tu Sala
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-vintage-muted)' }}>
                            {room.mode} Bolas • {room.paymentMode ? `Torneo (${room.cardPrice})` : 'Fichas Gratis'}
                          </div>
                        </div>

                        {/* Botones de Acción */}
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {isHost ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/host/${room.id}`)}
                              className="btn-vintage-burgundy"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <Crown size={14} /> Gestionar
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => navigate(`/play/${room.id}`)}
                                className="btn-vintage-burgundy"
                                style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <Play size={13} /> Jugar
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate(`/play/${room.id}?role=spectator`)}
                                className="vintage-brass-plaque"
                                style={{ margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                title="Entrar solo a observar en vivo"
                              >
                                <Eye size={13} /> Observar
                              </button>
                            </>
                          )}

                          {/* Botón de Clausura para Super Admin */}
                          {isAdminLoggedIn && (
                            <button
                              type="button"
                              onClick={() => handleAdminCloseRoom(room.id)}
                              style={{
                                background: '#7F1D1D',
                                color: '#FEE2E2',
                                border: '1px solid #991B1B',
                                borderRadius: '6px',
                                padding: '0.42rem 0.65rem',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                                transition: 'all 0.15s ease'
                              }}
                              title="Cerrar esta sala (Super Admin)"
                            >
                              <Power size={12} /> Cerrar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* MODAL DE INICIO DE SESIÓN SUPER ADMINISTRADOR */}
      {showAdminLoginModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 4, 2, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          backdropFilter: 'blur(5px)'
        }}>
          <div className="vintage-parchment-card animate-pop text-center" style={{
            maxWidth: '420px',
            width: '100%',
            padding: '2.5rem 2rem',
            position: 'relative'
          }}>
            <FiligreeCorner position="top-left" />
            <FiligreeCorner position="top-right" />
            <FiligreeCorner position="bottom-left" />
            <FiligreeCorner position="bottom-right" />

            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              background: 'radial-gradient(circle at 35% 30%, #8b2834 0%, var(--burgundy-primary) 60%, var(--burgundy-dark) 100%)',
              border: '3px solid var(--gold-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: '0 6px 14px rgba(0,0,0,0.35)'
            }}>
              🛡️
            </div>

            <h2 style={{
              fontFamily: 'var(--font-serif)',
              color: 'var(--burgundy-primary)',
              fontSize: '1.4rem',
              fontWeight: '900',
              marginBottom: '0.4rem',
              letterSpacing: '0.5px'
            }}>
              Acceso Administrador
            </h2>
            
            <p style={{
              fontSize: '0.85rem',
              color: '#3E2415',
              marginBottom: '1.25rem',
              lineHeight: '1.4'
            }}>
              Ingresa tus credenciales para administrar y limpiar el historial de salas en vivo.
            </p>

            <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: 'var(--burgundy-primary)', marginBottom: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                  Usuario:
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Ej: SAAD.PAEZ"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.95rem',
                    borderRadius: '6px',
                    border: '1.5px solid var(--gold-brass)',
                    backgroundColor: '#FFF',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '700'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: 'var(--burgundy-primary)', marginBottom: '0.25rem', fontFamily: 'var(--font-serif)' }}>
                  Contraseña:
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.95rem',
                    borderRadius: '6px',
                    border: '1.5px solid var(--gold-brass)',
                    backgroundColor: '#FFF',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              {adminLoginError && (
                <div style={{
                  padding: '0.4rem 0.6rem',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #EF4444',
                  borderRadius: '5px',
                  color: '#B91C1C',
                  fontSize: '0.78rem',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}>
                  {adminLoginError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    setAdminLoginError('');
                    playSound('pop');
                  }}
                  className="vintage-brass-plaque"
                  style={{ flex: 1, margin: 0, padding: '0.65rem', fontSize: '0.88rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-vintage-burgundy"
                  style={{ flex: 1, margin: 0, padding: '0.65rem', fontSize: '0.88rem' }}
                >
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA CERRAR TODAS LAS SALAS */}
      {showAdminConfirmAllModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 4, 2, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          backdropFilter: 'blur(5px)'
        }}>
          <div className="vintage-parchment-card animate-pop text-center" style={{
            maxWidth: '440px',
            width: '100%',
            padding: '2.5rem 2rem',
            position: 'relative'
          }}>
            <FiligreeCorner position="top-left" />
            <FiligreeCorner position="top-right" />
            <FiligreeCorner position="bottom-left" />
            <FiligreeCorner position="bottom-right" />

            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              background: 'radial-gradient(circle at 35% 30%, #8b2834 0%, var(--burgundy-primary) 60%, var(--burgundy-dark) 100%)',
              border: '3px solid var(--gold-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              boxShadow: '0 6px 14px rgba(0,0,0,0.35)'
            }}>
              ⚠️
            </div>

            <h2 style={{
              fontFamily: 'var(--font-serif)',
              color: 'var(--burgundy-primary)',
              fontSize: '1.45rem',
              fontWeight: '900',
              marginBottom: '0.5rem',
              letterSpacing: '0.5px'
            }}>
              ¿Cerrar Todas las Salas?
            </h2>

            <p style={{
              fontSize: '0.9rem',
              color: '#3E2415',
              marginBottom: '1rem',
              lineHeight: '1.45'
            }}>
              Se clausurarán permanentemente las <strong>{activeRooms.length} salas abiertas</strong> registradas actualmente en el sistema.
            </p>

            <p style={{
              fontSize: '0.78rem',
              color: '#8B1E26',
              fontStyle: 'italic',
              marginBottom: '1.5rem'
            }}>
              * Las mesas en vivo se eliminarán de la pantalla principal inmediatamente y los jugadores conectados recibirán el aviso de sala clausurada.
            </p>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowAdminConfirmAllModal(false);
                  playSound('pop');
                }}
                disabled={adminActionLoading}
                className="vintage-brass-plaque"
                style={{
                  margin: 0,
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.9rem'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdminCloseAllRooms}
                disabled={adminActionLoading}
                className="btn-vintage-burgundy"
                style={{
                  margin: 0,
                  padding: '0.65rem 1.4rem',
                  fontSize: '0.9rem',
                  backgroundColor: '#8B0000',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Power size={15} /> {adminActionLoading ? 'Cerrando salas...' : 'Sí, Cerrar Todas'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;
