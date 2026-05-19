import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Game constants
const GRID_SIZE = 20;
const CELL_SIZE = 25;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 3;
const POINTS_PER_FOOD = 10;

type Position = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

// Sound hook with generated audio
const useSound = () => {
  const eatAudioRef = useRef<HTMLAudioElement | null>(null);
  const levelupAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    eatAudioRef.current = new Audio('/eat-sfx.mp3');
    levelupAudioRef.current = new Audio('/levelup.mp3');
    bgMusicRef.current = new Audio('/bg-music.mp3');
    
    if (bgMusicRef.current) {
      bgMusicRef.current.loop = true;
      bgMusicRef.current.volume = 0.4;
    }
  }, []);

  const playEat = useCallback(() => {
    if (eatAudioRef.current) {
      eatAudioRef.current.currentTime = 0;
      eatAudioRef.current.play().catch(() => {});
    }
  }, []);

  const playLevelUp = useCallback(() => {
    if (levelupAudioRef.current) {
      levelupAudioRef.current.currentTime = 0;
      levelupAudioRef.current.play().catch(() => {});
    }
  }, []);

  const playGameOver = useCallback(() => {
    // Create game over sound with Web Audio
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  }, []);

  const startMusic = useCallback(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.play().catch(() => {});
    }
  }, []);

  const stopMusic = useCallback(() => {
    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
      bgMusicRef.current.currentTime = 0;
    }
  }, []);

  return { playEat, playLevelUp, playGameOver, startMusic, stopMusic };
};

const generateFood = (snake: Position[]): Position => {
  let newFood: Position;
  do {
    newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(s => s.x === newFood.x && s.y === newFood.y));
  return newFood;
};

export default function App() {
  const { playEat, playLevelUp, playGameOver, startMusic, stopMusic } = useSound();
  
  const [gameState, setGameState] = useState<GameState>('menu');
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [nextDirection, setNextDirection] = useState<Direction>('RIGHT');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [particles, setParticles] = useState<Position[]>([]);
  const [showLogo, setShowLogo] = useState(true);
  
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('snakeNeverHighScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snakeNeverHighScore', score.toString());
    }
  }, [score, highScore]);

  // Logo animation
  useEffect(() => {
    const timer = setTimeout(() => setShowLogo(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = prevSnake[0];
      let newHead: Position;

      switch (nextDirection) {
        case 'UP': newHead = { x: head.x, y: head.y - 1 }; break;
        case 'DOWN': newHead = { x: head.x, y: head.y + 1 }; break;
        case 'LEFT': newHead = { x: head.x - 1, y: head.y }; break;
        case 'RIGHT': newHead = { x: head.x + 1, y: head.y }; break;
      }

      // Wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        playGameOver();
        stopMusic();
        setGameState('gameover');
        return prevSnake;
      }

      // Self collision
      if (prevSnake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        playGameOver();
        stopMusic();
        setGameState('gameover');
        return prevSnake;
      }

      // Food collision
      const ateFood = newHead.x === food.x && newHead.y === food.y;
      
      if (ateFood) {
        playEat();
        setScore(s => s + POINTS_PER_FOOD);
        setFood(generateFood([...prevSnake, newHead]));
        setParticles([...particles, { ...food }]);
        setTimeout(() => setParticles([]), 500);
        
        // Level up every 50 points
        if ((score + POINTS_PER_FOOD) % 50 === 0) {
          setLevel(l => l + 1);
          setSpeed(s => Math.max(50, s - SPEED_INCREMENT));
          playLevelUp();
        }
        
        return [newHead, ...prevSnake];
      }

      setDirection(nextDirection);
      return [newHead, ...prevSnake.slice(0, -1)];
    });
  }, [nextDirection, food, playEat, playLevelUp, playGameOver, stopMusic, score, particles]);

  // Game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = window.setInterval(moveSnake, speed);
      return () => {
        if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      };
    }
  }, [gameState, speed, moveSnake]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState === 'menu' || gameState === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') startGame();
        return;
      }

      if (e.key === 'Escape' || e.key === 'p') {
        setGameState(gameState === 'paused' ? 'playing' : 'paused');
        return;
      }

      if (gameState === 'paused') return;

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (direction !== 'DOWN') setNextDirection('UP');
          break;
        case 'ArrowDown': case 's': case 'S':
          if (direction !== 'UP') setNextDirection('DOWN');
          break;
        case 'ArrowLeft': case 'a': case 'A':
          if (direction !== 'RIGHT') setNextDirection('LEFT');
          break;
        case 'ArrowRight': case 'd': case 'D':
          if (direction !== 'LEFT') setNextDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, direction]);

  // Touch controls
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameState !== 'playing') return;
    
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30 && direction !== 'LEFT') setNextDirection('RIGHT');
      else if (dx < -30 && direction !== 'RIGHT') setNextDirection('LEFT');
    } else {
      if (dy > 30 && direction !== 'UP') setNextDirection('DOWN');
      else if (dy < -30 && direction !== 'DOWN') setNextDirection('UP');
    }

    touchStartRef.current = null;
  };

  const startGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood([{ x: 10, y: 10 }]));
    setDirection('RIGHT');
    setNextDirection('RIGHT');
    setScore(0);
    setLevel(1);
    setSpeed(INITIAL_SPEED);
    setParticles([]);
    startMusic();
    setGameState('playing');
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 opacity-30">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(197,160,89,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(197,160,89,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'pulse-glow 4s ease-in-out infinite'
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <motion.h1
            animate={{ 
              textShadow: ['0 0 20px rgba(197,160,89,0.5)', '0 0 60px rgba(0,255,255,0.8)', '0 0 20px rgba(197,160,89,0.5)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-5xl md:text-7xl font-display font-bold text-gradient-gold mb-2"
          >
            🐍 SNAKE NEVER
          </motion.h1>
          <p className="text-gray-400 text-lg">The Ultimate Snake Experience</p>
        </div>

        {/* Score bar */}
        <div className="glass-gold rounded-2xl p-4 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Score</p>
              <p className="text-3xl font-mono font-bold text-gold">{score}</p>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Best</p>
              <p className="text-3xl font-mono font-bold text-cyan">{highScore}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Level</p>
            <p className="text-3xl font-mono font-bold text-white">{level}</p>
          </div>
        </div>

        {/* Game area */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="glass rounded-2xl p-4 relative overflow-hidden"
          style={{ aspectRatio: '1' }}
        >
          {/* Logo overlay */}
          <AnimatePresence>
            {showLogo && gameState === 'menu' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-surface/95"
              >
                <motion.img
                  src="/logo.png"
                  alt="Snake Never"
                  className="w-3/4 max-w-md"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(0,255,255,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,255,255,0.5) 1px, transparent 1px)
              `,
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`
            }}
          />

          {/* Game canvas */}
          <div
            className="relative w-full h-full"
            style={{ width: GRID_SIZE * CELL_SIZE, height: GRID_SIZE * CELL_SIZE, margin: '0 auto' }}
          >
            {/* Food */}
            <motion.div
              animate={{ 
                scale: [1, 1.3, 1],
                boxShadow: ['0 0 15px #00FFFF', '0 0 40px #00FFFF', '0 0 15px #00FFFF']
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-cyan to-cyan-dark"
              style={{
                left: food.x * CELL_SIZE + CELL_SIZE / 2 - 12,
                top: food.y * CELL_SIZE + CELL_SIZE / 2 - 12,
              }}
            />

            {/* Particles */}
            {particles.map((p, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 3, opacity: 0 }}
                className="absolute w-3 h-3 rounded-full bg-gold"
                style={{
                  left: p.x * CELL_SIZE + CELL_SIZE / 2 - 6,
                  top: p.y * CELL_SIZE + CELL_SIZE / 2 - 6,
                }}
              />
            ))}

            {/* Snake */}
            {snake.map((seg, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute rounded-md"
                style={{
                  left: seg.x * CELL_SIZE + 2,
                  top: seg.y * CELL_SIZE + 2,
                  width: CELL_SIZE - 4,
                  height: CELL_SIZE - 4,
                  background: i === 0
                    ? 'linear-gradient(135deg, #C5A059 0%, #D4B06A 50%, #00FFFF 100%)'
                    : `linear-gradient(135deg, hsl(${45 + i * 3}, 80%, 55%) 0%, hsl(${55 + i * 3}, 70%, 45%) 100%)`,
                  boxShadow: i === 0 ? '0 0 20px rgba(197,160,89,0.8), 0 0 40px rgba(0,255,255,0.5)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Menu overlay */}
          <AnimatePresence>
            {gameState === 'menu' && !showLogo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 glass-gold rounded-2xl flex flex-col items-center justify-center"
              >
                <motion.div
                  animate={{ y: [0, -15, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="text-9xl mb-6"
                >
                  🐍
                </motion.div>
                <h2 className="text-4xl font-display font-bold text-gradient-gold mb-4">
                  SNAKE NEVER
                </h2>
                <p className="text-gray-400 mb-2 text-center">
                  Use WASD or Arrow Keys to move
                </p>
                <p className="text-gray-500 mb-8 text-sm">
                  Touch swipe on mobile • ESC to pause
                </p>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-12 py-4 bg-gradient-to-r from-gold to-gold-light text-surface font-bold rounded-xl text-xl glow-gold"
                >
                  START GAME
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pause overlay */}
          <AnimatePresence>
            {gameState === 'paused' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 glass rounded-2xl flex flex-col items-center justify-center"
              >
                <h2 className="text-5xl font-display font-bold text-gradient-cyan mb-6">
                  PAUSED
                </h2>
                <p className="text-gray-400 mb-8">Press ESC or P to resume</p>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setGameState('playing')}
                  className="px-12 py-4 bg-gradient-to-r from-cyan to-cyan-dark text-surface font-bold rounded-xl text-xl glow-cyan"
                >
                  RESUME
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game over overlay */}
          <AnimatePresence>
            {gameState === 'gameover' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 glass rounded-2xl flex flex-col items-center justify-center"
              >
                <motion.img
                  src="/gameover.png"
                  alt="Game Over"
                  className="w-48 mb-4"
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <h2 className="text-5xl font-display font-bold text-red-500 mb-4">
                  GAME OVER
                </h2>
                <div className="text-center mb-6">
                  <p className="text-gray-400">Final Score</p>
                  <p className="text-6xl font-mono font-bold text-gold">{score}</p>
                  {score >= highScore && score > 0 && (
                    <motion.p
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="text-cyan mt-2 text-xl"
                    >
                      🏆 NEW HIGH SCORE!
                    </motion.p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startGame}
                  className="px-10 py-4 bg-gradient-to-r from-gold to-gold-light text-surface font-bold rounded-xl text-xl glow-gold mb-4"
                >
                  PLAY AGAIN
                </motion.button>
                <p className="text-gray-500 text-sm">Press ENTER to restart</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="glass rounded-xl p-3 mt-4 text-center text-sm text-gray-500">
          <p>4neverCompany • Snake Never 🐍</p>
        </div>
      </div>
    </div>
  );
}