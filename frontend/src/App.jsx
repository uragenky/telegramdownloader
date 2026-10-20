import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ChannelList from './components/ChannelList';
import MessageList from './components/MessageList';
import VideoList from './components/VideoList';
import FileList from './components/FileList';
import DownloadManager from './components/DownloadManager';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionId, setSessionId] = useState(() => {
    // Get sessionId from localStorage on initial load
    const stored = localStorage.getItem('sessionId');
    console.log('Loaded sessionId from localStorage:', stored);
    return stored;
  });
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [viewMode, setViewMode] = useState('files'); // 'files', 'videos', or 'messages'
  const [downloads, setDownloads] = useState([]);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (sessionId) {
      checkAuthStatus();
    } else {
      // Try to get any available restored session
      checkForRestoredSession();
    }
  }, []);

  const checkForRestoredSession = async () => {
    console.log('Checking for restored sessions...');
    setIsCheckingAuth(true);
    
    try {
      const response = await fetch('/api/auth/available-session');
      const data = await response.json();
      console.log('Available session response:', data);
      
      if (data.hasSession && data.sessionId) {
        console.log('Found restored session:', data.sessionId);
        // Save the restored session
        setSessionId(data.sessionId);
        localStorage.setItem('sessionId', data.sessionId);
        setIsAuthenticated(true);
      } else {
        console.log('No restored sessions available');
        setIsCheckingAuth(false);
      }
    } catch (error) {
      console.error('Failed to check for restored session:', error);
      setIsCheckingAuth(false);
    }
  };

  const checkAuthStatus = async () => {
    if (!sessionId) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      return;
    }

    console.log('Checking auth status for session:', sessionId);
    setIsCheckingAuth(true);

    try {
      const response = await fetch('/api/auth/status', {
        headers: {
          'x-session-id': sessionId
        }
      });
      const data = await response.json();
      console.log('Auth status response:', data);
      
      if (data.authenticated) {
        setIsAuthenticated(true);
        console.log('User is authenticated');
      } else {
        // Session exists but not authenticated, clear it
        localStorage.removeItem('sessionId');
        setSessionId(null);
        setIsAuthenticated(false);
        console.log('Session invalid, cleared');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = (newSessionId) => {
    console.log('Login successful, saving session:', newSessionId);
    setSessionId(newSessionId);
    localStorage.setItem('sessionId', newSessionId);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-session-id': sessionId
        }
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    
    localStorage.removeItem('sessionId');
    setSessionId(null);
    setIsAuthenticated(false);
    setSelectedChannel(null);
  };

  const handleDownload = (downloadData) => {
    const newDownload = {
      downloadId: downloadData.downloadId,
      title: downloadData.title || downloadData.media?.fileName || 'Unknown Video',
      video: downloadData.video || downloadData,
      channel: downloadData.channel || selectedChannel,
      progress: downloadData.progress || 0,
      status: downloadData.status || 'downloading',
      received: downloadData.received || 0,
      total: downloadData.total || 0,
      folderName: downloadData.folderName
    };
    console.log('Adding new download:', newDownload);
    setDownloads(prev => [...prev, newDownload]);
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="app">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '18px',
          color: '#666'
        }}>
          Checking authentication...
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <h1>Telegram Video Downloader</h1>
          {isAuthenticated && (
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {!isAuthenticated ? (
            <LoginForm onLogin={handleLogin} />
          ) : (
            <div className="app-content">
              <div className="sidebar">
                <ChannelList 
                  sessionId={sessionId}
                  onSelectChannel={setSelectedChannel}
                  selectedChannel={selectedChannel}
                />
              </div>
              
              <div className="main-content">
                {selectedChannel ? (
                  <>
                    <div className="view-mode-tabs">
                      <button 
                        className={`view-tab-btn ${viewMode === 'files' ? 'active' : ''}`}
                        onClick={() => setViewMode('files')}
                      >
                        📁 Semua File & Wishlist
                      </button>
                      <button 
                        className={`view-tab-btn ${viewMode === 'videos' ? 'active' : ''}`}
                        onClick={() => setViewMode('videos')}
                      >
                        🎬 Katalog Film
                      </button>
                      <button 
                        className={`view-tab-btn ${viewMode === 'messages' ? 'active' : ''}`}
                        onClick={() => setViewMode('messages')}
                      >
                        💬 Semua Pesan Chat
                      </button>
                    </div>

                    {viewMode === 'files' ? (
                      <FileList 
                        sessionId={sessionId}
                        channel={selectedChannel}
                        onDownload={handleDownload}
                      />
                    ) : viewMode === 'videos' ? (
                      <VideoList 
                        sessionId={sessionId}
                        channel={selectedChannel}
                        onDownload={handleDownload}
                      />
                    ) : (
                      <MessageList 
                        sessionId={sessionId}
                        channel={selectedChannel}
                        onDownload={handleDownload}
                      />
                    )}
                  </>
                ) : (
                  <div className="placeholder">
                    <h2>Pilih Channel</h2>
                    <p>Pilih channel dari daftar di sebelah kiri untuk melihat, mengindeks file, atau mengunduh konten</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {isAuthenticated && downloads.length > 0 && (
        <DownloadManager 
          downloads={downloads}
          setDownloads={setDownloads}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}

export default App;