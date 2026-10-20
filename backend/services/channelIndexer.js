const { Api } = require('telegram');
const db = require('./db');
const telegramService = require('./telegram');

class ChannelIndexer {
  constructor() {
    this.activeJobs = new Map();
  }

  isIndexing(channelId) {
    const job = this.activeJobs.get(String(channelId));
    return Boolean(job && !job.finished);
  }

  stopIndexing(channelId) {
    const job = this.activeJobs.get(String(channelId));
    if (job) {
      job.stopRequested = true;
      return true;
    }
    return false;
  }

  async startIndexing(sessionId, channelId, options = {}) {
    const idStr = String(channelId);
    if (this.isIndexing(idStr)) {
      return { status: 'already_running', channelId: idStr };
    }

    const {
      maxFiles = 1000,
      includeVideos = true
    } = options;

    const job = {
      channelId: idStr,
      sessionId,
      stopRequested: false,
      finished: false,
      processed: 0,
      total: 0,
      startTime: Date.now()
    };
    this.activeJobs.set(idStr, job);

    // Fire and forget in background
    this.runIndexingJob(job, maxFiles, includeVideos).catch(err => {
      console.error(`Indexing error for channel ${idStr}:`, err);
    });

    return { status: 'started', channelId: idStr };
  }

  async runIndexingJob(job, maxFiles, includeVideos) {
    const { channelId, sessionId } = job;
    try {
      await telegramService.ensureInitialized();
      const sessionData = telegramService.sessions.get(sessionId) || await telegramService.restoreSession(sessionId);
      if (!sessionData || !sessionData.authenticated) {
        throw new Error('User not authenticated');
      }

      const client = sessionData.client;
      const properPeer = telegramService.normalizePeerId(channelId);
      const entity = await client.getEntity(properPeer);
      const channelTitle = entity.title || 'Channel';

      db.updateIndexStatus(channelId, {
        channelTitle,
        status: 'indexing',
        progress: 0
      });

      this.emitProgress(channelId, {
        status: 'indexing',
        indexed: db.getFileCount(channelId),
        percentage: 0,
        channelTitle
      });

      // 1. Index documents (games, ROMs, archives, etc.)
      await this.indexWithFilter(client, entity, channelId, new Api.InputMessagesFilterDocument(), job, maxFiles);

      // 2. Index videos if requested and limit not yet reached
      if (includeVideos && !job.stopRequested && (!maxFiles || job.processed < maxFiles)) {
        const remainingLimit = maxFiles ? (maxFiles - job.processed) : null;
        await this.indexWithFilter(client, entity, channelId, new Api.InputMessagesFilterVideo(), job, remainingLimit);
      }

      const totalInDb = db.getFileCount(channelId);
      const finalStatus = job.stopRequested ? 'stopped' : 'completed';

      db.updateIndexStatus(channelId, {
        channelTitle,
        status: finalStatus,
        totalFiles: totalInDb,
        lastSyncAt: Date.now(),
        progress: 100
      });

      this.emitProgress(channelId, {
        status: finalStatus,
        indexed: totalInDb,
        total: totalInDb,
        percentage: 100,
        channelTitle
      });

    } catch (err) {
      console.error('Error during indexing:', err);
      db.updateIndexStatus(channelId, {
        status: 'error',
        progress: 0
      });
      this.emitProgress(channelId, {
        status: 'error',
        error: err.message
      });
    } finally {
      job.finished = true;
      this.activeJobs.delete(channelId);
    }
  }

  async indexWithFilter(client, entity, channelId, filter, job, limit) {
    let offsetId = 0;
    let hasMore = true;
    const batchSize = 100;

    const initial = await client.getMessages(entity, { filter, limit: 1 });
    const totalAvailable = initial.total || 0;
    const targetTotal = limit ? Math.min(limit, totalAvailable) : totalAvailable;

    while (hasMore && !job.stopRequested) {
      const currentBatchLimit = limit 
        ? Math.min(batchSize, limit - job.processed) 
        : batchSize;

      if (currentBatchLimit <= 0) break;

      const messages = await client.getMessages(entity, {
        filter,
        limit: currentBatchLimit,
        offsetId
      });

      if (!messages || messages.length === 0) {
        break;
      }

      const filesToInsert = [];

      for (const msg of messages) {
        if (!msg.media) continue;

        let fileName = '';
        let fileSize = 0;
        let mimeType = '';

        if (msg.media.document) {
          const doc = msg.media.document;
          fileSize = doc.size ? Number(doc.size) : 0;
          mimeType = doc.mimeType || '';
          const fileAttr = doc.attributes?.find(a => a.className === 'DocumentAttributeFilename');
          fileName = fileAttr?.fileName || '';
        }

        if (!fileName) {
          const firstLine = msg.message ? msg.message.split('\n')[0].trim() : '';
          fileName = firstLine ? firstLine.substring(0, 80) : `file_${msg.id}`;
        }

        filesToInsert.push({
          channelId,
          messageId: msg.id,
          fileName,
          fileSize,
          mimeType,
          caption: msg.message || '',
          date: msg.date || Math.floor(Date.now() / 1000),
          views: msg.views || 0
        });
      }

      if (filesToInsert.length > 0) {
        db.upsertFilesBatch(filesToInsert);
        job.processed += filesToInsert.length;
      }

      const totalInDb = db.getFileCount(channelId);
      const percentage = targetTotal > 0 ? Math.min(100, Math.round((job.processed / targetTotal) * 100)) : 100;

      this.emitProgress(channelId, {
        status: 'indexing',
        indexed: totalInDb,
        batchProcessed: job.processed,
        targetTotal,
        percentage
      });

      offsetId = messages[messages.length - 1].id;
      if (messages.length < currentBatchLimit) {
        hasMore = false;
      }

      // Delay to respect Telegram limits
      await new Promise(r => setTimeout(r, 250));
    }
  }

  emitProgress(channelId, data) {
    if (global.io) {
      global.io.emit('indexing_progress', { channelId, ...data });
    }
  }
}

module.exports = new ChannelIndexer();
