import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './FileList.css';

function FileList({ sessionId, channel, onDownload }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaType, setMediaType] = useState('all'); // 'all', 'switch_game', 'archive', 'video', 'document'
  const [extension, setExtension] = useState('all');
  const [onlyFavorite, setOnlyFavorite] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 1 });
  const [sortBy, setSortBy] = useState('message_id');
  const [sortOrder, setSortOrder] = useState('DESC');
  
  // Available extensions in channel
  const [availableExtensions, setAvailableExtensions] = useState([]);

  // Index status state
  const [indexStatus, setIndexStatus] = useState(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState(0);
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [indexLimitChoice, setIndexLimitChoice] = useState('1000');
  const [serverDownloadingIds, setServerDownloadingIds] = useState(new Set());

  const searchDebounceRef = useRef(null);

  // Fetch index status & initial files when channel changes
  useEffect(() => {
    if (channel) {
      setPage(1);
      setSearchQuery('');
      setMediaType('all');
      setExtension('all');
      setOnlyFavorite(false);
      fetchIndexStatus();
      fetchExtensions();
      fetchFiles(1, '', 'all', 'all', false, sortBy, sortOrder);
    }
  }, [channel]);

  // Socket.io for live indexing updates
  useEffect(() => {
    const socket = io();

    socket.on('indexing_progress', (data) => {
      if (data.channelId === String(channel?.id)) {
        if (data.status === 'indexing') {
          setIsIndexing(true);
          setIndexingProgress(data.percentage || 0);
          setIndexStatus(prev => ({
            ...prev,
            status: 'indexing',
            progress: data.percentage || 0,
            indexed_count: data.indexed || prev?.indexed_count || 0
          }));
        } else if (data.status === 'completed' || data.status === 'stopped') {
          setIsIndexing(false);
          setIndexingProgress(100);
          fetchIndexStatus();
          fetchExtensions();
          fetchFiles(1, searchQuery, mediaType, extension, onlyFavorite, sortBy, sortOrder);
        } else if (data.status === 'error') {
          setIsIndexing(false);
          setError(`Indexing error: ${data.error}`);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [channel, searchQuery, mediaType, extension, onlyFavorite, sortBy, sortOrder]);

  const fetchIndexStatus = async () => {
    if (!channel) return;
    try {
      const res = await fetch(`/api/channels/${channel.id}/index-status`, {
        headers: { 'x-session-id': sessionId }
      });
      if (res.ok) {
        const data = await res.json();
        setIndexStatus(data);
        setIsIndexing(data.is_running || data.status === 'indexing');
        if (data.progress) setIndexingProgress(data.progress);
      }
    } catch (err) {
      console.error('Failed to get index status:', err);
    }
  };

  const fetchExtensions = async () => {
    if (!channel) return;
    try {
      const res = await fetch(`/api/channels/${channel.id}/extensions`, {
        headers: { 'x-session-id': sessionId }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableExtensions(data.extensions || []);
      }
    } catch (err) {
      console.error('Failed to get extensions:', err);
    }
  };

  const fetchFiles = async (
    targetPage = page,
    targetQuery = searchQuery,
    targetType = mediaType,
    targetExt = extension,
    targetFav = onlyFavorite,
    targetSortBy = sortBy,
    targetSortOrder = sortOrder
  ) => {
    if (!channel) return;
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: limit.toString(),
        query: targetQuery || '',
        mediaType: targetType || 'all',
        extension: targetExt || 'all',
        favorite: targetFav ? 'true' : 'false',
        sortBy: targetSortBy,
        sortOrder: targetSortOrder
      });

      const res = await fetch(`/api/channels/${channel.id}/files?${params.toString()}`, {
        headers: { 'x-session-id': sessionId }
      });

      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        setPagination(data.pagination || { page: targetPage, limit, total: 0, totalPages: 1 });
      } else {
        setError('Gagal mengambil daftar file');
      }
    } catch (err) {
      setError('Koneksi jaringan bermasalah saat memuat file');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setPage(1);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      fetchFiles(1, val, mediaType, extension, onlyFavorite, sortBy, sortOrder);
    }, 350);
  };

  const handleTypeFilter = (type) => {
    setMediaType(type);
    setPage(1);
    fetchFiles(1, searchQuery, type, extension, onlyFavorite, sortBy, sortOrder);
  };

  const handleExtensionFilter = (ext) => {
    setExtension(ext);
    setPage(1);
    fetchFiles(1, searchQuery, mediaType, ext, onlyFavorite, sortBy, sortOrder);
  };

  const handleFavoriteFilterToggle = () => {
    const nextFav = !onlyFavorite;
    setOnlyFavorite(nextFav);
    setPage(1);
    fetchFiles(1, searchQuery, mediaType, extension, nextFav, sortBy, sortOrder);
  };

  const handleSortChange = (newSortBy) => {
    let newOrder = 'DESC';
    if (sortBy === newSortBy) {
      newOrder = sortOrder === 'DESC' ? 'ASC' : 'DESC';
    }
    setSortBy(newSortBy);
    setSortOrder(newOrder);
    setPage(1);
    fetchFiles(1, searchQuery, mediaType, extension, onlyFavorite, newSortBy, newOrder);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPage(newPage);
    fetchFiles(newPage, searchQuery, mediaType, extension, onlyFavorite, sortBy, sortOrder);
  };

  const handleToggleFavorite = async (file) => {
    const originalFav = file.is_favorite;
    const newFav = originalFav === 1 ? 0 : 1;

    // Optimistic UI update
    setFiles(prev => prev.map(f => f.message_id === file.message_id ? { ...f, is_favorite: newFav } : f));
    setIndexStatus(prev => prev ? {
      ...prev,
      favorite_count: Math.max(0, (prev.favorite_count || 0) + (newFav ? 1 : -1))
    } : prev);

    try {
      const res = await fetch(`/api/channels/${channel.id}/files/${file.message_id}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ isFavorite: Boolean(newFav) })
      });

      if (!res.ok) {
        // Revert on failure
        setFiles(prev => prev.map(f => f.message_id === file.message_id ? { ...f, is_favorite: originalFav } : f));
      }
    } catch (err) {
      setFiles(prev => prev.map(f => f.message_id === file.message_id ? { ...f, is_favorite: originalFav } : f));
    }
  };

  const handleStartIndexing = async () => {
    setShowIndexModal(false);
    setIsIndexing(true);
    setIndexingProgress(0);

    const max = indexLimitChoice === 'all' ? null : parseInt(indexLimitChoice);

    try {
      await fetch(`/api/channels/${channel.id}/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          maxFiles: max,
          includeVideos: true
        })
      });
      fetchIndexStatus();
    } catch (err) {
      setIsIndexing(false);
      setError('Gagal memulai proses sinkronisasi');
    }
  };

  const handleStopIndexing = async () => {
    try {
      await fetch(`/api/channels/${channel.id}/index/stop`, {
        method: 'POST',
        headers: { 'x-session-id': sessionId }
      });
    } catch (err) {
      console.error('Failed to stop indexing:', err);
    }
  };

  const handleBrowserDownload = (file) => {
    const downloadUrl = `/api/download/browser/${channel.id}/${file.message_id}?session=${encodeURIComponent(sessionId)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', file.file_name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleServerDownload = async (file) => {
    if (serverDownloadingIds.has(file.message_id)) return;
    setServerDownloadingIds(prev => new Set([...prev, file.message_id]));

    try {
      const res = await fetch('/api/download/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          videoId: file.message_id,
          channelId: channel.id,
          title: file.file_name,
          filename: file.file_name
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (onDownload) {
          onDownload({
            id: file.message_id,
            title: file.file_name,
            media: { fileName: file.file_name, size: file.file_size },
            downloadId: data.downloadId
          });
        }
      }
    } catch (err) {
      console.error('Server download error:', err);
    } finally {
      setServerDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(file.message_id);
        return next;
      });
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const num = Number(bytes);
    if (num >= 1024 * 1024 * 1024) {
      return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    const mb = num / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(num / 1024).toFixed(0)} KB`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp * 1000);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getBadgeClass = (mediaType, ext) => {
    if (mediaType === 'switch_game' || ['nsp', 'nsz', 'xci', 'xcz'].includes(ext)) {
      return 'badge-switch';
    }
    if (mediaType === 'archive' || ['zip', 'rar', '7z', '001', '002'].includes(ext)) {
      return 'badge-archive';
    }
    if (mediaType === 'video') return 'badge-video';
    if (mediaType === 'audio') return 'badge-audio';
    return 'badge-document';
  };

  const getBadgeLabel = (mediaType, ext) => {
    if (['nsp', 'nsz', 'xci', 'xcz'].includes(ext)) return ext.toUpperCase();
    if (mediaType === 'switch_game') return 'SWITCH';
    if (ext) return ext.toUpperCase();
    return mediaType.toUpperCase();
  };

  return (
    <div className="file-catalog">
      {/* Channel Header & Sync Dashboard */}
      <div className="file-catalog-header">
        <div className="header-info">
          <h2>📁 {channel.title}</h2>
          <div className="index-metrics">
            <span className="metric-pill">
              📊 {indexStatus?.indexed_count || 0} Terindeks
            </span>
            <span className="metric-pill favorite-pill">
              ⭐ {indexStatus?.favorite_count || 0} Wishlist
            </span>
            {indexStatus?.last_sync_at && (
              <span className="sync-time">
                Terakhir sync: {new Date(indexStatus.last_sync_at).toLocaleString('id-ID')}
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          {isIndexing ? (
            <div className="indexing-active-box">
              <div className="spinner-small" />
              <span>Mengindeks ({indexingProgress}%)</span>
              <button className="btn-stop-indexing" onClick={handleStopIndexing}>
                🛑 Berhenti
              </button>
            </div>
          ) : (
            <button 
              className="btn-sync-channel"
              onClick={() => setShowIndexModal(true)}
            >
              🔄 Sinkronisasi / Index Channel
            </button>
          )}
        </div>
      </div>

      {/* Indexing Progress Bar */}
      {isIndexing && (
        <div className="indexing-progress-container">
          <div 
            className="indexing-progress-fill" 
            style={{ width: `${indexingProgress}%` }}
          />
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="file-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Cari file, judul game, atau caption (cth: GTA, Zelda, ultrakill)..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => { setSearchQuery(''); fetchFiles(1, '', mediaType, extension, onlyFavorite, sortBy, sortOrder); }}>
              ✕
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="filter-chips">
          <button 
            className={`chip ${mediaType === 'all' && !onlyFavorite ? 'active' : ''}`}
            onClick={() => { setOnlyFavorite(false); handleTypeFilter('all'); }}
          >
            Semua
          </button>
          <button 
            className={`chip chip-wishlist ${onlyFavorite ? 'active' : ''}`}
            onClick={handleFavoriteFilterToggle}
          >
            ⭐ Wishlist ({indexStatus?.favorite_count || 0})
          </button>
          <button 
            className={`chip chip-switch ${mediaType === 'switch_game' && !onlyFavorite ? 'active' : ''}`}
            onClick={() => { setOnlyFavorite(false); handleTypeFilter('switch_game'); }}
          >
            🎮 Nintendo Switch (NSP/XCI)
          </button>
          <button 
            className={`chip chip-archive ${mediaType === 'archive' && !onlyFavorite ? 'active' : ''}`}
            onClick={() => { setOnlyFavorite(false); handleTypeFilter('archive'); }}
          >
            📦 Arsip (ZIP/RAR)
          </button>
          <button 
            className={`chip chip-video ${mediaType === 'video' && !onlyFavorite ? 'active' : ''}`}
            onClick={() => { setOnlyFavorite(false); handleTypeFilter('video'); }}
          >
            🎬 Video
          </button>
          <button 
            className={`chip ${mediaType === 'document' && !onlyFavorite ? 'active' : ''}`}
            onClick={() => { setOnlyFavorite(false); handleTypeFilter('document'); }}
          >
            📄 Dokumen
          </button>
        </div>

        {/* Extension Chips (if available) */}
        {availableExtensions.length > 0 && (
          <div className="extension-chips">
            <span className="ext-label">Format:</span>
            <button 
              className={`ext-chip ${extension === 'all' ? 'active' : ''}`}
              onClick={() => handleExtensionFilter('all')}
            >
              Semua
            </button>
            {availableExtensions.slice(0, 8).map(extItem => (
              <button
                key={extItem.extension}
                className={`ext-chip ${extension === extItem.extension ? 'active' : ''}`}
                onClick={() => handleExtensionFilter(extItem.extension)}
              >
                .{extItem.extension} ({extItem.count})
              </button>
            ))}
          </div>
        )}

        {/* Sorting Bar */}
        <div className="sort-bar">
          <span className="sort-label">Urutkan:</span>
          <button 
            className={`sort-btn ${sortBy === 'message_id' ? 'active' : ''}`}
            onClick={() => handleSortChange('message_id')}
          >
            Pesan {sortBy === 'message_id' && (sortOrder === 'DESC' ? '↓' : '↑')}
          </button>
          <button 
            className={`sort-btn ${sortBy === 'file_size' ? 'active' : ''}`}
            onClick={() => handleSortChange('file_size')}
          >
            Ukuran {sortBy === 'file_size' && (sortOrder === 'DESC' ? '↓' : '↑')}
          </button>
          <button 
            className={`sort-btn ${sortBy === 'file_name' ? 'active' : ''}`}
            onClick={() => handleSortChange('file_name')}
          >
            Nama {sortBy === 'file_name' && (sortOrder === 'DESC' ? '↓' : '↑')}
          </button>
          <span className="total-indicator">
            Menampilkan {files.length} dari {pagination.total} file
          </span>
        </div>
      </div>

      {/* Main File Table / List */}
      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="file-loading">
          <div className="spinner-large" />
          <p>Memuat file...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="empty-files">
          <div className="empty-icon">📭</div>
          <h3>Tidak ada file ditemukan</h3>
          {indexStatus?.indexed_count === 0 ? (
            <p>
              Channel ini belum di-index. Klik tombol <strong>"Sinkronisasi / Index Channel"</strong> di atas untuk memindai semua file di channel ini!
            </p>
          ) : (
            <p>Coba sesuaikan kata kunci pencarian atau filter kategori Anda.</p>
          )}
        </div>
      ) : (
        <div className="file-table">
          {files.map(file => (
            <div key={file.id || file.message_id} className="file-row">
              {/* Star / Wishlist Toggle */}
              <button 
                className={`btn-star ${file.is_favorite === 1 ? 'starred' : ''}`}
                title={file.is_favorite === 1 ? 'Hapus dari Wishlist' : 'Tambah ke Wishlist'}
                onClick={() => handleToggleFavorite(file)}
              >
                {file.is_favorite === 1 ? '⭐' : '☆'}
              </button>

              {/* Format Badge */}
              <div className={`format-badge ${getBadgeClass(file.media_type, file.extension)}`}>
                {getBadgeLabel(file.media_type, file.extension)}
              </div>

              {/* File Info */}
              <div className="file-details">
                <div className="file-name" title={file.file_name}>
                  {file.file_name}
                </div>
                {file.caption && file.caption.trim() !== file.file_name && (
                  <div className="file-caption" title={file.caption}>
                    {file.caption.replace(/[\r\n]+/g, ' ').substring(0, 140)}
                  </div>
                )}
                <div className="file-meta">
                  <span className="meta-size">💾 {formatSize(file.file_size)}</span>
                  <span className="meta-date">📅 {formatDate(file.date)}</span>
                  <span className="meta-id">ID: #{file.message_id}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="file-actions">
                <button
                  className="btn-download-browser"
                  title="Unduh langsung via browser"
                  onClick={() => handleBrowserDownload(file)}
                >
                  ⬇️ Unduh
                </button>
                <button
                  className="btn-download-server"
                  title="Unduh ke storage server (dengan antrian)"
                  disabled={serverDownloadingIds.has(file.message_id)}
                  onClick={() => handleServerDownload(file)}
                >
                  {serverDownloadingIds.has(file.message_id) ? '⏳ Antre...' : '📥 Server'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="pagination-bar">
          <button 
            className="btn-page"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            ← Halaman Sebelumnya
          </button>
          <span className="page-indicator">
            Halaman {page} dari {pagination.totalPages} ({pagination.total} file)
          </span>
          <button 
            className="btn-page"
            disabled={page >= pagination.totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Halaman Selanjutnya →
          </button>
        </div>
      )}

      {/* Index Modal Confirmation */}
      {showIndexModal && (
        <div className="modal-backdrop" onClick={() => setShowIndexModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Sinkronisasi & Index Channel</h3>
            <p>
              Sistem akan memindai pesan pada channel <strong>{channel.title}</strong> dan mengindeks seluruh file ke dalam database lokal untuk pencarian instan dan wishlist.
            </p>

            <div className="modal-options">
              <label>Batas Jumlah File yang Di-index:</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="indexLimit"
                    value="500"
                    checked={indexLimitChoice === '500'}
                    onChange={() => setIndexLimitChoice('500')}
                  />
                  500 File Terbaru (Cepat ~1-2 menit)
                </label>
                <label>
                  <input
                    type="radio"
                    name="indexLimit"
                    value="1000"
                    checked={indexLimitChoice === '1000'}
                    onChange={() => setIndexLimitChoice('1000')}
                  />
                  1.000 File Terbaru (Direkomendasikan)
                </label>
                <label>
                  <input
                    type="radio"
                    name="indexLimit"
                    value="5000"
                    checked={indexLimitChoice === '5000'}
                    onChange={() => setIndexLimitChoice('5000')}
                  />
                  5.000 File
                </label>
                <label>
                  <input
                    type="radio"
                    name="indexLimit"
                    value="all"
                    checked={indexLimitChoice === 'all'}
                    onChange={() => setIndexLimitChoice('all')}
                  />
                  Semua File di Channel (Lengkap)
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowIndexModal(false)}>
                Batal
              </button>
              <button className="btn-confirm" onClick={handleStartIndexing}>
                Mulai Indexing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileList;
