import React, { useState, useEffect } from 'react';
import './VideoList.css';

function VideoList({ sessionId, channel, onDownload }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filterDuration, setFilterDuration] = useState('all'); // 'all', 'movie' (>40min), 'short' (<=40min)
  const [hasMore, setHasMore] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState(new Set());

  useEffect(() => {
    if (channel) {
      setSearchQuery('');
      setIsSearching(false);
      fetchVideos(0);
    }
  }, [channel]);

  const fetchVideos = async (offsetId = 0) => {
    if (offsetId === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError('');

    try {
      const url = offsetId > 0 
        ? `/api/channels/${channel.id}/videos?offsetId=${offsetId}&limit=24`
        : `/api/channels/${channel.id}/videos?limit=24`;

      const response = await fetch(url, {
        headers: {
          'x-session-id': sessionId
        }
      });

      if (response.ok) {
        const data = await response.json();
        const newVideos = data.videos || [];
        
        if (offsetId === 0) {
          setVideos(newVideos);
        } else {
          setVideos(prev => {
            const existingIds = new Set(prev.map(v => v.id));
            const unique = newVideos.filter(v => !existingIds.has(v.id));
            return [...prev, ...unique];
          });
        }
        setHasMore(newVideos.length >= 24);
      } else {
        setError('Gagal memuat video channel');
      }
    } catch (err) {
      setError('Koneksi jaringan bermasalah');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = async (e, offsetId = 0) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchQuery.trim()) {
      setIsSearching(false);
      fetchVideos(0);
      return;
    }

    if (offsetId === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError('');
    setIsSearching(true);

    try {
      const url = offsetId > 0 
        ? `/api/channels/${channel.id}/search?query=${encodeURIComponent(searchQuery)}&offsetId=${offsetId}&limit=50`
        : `/api/channels/${channel.id}/search?query=${encodeURIComponent(searchQuery)}&limit=50`;

      const response = await fetch(url, {
        headers: {
          'x-session-id': sessionId
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Keep video / media items from search results
        const rawResults = data.results || [];
        const videoResults = rawResults
          .filter(item => {
            const isVideoType = item.mediaType === 'video';
            const isDocVideo = item.mediaType === 'document' && (
              item.media?.fileName?.match(/\.(mp4|mkv|avi|mov|webm|ts|m4v)$/i) ||
              item.title?.match(/\.(mp4|mkv|avi|mov|webm|ts|m4v)$/i)
            );
            const hasVideoMedia = item.media && (item.media.duration || item.media.type === 'video');
            return isVideoType || isDocVideo || hasVideoMedia;
          })
          .map(item => ({
            id: item.id,
            title: item.title || item.text || item.media?.fileName || `Film ${item.id}`,
            text: item.text || '',
            date: item.date,
            mediaType: item.mediaType || 'video',
            media: item.media || {},
            duration: item.media?.duration || 0,
            thumbnail: item.thumbnail
          }));

        if (offsetId === 0) {
          setVideos(videoResults);
        } else {
          setVideos(prev => {
            const existingIds = new Set(prev.map(v => v.id));
            const unique = videoResults.filter(v => !existingIds.has(v.id));
            return [...prev, ...unique];
          });
        }
        setHasMore(data.hasMore !== undefined ? data.hasMore : rawResults.length >= 50);
      } else {
        setError('Gagal melakukan pencarian film');
      }
    } catch (err) {
      setError('Koneksi bermasalah saat mencari film');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    fetchVideos(0);
  };

  // Direct Browser Download
  const handleBrowserDownload = (video) => {
    const fileName = video.title || video.media?.fileName || `video_${video.id}.mp4`;
    const downloadUrl = `/api/download/browser/${channel.id}/${video.id}?session=${encodeURIComponent(sessionId)}`;
    
    // Create hidden anchor to trigger browser native download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Optional: Server Download (for background queue)
  const handleServerDownload = async (video) => {
    if (downloadingIds.has(video.id)) return;

    setDownloadingIds(prev => new Set([...prev, video.id]));

    try {
      const response = await fetch('/api/download/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          videoId: video.id,
          channelId: channel.id,
          title: video.title || video.media?.fileName || `Film_${video.id}`
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (onDownload) {
          onDownload({ ...video, downloadId: data.downloadId });
        }
      } else {
        console.error('Failed to start server download');
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(video.id);
        return newSet;
      });
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return null;
    const sec = parseInt(seconds);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remainingSecs = sec % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return 'N/A';
    const num = Number(bytes);
    if (num >= 1024 * 1024 * 1024) {
      return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    const mb = num / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Filter video based on duration
  const filteredVideos = videos.filter(video => {
    const duration = video.duration || video.media?.duration || 0;
    if (filterDuration === 'movie') {
      return duration >= 40 * 60; // Film >= 40 menit
    }
    if (filterDuration === 'short') {
      return duration > 0 && duration < 40 * 60; // Klip < 40 menit
    }
    return true;
  });

  const handleLoadMore = () => {
    if (loadingMore || videos.length === 0) return;
    const oldestVideo = videos.reduce((oldest, current) => 
      !oldest || current.id < oldest.id ? current : oldest, null);
    if (oldestVideo) {
      if (isSearching) {
        handleSearch(null, oldestVideo.id);
      } else {
        fetchVideos(oldestVideo.id);
      }
    }
  };

  return (
    <div className="video-list">
      {/* Top Header & Search Bar */}
      <div className="video-list-header">
        <div className="header-info">
          <h3>{channel.title}</h3>
          <span className="video-count">
            {isSearching ? `Hasil Pencarian: ${filteredVideos.length}` : `${filteredVideos.length} film/video`}
          </span>
        </div>

        <div className="header-controls">
          {/* Search Form */}
          <form className="video-search-form" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Cari judul film di channel ini..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-primary search-btn">
              🔍 Cari
            </button>
            {isSearching && (
              <button type="button" onClick={handleClearSearch} className="btn btn-secondary reset-btn">
                ✕ Reset
              </button>
            )}
          </form>

          {/* Duration Filter */}
          <select 
            className="filter-select" 
            value={filterDuration} 
            onChange={(e) => setFilterDuration(e.target.value)}
          >
            <option value="all">Semua Video</option>
            <option value="movie">Khusus Film (&gt; 40 mnt)</option>
            <option value="short">Klip / Pendek (&le; 40 mnt)</option>
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="video-list-content">
        {loading && (
          <div className="video-list-loading">
            <span className="loading"></span>
            <p>{isSearching ? 'Mencari film...' : 'Memuat daftar film...'}</p>
          </div>
        )}

        {error && (
          <div className="video-list-error">
            <p>{error}</p>
            <button onClick={() => isSearching ? handleSearch() : fetchVideos(0)} className="btn btn-secondary">
              Coba Lagi
            </button>
          </div>
        )}

        {!loading && !error && filteredVideos.length === 0 && (
          <div className="video-list-empty">
            <div className="empty-icon">🎬</div>
            <p>{isSearching ? `Tidak ditemukan film dengan kata kunci "${searchQuery}"` : 'Tidak ada video film di channel ini'}</p>
            {isSearching && (
              <button onClick={handleClearSearch} className="btn btn-secondary" style={{ marginTop: '10px' }}>
                Kembali ke Semua Video
              </button>
            )}
          </div>
        )}

        {!loading && !error && filteredVideos.length > 0 && (
          <>
            <div className="video-grid">
              {filteredVideos.map((video) => {
                const duration = video.duration || video.media?.duration;
                const size = video.media?.size;
                const formattedDuration = formatDuration(duration);

                return (
                  <div key={video.id} className="video-card">
                    {/* Thumbnail Poster */}
                    <div className="video-thumbnail">
                      <img
                        src={video.thumbnail || `/api/channels/${channel.id}/photo/${video.id}?session=${encodeURIComponent(sessionId)}`}
                        alt={video.title}
                        className="video-thumbnail-img"
                        loading="lazy"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      {size && (
                        <span className="video-size-badge">
                          {formatSize(size)}
                        </span>
                      )}
                      {formattedDuration && (
                        <span className="video-duration">
                          ⏱ {formattedDuration}
                        </span>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="video-info">
                      <h4 title={video.title}>{video.title}</h4>
                      
                      {video.text && video.text !== video.title && (
                        <p className="video-description">{video.text}</p>
                      )}

                      <div className="video-meta">
                        {size && <span>{formatSize(size)}</span>}
                        {formattedDuration && (
                          <>
                            <span>•</span>
                            <span>{formattedDuration}</span>
                          </>
                        )}
                        {video.date && (
                          <>
                            <span>•</span>
                            <span>{formatDate(video.date)}</span>
                          </>
                        )}
                      </div>

                      {/* Download Buttons */}
                      <div className="video-card-actions">
                        <button
                          className="btn btn-primary video-download-btn direct-download-btn"
                          onClick={() => handleBrowserDownload(video)}
                          title="Download langsung ke folder browser laptop/HP"
                        >
                          ⬇️ Unduh ke Browser
                        </button>
                        <button
                          className="btn btn-secondary server-download-btn"
                          onClick={() => handleServerDownload(video)}
                          disabled={downloadingIds.has(video.id)}
                          title="Simpan file ke folder server webapp"
                        >
                          {downloadingIds.has(video.id) ? '⏳ Menyimpan...' : '💾 Server'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination / Load More */}
            {hasMore && (
              <div className="load-more-container">
                <button 
                  className="btn btn-secondary btn-load-more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore 
                    ? 'Memuat film lainnya...' 
                    : isSearching 
                      ? 'Muat Lebih Banyak Hasil Pencarian ⬇️' 
                      : 'Muat Lebih Banyak Film ⬇️'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default VideoList;
