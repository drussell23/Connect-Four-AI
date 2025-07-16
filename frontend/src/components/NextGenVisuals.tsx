import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import './NextGenVisuals.css';

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'spark' | 'glow' | 'trail' | 'burst' | 'wave' | 'neural';
}

interface VisualEffect {
  id: string;
  type: 'win' | 'lose' | 'move' | 'hint' | 'achievement' | 'background';
  intensity: number;
  duration: number;
  color?: string;
  position?: { x: number; y: number };
}

interface VisualSettings {
  particleSystem: boolean;
  backgroundEffects: boolean;
  gameAnimations: boolean;
  uiEffects: boolean;
  performanceMode: 'high' | 'medium' | 'low' | 'minimal';
  particleDensity: number;
  animationSpeed: number;
  colorScheme: 'default' | 'neon' | 'classic' | 'cyberpunk' | 'nature' | 'space';
  immersiveMode: boolean;
  dynamicLighting: boolean;
  particleTrails: boolean;
  bloomEffect: boolean;
}

interface NextGenVisualsProps {
  isVisible: boolean;
  onClose: () => void;
  gameState?: any;
  boardElement?: HTMLElement | null;
  triggerEffect?: (effect: VisualEffect) => void;
}

const NextGenVisuals: React.FC<NextGenVisualsProps> = ({
  isVisible,
  onClose,
  gameState,
  boardElement,
  triggerEffect
}) => {
  const [activeTab, setActiveTab] = useState<'effects' | 'particles' | 'themes' | 'settings' | 'demo'>('effects');
  const [visualSettings, setVisualSettings] = useState<VisualSettings>({
    particleSystem: true,
    backgroundEffects: true,
    gameAnimations: true,
    uiEffects: true,
    performanceMode: 'high',
    particleDensity: 100,
    animationSpeed: 1,
    colorScheme: 'default',
    immersiveMode: false,
    dynamicLighting: true,
    particleTrails: true,
    bloomEffect: true
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [currentEffect, setCurrentEffect] = useState<VisualEffect | null>(null);
  
  // Color schemes
  const colorSchemes = {
    default: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#06b6d4',
      particles: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'],
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
    },
    neon: {
      primary: '#ff0080',
      secondary: '#00ff80',
      accent: '#8000ff',
      particles: ['#ff0080', '#00ff80', '#8000ff', '#ffff00', '#ff8000'],
      background: 'linear-gradient(135deg, #000000 0%, #1a0033 50%, #330066 100%)'
    },
    classic: {
      primary: '#dc2626',
      secondary: '#fbbf24',
      accent: '#059669',
      particles: ['#dc2626', '#fbbf24', '#059669', '#1d4ed8'],
      background: 'linear-gradient(135deg, #1f2937 0%, #374151 50%, #4b5563 100%)'
    },
    cyberpunk: {
      primary: '#00d9ff',
      secondary: '#ff006e',
      accent: '#ffbe0b',
      particles: ['#00d9ff', '#ff006e', '#ffbe0b', '#8338ec', '#fb5607'],
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)'
    },
    nature: {
      primary: '#059669',
      secondary: '#0891b2',
      accent: '#65a30d',
      particles: ['#059669', '#0891b2', '#65a30d', '#ca8a04', '#dc2626'],
      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)'
    },
    space: {
      primary: '#7c3aed',
      secondary: '#2563eb',
      accent: '#0891b2',
      particles: ['#7c3aed', '#2563eb', '#0891b2', '#06b6d4', '#8b5cf6'],
      background: 'linear-gradient(135deg, #000000 0%, #1e1b4b 50%, #312e81 100%)'
    }
  };

  // Initialize particle system
  useEffect(() => {
    if (isVisible && visualSettings.particleSystem) {
      initializeParticles();
      startAnimation();
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible, visualSettings.particleSystem]);

  // Update canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      };
      
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [isVisible]);

  const initializeParticles = () => {
    const particleCount = Math.floor(visualSettings.particleDensity * 
      (visualSettings.performanceMode === 'high' ? 1 : 
       visualSettings.performanceMode === 'medium' ? 0.7 :
       visualSettings.performanceMode === 'low' ? 0.4 : 0.2));
    
    particlesRef.current = [];
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push(createParticle());
    }
  };

  const createParticle = (config?: Partial<Particle>): Particle => {
    const canvas = canvasRef.current;
    const width = canvas?.clientWidth || 800;
    const height = canvas?.clientHeight || 600;
    const scheme = colorSchemes[visualSettings.colorScheme];
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      x: config?.x ?? Math.random() * width,
      y: config?.y ?? Math.random() * height,
      vx: config?.vx ?? (Math.random() - 0.5) * 2,
      vy: config?.vy ?? (Math.random() - 0.5) * 2,
      size: config?.size ?? Math.random() * 3 + 1,
      color: config?.color ?? scheme.particles[Math.floor(Math.random() * scheme.particles.length)],
      life: config?.life ?? Math.random() * 1000 + 500,
      maxLife: config?.maxLife ?? Math.random() * 1000 + 500,
      type: config?.type ?? (['spark', 'glow', 'trail'] as const)[Math.floor(Math.random() * 3)],
      ...config
    };
  };

  const updateParticles = (deltaTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    particlesRef.current = particlesRef.current.filter(particle => {
      // Update position
      particle.x += particle.vx * deltaTime * visualSettings.animationSpeed;
      particle.y += particle.vy * deltaTime * visualSettings.animationSpeed;
      
      // Update life
      particle.life -= deltaTime;
      
      // Boundary handling
      if (particle.x < 0 || particle.x > width) particle.vx *= -0.8;
      if (particle.y < 0 || particle.y > height) particle.vy *= -0.8;
      
      // Keep particles in bounds
      particle.x = Math.max(0, Math.min(width, particle.x));
      particle.y = Math.max(0, Math.min(height, particle.y));
      
      return particle.life > 0;
    });
    
    // Add new particles to maintain count
    while (particlesRef.current.length < visualSettings.particleDensity * 0.5) {
      particlesRef.current.push(createParticle());
    }
  };

  const renderParticles = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // Enable blur effect if bloom is enabled
    if (visualSettings.bloomEffect) {
      ctx.filter = 'blur(0.5px)';
    }
    
    particlesRef.current.forEach(particle => {
      const alpha = particle.life / particle.maxLife;
      
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      
      switch (particle.type) {
        case 'glow':
          renderGlowParticle(ctx, particle);
          break;
        case 'trail':
          renderTrailParticle(ctx, particle);
          break;
        case 'neural':
          renderNeuralParticle(ctx, particle);
          break;
        default:
          renderSparkParticle(ctx, particle);
      }
      
      ctx.restore();
    });
    
    ctx.filter = 'none';
  };

  const renderSparkParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    const gradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, particle.size
    );
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  };

  const renderGlowParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    ctx.shadowBlur = particle.size * 2;
    ctx.shadowColor = particle.color;
    ctx.fillStyle = particle.color;
    
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
  };

  const renderTrailParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = particle.size;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(particle.x - particle.vx * 5, particle.y - particle.vy * 5);
    ctx.lineTo(particle.x, particle.y);
    ctx.stroke();
  };

  const renderNeuralParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    // Find nearby particles for connections
    const nearbyParticles = particlesRef.current.filter(p => 
      p !== particle && 
      Math.abs(p.x - particle.x) < 100 && 
      Math.abs(p.y - particle.y) < 100
    );
    
    // Draw connections
    nearbyParticles.forEach(nearby => {
      const distance = Math.sqrt(
        Math.pow(nearby.x - particle.x, 2) + Math.pow(nearby.y - particle.y, 2)
      );
      
      if (distance < 80) {
        ctx.strokeStyle = particle.color;
        ctx.globalAlpha = (1 - distance / 80) * 0.3;
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(nearby.x, nearby.y);
        ctx.stroke();
      }
    });
    
    // Draw node
    renderSparkParticle(ctx, particle);
  };

  const startAnimation = () => {
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastUpdateRef.current;
      lastUpdateRef.current = currentTime;
      
      if (visualSettings.particleSystem) {
        updateParticles(deltaTime);
        renderParticles();
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const triggerVisualEffect = (effect: VisualEffect) => {
    setCurrentEffect(effect);
    
    // Create effect-specific particles
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const centerX = effect.position?.x ?? width / 2;
    const centerY = effect.position?.y ?? height / 2;
    
    const particleCount = effect.intensity * 20;
    const scheme = colorSchemes[visualSettings.colorScheme];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = effect.intensity * 5;
      
      particlesRef.current.push(createParticle({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 5 + 2,
        color: effect.color || scheme.particles[Math.floor(Math.random() * scheme.particles.length)],
        life: effect.duration,
        maxLife: effect.duration,
        type: effect.type === 'win' ? 'burst' : 
              effect.type === 'move' ? 'wave' : 
              effect.type === 'hint' ? 'neural' : 'glow'
      }));
    }
    
    // Clear effect after duration
    setTimeout(() => {
      if (currentEffect?.id === effect.id) {
        setCurrentEffect(null);
      }
    }, effect.duration);
  };

  const playDemo = () => {
    setIsPlayingDemo(true);
    
    const demoEffects = [
      { type: 'move', delay: 0 },
      { type: 'hint', delay: 1000 },
      { type: 'achievement', delay: 2000 },
      { type: 'win', delay: 3000 },
    ];
    
    demoEffects.forEach(({ type, delay }) => {
      setTimeout(() => {
        triggerVisualEffect({
          id: Math.random().toString(),
          type: type as any,
          intensity: Math.random() * 0.5 + 0.5,
          duration: 1000,
          position: {
            x: Math.random() * 400 + 200,
            y: Math.random() * 300 + 150
          }
        });
      }, delay);
    });
    
    setTimeout(() => {
      setIsPlayingDemo(false);
    }, 5000);
  };

  const updateSetting = <K extends keyof VisualSettings>(
    key: K, 
    value: VisualSettings[K]
  ) => {
    setVisualSettings(prev => ({ ...prev, [key]: value }));
    
    // Reinitialize particles if relevant settings changed
    if (['particleDensity', 'colorScheme', 'performanceMode'].includes(key)) {
      initializeParticles();
    }
  };

  const renderEffectsTab = () => (
    <div className="effects-tab">
      {/* Canvas for particles */}
      <motion.div 
        className="effects-canvas-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <canvas
          ref={canvasRef}
          className="effects-canvas"
          style={{ background: colorSchemes[visualSettings.colorScheme].background }}
        />
        
        <div className="canvas-overlay">
          <h3>Real-time Particle Effects</h3>
          <p>Interactive particle system with {particlesRef.current.length} active particles</p>
          
          <div className="effect-triggers">
            <button 
              className="effect-btn move"
              onClick={() => triggerVisualEffect({
                id: Math.random().toString(),
                type: 'move',
                intensity: 0.8,
                duration: 1000,
                position: { x: 200, y: 200 }
              })}
            >
              🎯 Move Effect
            </button>
            
            <button 
              className="effect-btn win"
              onClick={() => triggerVisualEffect({
                id: Math.random().toString(),
                type: 'win',
                intensity: 1.0,
                duration: 2000,
                position: { x: 400, y: 200 }
              })}
            >
              🏆 Win Effect
            </button>
            
            <button 
              className="effect-btn hint"
              onClick={() => triggerVisualEffect({
                id: Math.random().toString(),
                type: 'hint',
                intensity: 0.6,
                duration: 1500,
                position: { x: 300, y: 300 }
              })}
            >
              💡 Hint Effect
            </button>
            
            <button 
              className="effect-btn achievement"
              onClick={() => triggerVisualEffect({
                id: Math.random().toString(),
                type: 'achievement',
                intensity: 0.9,
                duration: 1800,
                position: { x: 500, y: 250 }
              })}
            >
              🎖️ Achievement
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* Effect Controls */}
      <motion.div 
        className="effect-controls"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h4>Effect Controls</h4>
        
        <div className="control-grid">
          <div className="control-group">
            <label>Particle Density</label>
            <input
              type="range"
              min="10"
              max="200"
              value={visualSettings.particleDensity}
              onChange={(e) => updateSetting('particleDensity', parseInt(e.target.value))}
              className="range-slider"
            />
            <span className="range-value">{visualSettings.particleDensity}</span>
          </div>
          
          <div className="control-group">
            <label>Animation Speed</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={visualSettings.animationSpeed}
              onChange={(e) => updateSetting('animationSpeed', parseFloat(e.target.value))}
              className="range-slider"
            />
            <span className="range-value">{visualSettings.animationSpeed}x</span>
          </div>
          
          <div className="control-group">
            <label>Performance Mode</label>
            <select
              value={visualSettings.performanceMode}
              onChange={(e) => updateSetting('performanceMode', e.target.value as any)}
              className="select-input"
            >
              <option value="high">High Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="low">Low Quality</option>
              <option value="minimal">Minimal Effects</option>
            </select>
          </div>
        </div>
      </motion.div>
    </div>
  );

  const renderParticlesTab = () => (
    <div className="particles-tab">
      <motion.div 
        className="particle-showcase"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h3>Particle System Showcase</h3>
        
        <div className="particle-types">
          {['spark', 'glow', 'trail', 'neural'].map((type, index) => (
            <motion.div
              key={type}
              className={`particle-type-card ${type}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 * index }}
              onClick={() => {
                // Create particles of this type
                const canvas = canvasRef.current;
                if (!canvas) return;
                
                for (let i = 0; i < 20; i++) {
                  particlesRef.current.push(createParticle({
                    x: 300 + Math.random() * 200,
                    y: 200 + Math.random() * 150,
                    type: type as any
                  }));
                }
              }}
            >
              <div className="particle-icon">
                {type === 'spark' ? '✨' : 
                 type === 'glow' ? '💫' : 
                 type === 'trail' ? '🌟' : '🔗'}
              </div>
              <h4>{type.charAt(0).toUpperCase() + type.slice(1)} Particles</h4>
              <p>
                {type === 'spark' ? 'Basic radial particles with gradient fills' :
                 type === 'glow' ? 'Glowing particles with shadow effects' :
                 type === 'trail' ? 'Motion trail particles' :
                 'Connected neural network particles'}
              </p>
              <button className="spawn-btn">Spawn {type}</button>
            </motion.div>
          ))}
        </div>
      </motion.div>
      
      <motion.div 
        className="particle-settings"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h4>Particle System Settings</h4>
        
        <div className="toggle-grid">
          {[
            { key: 'particleTrails', label: 'Particle Trails', description: 'Enable motion trails for particles' },
            { key: 'dynamicLighting', label: 'Dynamic Lighting', description: 'Real-time lighting effects' },
            { key: 'bloomEffect', label: 'Bloom Effect', description: 'Glow and blur effects' }
          ].map(setting => (
            <label key={setting.key} className="toggle-setting">
              <div className="toggle-info">
                <div className="toggle-label">{setting.label}</div>
                <div className="toggle-description">{setting.description}</div>
              </div>
              <input
                type="checkbox"
                checked={visualSettings[setting.key as keyof VisualSettings] as boolean}
                onChange={(e) => updateSetting(setting.key as keyof VisualSettings, e.target.checked)}
                className="toggle-input"
              />
              <div className="toggle-switch" />
            </label>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderThemesTab = () => (
    <div className="themes-tab">
      <motion.div 
        className="theme-showcase"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h3>Visual Themes</h3>
        
        <div className="themes-grid">
          {Object.entries(colorSchemes).map(([key, scheme], index) => (
            <motion.div
              key={key}
              className={`theme-card ${visualSettings.colorScheme === key ? 'active' : ''}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 * index }}
              onClick={() => updateSetting('colorScheme', key as any)}
              style={{ background: scheme.background }}
            >
              <div className="theme-preview">
                <div className="color-palette">
                  {scheme.particles.slice(0, 4).map((color, i) => (
                    <div
                      key={i}
                      className="color-swatch"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              <div className="theme-info">
                <h4>{key.charAt(0).toUpperCase() + key.slice(1)}</h4>
                <p>
                  {key === 'default' ? 'Clean and modern blue theme' :
                   key === 'neon' ? 'Vibrant cyberpunk neon colors' :
                   key === 'classic' ? 'Traditional warm color palette' :
                   key === 'cyberpunk' ? 'Futuristic digital aesthetic' :
                   key === 'nature' ? 'Earth tones and organic colors' :
                   'Space-inspired cosmic theme'}
                </p>
              </div>
              
              {visualSettings.colorScheme === key && (
                <div className="active-indicator">✓</div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="settings-tab">
      <motion.div 
        className="visual-settings"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h3>Visual Settings</h3>
        
        <div className="settings-sections">
          <div className="settings-section">
            <h4>Core Features</h4>
            <div className="feature-toggles">
              {[
                { key: 'particleSystem', label: 'Particle System', description: 'Enable particle effects throughout the game' },
                { key: 'backgroundEffects', label: 'Background Effects', description: 'Animated backgrounds and environmental effects' },
                { key: 'gameAnimations', label: 'Game Animations', description: 'Enhanced animations for game elements' },
                { key: 'uiEffects', label: 'UI Effects', description: 'Visual enhancements for interface elements' },
                { key: 'immersiveMode', label: 'Immersive Mode', description: 'Full-screen immersive visual experience' }
              ].map(feature => (
                <label key={feature.key} className="feature-toggle">
                  <div className="feature-info">
                    <div className="feature-label">{feature.label}</div>
                    <div className="feature-description">{feature.description}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visualSettings[feature.key as keyof VisualSettings] as boolean}
                    onChange={(e) => updateSetting(feature.key as keyof VisualSettings, e.target.checked)}
                    className="feature-input"
                  />
                  <div className="feature-switch" />
                </label>
              ))}
            </div>
          </div>
          
          <div className="settings-section">
            <h4>Performance Optimization</h4>
            <div className="performance-settings">
              <div className="performance-card">
                <h5>Recommended Settings</h5>
                <div className="performance-presets">
                  <button 
                    className="preset-btn high"
                    onClick={() => {
                      updateSetting('performanceMode', 'high');
                      updateSetting('particleDensity', 150);
                      updateSetting('animationSpeed', 1);
                    }}
                  >
                    🚀 High Performance
                  </button>
                  <button 
                    className="preset-btn balanced"
                    onClick={() => {
                      updateSetting('performanceMode', 'medium');
                      updateSetting('particleDensity', 100);
                      updateSetting('animationSpeed', 0.8);
                    }}
                  >
                    ⚖️ Balanced
                  </button>
                  <button 
                    className="preset-btn battery"
                    onClick={() => {
                      updateSetting('performanceMode', 'low');
                      updateSetting('particleDensity', 50);
                      updateSetting('animationSpeed', 0.5);
                    }}
                  >
                    🔋 Battery Saver
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  const renderDemoTab = () => (
    <div className="demo-tab">
      <motion.div 
        className="demo-showcase"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h3>Interactive Demo</h3>
        
        <div className="demo-controls">
          <button 
            className={`demo-btn ${isPlayingDemo ? 'playing' : ''}`}
            onClick={playDemo}
            disabled={isPlayingDemo}
          >
            {isPlayingDemo ? '🎬 Playing Demo...' : '▶️ Play Visual Demo'}
          </button>
          
          <button 
            className="demo-btn"
            onClick={() => {
              particlesRef.current = [];
              initializeParticles();
            }}
          >
            🔄 Reset Particles
          </button>
          
          <button 
            className="demo-btn"
            onClick={() => {
              for (let i = 0; i < 50; i++) {
                particlesRef.current.push(createParticle({
                  x: Math.random() * 600,
                  y: Math.random() * 400,
                  type: 'neural'
                }));
              }
            }}
          >
            🧠 Neural Network
          </button>
        </div>
        
        <div className="demo-info">
          <div className="info-card">
            <h4>Current Configuration</h4>
            <div className="config-details">
              <div className="config-item">
                <span className="config-label">Theme:</span>
                <span className="config-value">{visualSettings.colorScheme}</span>
              </div>
              <div className="config-item">
                <span className="config-label">Particles:</span>
                <span className="config-value">{particlesRef.current.length}</span>
              </div>
              <div className="config-item">
                <span className="config-label">Performance:</span>
                <span className="config-value">{visualSettings.performanceMode}</span>
              </div>
              <div className="config-item">
                <span className="config-label">Effects:</span>
                <span className="config-value">
                  {Object.values(visualSettings).filter(v => v === true).length} enabled
                </span>
              </div>
            </div>
          </div>
          
          <div className="info-card">
            <h4>System Performance</h4>
            <div className="performance-metrics">
              <div className="metric">
                <span className="metric-label">FPS Target:</span>
                <span className="metric-value">60</span>
              </div>
              <div className="metric">
                <span className="metric-label">Particles/Frame:</span>
                <span className="metric-value">{particlesRef.current.length}</span>
              </div>
              <div className="metric">
                <span className="metric-label">GPU Acceleration:</span>
                <span className="metric-value">✓ Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="nextgen-visuals-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div 
          className="nextgen-visuals"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="visuals-header">
            <div className="header-title">
              <h2>Next-Gen Visual Effects</h2>
              <div className="header-subtitle">
                Immersive Graphics & Particle Systems
              </div>
            </div>
            <div className="header-controls">
              <button 
                className="reset-defaults-btn"
                onClick={() => {
                  setVisualSettings({
                    particleSystem: true,
                    backgroundEffects: true,
                    gameAnimations: true,
                    uiEffects: true,
                    performanceMode: 'high',
                    particleDensity: 100,
                    animationSpeed: 1,
                    colorScheme: 'default',
                    immersiveMode: false,
                    dynamicLighting: true,
                    particleTrails: true,
                    bloomEffect: true
                  });
                }}
              >
                🔄 Reset to Defaults
              </button>
              <button className="close-btn" onClick={onClose}>×</button>
            </div>
          </div>

          {/* Navigation */}
          <div className="visuals-nav">
            {[
              { id: 'effects', label: 'Effects', icon: '✨' },
              { id: 'particles', label: 'Particles', icon: '🌟' },
              { id: 'themes', label: 'Themes', icon: '🎨' },
              { id: 'settings', label: 'Settings', icon: '⚙️' },
              { id: 'demo', label: 'Demo', icon: '🎬' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="visuals-content">
            <AnimatePresence mode="wait">
              {activeTab === 'effects' && renderEffectsTab()}
              {activeTab === 'particles' && renderParticlesTab()}
              {activeTab === 'themes' && renderThemesTab()}
              {activeTab === 'settings' && renderSettingsTab()}
              {activeTab === 'demo' && renderDemoTab()}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NextGenVisuals; 