import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  // Theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('bingo-theme');
    return saved || 'light';
  });

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('bingo-sound');
    return saved ? JSON.parse(saved) : true;
  });

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('bingo-theme', theme);
  }, [theme]);

  // Save sound setting
  useEffect(() => {
    localStorage.setItem('bingo-sound', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  // Sound player helper
  const playSound = (type) => {
    if (!soundEnabled) return;
    
    let audioSrc = '';
    switch (type) {
      case 'pop':
        audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'; // Bubble pop
        break;
      case 'draw':
        audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'; // Fast woosh/click
        break;
      case 'win':
        audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2002/2002-preview.mp3'; // Cheering/Trumpet
        break;
      case 'start':
        audioSrc = 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'; // Arcade start
        break;
      default:
        return;
    }

    const audio = new Audio(audioSrc);
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play blocked by browser interaction policy"));
  };

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, soundEnabled, toggleSound, playSound }}>
      {children}
    </SettingsContext.Provider>
  );
};
