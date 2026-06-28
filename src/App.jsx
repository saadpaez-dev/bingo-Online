import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import HostPanel from './pages/HostPanel';
import PlayerPanel from './pages/PlayerPanel';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import './App.css';

// Componente para la barra superior global
const GlobalHeader = () => {
  const { theme, toggleTheme, soundEnabled, toggleSound } = useSettings();
  const location = useLocation();

  // No mostrar el título en la pantalla de inicio porque ya tiene uno gigante
  const showTitle = location.pathname !== '/';

  return (
    <header style={{
      display: 'flex',
      justifyContent: showTitle ? 'space-between' : 'flex-end',
      alignItems: 'center',
      padding: '1rem 2rem',
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow-sm)'
    }}>
      {showTitle && (
        <a href="/" style={{ textDecoration: 'none', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🎉</span> Bingo Familiar
        </a>
      )}
      
      <div style={{ display: 'flex', gap: '1rem', marginLeft: showTitle ? '0' : 'auto' }}>
        <button 
          onClick={toggleSound}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: soundEnabled ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.5rem', borderRadius: '50%',
            backgroundColor: 'var(--bg-app)',
            transition: 'all 0.2s'
          }}
          title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
        >
          {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
        </button>
        
        <button 
          onClick={toggleTheme}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: theme === 'dark' ? 'var(--warning)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.5rem', borderRadius: '50%',
            backgroundColor: 'var(--bg-app)',
            transition: 'all 0.2s'
          }}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
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
          <main style={{ flex: 1, paddingBottom: '2rem' }}>
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
