import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import HostPanel from './pages/HostPanel';
import PlayerPanel from './pages/PlayerPanel';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="navbar">
          <a href="/" className="navbar-brand">🎉 Bingo Familiar Online</a>
        </header>
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/host/:gameId" element={<HostPanel />} />
            <Route path="/play/:gameId" element={<PlayerPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
