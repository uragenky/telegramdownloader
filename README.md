# TeleDown - Telegram Video & File Downloader

A powerful web-based Telegram downloader and channel indexer that supports downloading videos, documents, game ROMs, and archives from both public and **private channels** that you have access to.

## ✨ Key Features

- 🔐 **Download from Private Channels** - Access and download files from private Telegram channels you're a member of
- 📁 **Full Channel File Indexer** - Crawl and index entire channels into a local SQLite database for instant, rate-limit-free search
- ⭐ **Wishlist / Favorites** - Bookmark any files (games, archives, movies) to your wishlist
- 🎮 **Multi-Format Classification** - Smart recognition of Nintendo Switch packages (`.nsp`, `.xci`, `.nsz`), multi-part archives (`.zip`, `.rar`, `.001`), videos, and documents
- 📺 Support for public channels and groups
- 🎥 High-quality video & file downloads with original resolution and names
- 📊 Progress tracking with real-time updates via WebSocket (Socket.IO)
- 🌐 Web-based interface - no installation required for users
- 🚀 Fast and efficient downloading with concurrent support
- 📱 Responsive design for desktop and mobile
- 🔄 Session persistence - stay logged in across restarts
- 🔽 **Dual Download Options** - Choose between direct browser download or queued background server download
- 🤖 **Smart Batch Detection** - Automatically finds and groups related videos for batch downloading
- 🔍 **Fast Local & In-Channel Search** - Search across indexed files instantly or query live channel history
- ⏫ **Smart Navigation** - Load newer or older messages with dedicated buttons
- 🎯 **Queue Management** - Configurable concurrent download limits for optimal performance
- 🔁 **Auto-Retry** - Automatic retry mechanism for failed downloads with exponential backoff

## 🛠️ Tech Stack

- **Frontend**: React + Vite + Modern CSS
- **Backend**: Node.js + Express
- **Telegram API**: GramJS (MTProto client)
- **Database**: SQLite (Node.js built-in `node:sqlite`) for indexing and favorites
- **Real-time Updates**: Socket.IO

## 📋 Prerequisites

- Node.js (v20 or higher recommended, minimum v18)
- npm or yarn
- Telegram API credentials (API ID and API Hash)

## 🚀 Installation

### Step 1: Clone the Repository

```bash
git clone git@github.com:uragenky/telegramdownloader.git
cd telegramdownloader
```

### Step 2: Install Dependencies

Install root & backend dependencies:
```bash
npm install
```

Install frontend dependencies:
```bash
cd frontend && npm install && cd ..
```

### Step 3: Configure Telegram API

1. **Get your Telegram API credentials**:
   - Visit https://my.telegram.org
   - Log in with your phone number
   - Go to "API Development Tools"
   - Create a new application if you haven't already
   - Copy your `api_id` and `api_hash`

2. **Create environment configuration**:

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=8888
API_ID=your_api_id
API_HASH=your_api_hash
MAX_CONCURRENT_DOWNLOADS=2
DOWNLOAD_DIR=./downloads
```

## 🏃‍♂️ Running the Application

### Development Mode

Start the backend server (runs on port 8888 by default):
```bash
npm run dev
# or: npm start
```

In another terminal, start the frontend development server:
```bash
npm run frontend
# or: cd frontend && npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8888

### Production Build

Build frontend:
```bash
npm run build
```

Then run the server:
```bash
npm start
```

## 🌟 Key Features Explained

### Smart Download System

TeleDown features an intelligent dual-download system that adapts to your needs:

#### 🔽 Single Video Download (Blue Button)
- Downloads only the selected video file
- Perfect for specific content you need immediately
- Faster for individual files
- No additional processing or analysis

#### 📦 Intelligent Batch Download (Purple Button)
- **Smart Content Detection**: Automatically analyzes message patterns to find related videos
- **Text Message Association**: Uses adjacent text messages to group related content
- **Automatic Folder Organization**: Creates folders based on the descriptive text content
- **Confirmation Dialog**: Shows you exactly what will be downloaded before starting
- **Queue Management**: Downloads are processed in controlled batches (configurable via MAX_CONCURRENT_DOWNLOADS)
- **Clean File Naming**: Preserves original filenames from Telegram for consistency

**How Batch Download Works:**
1. Analyzes the selected video's context within the channel
2. Searches backward and forward for related text messages
3. Identifies video groups based on message timestamps and content patterns  
4. Presents a confirmation dialog with folder name and video list
5. Downloads all related videos to an organized folder structure

This intelligent system is perfect for content series, multi-part videos, or collections that are posted together but may be separated by other messages in the channel.

### 📁 Channel File Indexer & Wishlist System

For channels with thousands of documents and games (like ROM sharing or archive channels):
- **Local Indexing**: Scans document messages in chunks and stores metadata (filename, size, MIME type, extension, caption) in a high-performance SQLite database.
- **Smart Category Detection**: Auto-detects Switch packages (`.nsp`, `.xci`, `.nsz`), split archives (`.zip.001`, `.rar`), audio, and video files.
- **Instant Search**: Search through 10,000+ files locally by title or caption in milliseconds without hitting Telegram rate limits (`FLOOD_WAIT`).
- **Wishlist Tracking**: Star files with one click to build a personal download queue or wish list.
- **Direct & Server Downloads**: Stream files straight to your browser with original filenames preserved, or send them to the server download queue.

## 📖 Usage Guide

### 1. Login to Telegram

- Open the application in your browser
- Enter your phone number with country code
- Enter the verification code sent to your Telegram app
- If you have 2FA enabled, enter your password
- Your session will be saved for future use

### 2. Browse Channels

- View all channels you have access to (both public and private)
- Search channels by name
- See channel statistics (member count, post count)
- Channels are paginated for better performance

### 3. Download Videos

- Click on any channel to view its media content
- Preview video thumbnails and information with metadata (duration, file size)
- **Two Download Options Available**:
  - **🔽 Single Download (Blue Button)**: Downloads only the selected video
  - **📦 Batch Download (Purple Button)**: Automatically finds and downloads all related videos in the group
- Monitor real-time download progress with WebSocket updates
- Downloads are organized into folders based on content groups
- All downloads are saved to the configured directory

### 4. Manage Downloads

- View active downloads with progress bars
- See queued downloads waiting to start
- Cancel unwanted downloads
- Access download history
- Automatic retry for failed downloads (FILE_REFERENCE_EXPIRED errors)
- Configurable concurrent download limits

## 🔒 Security & Privacy

- **Secure Authentication**: Uses official Telegram MTProto protocol
- **Session Encryption**: All session data is encrypted locally
- **No Third Parties**: Direct connection to Telegram servers
- **Private Downloads**: Your download activity is completely private
- **Data Protection**: No user data is collected or shared

## 📁 Project Structure

```
teledownapp/
├── backend/
│   ├── routes/
│   │   ├── auth.js          # Telegram authentication routes
│   │   ├── channels.js      # Channel listing, history, & indexing API
│   │   └── download.js      # Browser stream & queue download routes
│   ├── services/
│   │   ├── channelIndexer.js # Channel crawler & indexer service
│   │   ├── db.js             # SQLite file & wishlist service
│   │   ├── sessionStore.js   # Session persistence manager
│   │   └── telegram.js       # GramJS client wrapper & download handlers
│   └── server.js            # Express & Socket.IO server entry point
├── frontend/
│   ├── src/
│   │   ├── components/      # React components (FileList, VideoList, etc.)
│   │   ├── App.jsx          # Main application component
│   │   ├── index.css        # Base styling
│   │   └── main.jsx         # React mounting entry point
│   ├── package.json
│   └── vite.config.js
├── downloads/               # Directory for server-downloaded files
├── sessions/                # Stored Telegram session tokens (git-ignored)
├── package.json             # Root dependencies & run scripts
└── README.md
```

## 🔧 API Documentation

### Authentication
- `POST /api/auth/send-code` - Send verification code
- `POST /api/auth/verify-code` - Verify code and login
- `POST /api/auth/check-session` - Check session status
- `POST /api/auth/logout` - Logout and clear session

### Channels & Media
- `GET /api/channels` - List all accessible channels
- `GET /api/channels/:id/info` - Get channel metadata
- `GET /api/channels/:id/videos` - Get channel messages/videos (paginated)
- `GET /api/channels/:id/search` - Live search channel messages

### File Indexing & Wishlist
- `POST /api/channels/:id/index` - Start background indexing of channel files (`maxFiles`, `includeVideos`)
- `POST /api/channels/:id/index/stop` - Stop active background indexing
- `GET /api/channels/:id/index-status` - Get index status, total files, and wishlist counts
- `GET /api/channels/:id/files` - Query indexed files with search (`query`), category (`mediaType`), extension (`extension`), wishlist (`favorite=true`), and pagination
- `POST /api/channels/:id/files/:messageId/favorite` - Toggle or set wishlist status
- `GET /api/channels/:id/extensions` - Get list of file extensions and counts in channel

### Downloads
- `GET /api/download/browser/:channelId/:fileId` - Stream file directly to browser with original filename
- `POST /api/download/start` - Queue server-side download for video or file
- `POST /api/download/batch` - Start batch download of related files
- `POST /api/download/find-related` - Find related messages for batch grouping
- `GET /api/download/progress/:id` - Get download progress
- `POST /api/download/cancel/:id` - Cancel download
- `GET /api/download/list` - Get list of server downloads

## 🚨 Troubleshooting

### Common Issues

1. **Login Issues**
   - Ensure phone number includes country code
   - Check if 2FA is enabled on your account
   - Clear browser cache and cookies

2. **Download Failures**
   - Check internet connection
   - Verify you have access to the channel
   - Ensure sufficient disk space
   - FILE_REFERENCE_EXPIRED errors are automatically retried

3. **Session Expired**
   - Re-login with your credentials
   - Sessions expire after 30 days of inactivity

4. **Slow Batch Downloads**
   - Adjust MAX_CONCURRENT_DOWNLOADS in .env file
   - Default is 2 for stability, can be increased based on your connection

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow modern JavaScript and React best practices
- Update documentation as needed
- Test changes thoroughly with Telegram channels

## ⚠️ Disclaimer

This tool is intended for personal use only. Please respect content creators' rights and Telegram's Terms of Service:

- Only download content you have permission to access
- Do not redistribute downloaded content without permission
- Respect copyright and intellectual property rights
- Use responsibly and ethically

The developers are not responsible for any misuse of this tool.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments & Credits

- **Original Base Project**: Based on [teledown](https://github.com/EricZhengH/teledown) by [@EricZhengH](https://github.com/EricZhengH).
- [GramJS](https://github.com/gram-js/gramjs) - Telegram MTProto client library
- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [Socket.IO](https://socket.io/) - Real-time bidirectional communication

## 📞 Support

If you encounter any issues or have questions:

- Check the [Issues](https://github.com/yourusername/teledown/issues) page
- Create a new issue with detailed information
- Include error messages and steps to reproduce
- Join our [Telegram Support Group](https://t.me/teledown_support)

## 🔮 Future Features

- [x] Batch download with queue management
- [x] In-channel search functionality
- [x] Load newer/older messages navigation
- [ ] Download scheduling
- [ ] Video quality selection
- [ ] Audio-only extraction
- [ ] Subtitle download support
- [ ] Docker support for easy deployment
- [ ] Mobile app (React Native)
- [ ] Download resume capability
- [ ] Export download history

---

**⭐ Star this repository if you find it useful!**

**Note**: This tool requires active Telegram account authentication and only works with channels you have legitimate access to. It's designed to help you manage and backup your accessible content for personal use.