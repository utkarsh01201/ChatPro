import React, { useState, useEffect } from 'react';
import './index.css';
import { MusicProvider } from './MusicContext';
import HeaderNav from './components/HeaderNav';
import MiniPlayer from './components/MiniPlayer';
import ChatWorkspace from './components/ChatWorkspace';
import MusicStudio from './components/MusicStudio';
import ImageStudio from './components/ImageStudio';
import FontStudio from './components/FontStudio';
import CapabilitiesPage from './components/CapabilitiesPage';
import AboutPage from './components/AboutPage';

const TOP_TABS = [
  { id: 'chatpro', label: 'ChatPro AI', icon: null },
  { id: 'music', label: 'Music', icon: '🎵' },
];

const SUB_TABS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'image', label: 'Image Studio', icon: '🎨' },
  { id: 'fonts', label: 'Font Lab', icon: '🔤' },
  { id: 'capabilities', label: 'Capabilities', icon: '⚡' },
  { id: 'about', label: 'About', icon: 'ℹ️' },
];

export default function App() {
  const [topTab, setTopTab] = useState('chatpro');
  const [subTab, setSubTab] = useState('chat');

  // ── Theme ──
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('chatpro-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chatpro-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const goToMusic = () => setTopTab('music');

  return (
    <MusicProvider>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <HeaderNav
          topTab={topTab}
          subTab={subTab}
          topTabs={TOP_TABS}
          subTabs={SUB_TABS}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSelectTopTab={(id) => setTopTab(id)}
          onSelectSubTab={(id) => setSubTab(id)}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {topTab === 'music' && <MusicStudio />}
          {topTab === 'chatpro' && (
            <>
              {subTab === 'chat' && <ChatWorkspace />}
              {subTab === 'image' && <ImageStudio />}
              {subTab === 'fonts' && <FontStudio />}
              {subTab === 'capabilities' && <CapabilitiesPage />}
              {subTab === 'about' && <AboutPage onNavigateToChat={() => setSubTab('chat')} />}
            </>
          )}
        </div>

        {/* Global MiniPlayer — shown on all non-music tabs when playing */}
        {topTab !== 'music' && <MiniPlayer onGoToMusic={goToMusic} />}
      </div>
    </MusicProvider>
  );
}
