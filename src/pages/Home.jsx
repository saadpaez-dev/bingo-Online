import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db, loginAnonymously } from '../firebase';
import { Play, PlusCircle, Sparkles, Hash } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';


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
    <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem 1rem' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '2rem' }} className="animate-pop">
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--primary)', color: 'white', padding: '1rem', borderRadius: '1rem', marginBottom: '1rem', boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)' }}>
          <Sparkles size={40} />
        </div>
        <h1 style={{ fontSize: '3rem', letterSpacing: '-1px', color: 'var(--primary)' }}>Bingo <span style={{ color: 'var(--text-main)' }}>Familiar</span></h1>
        <p className="text-muted" style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>La mejor experiencia multijugador en tiempo real</p>
      </div>

      <div className="card animate-pop" style={{ maxWidth: '500px', width: '100%', padding: '2.5rem', animationDelay: '0.1s' }}>
        
        {/* Sección Crear */}
        <div style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={24} color="var(--primary)" /> Crear Partida
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div 
              onClick={() => { setGameMode(75); playSound('draw'); }}
              style={{
                border: `2px solid ${gameMode === 75 ? 'var(--primary)' : 'var(--border-color)'}`,
                backgroundColor: gameMode === 75 ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                transform: gameMode === 75 ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: gameMode === 75 ? 'var(--primary)' : 'var(--text-main)' }}>75</div>
              <div className="text-muted" style={{ fontSize: '0.9rem' }}>Bolas (Letras)</div>
            </div>
            
            <div 
              onClick={() => { setGameMode(90); playSound('draw'); }}
              style={{
                border: `2px solid ${gameMode === 90 ? 'var(--primary)' : 'var(--border-color)'}`,
                backgroundColor: gameMode === 90 ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                transform: gameMode === 90 ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: gameMode === 90 ? 'var(--primary)' : 'var(--text-main)' }}>90</div>
              <div className="text-muted" style={{ fontSize: '0.9rem' }}>Bolas (Cartón)</div>
            </div>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleCreateGame}
            disabled={loading}
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
          >
            {loading ? 'Preparando sala...' : 'Crear Sala Ahora'}
          </button>
        </div>

        {/* Separador */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '2rem 0' }}>
          <div style={{ flex: 1, height: '2px', backgroundColor: 'var(--border-color)' }}></div>
          <div style={{ padding: '0 1rem', color: 'var(--text-muted)', fontWeight: '600' }}>O</div>
          <div style={{ flex: 1, height: '2px', backgroundColor: 'var(--border-color)' }}></div>
        </div>

        {/* Sección Unirse */}
        <div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Hash size={24} color="var(--secondary)" /> Unirse con Código
          </h2>
          <form onSubmit={handleJoinGame} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Ej: GG2LYX" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              required
              style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.5rem', textTransform: 'uppercase' }}
            />
            <button type="submit" className="btn btn-secondary" style={{ padding: '1rem', fontSize: '1.1rem' }}>
              Entrar a Jugar <Play size={20} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Home;
