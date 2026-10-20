const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegram');
const db = require('../services/db');
const channelIndexer = require('../services/channelIndexer');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // TODO: Verify session is valid and authenticated
  req.sessionId = sessionId;
  next();
};

// Get user's subscribed channels
router.get('/', requireAuth, async (req, res) => {
  try {
    const channels = await telegramService.getChannels(req.sessionId);
    
    res.json({ 
      channels,
      total: channels.length
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ 
      error: 'Failed to fetch channels',
      details: error.message
    });
  }
});

// Get videos/messages from a specific channel
router.get('/:channelId/videos', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 20, offsetId = 0, minId = 0 } = req.query;  // Added minId for newer messages
    
    // If minId is provided, get messages newer than minId
    // Otherwise, get messages older than offsetId (or latest if offsetId = 0)
    const videos = await telegramService.getChannelMessages(
      req.sessionId,
      channelId,
      parseInt(limit),
      parseInt(offsetId),
      parseInt(minId) > 0 ? parseInt(minId) : null  // Pass minId if provided
    );
    
    res.json({ 
      videos,
      channelId,
      count: videos.length,
      hasMore: videos.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching channel videos:', error);
    res.status(500).json({ 
      error: 'Failed to fetch channel videos',
      details: error.message
    });
  }
});

// Search for messages in a channel with pagination support
router.get('/:channelId/search', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { query, limit = 50, offsetId = 0 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchData = await telegramService.searchChannelMessages(
      req.sessionId,
      channelId,
      query,
      parseInt(limit),
      parseInt(offsetId) || 0
    );
    
    res.json({ 
      results: searchData.results,
      query,
      count: searchData.results.length,
      totalCount: searchData.totalCount,
      hasMore: searchData.hasMore
    });
  } catch (error) {
    console.error('Error searching channel:', error);
    res.status(500).json({ 
      error: 'Failed to search channel',
      details: error.message
    });
  }
});

// Get messages around a specific message ID
router.get('/:channelId/messages-around/:messageId', requireAuth, async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const { limit = 20 } = req.query;
    
    const messages = await telegramService.getMessagesAround(
      req.sessionId,
      channelId,
      parseInt(messageId),
      parseInt(limit)
    );
    
    res.json({ 
      videos: messages,
      targetId: messageId,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching messages around ID:', error);
    res.status(500).json({ 
      error: 'Failed to fetch messages around ID',
      details: error.message
    });
  }
});

// Get photo from a message - returns actual image
router.get('/:channelId/photo/:messageId', async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    // Get session from query param or header
    const sessionId = req.query.session || req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const photo = await telegramService.getMessagePhoto(
      sessionId,
      channelId,
      messageId
    );
    
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Return photo as image directly
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(photo);
  } catch (error) {
    console.error('Error fetching photo:', error);
    res.status(500).json({ 
      error: 'Failed to fetch photo',
      details: error.message
    });
  }
});

// Get channel info and statistics
router.get('/:channelId/info', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    
    // Get channel details
    const channels = await telegramService.getChannels(req.sessionId);
    const channel = channels.find(c => c.id === channelId);
    
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    res.json({ channel });
  } catch (error) {
    console.error('Error fetching channel info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch channel info',
      details: error.message
    });
  }
});

// Start indexing channel files
router.post('/:channelId/index', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { maxFiles = 1000, includeVideos = true } = req.body || {};

    const result = await channelIndexer.startIndexing(req.sessionId, channelId, {
      maxFiles: maxFiles ? parseInt(maxFiles) : null,
      includeVideos: Boolean(includeVideos)
    });

    res.json(result);
  } catch (error) {
    console.error('Error starting channel indexing:', error);
    res.status(500).json({
      error: 'Failed to start indexing',
      details: error.message
    });
  }
});

// Stop indexing channel files
router.post('/:channelId/index/stop', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const stopped = channelIndexer.stopIndexing(channelId);
    res.json({ stopped, channelId });
  } catch (error) {
    console.error('Error stopping channel indexing:', error);
    res.status(500).json({
      error: 'Failed to stop indexing',
      details: error.message
    });
  }
});

// Get index status & statistics for a channel
router.get('/:channelId/index-status', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const status = db.getIndexStatus(channelId);
    const isRunning = channelIndexer.isIndexing(channelId);

    res.json({
      ...status,
      is_running: isRunning
    });
  } catch (error) {
    console.error('Error getting index status:', error);
    res.status(500).json({
      error: 'Failed to get index status',
      details: error.message
    });
  }
});

// Get indexed files with search, filtering, and wishlist
router.get('/:channelId/files', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const {
      query = '',
      mediaType = 'all',
      extension = '',
      favorite = 'false',
      page = 1,
      limit = 50,
      sortBy = 'message_id',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;
    const isFavorite = favorite === 'true' || favorite === '1';

    const filterOptions = {
      query,
      mediaType,
      extension,
      isFavorite,
      limit: limitNum,
      offset,
      sortBy,
      sortOrder
    };

    const files = db.getFiles(channelId, filterOptions);
    const total = db.getFileCount(channelId, filterOptions);

    res.json({
      files,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error getting indexed files:', error);
    res.status(500).json({
      error: 'Failed to get indexed files',
      details: error.message
    });
  }
});

// Toggle wishlist / favorite for a file
router.post('/:channelId/files/:messageId/favorite', requireAuth, async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const { isFavorite } = req.body || {};

    let result;
    if (isFavorite !== undefined) {
      result = db.setFavorite(channelId, messageId, Boolean(isFavorite));
    } else {
      result = db.toggleFavorite(channelId, messageId);
    }

    if (result === null) {
      return res.status(404).json({ error: 'File not found in index' });
    }

    res.json({
      success: true,
      channelId,
      messageId: parseInt(messageId),
      is_favorite: result
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({
      error: 'Failed to toggle favorite',
      details: error.message
    });
  }
});

// Get distinct extensions in channel for filter chips
router.get('/:channelId/extensions', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const extensions = db.getExtensions(channelId);
    res.json({ extensions });
  } catch (error) {
    console.error('Error getting extensions:', error);
    res.status(500).json({
      error: 'Failed to get extensions',
      details: error.message
    });
  }
});

module.exports = router;