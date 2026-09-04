import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import HostPanel from './pages/HostPanel';
import PlayerPanel from './pages/PlayerPanel';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import './App.css';

// Barra superior estilo Salón de Caoba y Bronce
const GlobalHeader = () => {
  const { theme, toggleTheme, soundEnabled, toggleSound } = useSettings();
  const location = useLocation();

  const showTitle = location.pathname !== '/';

  return (
    <header style={{
      display: 'flex',
      justifyContent: showTitle ? 'space-between' : 'flex-end',
      alignItems: 'center',
      padding: '0.75rem 2rem',
      background: location.pathname === '/' 
        ? 'rgba(22, 10, 6, 0.45)' 
        : 'linear-gradient(180deg, rgba(46, 21, 12, 0.95) 0%, rgba(22, 10, 6, 0.95) 100%)',
      backdropFilter: 'blur(8px)',
      borderBottom: location.pathname === '/' ? '1px solid rgba(197, 155, 39, 0.35)' : '2px solid var(--gold-brass)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.6)'
    }}>
      {showTitle && (
        <a href="/" style={{ 
          textDecoration: 'none', 
          color: 'var(--text-gold-emboss)', 
          fontFamily: 'var(--font-serif)',
          fontWeight: '900', 
          fontSize: '1.35rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          letterSpacing: '1px',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)'
        }}>
          <span style={{ color: 'var(--gold-highlight)' }}>⚜️</span> Bingo Familiar
        </a>
      )}
      
      <div style={{ display: 'flex', gap: '0.75rem', marginLeft: showTitle ? '0' : 'auto' }}>
        <button 
          onClick={toggleSound}
          style={{
            background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)', 
            border: '1.5px solid var(--gold-brass)', 
            cursor: 'pointer',
            color: soundEnabled ? 'var(--burgundy-primary)' : 'var(--text-vintage-muted)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '0.45rem', 
            borderRadius: '50%',
            boxShadow: '0 2px 5px rgba(0,0,0,0.35)',
            transition: 'all 0.2s'
          }}
          title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
        >
          {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        
        <button 
          onClick={toggleTheme}
          style={{
            background: 'linear-gradient(180deg, #FAF4E5 0%, #E6D2AE 100%)', 
            border: '1.5px solid var(--gold-brass)', 
            cursor: 'pointer',
            color: theme === 'dark' ? 'var(--gold-antique)' : 'var(--burgundy-primary)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '0.45rem', 
            borderRadius: '50%',
            boxShadow: '0 2px 5px rgba(0,0,0,0.35)',
            transition: 'all 0.2s'
          }}
          title={theme === 'dark' ? 'Cambiar a modo diurno' : 'Cambiar a modo nocturno'}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
};

function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <GlobalHeader />
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/host/:gameId" element={<HostPanel />} />
              <Route path="/play/:gameId" element={<PlayerPanel />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </SettingsProvider>
  );
}

export default App;
