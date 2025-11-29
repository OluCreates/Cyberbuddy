
const CYBERBUDDY_STATE = {
  allActiveBadges: new Set(),
  processedVideos: new Set(),
  processedImages: new Set(),
  blockAIEnabled: false,  // Cached block AI setting
  // Content type analysis settings (default: all enabled)
  analyzeImages: true,
  analyzeVideos: true,
  analyzeAudio: true,
  currentUrl: location.href,
  navigationLocked: false,
  scanInProgress: false,
  typewriterInstances: new Map(),
  autoDismissTimers: new Map(),
  badgeIdCounter: 0,
  tiltInstances: new Map()
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  AUTO_DISMISS_DELAY: 10000, // 10 seconds
  FADE_OUT_DURATION: 800,    // 0.8 seconds
  URL_CHECK_INTERVAL: 300,  // Check URL every 300ms
  MIN_IMAGE_SIZE: 80,       // Minimum image dimensions (lowered for Google Images)
  MIN_VIDEO_SIZE: 200,      // Minimum video dimensions
  MAX_IMAGES_TO_ANALYZE: 2,  // Maximum 2 images per scan
  MAX_VIDEOS_TO_ANALYZE: 2,
  TYPEWRITER_SPEEDS: {
    VERDICT: 40,    // ms per character
    AUDIO: 25,      // ms per character
    REASONING: 15   // ms per character (fastest for long text)
  },
  TYPEWRITER_DELAYS: {
    VERDICT: 150,
    AUDIO: 500,
    REASONING_IMAGE: 400,
    REASONING_VIDEO: 900
  },
  TILT: {
    ROTATE_AMPLITUDE: 14,      // Max rotation in degrees
    SCALE_ON_HOVER: 1.12,      // Scale multiplier on hover
    SPRING_DAMPING: 30,        // Spring physics damping
    SPRING_STIFFNESS: 100,     // Spring physics stiffness
    SPRING_MASS: 2             // Spring physics mass
  },
  BADGE: {
    MIN_WIDTH: 140,            // Minimum badge width
    MAX_WIDTH: 280,            // Maximum badge width
    OFFSET_X: 12,              // Horizontal offset from edge
    OFFSET_Y: 12,              // Vertical offset from edge
    Z_INDEX: 999999            // Ensure badges are on top
  }
};

// ============================================================================
// ENHANCED AESTHETIC STYLES WITH TILT & GLOW
// ============================================================================

if (!document.getElementById('cyberbuddy-enhanced-styles')) {
  console.log("[CyberBuddy] 🎨 Injecting ENHANCED AESTHETIC styles...");
  const style = document.createElement('style');
  style.id = 'cyberbuddy-enhanced-styles';
  style.textContent = `
    /* ====== SMOOTH FADE IN WITH TILT ====== */
    @keyframes cbSmoothFadeIn {
      0% {
        opacity: 0;
        transform: scale(0.85) translateY(15px) rotateX(15deg);
        filter: blur(12px) brightness(0.8);
      }
      60% {
        opacity: 0.7;
        filter: blur(4px) brightness(0.95);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0) rotateX(0deg);
        filter: blur(0) brightness(1);
      }
    }
    
    /* ====== FADE OUT WITH 3D EFFECT ====== */
    @keyframes cbFadeOut {
      0% {
        opacity: 1;
        transform: scale(1) translateY(0) rotateX(0deg);
        filter: brightness(1) blur(0px);
      }
      100% {
        opacity: 0;
        transform: scale(0.8) translateY(-20px) rotateX(-15deg);
        filter: brightness(0.4) blur(8px);
      }
    }
    
    /* ====== QUICK REMOVE ====== */
    @keyframes cbQuickRemove {
      0% {
        opacity: 1;
        transform: scale(1);
      }
      100% {
        opacity: 0;
        transform: scale(0.7) rotateZ(5deg);
      }
    }
    
    /* ====== HOLOGRAPHIC PULSE - ENHANCED ====== */
    @keyframes cbHoloPulse {
      0%, 100% { 
        box-shadow: 
          0 0 20px currentColor, 
          0 0 40px currentColor, 
          0 0 60px currentColor,
          0 0 80px currentColor,
          inset 0 0 15px rgba(255,255,255,0.15);
        filter: brightness(1) saturate(1.1);
      }
      50% { 
        box-shadow: 
          0 0 30px currentColor, 
          0 0 60px currentColor, 
          0 0 90px currentColor, 
          0 0 120px currentColor,
          inset 0 0 25px rgba(255,255,255,0.25);
        filter: brightness(1.12) saturate(1.3);
      }
    }
    
    /* ====== SHIMMER EFFECT ====== */
    @keyframes cbHoloShimmer {
      0% { 
        background-position: -200% center;
        opacity: 0.5;
      }
      50% {
        opacity: 1;
      }
      100% { 
        background-position: 200% center;
        opacity: 0.5;
      }
    }
    
    /* ====== SCAN LINE EFFECT ====== */
    @keyframes cbScanLine {
      0% {
        transform: translateY(-100%);
        opacity: 0.3;
      }
      50% {
        opacity: 0.6;
      }
      100% {
        transform: translateY(200%);
        opacity: 0.3;
      }
    }
    
    /* ====== WHITE GLOW PULSE ====== */
    @keyframes cbWhiteGlowPulse {
      0%, 100% {
        box-shadow: 
          0 0 20px rgba(255, 255, 255, 0.3),
          0 0 40px rgba(255, 255, 255, 0.2),
          0 0 60px rgba(255, 255, 255, 0.1);
      }
      50% {
        box-shadow: 
          0 0 30px rgba(255, 255, 255, 0.5),
          0 0 60px rgba(255, 255, 255, 0.4),
          0 0 90px rgba(255, 255, 255, 0.3);
      }
    }
    
    /* ====== CURSOR BLINK ====== */
    @keyframes cbCursorBlink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }
    
    /* ====== BADGE CONTAINER - OVERLAY POSITIONING ====== */
    .cyberbuddy-badge-overlay-container {
      position: absolute !important;
      z-index: ${CONFIG.BADGE.Z_INDEX} !important;
      pointer-events: none !important;
      animation: cbSmoothFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      perspective: 1200px !important;
      transform-style: preserve-3d !important;
      will-change: transform, opacity !important;
    }
    
    .cyberbuddy-badge-overlay-container.cyberbuddy-fading-out {
      animation: cbFadeOut 0.8s cubic-bezier(0.36, 0, 0.66, -0.56) forwards !important;
    }
    
    .cyberbuddy-badge-overlay-container.cyberbuddy-removing {
      animation: cbQuickRemove 0.2s ease-out forwards !important;
    }
    
    /* ====== ENHANCED AESTHETIC BADGE ====== */
    .cyberbuddy-badge-enhanced {
      pointer-events: auto !important;
      display: inline-flex !important;
      flex-direction: column !important;
      gap: 6px !important;
      border-radius: 14px !important;
      padding: 10px 14px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif !important;
      font-size: 9px !important;
      font-weight: 700 !important;
      color: #FFFFFF !important;
      text-shadow: 0 1px 4px rgba(0,0,0,0.7) !important;
      backdrop-filter: blur(16px) saturate(1.8) !important;
      -webkit-backdrop-filter: blur(16px) saturate(1.8) !important;
      position: relative !important;
      overflow: hidden !important;
      transform-style: preserve-3d !important;
      transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      will-change: transform, filter, box-shadow !important;
      cursor: pointer !important;
      animation: cbHoloPulse 4s ease-in-out infinite;
    }
    
    /* ====== SHIMMER OVERLAY ====== */
    .cyberbuddy-badge-enhanced::before {
      content: '';
      position: absolute;
      top: -60%;
      left: -60%;
      width: 220%;
      height: 220%;
      background: linear-gradient(
        60deg,
        transparent 25%,
        rgba(255,255,255,0.12) 45%,
        rgba(255,255,255,0.25) 50%,
        rgba(255,255,255,0.12) 55%,
        transparent 75%
      );
      animation: cbHoloShimmer 4s ease-in-out infinite;
      pointer-events: none;
      z-index: 1;
      border-radius: inherit;
    }
    
    /* ====== SCAN LINE OVERLAY ====== */
    .cyberbuddy-badge-enhanced::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255,255,255,0.5),
        transparent
      );
      animation: cbScanLine 3s linear infinite;
      pointer-events: none;
      z-index: 2;
      opacity: 0.6;
    }
    
    /* ====== HOVER STATE WITH WHITE BACKLIGHT GLOW ====== */
    .cyberbuddy-badge-enhanced:hover {
      animation: cbWhiteGlowPulse 1.5s ease-in-out infinite !important;
      filter: brightness(1.25) saturate(1.2) contrast(1.1) !important;
      box-shadow: 
        0 8px 32px rgba(0,0,0,0.6),
        0 0 50px rgba(255, 255, 255, 0.5),
        0 0 80px rgba(255, 255, 255, 0.4),
        0 0 120px rgba(255, 255, 255, 0.3),
        0 0 160px rgba(255, 255, 255, 0.2),
        inset 0 0 30px rgba(255, 255, 255, 0.2) !important;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
    }
    
    /* ====== TILT ACTIVE STATE ====== */
    .cyberbuddy-badge-enhanced.tilt-active {
      transition: none !important;
    }
    
    /* ====== TYPEWRITER CURSOR ====== */
    .cyberbuddy-typing-cursor {
      display: inline-block;
      width: 2px;
      height: 1em;
      background-color: currentColor;
      margin-left: 3px;
      animation: cbCursorBlink 1s step-end infinite;
      box-shadow: 0 0 8px currentColor, 0 0 12px currentColor;
    }
    
    /* ====== BADGE CONTENT LAYERS ====== */
    .cyberbuddy-badge-content {
      position: relative;
      z-index: 3;
    }
    
    /* ====== COLOR VARIANTS ====== */
    .cyberbuddy-badge-red {
      background: linear-gradient(135deg, 
        rgba(239, 68, 68, 0.95), 
        rgba(220, 38, 38, 0.95)) !important;
      border: 2px solid rgba(220, 38, 38, 0.8) !important;
      box-shadow: 
        0 4px 20px rgba(0,0,0,0.6),
        0 0 40px rgba(239, 68, 68, 0.5),
        0 0 70px rgba(239, 68, 68, 0.3) !important;
    }
    
    .cyberbuddy-badge-yellow {
      background: linear-gradient(135deg, 
        rgba(245, 158, 11, 0.95), 
        rgba(217, 119, 6, 0.95)) !important;
      border: 2px solid rgba(217, 119, 6, 0.8) !important;
      box-shadow: 
        0 4px 20px rgba(0,0,0,0.6),
        0 0 40px rgba(245, 158, 11, 0.5),
        0 0 70px rgba(245, 158, 11, 0.3) !important;
    }
    
    .cyberbuddy-badge-green {
      background: linear-gradient(135deg, 
        rgba(16, 185, 129, 0.95), 
        rgba(5, 150, 105, 0.95)) !important;
      border: 2px solid rgba(5, 150, 105, 0.8) !important;
      box-shadow: 
        0 4px 20px rgba(0,0,0,0.6),
        0 0 40px rgba(16, 185, 129, 0.5),
        0 0 70px rgba(16, 185, 129, 0.3) !important;
    }
    
    /* ====== RESPONSIVE SIZING ====== */
    @media (max-width: 768px) {
      .cyberbuddy-badge-enhanced {
        font-size: 8px !important;
        padding: 8px 12px !important;
        gap: 4px !important;
      }
    }
    
    /* ====== GLASSMORPHISM EFFECT ====== */
    .cyberbuddy-glass-effect {
      background: rgba(255, 255, 255, 0.05) !important;
      backdrop-filter: blur(20px) saturate(2) !important;
      -webkit-backdrop-filter: blur(20px) saturate(2) !important;
    }
    
    /* ====== LOADING STATE ====== */
    .cyberbuddy-loading {
      opacity: 0.7;
      pointer-events: none;
    }
    
    /* ====== ERROR STATE ====== */
    .cyberbuddy-error {
      border-color: #EF4444 !important;
      background: linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(239, 68, 68, 0.95)) !important;
    }
  `;
  document.head.appendChild(style);
  console.log("[CyberBuddy] ✅ ENHANCED AESTHETIC styles injected");
}

// ============================================================================
// ADVANCED 3D TILT EFFECT CLASS
// ============================================================================

class Advanced3DTilt {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      rotateAmplitude: options.rotateAmplitude || CONFIG.TILT.ROTATE_AMPLITUDE,
      scaleOnHover: options.scaleOnHover || CONFIG.TILT.SCALE_ON_HOVER,
      springDamping: options.springDamping || CONFIG.TILT.SPRING_DAMPING,
      springStiffness: options.springStiffness || CONFIG.TILT.SPRING_STIFFNESS,
      springMass: options.springMass || CONFIG.TILT.SPRING_MASS
    };
    
    // Spring physics state
    this.state = {
      rotateX: 0,
      rotateY: 0,
      targetRotateX: 0,
      targetRotateY: 0,
      velocityX: 0,
      velocityY: 0,
      scale: 1,
      targetScale: 1,
      isHovering: false
    };
    
    this.rafId = null;
    this.lastTime = performance.now();
    this.isActive = false;
    
    this.bindEvents();
  }
  
  bindEvents() {
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseEnter = this.onMouseEnter.bind(this);
    this.handleMouseLeave = this.onMouseLeave.bind(this);
    
    this.element.addEventListener('mousemove', this.handleMouseMove);
    this.element.addEventListener('mouseenter', this.handleMouseEnter);
    this.element.addEventListener('mouseleave', this.handleMouseLeave);
  }
  
  onMouseMove(e) {
    if (!this.state.isHovering || !this.element) return;
    
    const rect = this.element.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    
    // Calculate target rotations with easing
    this.state.targetRotateX = (offsetY / (rect.height / 2)) * -this.options.rotateAmplitude;
    this.state.targetRotateY = (offsetX / (rect.width / 2)) * this.options.rotateAmplitude;
    
    if (!this.isActive) {
      this.isActive = true;
      this.element.classList.add('tilt-active');
      this.animate();
    }
  }
  
  onMouseEnter() {
    this.state.isHovering = true;
    this.state.targetScale = this.options.scaleOnHover;
  }
  
  onMouseLeave() {
    this.state.isHovering = false;
    this.state.targetRotateX = 0;
    this.state.targetRotateY = 0;
    this.state.targetScale = 1;
    
    if (!this.isActive) {
      this.isActive = true;
      this.animate();
    }
  }
  
  animate() {
    if (!this.element || !document.body.contains(this.element)) {
      this.stop();
      return;
    }
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;
    
    // Spring physics for smooth animation
    const { springStiffness, springDamping, springMass } = this.options;
    
    // Rotation X
    const forceX = springStiffness * (this.state.targetRotateX - this.state.rotateX);
    const dampingX = springDamping * this.state.velocityX;
    const accelerationX = (forceX - dampingX) / springMass;
    this.state.velocityX += accelerationX * deltaTime;
    this.state.rotateX += this.state.velocityX * deltaTime;
    
    // Rotation Y
    const forceY = springStiffness * (this.state.targetRotateY - this.state.rotateY);
    const dampingY = springDamping * this.state.velocityY;
    const accelerationY = (forceY - dampingY) / springMass;
    this.state.velocityY += accelerationY * deltaTime;
    this.state.rotateY += this.state.velocityY * deltaTime;
    
    // Scale (simple lerp)
    this.state.scale += (this.state.targetScale - this.state.scale) * 0.15;
    
    // Apply transform
    this.element.style.transform = `
      scale(${this.state.scale})
      rotateX(${this.state.rotateX}deg)
      rotateY(${this.state.rotateY}deg)
      translateZ(0)
    `;
    
    // Check if animation should continue
    const isSettled = 
      Math.abs(this.state.rotateX - this.state.targetRotateX) < 0.1 &&
      Math.abs(this.state.rotateY - this.state.targetRotateY) < 0.1 &&
      Math.abs(this.state.velocityX) < 0.1 &&
      Math.abs(this.state.velocityY) < 0.1 &&
      Math.abs(this.state.scale - this.state.targetScale) < 0.01;
    
    if (isSettled && !this.state.isHovering) {
      this.isActive = false;
      this.element.classList.remove('tilt-active');
      // Reset to exact target values
      this.state.rotateX = this.state.targetRotateX;
      this.state.rotateY = this.state.targetRotateY;
      this.state.scale = this.state.targetScale;
      this.state.velocityX = 0;
      this.state.velocityY = 0;
      this.element.style.transform = `scale(1) rotateX(0deg) rotateY(0deg) translateZ(0)`;
      return;
    }
    
    this.rafId = requestAnimationFrame(() => this.animate());
  }
  
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isActive = false;
    
    // Clean up event listeners
    if (this.element) {
      this.element.removeEventListener('mousemove', this.handleMouseMove);
      this.element.removeEventListener('mouseenter', this.handleMouseEnter);
      this.element.removeEventListener('mouseleave', this.handleMouseLeave);
      this.element.classList.remove('tilt-active');
    }
  }
  
  destroy() {
    this.stop();
    this.element = null;
  }
}

// ============================================================================
// HOLOGRAPHIC TYPEWRITER CLASS
// ============================================================================

class HolographicTypewriter {
  constructor(element, options = {}) {
    this.element = element;
    this.speed = options.speed || 30;
    this.onComplete = options.onComplete || null;
    this.showCursor = options.showCursor !== false;
    
    this.buffer = '';
    this.displayedText = '';
    this.currentIndex = 0;
    this.isRunning = false;
    this.isComplete = false;
    this.rafId = null;
    this.lastUpdateTime = 0;
    
    if (this.showCursor) {
      this.cursor = document.createElement('span');
      this.cursor.className = 'cyberbuddy-typing-cursor';
      this.element.appendChild(this.cursor);
    }
  }
  
  setText(text) {
    this.buffer = text || '';
    if (!this.isRunning && !this.isComplete) {
      this.start();
    }
  }
  
  start() {
    if (this.isRunning || this.isComplete) return;
    if (!this.element || !document.body.contains(this.element)) return;
    
    this.isRunning = true;
    this.lastUpdateTime = performance.now();
    this.rafId = requestAnimationFrame((time) => this.animate(time));
  }
  
  animate(currentTime) {
    if (!this.element || !document.body.contains(this.element)) {
      this.stop();
      return;
    }
    
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = currentTime;
    }
    
    const deltaTime = currentTime - this.lastUpdateTime;
    
    if (deltaTime >= this.speed) {
      if (this.currentIndex < this.buffer.length) {
        const nextChar = this.buffer.charAt(this.currentIndex);
        this.displayedText += nextChar;
        
        if (this.cursor) {
          this.element.textContent = this.displayedText;
          this.element.appendChild(this.cursor);
        } else {
          this.element.textContent = this.displayedText;
        }
        
        this.currentIndex++;
        this.lastUpdateTime = currentTime;
      } else {
        this.complete();
        return;
      }
    }
    
    if (this.isRunning) {
      this.rafId = requestAnimationFrame((time) => this.animate(time));
    }
  }
  
  complete() {
    if (this.isComplete) return;
    
    this.isComplete = true;
    this.isRunning = false;
    
    if (this.cursor && this.cursor.parentNode) {
      this.cursor.remove();
    }
    
    if (this.element) {
      this.element.textContent = this.buffer;
    }
    
    if (this.onComplete) {
      this.onComplete();
    }
  }
  
  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.cursor && this.cursor.parentNode) {
      this.cursor.remove();
    }
  }
  
  finish() {
    this.stop();
    if (this.element) {
      this.element.textContent = this.buffer;
    }
    this.isComplete = true;
    if (this.onComplete) {
      this.onComplete();
    }
  }
}

// ============================================================================
// ENHANCED VERDICT DESCRIPTION GENERATOR
// ============================================================================

function generateEnhancedDescription(verdict, aiConfidence, type, originalReason) {
  // If we have a good original reason, use it
  if (originalReason && originalReason.length > 20 && originalReason.length < 200) {
    return originalReason;
  }
  
  // FIXED: For green verdicts, invert confidence since backend returns AI confidence
  const confidencePct = verdict === 'green' 
    ? Math.round((1 - aiConfidence) * 100)  // Invert for green: low AI = high human confidence
    : Math.round(aiConfidence * 100);        // Use as-is for red/yellow
  
  const contentType = type === "image" ? "image" : type === "video" ? "video" : "content";
  
  if (verdict === "red") {
    // AI DETECTED
    if (aiConfidence >= 0.8) {
      const descriptions = [
        `Strong AI signatures detected in this ${contentType}. Analysis shows ${confidencePct}% certainty of synthetic generation.`,
        `This ${contentType} exhibits clear artificial intelligence patterns with high confidence.`,
        `Detected characteristic AI-generated features including synthetic patterns and uniform textures.`
      ];
      return descriptions[Math.floor(Math.random() * descriptions.length)];
    } else if (aiConfidence >= 0.6) {
      const descriptions = [
        `This ${contentType} likely contains AI-generated elements with ${confidencePct}% confidence.`,
        `Multiple AI indicators detected. This ${contentType} shows probable synthetic origin.`,
        `AI generation detected with moderate-to-high certainty based on pattern analysis.`
      ];
      return descriptions[Math.floor(Math.random() * descriptions.length)];
    } else {
      const descriptions = [
        `Possible AI generation detected, though confidence is moderate at ${confidencePct}%.`,
        `This ${contentType} shows some AI indicators but analysis certainty is limited.`,
        `Potential synthetic elements detected with ${confidencePct}% confidence.`
      ];
      return descriptions[Math.floor(Math.random() * descriptions.length)];
    }
  } else if (verdict === "yellow") {
    // UNCERTAIN
    const descriptions = [
      `This ${contentType} shows mixed characteristics - could be AI-assisted, edited, or hybrid content.`,
      `Analysis inconclusive. This ${contentType} exhibits both natural and synthetic patterns.`,
      `Unable to determine with certainty - may contain both human and AI elements.`
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  } else {
    // AUTHENTIC (GREEN) - Use inverted confidence
    const humanConfidence = 1 - aiConfidence; // Convert AI confidence to human confidence
    if (humanConfidence >= 0.8) {
      const descriptions = [
        `This ${contentType} appears authentically human-created with ${confidencePct}% confidence.`,
        `Strong indicators of genuine human creation. Natural variation and artistic intent detected.`,
        `Analysis suggests authentic human work with high certainty based on organic patterns.`
      ];
      return descriptions[Math.floor(Math.random() * descriptions.length)];
    } else if (humanConfidence >= 0.6) {
      const descriptions = [
        `This ${contentType} likely authentic with ${confidencePct}% confidence.`,
        `Predominantly human characteristics detected with moderate certainty.`,
        `Appears to be human-created based on natural pattern analysis.`
      ];
      return descriptions[Math.floor(Math.random() * descriptions.length)];
    } else {
      const descriptions = [
        `Likely authentic, though analysis confidence is moderate at ${confidencePct}%.`,
        `This ${contentType} shows human characteristics but certainty is limited.`,
        `Appears human-created with ${confidencePct}% confidence. Minimal AI indicators found.`
      ];
      return descriptions[Math.floor(Math.random() * descriptions.length)];
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateBadgeId() {
  return `cyberbuddy-badge-${++CYBERBUDDY_STATE.badgeIdCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isElementVisible(element) {
  if (!element || !element.getBoundingClientRect) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

function calculateOptimalBadgeWidth(text, minWidth = CONFIG.BADGE.MIN_WIDTH, maxWidth = CONFIG.BADGE.MAX_WIDTH) {
  if (!text) return minWidth;
  
  const textLength = text.length;
  // Estimate width: ~7 pixels per character for small font
  const estimatedWidth = textLength * 7 + 50;
  
  return Math.max(minWidth, Math.min(estimatedWidth, maxWidth));
}

function calculateOptimalBadgePosition(element, badgeWidth, badgeHeight) {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate available space in each corner
  const positions = {
    topRight: {
      x: rect.right - badgeWidth - CONFIG.BADGE.OFFSET_X,
      y: rect.top + CONFIG.BADGE.OFFSET_Y,
      score: 0
    },
    topLeft: {
      x: rect.left + CONFIG.BADGE.OFFSET_X,
      y: rect.top + CONFIG.BADGE.OFFSET_Y,
      score: 0
    },
    bottomRight: {
      x: rect.right - badgeWidth - CONFIG.BADGE.OFFSET_X,
      y: rect.bottom - badgeHeight - CONFIG.BADGE.OFFSET_Y,
      score: 0
    },
    bottomLeft: {
      x: rect.left + CONFIG.BADGE.OFFSET_X,
      y: rect.bottom - badgeHeight - CONFIG.BADGE.OFFSET_Y,
      score: 0
    }
  };
  
  // Score each position (higher is better)
  for (const [key, pos] of Object.entries(positions)) {
    // Check if position is within viewport
    const inViewport = 
      pos.x >= 0 && 
      pos.x + badgeWidth <= viewportWidth &&
      pos.y >= 0 && 
      pos.y + badgeHeight <= viewportHeight;
    
    if (!inViewport) {
      pos.score = -1000; // Heavily penalize out-of-viewport positions
      continue;
    }
    
    // Prefer top-right (most common position for overlays)
    if (key === 'topRight') pos.score += 100;
    if (key === 'topLeft') pos.score += 80;
    if (key === 'bottomRight') pos.score += 60;
    if (key === 'bottomLeft') pos.score += 40;
    
    // Add distance from edges as a score component
    const distanceFromRight = viewportWidth - (pos.x + badgeWidth);
    const distanceFromBottom = viewportHeight - (pos.y + badgeHeight);
    pos.score += Math.min(distanceFromRight, 100);
    pos.score += Math.min(distanceFromBottom, 100);
  }
  
  // Find the best position
  let bestPosition = 'topRight';
  let bestScore = -Infinity;
  
  for (const [key, pos] of Object.entries(positions)) {
    if (pos.score > bestScore) {
      bestScore = pos.score;
      bestPosition = key;
    }
  }
  
  const selectedPos = positions[bestPosition];
  
  // Ensure position is clamped within viewport
  return {
    x: Math.max(0, Math.min(selectedPos.x, viewportWidth - badgeWidth)),
    y: Math.max(0, Math.min(selectedPos.y, viewportHeight - badgeHeight)),
    position: bestPosition
  };
}

// ============================================================================
// BADGE CLEARING SYSTEM
// ============================================================================

function clearAllBadges(reason = 'unknown') {
  console.log(`[CyberBuddy] Clearing all badges - Reason: ${reason}`);
  
  // Stop all typewriter animations
  CYBERBUDDY_STATE.typewriterInstances.forEach((typewriter, key) => {
    if (typewriter && typeof typewriter.stop === 'function') {
      typewriter.stop();
    }
  });
  CYBERBUDDY_STATE.typewriterInstances.clear();
  
  // Stop all tilt instances
  CYBERBUDDY_STATE.tiltInstances.forEach((tilt, key) => {
    if (tilt && typeof tilt.destroy === 'function') {
      tilt.destroy();
    }
  });
  CYBERBUDDY_STATE.tiltInstances.clear();
  
  // Clear all auto-dismiss timers
  CYBERBUDDY_STATE.autoDismissTimers.forEach((timer, key) => {
    clearTimeout(timer);
  });
  CYBERBUDDY_STATE.autoDismissTimers.clear();
  
  // Remove tracked badges with animation
  let removedCount = 0;
  CYBERBUDDY_STATE.allActiveBadges.forEach(container => {
    if (container && document.body.contains(container)) {
      container.classList.add('cyberbuddy-removing');
      setTimeout(() => {
        if (document.body.contains(container)) {
          container.remove();
        }
      }, 150);
      removedCount++;
    }
  });
  CYBERBUDDY_STATE.allActiveBadges.clear();
  
  // Query and remove any orphaned badges
  const orphanedBadges = document.querySelectorAll('.cyberbuddy-badge-overlay-container');
  orphanedBadges.forEach(badge => {
    badge.classList.add('cyberbuddy-removing');
    setTimeout(() => badge.remove(), 150);
  });
  
  console.log(`[CyberBuddy] Cleared ${removedCount} tracked badges + ${orphanedBadges.length} orphaned badges`);
}

// ============================================================================
// ENHANCED OVERLAY BADGE CREATION WITH 3D TILT
// ============================================================================



// Get element URL (works for img, video, etc)
function getElementURL(element) {
  if (element.tagName === 'IMG') {
    return element.src;
  } else if (element.tagName === 'VIDEO') {
    return element.src || element.currentSrc;
  }
  return null;

}
// ============================================================================
// BADGE CREATION
// ============================================================================

function createBadge(element, result, type) {
  console.log(`[CyberBuddy] 🎨 Creating enhanced overlay badge for ${type}`, result);
  
  if (!element || !document.body.contains(element)) {
    console.error('[CyberBuddy] ❌ Element not in DOM, cannot create badge');
    return;
  }
  
  const verdict = result.verdict || result.label || 'green';
  
  // Apply blocking immediately if enabled and content is AI-generated
  if (CYBERBUDDY_STATE.blockAIEnabled && verdict === 'red') {
    console.log(`[CyberBuddy] 🚫 Blocking AI content (${type})`);
    const elementURL = getElementURL(element);
    if (elementURL) {
      applyBlockingToElement(element, elementURL);
    }
  }
  
  // Generate unique badge ID
  const badgeId = generateBadgeId();
  element.dataset.cbId = badgeId;
  
  // FIXED: Get raw AI confidence score
  const rawConfidence = Math.round((result.confidence || result.score || result.ai_score || 0) * 100);
  
  // FIXED: For green (human) verdicts, invert the confidence since backend returns AI confidence
  // For red/yellow verdicts, use raw confidence as-is
  const displayConfidence = verdict === 'green' ? (100 - rawConfidence) : rawConfidence;
  
  const reason = result.reason || result.description || '';
  const audioVerdict = result.audio_verdict || null;
  const audioConfidence = result.audio_confidence ? Math.round(result.audio_confidence * 100) : null;
  
  const colors = {
    red: { bg: '#EF4444', border: '#DC2626', icon: '⚠️', label: 'AI DETECTED', class: 'cyberbuddy-badge-red' },
    yellow: { bg: '#F59E0B', border: '#D97706', icon: '⚡', label: 'UNCERTAIN', class: 'cyberbuddy-badge-yellow' },
    green: { bg: '#10B981', border: '#059669', icon: '✓', label: 'AUTHENTIC', class: 'cyberbuddy-badge-green' }
  };
  
  const color = colors[verdict] || colors.green;
  
  // Generate description text (use raw confidence for description logic)
  const originalReason = typeof reason === 'string' ? reason : (Array.isArray(reason) ? reason[0] : '');
  const reasonText = generateEnhancedDescription(verdict, rawConfidence / 100, type, originalReason);
  
  // Calculate optimal badge width
  const badgeWidth = calculateOptimalBadgeWidth(reasonText);
  const estimatedHeight = 120; // Estimated badge height
  
  // Get element position for overlay
  const elementRect = element.getBoundingClientRect();
  
  // Calculate optimal position
  const position = calculateOptimalBadgePosition(element, badgeWidth, estimatedHeight);
  
  // Create overlay container
  const container = document.createElement('div');
  container.className = 'cyberbuddy-badge-overlay-container';
  container.dataset.cbId = badgeId;
  container.dataset.badgeId = badgeId;
  container.style.cssText = `
    left: ${position.x}px;
    top: ${position.y}px;
    width: ${badgeWidth}px;
  `;
  
  // Track this badge globally
  CYBERBUDDY_STATE.allActiveBadges.add(container);
  
  // Create the actual badge
  const badge = document.createElement('div');
  badge.className = `cyberbuddy-badge-enhanced ${color.class}`;
  badge.style.width = '100%';
  
  // ========== VERDICT HEADER ==========
  const verdictHeader = document.createElement('div');
  verdictHeader.className = 'cyberbuddy-badge-content';
  verdictHeader.style.cssText = `
    display: flex; 
    align-items: center; 
    gap: 7px; 
    white-space: nowrap;
  `;
  
  const iconSpan = document.createElement('span');
  iconSpan.style.cssText = 'font-size: 16px; line-height: 1; filter: drop-shadow(0 0 6px currentColor);';
  iconSpan.textContent = color.icon;
  
  const labelSpan = document.createElement('span');
  labelSpan.style.cssText = 'letter-spacing: 1px; font-size: 10px; font-weight: 800; text-transform: uppercase;';
  labelSpan.textContent = ''; // Will be filled by typewriter
  
  verdictHeader.appendChild(iconSpan);
  verdictHeader.appendChild(labelSpan);
  badge.appendChild(verdictHeader);
  
  // ========== CONFIDENCE ==========
  const confidenceDiv = document.createElement('div');
  confidenceDiv.className = 'cyberbuddy-badge-content';
  confidenceDiv.style.cssText = `
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    gap: 6px;
    font-size: 9px;
    opacity: 0.95;
    font-weight: 600;
  `;
  confidenceDiv.innerHTML = `<span>Confidence: ${displayConfidence}%</span>`;
  badge.appendChild(confidenceDiv);
  
  // ========== TIMESTAMP DISPLAY ==========
  if ((type === 'video' || type === 'audio') && result.startTime !== undefined && result.endTime !== undefined) {
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'cyberbuddy-badge-content';
    timestampDiv.style.cssText = `
      font-size: 7.5px;
      opacity: 0.75;
      margin-top: 3px;
      font-weight: 500;
      font-style: italic;
    `;
    
    const formatTimestamp = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(1);
      if (mins > 0) {
        return `${mins}:${secs.padStart(4, '0')}`;
      }
      return `${secs}s`;
    };
    
    timestampDiv.textContent = `📍 Analyzed: ${formatTimestamp(result.startTime)} - ${formatTimestamp(result.endTime)}`;
    badge.appendChild(timestampDiv);
  }
  
  
  // Storage for instances
  const typewriters = [];
  
  // ========== VERDICT LABEL TYPEWRITER ==========
  setTimeout(() => {
    if (!document.body.contains(labelSpan)) return;
    
    const verdictTypewriter = new HolographicTypewriter(labelSpan, {
      speed: CONFIG.TYPEWRITER_SPEEDS.VERDICT,
      showCursor: false,
      onComplete: () => {
        console.log(`[CyberBuddy] ✅ Verdict typing complete: ${color.label}`);
      }
    });
    verdictTypewriter.setText(color.label);
    
    typewriters.push(verdictTypewriter);
    CYBERBUDDY_STATE.typewriterInstances.set(`${badgeId}-verdict`, verdictTypewriter);
  }, CONFIG.TYPEWRITER_DELAYS.VERDICT);
  
  // ========== AUDIO VERDICT (for videos) ==========
  if (type === 'video' && audioVerdict) {
    const audioDiv = document.createElement('div');
    audioDiv.className = 'cyberbuddy-badge-content';
    audioDiv.style.cssText = `
      margin-top: 4px;
      padding-top: 5px;
      border-top: 1px solid rgba(255,255,255,0.25);
      font-size: 8px;
      opacity: 0.95;
      font-weight: 600;
    `;
    audioDiv.textContent = ''; // Will be filled by typewriter
    badge.appendChild(audioDiv);
    
    setTimeout(() => {
      if (!document.body.contains(audioDiv)) return;
      
      const audioLabel = audioVerdict === 'red' ? 'AI' : 
                        audioVerdict === 'yellow' ? 'Uncertain' : 
                        'Authentic';
      const audioText = `🔊 Audio: ${audioLabel} (${audioConfidence}%)`;
      
      const audioTypewriter = new HolographicTypewriter(audioDiv, {
        speed: CONFIG.TYPEWRITER_SPEEDS.AUDIO,
        showCursor: false,
        onComplete: () => {
          console.log(`[CyberBuddy] ✅ Audio typing complete`);
        }
      });
      audioTypewriter.setText(audioText);
      
      typewriters.push(audioTypewriter);
      CYBERBUDDY_STATE.typewriterInstances.set(`${badgeId}-audio`, audioTypewriter);
    }, CONFIG.TYPEWRITER_DELAYS.AUDIO);
  }
  
  // ========== REASONING WITH STREAMING ==========
  if (reasonText && reasonText.length > 0) {
    const reasonDiv = document.createElement('div');
    reasonDiv.className = 'cyberbuddy-badge-content';
    reasonDiv.style.cssText = `
      margin-top: 7px; 
      padding-top: 7px; 
      border-top: 1px solid rgba(255,255,255,0.3);
      font-size: 8.5px; 
      font-weight: 500; 
      line-height: 1.5;
      opacity: 0.92;
      word-wrap: break-word;
      white-space: normal;
      letter-spacing: 0.2px;
    `;
    reasonDiv.textContent = ''; // Will be filled by typewriter
    badge.appendChild(reasonDiv);
    
    const reasonDelay = type === 'video' && audioVerdict ? 
      CONFIG.TYPEWRITER_DELAYS.REASONING_VIDEO : 
      CONFIG.TYPEWRITER_DELAYS.REASONING_IMAGE;
    
    setTimeout(() => {
      if (!document.body.contains(reasonDiv)) return;
      
      const reasonTypewriter = new HolographicTypewriter(reasonDiv, {
        speed: CONFIG.TYPEWRITER_SPEEDS.REASONING,
        showCursor: false,
        onComplete: () => {
          console.log(`[CyberBuddy] ✅ Reasoning typing complete`);
        }
      });
      reasonTypewriter.setText(reasonText);
      
      typewriters.push(reasonTypewriter);
      CYBERBUDDY_STATE.typewriterInstances.set(`${badgeId}-reasoning`, reasonTypewriter);
    }, reasonDelay);
  }
  
  container.appendChild(badge);
  
  // ========== CLICK TO DISMISS ==========
  badge.style.cursor = 'pointer';
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log(`[CyberBuddy] 👆 Badge clicked - dismissing ${badgeId}`);
    
    // Cancel auto-dismiss timer if exists
    if (CYBERBUDDY_STATE.autoDismissTimers.has(badgeId)) {
      clearTimeout(CYBERBUDDY_STATE.autoDismissTimers.get(badgeId));
      CYBERBUDDY_STATE.autoDismissTimers.delete(badgeId);
    }
    
    // Fade out
    container.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    
    // Remove after fade
    setTimeout(() => {
      if (document.body.contains(container)) {
        container.remove();
        CYBERBUDDY_STATE.allActiveBadges.delete(container);
        
        // Cleanup tilt instance
        const tilt = CYBERBUDDY_STATE.tiltInstances.get(badgeId);
        if (tilt && typeof tilt.destroy === 'function') {
          tilt.destroy();
        }
        CYBERBUDDY_STATE.tiltInstances.delete(badgeId);
        
        // Stop typewriter if running
        const typewriter = CYBERBUDDY_STATE.typewriterInstances.get(badgeId);
        if (typewriter && typeof typewriter.stop === 'function') {
          typewriter.stop();
        }
        CYBERBUDDY_STATE.typewriterInstances.delete(badgeId);
        
        console.log(`[CyberBuddy] ✓ Badge ${badgeId} dismissed and cleaned up`);
      }
    }, 500);
  });
  
  // ========== INSERT INTO DOM AS OVERLAY ==========
  try {
    document.body.appendChild(container);
    console.log(`[CyberBuddy] ✓ Overlay badge inserted with ID: ${badgeId} at position ${position.position}`);
    
    // ========== INITIALIZE 3D TILT EFFECT ==========
    const tilt = new Advanced3DTilt(badge, {
      rotateAmplitude: CONFIG.TILT.ROTATE_AMPLITUDE,
      scaleOnHover: CONFIG.TILT.SCALE_ON_HOVER,
      springDamping: CONFIG.TILT.SPRING_DAMPING,
      springStiffness: CONFIG.TILT.SPRING_STIFFNESS,
      springMass: CONFIG.TILT.SPRING_MASS
    });
    
    CYBERBUDDY_STATE.tiltInstances.set(badgeId, tilt);
    console.log(`[CyberBuddy] ✓ 3D tilt effect initialized for badge ${badgeId}`);
    
    // ========== UPDATE POSITION ON SCROLL/RESIZE ==========
    const updatePosition = () => {
      if (!document.body.contains(element) || !document.body.contains(container)) return;
      
      const newRect = element.getBoundingClientRect();
      const newPosition = calculateOptimalBadgePosition(element, badgeWidth, container.offsetHeight);
      
      container.style.left = `${newPosition.x}px`;
      container.style.top = `${newPosition.y}px`;
    };
    
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });
    
    // Store cleanup function
    container.dataset.cleanup = 'scroll-resize-listeners';
    
  } catch (error) {
    console.error('[CyberBuddy] Failed to insert badge into DOM:', error);
    CYBERBUDDY_STATE.allActiveBadges.delete(container);
    return;
  }
  
  // ========== AUTO-DISMISS TIMER ==========
  const autoDismissTimer = setTimeout(() => {
    if (!document.body.contains(container)) return;
    
    console.log(`[CyberBuddy] Auto-dismissing badge ${badgeId}`);
    
    // Stop all typewriters
    typewriters.forEach(tw => tw.stop());
    CYBERBUDDY_STATE.typewriterInstances.delete(`${badgeId}-verdict`);
    CYBERBUDDY_STATE.typewriterInstances.delete(`${badgeId}-audio`);
    CYBERBUDDY_STATE.typewriterInstances.delete(`${badgeId}-reasoning`);
    
    // Stop tilt effect
    const tilt = CYBERBUDDY_STATE.tiltInstances.get(badgeId);
    if (tilt) {
      tilt.destroy();
      CYBERBUDDY_STATE.tiltInstances.delete(badgeId);
    }
    
    // Fade out
    container.classList.add('cyberbuddy-fading-out');
    setTimeout(() => {
      CYBERBUDDY_STATE.allActiveBadges.delete(container);
      if (document.body.contains(container)) {
        container.remove();
      }
    }, CONFIG.FADE_OUT_DURATION);
  }, CONFIG.AUTO_DISMISS_DELAY);
  
  CYBERBUDDY_STATE.autoDismissTimers.set(badgeId, autoDismissTimer);
  
  // ========== ELEMENT REMOVAL OBSERVER ==========
  const removalObserver = new MutationObserver((mutations) => {
    if (!document.body.contains(element)) {
      console.log(`[CyberBuddy] Parent element removed, cleaning up badge ${badgeId}`);
      
      // Clear timer
      const timer = CYBERBUDDY_STATE.autoDismissTimers.get(badgeId);
      if (timer) {
        clearTimeout(timer);
        CYBERBUDDY_STATE.autoDismissTimers.delete(badgeId);
      }
      
      // Stop typewriters
      typewriters.forEach(tw => tw.stop());
      CYBERBUDDY_STATE.typewriterInstances.delete(`${badgeId}-verdict`);
      CYBERBUDDY_STATE.typewriterInstances.delete(`${badgeId}-audio`);
      CYBERBUDDY_STATE.typewriterInstances.delete(`${badgeId}-reasoning`);
      
      // Stop tilt
      const tilt = CYBERBUDDY_STATE.tiltInstances.get(badgeId);
      if (tilt) {
        tilt.destroy();
        CYBERBUDDY_STATE.tiltInstances.delete(badgeId);
      }
      
      // Remove badge
      CYBERBUDDY_STATE.allActiveBadges.delete(container);
      if (document.body.contains(container)) {
        container.remove();
      }
      
      removalObserver.disconnect();
    }
  });
  
  removalObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

// ============================================================================
// SCREENSHOT CAPTURE
// ============================================================================

function captureScreenshot() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "capture_screenshot" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response?.error) {
        reject(new Error(response.message));
      } else if (response?.dataUrl) {
        resolve(response.dataUrl);
      } else {
        reject(new Error("Screenshot failed: No data returned"));
      }
    });
  });
}

// ============================================================================
// IMAGE CAPTURE
// ============================================================================

function captureImages(videos = []) {
  console.log("[CyberBuddy] Scanning for images...");
  
  const allImages = document.querySelectorAll('img');
  console.log(`[CyberBuddy] Found ${allImages.length} total img elements`);
  
  // Get all video element positions for exclusion
  const videoRects = videos.map(v => ({
    element: v.element,
    rect: v.element.getBoundingClientRect()
  }));
  
  const validImages = Array.from(allImages)
    .filter(img => {
      // Size check
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < CONFIG.MIN_IMAGE_SIZE || h < CONFIG.MIN_IMAGE_SIZE) {
        return false;
      }
      
      // Source check
      if (!img.src || img.src.startsWith('data:')) {
        return false;
      }
      
      // Visible size check - lowered for thumbnails
      const rect = img.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 60) {
        return false;
      }
      
      // Visibility check
      if (!isElementVisible(img)) {
        return false;
      }
      
      // ========== AGGRESSIVE VIDEO THUMBNAIL EXCLUSION ==========
      // Check if this image is inside a video element or is a video poster
      const parentVideo = img.closest('video');
      if (parentVideo) {
        console.log(`[CyberBuddy] ⊗ Skipping image - inside video element`);
        return false;
      }
      
      // Check if image overlaps with ANY video element we're analyzing
      const imgRect = img.getBoundingClientRect();
      for (const videoData of videoRects) {
        const vRect = videoData.rect;
        
        // Check if image overlaps with video
        const overlapsX = imgRect.left < vRect.right && imgRect.right > vRect.left;
        const overlapsY = imgRect.top < vRect.bottom && imgRect.bottom > vRect.top;
        
        if (overlapsX && overlapsY) {
          console.log(`[CyberBuddy] ⊗ Skipping image - overlaps video thumbnail`);
          return false;
        }
        
        // Check if image is in same container as video (common pattern)
        const imgParent = img.parentElement;
        const videoParent = videoData.element.parentElement;
        if (imgParent && videoParent && imgParent === videoParent) {
          // Check if sizes are similar (thumbnail pattern)
          const sizeSimilarity = Math.abs(imgRect.width - vRect.width) < 50 && 
                                 Math.abs(imgRect.height - vRect.height) < 50;
          if (sizeSimilarity) {
            console.log(`[CyberBuddy] ⊗ Skipping image - same container as video with similar size`);
            return false;
          }
        }
      }
      // ========== END VIDEO THUMBNAIL EXCLUSION ==========
      
      // Already processed check
      const imgSrc = img.src;
      if (CYBERBUDDY_STATE.processedImages.has(imgSrc)) {
        return false;
      }
      
      return true;
    })
    .slice(0, CONFIG.MAX_IMAGES_TO_ANALYZE)
    .map((img, index) => {
      CYBERBUDDY_STATE.processedImages.add(img.src);
      return {
        url: img.src,
        index: index,
        element: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      };
    });
  
  console.log(`[CyberBuddy] ✓ Found ${validImages.length} valid images to analyze`);
  return validImages;
}

// ============================================================================
// VIDEO CAPTURE
// ============================================================================

// ============================================================================
// VIDEO CAPTURE - WITH MULTIPLE FRAME CAPTURE
// ============================================================================

async function captureVideos() {
  console.log("[CyberBuddy] Scanning for videos...");
  
  const allVideos = document.querySelectorAll('video');
  console.log(`[CyberBuddy] Found ${allVideos.length} total video elements`);
  
  const validVideos = [];
  
  for (const video of Array.from(allVideos).slice(0, CONFIG.MAX_VIDEOS_TO_ANALYZE)) {
    // Size check
    const w = video.videoWidth || video.offsetWidth;
    const h = video.videoHeight || video.offsetHeight;
    if (w < CONFIG.MIN_VIDEO_SIZE || h < CONFIG.MIN_VIDEO_SIZE) {
      continue;
    }
    
    // Source check
    const videoSrc = video.src || video.currentSrc;
    if (!videoSrc) {
      console.log(`[CyberBuddy] ⚠️ Video has no src, skipping`);
      continue;
    }
    
    console.log(`[CyberBuddy] 🔍 Video src: ${videoSrc.substring(0, 100)}...`);
    
    // Visible size check
    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) {
      continue;
    }
    
    // Visibility check
    if (!isElementVisible(video)) {
      continue;
    }
    
    // Already processed check
    if (CYBERBUDDY_STATE.processedVideos.has(videoSrc)) {
      continue;
    }
    
    // Check if video is ready
    if (video.readyState < 2) {
      continue;
    }
    
    // Check if this is a blob/data URL (needs conversion) or HTTP URL (can send directly)
    const isBlobVideo = videoSrc.startsWith('blob:') || videoSrc.startsWith('data:');
    
    console.log(`[CyberBuddy] Video type check:`);
    console.log(`  - URL: ${videoSrc.substring(0, 80)}...`);
    console.log(`  - Is blob: ${isBlobVideo}`);
    console.log(`  - Starts with 'blob:': ${videoSrc.startsWith('blob:')}`);
    console.log(`  - Starts with 'data:': ${videoSrc.startsWith('data:')}`);
    console.log(`  - Starts with 'http': ${videoSrc.startsWith('http')}`);
    
    if (isBlobVideo) {
      console.log(`[CyberBuddy] 🎬 Blob video detected - capturing 3 frames...`);
      
      try {
        // Capture 3 frames from the video
        const videoResult = await captureVideoFrames(video, 3);
        
        if (videoResult.frames.length === 0) {
          console.log(`[CyberBuddy] ⚠️ No frames captured from video`);
          continue;
        }
        
        CYBERBUDDY_STATE.processedVideos.add(videoSrc);
        
        validVideos.push({
          frames: videoResult.frames,
          videoBase64: null,
          videoUrl: null,
          isBlob: true,
          startTime: videoResult.startTime,
          endTime: videoResult.endTime,
          index: validVideos.length,
          element: video,
          width: video.videoWidth || video.offsetWidth,
          height: video.videoHeight || video.offsetHeight
        });
        
        console.log(`[CyberBuddy] ✓ Captured ${videoResult.frames.length} frames from video ${validVideos.length} (${videoResult.startTime.toFixed(1)}s - ${videoResult.endTime.toFixed(1)}s)`);
        
      } catch (error) {
        console.error(`[CyberBuddy] ❌ Failed to capture video frames:`, error);
      }
      
    } else {
      // HTTP/HTTPS URL - can send directly to Hive
      console.log(`[CyberBuddy] 🎬 HTTP video detected - using URL directly`);
      
      CYBERBUDDY_STATE.processedVideos.add(videoSrc);
      
      validVideos.push({
        videoBase64: null,         // No base64 for HTTP videos
        videoUrl: videoSrc,        // HTTP URL
        isBlob: false,
        startTime: 0,
        endTime: video.duration || 0,
        index: validVideos.length,
        element: video,
        width: video.videoWidth || video.offsetWidth,
        height: video.videoHeight || video.offsetHeight
      });
      
      console.log(`[CyberBuddy] ✓ HTTP video ${validVideos.length} ready (duration: ${video.duration?.toFixed(1) || 0}s)`);
    }
  }
  
  console.log(`[CyberBuddy] ✓ Found ${validVideos.length} valid videos to analyze`);
  return validVideos;
}

// ============================================================================
// CAPTURE MULTIPLE FRAMES FROM VIDEO
// ============================================================================



async function captureVideoFrames(video, numFrames = 3) {
  const frames = [];
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  
  const duration = video.duration || 10;
  
  // ========== SAVE VIDEO STATE ==========
  const originalTime = video.currentTime;
  const wasPlaying = !video.paused;
  const originalPlaybackRate = video.playbackRate;
  
  // Pause video to prevent glitches during frame capture
  if (wasPlaying) {
    video.pause();
  }
  
  console.log(`[CyberBuddy] 📹 Video state saved - Current time: ${originalTime.toFixed(1)}s, Playing: ${wasPlaying}`);
  
  // Calculate capture window: 6 seconds from current position
  const startAnalysisTime = originalTime;
  const endAnalysisTime = Math.min(originalTime + 6, duration);
  const captureWindow = endAnalysisTime - startAnalysisTime;
  
  console.log(`[CyberBuddy] Capturing ${numFrames} frames from ${startAnalysisTime.toFixed(1)}s to ${endAnalysisTime.toFixed(1)}s (${captureWindow.toFixed(1)}s window)...`);
  
  // Calculate target timestamps within the capture window
  // For 3 frames: 25%, 50%, 75% of the window from current position
  const timestamps = [];
  for (let i = 0; i < numFrames; i++) {
    const progress = (i + 1) / (numFrames + 1); // 0.25, 0.5, 0.75
    const targetTime = startAnalysisTime + (captureWindow * progress);
    timestamps.push(Math.min(targetTime, duration - 0.1)); // Ensure we don't go past video end
  }
  
  console.log(`[CyberBuddy] Target timestamps: ${timestamps.map(t => t.toFixed(1) + 's').join(', ')}`);
  
  // Capture frame at each timestamp
  for (let i = 0; i < timestamps.length; i++) {
    try {
      const targetTime = timestamps[i];
      
      // Seek to target time
      video.currentTime = targetTime;
      
      // Wait for seek to complete
      await new Promise((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        
        // Fallback timeout in case seeked never fires
        setTimeout(resolve, 300);
      });
      
      // Small delay to ensure frame is rendered
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Capture frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.85));
      console.log(`[CyberBuddy] ✓ Captured frame ${i + 1}/${numFrames} at ${targetTime.toFixed(1)}s`);
      
    } catch (error) {
      console.error(`[CyberBuddy] Error capturing frame ${i + 1}:`, error);
    }
  }
  
  // ========== RESTORE VIDEO STATE ==========
  video.currentTime = originalTime;
  
  // Wait for seek back to complete
  await new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    setTimeout(resolve, 300);
  });
  
  // Resume playback if it was playing
  if (wasPlaying) {
    video.play().catch(err => console.log('[CyberBuddy] Could not resume playback:', err));
  }
  
  console.log(`[CyberBuddy] ✓ Video state restored - Back to ${originalTime.toFixed(1)}s, Playing: ${wasPlaying}`);
  console.log(`[CyberBuddy] ✓ Captured ${frames.length} frames total`);
  
  return { 
    frames, 
    startTime: timestamps[0] || startAnalysisTime, 
    endTime: timestamps[timestamps.length - 1] || endAnalysisTime,
    userPosition: originalTime
  };
}



// ============================================================================
// AUDIO CAPTURE
// ============================================================================

// ============================================================================
// AUDIO CAPTURE - WITH BASE64 ENCODING
// ============================================================================

async function captureAudio() {
  console.log("[CyberBuddy] Scanning for audio...");
  
  const allAudio = document.querySelectorAll('audio');
  console.log(`[CyberBuddy] Found ${allAudio.length} total audio elements`);
  
  const validAudio = [];
  
  for (const audioElement of Array.from(allAudio).slice(0, 5)) {
    // Source check
    const audioSrc = audioElement.src || audioElement.currentSrc;
    if (!audioSrc) {
      continue;
    }
    
    // Visibility check (audio element must be in DOM)
    if (!document.body.contains(audioElement)) {
      continue;
    }
    
    // Already processed check
    const processedAudioKey = `audio_${audioSrc}`;
    if (CYBERBUDDY_STATE.processedVideos.has(processedAudioKey)) {
      continue;
    }
    
    // Record audio using MediaRecorder
    try {
      console.log(`[CyberBuddy] Recording audio from: ${audioSrc.substring(0, 100)}`);
      
      // Create audio context and capture stream
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(audioElement);
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect source to both destination (for recording) and speakers (so it keeps playing)
      source.connect(destination);
      source.connect(audioContext.destination);
      
      // Record for 3 seconds
      // Record for 3 seconds
      const startTime = audioElement.currentTime || 0;
      const endTime = startTime + 3;
      
      console.log(`[CyberBuddy] Recording from ${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s`);
      
      const audioResult = await new Promise((resolve, reject) => {
        // Detect supported audio format
        let mimeType = 'audio/webm'; // Default fallback
        let blobType = 'audio/webm';
        
        if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
          mimeType = 'audio/webm; codecs=opus';
          blobType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
          blobType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')) {
          mimeType = 'audio/ogg; codecs=opus';
          blobType = 'audio/ogg';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          blobType = 'audio/mp4';
        }
        
        console.log(`[CyberBuddy] Using audio format: ${mimeType}`);
        
        const mediaRecorder = new MediaRecorder(destination.stream, { mimeType });
        const chunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { type: blobType });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            audioContext.close();
            resolve({ data: base64, format: blobType, startTime, endTime });
          };
          reader.onerror = () => {
            audioContext.close();
            reject(new Error('Failed to convert'));
          };
          reader.readAsDataURL(blob);
        };
        
        mediaRecorder.onerror = (e) => {
          audioContext.close();
          reject(e);
        };
        
        mediaRecorder.start();
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, 3000); // Record 3 seconds
      });
      
      CYBERBUDDY_STATE.processedVideos.add(processedAudioKey);
      
      validAudio.push({
        data: audioResult.data,
        format: audioResult.format,
        startTime: audioResult.startTime,
        endTime: audioResult.endTime,
        index: validAudio.length,
        element: audioElement
      });
      
      console.log(`[CyberBuddy] ✓ Recorded audio ${validAudio.length} (${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s)`);
      
    } catch (error) {
      console.error(`[CyberBuddy] ❌ Failed to record audio:`, error);
      // Continue with other audio files
    }
  }
  
  console.log(`[CyberBuddy] ✓ Found ${validAudio.length} valid audio files to analyze`);
  return validAudio;
}
// ============================================================================
// YOUTUBE NAVIGATION DETECTION
// ============================================================================

console.log("[CyberBuddy] Setting up navigation detection...");

// YouTube's custom navigation events
document.addEventListener('yt-navigate-start', () => {
  console.log('[CyberBuddy] ✓ yt-navigate-start detected');
  CYBERBUDDY_STATE.navigationLocked = true;
  clearAllBadges('yt-navigate-start');
  CYBERBUDDY_STATE.processedVideos.clear();
  CYBERBUDDY_STATE.processedImages.clear();
});

document.addEventListener('yt-navigate-finish', () => {
  console.log('[CyberBuddy] ✓ yt-navigate-finish detected');
  CYBERBUDDY_STATE.currentUrl = location.href;
  CYBERBUDDY_STATE.navigationLocked = false;
  clearAllBadges('yt-navigate-finish');
  CYBERBUDDY_STATE.processedVideos.clear();
  CYBERBUDDY_STATE.processedImages.clear();
});

// History API detection
window.addEventListener('popstate', () => {
  console.log('[CyberBuddy] ✓ popstate detected (back/forward)');
  clearAllBadges('popstate');
  CYBERBUDDY_STATE.processedVideos.clear();
  CYBERBUDDY_STATE.processedImages.clear();
  CYBERBUDDY_STATE.currentUrl = location.href;
});

// Intercept pushState
const originalPushState = history.pushState;
history.pushState = function(...args) {
  console.log('[CyberBuddy] ✓ history.pushState intercepted');
  originalPushState.apply(this, args);
  clearAllBadges('pushState');
  CYBERBUDDY_STATE.processedVideos.clear();
  CYBERBUDDY_STATE.processedImages.clear();
  CYBERBUDDY_STATE.currentUrl = location.href;
};

// URL Polling
function checkUrlChange() {
  if (location.href !== CYBERBUDDY_STATE.currentUrl) {
    console.log(`[CyberBuddy] ✓ URL change detected via polling`);
    clearAllBadges('url-polling');
    CYBERBUDDY_STATE.processedVideos.clear();
    CYBERBUDDY_STATE.processedImages.clear();
    CYBERBUDDY_STATE.currentUrl = location.href;
  }
}
setInterval(checkUrlChange, CONFIG.URL_CHECK_INTERVAL);

// ============================================================================
// MESSAGE LISTENER
// ============================================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return false;
  
  if (msg.type === "scan_media" || msg === "scan_media") {
    console.log("[CyberBuddy] Manual scan requested via message");
    if (!CYBERBUDDY_STATE.scanInProgress) {
      scanMediaPage();
    }
    sendResponse({ received: true });
    return true;
  }
  
  if (msg.type === "clear_badges") {
    clearAllBadges('message-request');
    sendResponse({ cleared: true });
    return true;
  }
  
  if (msg.type === "check_scan_state") {
    console.log("[CyberBuddy] Scan state check - scanInProgress:", CYBERBUDDY_STATE.scanInProgress);
    sendResponse({ 
      scanInProgress: CYBERBUDDY_STATE.scanInProgress,
      displayInProgress: false
    });
    return true;
  }
  
});

// ============================================================================
// MAIN SCAN FUNCTION
// ============================================================================


async function scanMediaPage() {
  if (CYBERBUDDY_STATE.scanInProgress) {
    console.log("[CyberBuddy] Scan already in progress");
    return;
  }
  
  CYBERBUDDY_STATE.scanInProgress = true;
  
  try {
    console.log("[CyberBuddy] ========================================");
    console.log("[CyberBuddy] STARTING ENHANCED MEDIA SCAN");
    console.log("[CyberBuddy] ========================================");
    
    const url = window.location.href;
    const title = document.title;
    
    // ========== CHECK CONTENT TYPE SETTINGS ==========
    console.log("[CyberBuddy] 📋 Checking content type settings:");
    console.log(`  - Images: ${CYBERBUDDY_STATE.analyzeImages ? '✓' : '✗ SKIP'}`);
    console.log(`  - Videos: ${CYBERBUDDY_STATE.analyzeVideos ? '✓' : '✗ SKIP'}`);
    console.log(`  - Audio: ${CYBERBUDDY_STATE.analyzeAudio ? '✓' : '✗ SKIP'}`);
    
    // ========== CAPTURE VIDEOS FIRST (if enabled) ==========
    let videos = [];
    if (CYBERBUDDY_STATE.analyzeVideos) {
      videos = await captureVideos();
    } else {
      console.log("[CyberBuddy] ⊗ Video analysis disabled - skipping");
    }
    
    // ========== CAPTURE IMAGES (excluding video thumbnails, if enabled) ==========
    let images = [];
    if (CYBERBUDDY_STATE.analyzeImages) {
      images = captureImages(videos);
    } else {
      console.log("[CyberBuddy] ⊗ Image analysis disabled - skipping");
    }
    
    // ========== CAPTURE AUDIO (if enabled) ==========
    let audio = [];
    if (CYBERBUDDY_STATE.analyzeAudio) {
      audio = await captureAudio();
    } else {
      console.log("[CyberBuddy] ⊗ Audio analysis disabled - skipping");
    }
    
    console.log(`[CyberBuddy] 📊 Scan summary:`);
    console.log(`  - Images: ${images.length}`);
    console.log(`  - Videos: ${videos.length}`);
    console.log(`  - Audio: ${audio.length}`);
    
    // Send to backend
    console.log("[CyberBuddy] Sending data to backend...");
    
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Backend timeout after 60 seconds"));
      }, 60000);

      chrome.runtime.sendMessage(
        { 
          type: "api_analyze_comprehensive",
          screenshot: null,
          textContent: '',
          wordCount: 0,
          images: images.map(img => ({ url: img.url, index: img.index })),
          videos: videos.map(vid => ({ 
            frames: vid.frames || [],          // Frames for blob videos
            videoBase64: vid.videoBase64 || null,  // Base64 for full video (if available)
            videoUrl: vid.videoUrl || null,        // URL for HTTP videos
            isBlob: vid.isBlob || false,
            startTime: vid.startTime,
            endTime: vid.endTime,
            index: vid.index 
          })),
          audioRecordings: audio.map(aud => ({ 
            data: aud.data, 
            format: aud.format, 
            startTime: aud.startTime,
            endTime: aud.endTime,
            index: aud.index 
          })),
          videoRecordings: [],
          videoThumbnails: [],
          url: url,
          title: title
        },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && !response.error) {
            resolve(response);
          } else {
            reject(new Error(response?.message || "Analysis failed"));
          }
        }
      );
    });
    
    console.log("[CyberBuddy] ✓ Backend response received");
    
    // ========== SEND RESULT TO BACKGROUND FOR HISTORY ==========
    console.log("[CyberBuddy] Sending result to background for history...");
    
    // Transform result to match expected format
    const transformedResult = {
      modalities: {
        text: result.text || null,
        visual: result.visual || null,
        audio: result.audio || null
      },
      images: result.images || [],
      videos: result.videos || [],
      audioFiles: result.audioFiles || [],
      usage: result.usage
    };
    
    chrome.runtime.sendMessage({
      type: "analyze_result",
      result: transformedResult
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[CyberBuddy] Failed to send result to background:", chrome.runtime.lastError.message);
      } else {
        console.log("[CyberBuddy] ✓ Result sent to background successfully");
      }
    });
    
    // ========== DISPLAY RESULTS FOR IMAGES ==========
    if (result.images && result.images.length > 0) {
      console.log(`[CyberBuddy] Displaying enhanced overlay badges for ${result.images.length} images`);
      
      result.images.forEach((imageResult, idx) => {
        const imgData = images.find(img => img.index === imageResult.index);
        if (imgData?.element && imageResult.verdict !== 'none') {
          console.log(`[CyberBuddy] Creating enhanced badge for image ${idx + 1}: ${imageResult.verdict}`);
          
          setTimeout(() => {
            if (document.body.contains(imgData.element)) {
              createBadge(imgData.element, imageResult, "image");
            }
          }, idx * 150);
        }
      });
    }
    
    // ========== DISPLAY RESULTS FOR VIDEOS ==========
    if (result.videos && result.videos.length > 0) {
      console.log(`[CyberBuddy] Displaying enhanced overlay badges for ${result.videos.length} videos`);
      
      result.videos.forEach((videoResult, idx) => {
        const vidData = videos.find(vid => vid.index === videoResult.index);
        if (vidData?.element && videoResult.verdict !== 'none') {
          console.log(`[CyberBuddy] Creating enhanced badge for video ${idx + 1}: ${videoResult.verdict}`);
          
          setTimeout(() => {
            if (document.body.contains(vidData.element)) {
              createBadge(vidData.element, videoResult, "video");
            }
          }, (images.length + idx) * 150);
        }
      });
    }
    
    // ========== DISPLAY RESULTS FOR AUDIO ==========
    if (result.audioFiles && result.audioFiles.length > 0) {  // ← Backend returns audioFiles
      console.log(`[CyberBuddy] Displaying enhanced overlay badges for ${result.audioFiles.length} audio`);
      
      result.audioFiles.forEach((audioResult, idx) => {
        const audData = audio.find(aud => aud.index === audioResult.index);
        if (audData?.element && audioResult.verdict !== 'none') {
          console.log(`[CyberBuddy] Creating enhanced badge for audio ${idx + 1}: ${audioResult.verdict}`);
          
          setTimeout(() => {
            if (document.body.contains(audData.element)) {
              createBadge(audData.element, audioResult, "audio");
            }
          }, (images.length + videos.length + idx) * 150);
        }
      });
    }
    
    console.log("[CyberBuddy] ========================================");
    console.log("[CyberBuddy] ENHANCED SCAN COMPLETE");
    console.log("[CyberBuddy] ========================================");
    
  } catch (error) {
    console.error("[CyberBuddy] ========================================");
    console.error("[CyberBuddy] SCAN FAILED:", error);
    console.error("[CyberBuddy] ========================================");
  } finally {
    CYBERBUDDY_STATE.scanInProgress = false;
  }
}

// ============================================================================
// INITIALIZATION - Load settings and blocked URLs
// ============================================================================

// Load content type analysis settings
chrome.storage.sync.get({
  analyzeImages: true,
  analyzeVideos: true,
  analyzeAudio: true,
  blockAIEnabled: false
}, (settings) => {
  CYBERBUDDY_STATE.analyzeImages = settings.analyzeImages;
  CYBERBUDDY_STATE.analyzeVideos = settings.analyzeVideos;
  CYBERBUDDY_STATE.analyzeAudio = settings.analyzeAudio;
  CYBERBUDDY_STATE.blockAIEnabled = settings.blockAIEnabled;
  
  console.log("[CyberBuddy] 📋 Content analysis settings loaded:");
  console.log(`  - Images: ${CYBERBUDDY_STATE.analyzeImages ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  - Videos: ${CYBERBUDDY_STATE.analyzeVideos ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  - Audio: ${CYBERBUDDY_STATE.analyzeAudio ? '✓ Enabled' : '✗ Disabled'}`);
  console.log(`  - Block AI: ${CYBERBUDDY_STATE.blockAIEnabled ? '✓ Enabled' : '✗ Disabled'}`);
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.analyzeImages) {
      CYBERBUDDY_STATE.analyzeImages = changes.analyzeImages.newValue;
      console.log(`[CyberBuddy] Setting updated - Analyze Images: ${CYBERBUDDY_STATE.analyzeImages}`);
    }
    if (changes.analyzeVideos) {
      CYBERBUDDY_STATE.analyzeVideos = changes.analyzeVideos.newValue;
      console.log(`[CyberBuddy] Setting updated - Analyze Videos: ${CYBERBUDDY_STATE.analyzeVideos}`);
    }
    if (changes.analyzeAudio) {
      CYBERBUDDY_STATE.analyzeAudio = changes.analyzeAudio.newValue;
      console.log(`[CyberBuddy] Setting updated - Analyze Audio: ${CYBERBUDDY_STATE.analyzeAudio}`);
    }
    if (changes.blockAIEnabled) {
      CYBERBUDDY_STATE.blockAIEnabled = changes.blockAIEnabled.newValue;
      console.log(`[CyberBuddy] Setting updated - Block AI: ${CYBERBUDDY_STATE.blockAIEnabled}`);
    }
  }
});

