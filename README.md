# Bomberman DOM - Multiplayer Game

A real-time multiplayer Bomberman game built using DOM manipulation (no Canvas/WebGL) with a custom mini-framework and WebSocket communication.

## 🎮 Game Features

- **Multiplayer**: 2-4 players in real-time
- **DOM-based**: Pure DOM manipulation for 60fps performance
- **Custom Framework**: Built with a lightweight custom framework
- **WebSocket Communication**: Real-time multiplayer synchronization
- **Chat System**: In-game chat functionality
- **Power-ups**: Bomb capacity, explosion range, and speed boosts
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bomberman-dom
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:8080
```

## 🎯 How to Play

1. **Enter Nickname**: Choose a unique nickname on the landing page
2. **Waiting Room**: Wait for other players (2-4 players total)
3. **Game Start**: Game begins after countdown
4. **Controls**:
   - **Arrow Keys**: Move your player
   - **Space**: Place bomb
   - **Escape**: Open menu
5. **Objective**: Be the last player standing!

### Power-ups

- 🧨 **Bomb**: Increases bomb capacity
- 🔥 **Flame**: Increases explosion range
- ⚡ **Speed**: Increases movement speed

## 🏗️ Project Structure

```
bomberman-dom/
├── src/
│   ├── framework/           # Custom mini-framework
│   ├── game/
│   │   ├── components/      # Game components
│   │   ├── core/           # Core game logic
│   │   ├── networking/     # WebSocket client
│   │   ├── ui/             # UI components
│   │   └── utils/          # Utility functions
│   └── assets/
│       ├── css/            # Stylesheets
│       ├── images/         # Game images
│       └── sounds/         # Audio files
├── server/
│   ├── websocket/          # WebSocket server
│   ├── game-logic/         # Server game logic
│   └── utils/              # Server utilities
└── public/                 # Static assets
```

## 🛠️ Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server
- `npm run client` - Start client-only development server
- `npm test` - Run tests (when implemented)

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key configuration options:
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (error/warn/info/debug)

## 🎨 Technical Architecture

### Frontend
- **Custom Framework**: Lightweight DOM manipulation framework
- **Performance**: 60fps with requestAnimationFrame
- **Responsive**: CSS Grid and Flexbox for layout
- **Animations**: CSS animations with hardware acceleration

### Backend
- **WebSocket Server**: Real-time communication
- **Game Rooms**: Automatic matchmaking system
- **State Management**: Authoritative server architecture
- **Performance Monitoring**: Built-in performance tracking

### Communication Protocol
- **Message Types**: JSON-based WebSocket messages
- **Real-time Sync**: Game state synchronization
- **Error Handling**: Comprehensive error management
- **Reconnection**: Automatic reconnection logic

## 🔧 Configuration

### Game Settings
- **Board Size**: 15x13 grid
- **Player Lives**: 3 lives per player
- **Bomb Timer**: 3 seconds
- **Game Duration**: 5 minutes maximum
- **Waiting Timeout**: 20 seconds for additional players

### Performance Settings
- **Target FPS**: 60fps
- **Performance Monitor**: Optional FPS/ping display
- **Memory Management**: Automatic cleanup

## 🌐 Deployment

### Production Build

1. Set environment to production:
```bash
export NODE_ENV=production
```

2. Start the server:
```bash
npm start
```

### Docker Deployment

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🎯 Roadmap

- [ ] Sound effects and music
- [ ] Tournament mode
- [ ] Spectator mode
- [ ] Replay system
- [ ] Mobile app version
- [ ] AI opponents
- [ ] Custom maps
- [ ] Statistics tracking

## 🐛 Known Issues

- Mobile touch controls need refinement
- Occasional WebSocket reconnection delays
- Performance optimization for older browsers

## 📞 Support

For support, please open an issue on GitHub or contact the development team.

---

Built with ❤️ using DOM manipulation and WebSockets