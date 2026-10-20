const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'database.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new DatabaseSync(dbPath);
    this.initTables();
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS channel_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        mime_type TEXT,
        extension TEXT,
        media_type TEXT,
        caption TEXT,
        date INTEGER,
        views INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        indexed_at INTEGER,
        UNIQUE(channel_id, message_id)
      );

      CREATE TABLE IF NOT EXISTS channel_index_status (
        channel_id TEXT PRIMARY KEY,
        channel_title TEXT,
        total_files INTEGER DEFAULT 0,
        last_message_id INTEGER DEFAULT 0,
        last_sync_at INTEGER,
        status TEXT DEFAULT 'idle',
        progress INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_channel_files_channel ON channel_files(channel_id);
      CREATE INDEX IF NOT EXISTS idx_channel_files_fav ON channel_files(channel_id, is_favorite);
      CREATE INDEX IF NOT EXISTS idx_channel_files_type ON channel_files(channel_id, media_type);
      CREATE INDEX IF NOT EXISTS idx_channel_files_ext ON channel_files(channel_id, extension);
      CREATE INDEX IF NOT EXISTS idx_channel_files_msg ON channel_files(channel_id, message_id);
    `);
  }

  static detectExtension(fileName) {
    if (!fileName) return '';
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1 || lastDot === fileName.length - 1) return '';
    return fileName.slice(lastDot + 1).toLowerCase();
  }

  static classifyMediaType(fileName, mimeType = '', caption = '') {
    const ext = DatabaseService.detectExtension(fileName);
    const textContext = `${fileName} ${caption}`.toLowerCase();

    // Nintendo Switch Game files
    if (['nsp', 'nsz', 'xci', 'xcz'].includes(ext)) {
      return 'switch_game';
    }

    // Archives (many switch games on DarkNSP are .zip or .rar with [NSP] in title)
    if (['zip', 'rar', '7z', 'tar', 'gz', '001', '002', '003', '004', '005', '006'].includes(ext)) {
      if (textContext.includes('[nsp]') || textContext.includes('[xci]') || textContext.includes('nintendo switch') || textContext.includes('switch port')) {
        return 'switch_game';
      }
      return 'archive';
    }

    // Videos
    if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'ts', 'm4v'].includes(ext) || mimeType.startsWith('video/')) {
      return 'video';
    }

    // Audio
    if (['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac'].includes(ext) || mimeType.startsWith('audio/')) {
      return 'audio';
    }

    // Photos
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext) || mimeType.startsWith('image/')) {
      return 'photo';
    }

    // Documents
    if (['pdf', 'epub', 'mobi', 'cbr', 'cbz', 'doc', 'docx', 'txt', 'xls', 'xlsx'].includes(ext)) {
      return 'document';
    }

    return 'document';
  }

  upsertFilesBatch(files) {
    if (!files || files.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT INTO channel_files (
        channel_id, message_id, file_name, file_size, mime_type,
        extension, media_type, caption, date, views, is_favorite, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(channel_id, message_id) DO UPDATE SET
        file_name = excluded.file_name,
        file_size = excluded.file_size,
        mime_type = excluded.mime_type,
        extension = excluded.extension,
        media_type = excluded.media_type,
        caption = excluded.caption,
        date = excluded.date,
        views = excluded.views,
        indexed_at = excluded.indexed_at
    `);

    const now = Date.now();
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const f of files) {
        const ext = DatabaseService.detectExtension(f.fileName);
        const mediaType = f.mediaType || DatabaseService.classifyMediaType(f.fileName, f.mimeType, f.caption);

        stmt.run(
          String(f.channelId),
          Number(f.messageId),
          String(f.fileName || `file_${f.messageId}`),
          Number(f.fileSize || 0),
          String(f.mimeType || ''),
          String(ext),
          String(mediaType),
          String(f.caption || ''),
          Number(f.date || 0),
          Number(f.views || 0),
          now
        );
      }
      this.db.exec('COMMIT');
      return files.length;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getFiles(channelId, options = {}) {
    const {
      query = '',
      mediaType = 'all',
      extension = '',
      isFavorite = false,
      limit = 50,
      offset = 0,
      sortBy = 'message_id',
      sortOrder = 'DESC'
    } = options;

    let sql = 'SELECT * FROM channel_files WHERE channel_id = ?';
    const params = [String(channelId)];

    if (query && query.trim()) {
      sql += ' AND (file_name LIKE ? OR caption LIKE ?)';
      const q = `%${query.trim()}%`;
      params.push(q, q);
    }

    if (mediaType && mediaType !== 'all') {
      sql += ' AND media_type = ?';
      params.push(mediaType);
    }

    if (extension && extension !== 'all') {
      sql += ' AND extension = ?';
      params.push(extension.toLowerCase());
    }

    if (isFavorite) {
      sql += ' AND is_favorite = 1';
    }

    // Whitelist sort column
    const validSortCols = ['message_id', 'date', 'file_size', 'file_name'];
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'message_id';
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  getFileCount(channelId, options = {}) {
    const {
      query = '',
      mediaType = 'all',
      extension = '',
      isFavorite = false
    } = options;

    let sql = 'SELECT COUNT(*) as count FROM channel_files WHERE channel_id = ?';
    const params = [String(channelId)];

    if (query && query.trim()) {
      sql += ' AND (file_name LIKE ? OR caption LIKE ?)';
      const q = `%${query.trim()}%`;
      params.push(q, q);
    }

    if (mediaType && mediaType !== 'all') {
      sql += ' AND media_type = ?';
      params.push(mediaType);
    }

    if (extension && extension !== 'all') {
      sql += ' AND extension = ?';
      params.push(extension.toLowerCase());
    }

    if (isFavorite) {
      sql += ' AND is_favorite = 1';
    }

    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return row ? row.count : 0;
  }

  toggleFavorite(channelId, messageId) {
    const findStmt = this.db.prepare('SELECT is_favorite FROM channel_files WHERE channel_id = ? AND message_id = ?');
    const existing = findStmt.get(String(channelId), Number(messageId));

    if (!existing) {
      return null;
    }

    const newFav = existing.is_favorite === 1 ? 0 : 1;
    const updateStmt = this.db.prepare('UPDATE channel_files SET is_favorite = ? WHERE channel_id = ? AND message_id = ?');
    updateStmt.run(newFav, String(channelId), Number(messageId));
    return newFav === 1;
  }

  setFavorite(channelId, messageId, isFavorite) {
    const favValue = isFavorite ? 1 : 0;
    const stmt = this.db.prepare('UPDATE channel_files SET is_favorite = ? WHERE channel_id = ? AND message_id = ?');
    const res = stmt.run(favValue, String(channelId), Number(messageId));
    return favValue === 1;
  }

  getExtensions(channelId) {
    const stmt = this.db.prepare(`
      SELECT extension, COUNT(*) as count 
      FROM channel_files 
      WHERE channel_id = ? AND extension != '' 
      GROUP BY extension 
      ORDER BY count DESC 
      LIMIT 20
    `);
    return stmt.all(String(channelId));
  }

  getIndexStatus(channelId) {
    const stmt = this.db.prepare('SELECT * FROM channel_index_status WHERE channel_id = ?');
    const status = stmt.get(String(channelId));
    
    // Also get current total files and favorite count from channel_files
    const filesStmt = this.db.prepare('SELECT COUNT(*) as count, SUM(is_favorite) as favorites FROM channel_files WHERE channel_id = ?');
    const stats = filesStmt.get(String(channelId));

    return {
      ...(status || {
        channel_id: String(channelId),
        status: 'idle',
        progress: 0,
        total_files: 0,
        last_sync_at: null,
        last_message_id: 0
      }),
      indexed_count: stats ? stats.count : 0,
      favorite_count: stats && stats.favorites ? stats.favorites : 0
    };
  }

  updateIndexStatus(channelId, data) {
    const current = this.getIndexStatus(channelId);
    const stmt = this.db.prepare(`
      INSERT INTO channel_index_status (
        channel_id, channel_title, total_files, last_message_id, last_sync_at, status, progress
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(channel_id) DO UPDATE SET
        channel_title = COALESCE(excluded.channel_title, channel_index_status.channel_title),
        total_files = COALESCE(excluded.total_files, channel_index_status.total_files),
        last_message_id = COALESCE(excluded.last_message_id, channel_index_status.last_message_id),
        last_sync_at = COALESCE(excluded.last_sync_at, channel_index_status.last_sync_at),
        status = COALESCE(excluded.status, channel_index_status.status),
        progress = COALESCE(excluded.progress, channel_index_status.progress)
    `);

    stmt.run(
      String(channelId),
      data.channelTitle !== undefined ? data.channelTitle : current.channel_title || '',
      data.totalFiles !== undefined ? data.totalFiles : current.total_files || 0,
      data.lastMessageId !== undefined ? data.lastMessageId : current.last_message_id || 0,
      data.lastSyncAt !== undefined ? data.lastSyncAt : current.last_sync_at,
      data.status !== undefined ? data.status : current.status || 'idle',
      data.progress !== undefined ? data.progress : current.progress || 0
    );
  }
}

module.exports = new DatabaseService();
