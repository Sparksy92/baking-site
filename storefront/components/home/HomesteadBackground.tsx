'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   PHOTOREALISTIC 4D HOMESTEAD SHADER (WITH SUBTLE PARALLAX)
═══════════════════════════════════════════════════════════════════ */
const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    vUv.y = 1.0 - vUv.y; // Flip Y for WebGL texture coordinates
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  uniform sampler2D uImage;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  varying vec2 vUv;

  float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 uv = vUv;

    // 1. Damped Ultra-Subtle 3D Parallax Window (Reduced by 75%)
    vec2 mouseOffset = (uMouse / uResolution - 0.5);
    float depth = uv.y; 
    vec2 parallax = mouseOffset * (0.003 + depth * 0.005); // Barely perceptible movement
    uv -= parallax;

    uv = clamp(uv, 0.001, 0.999);

    vec4 origColor = texture2D(uImage, uv);

    // 2. Color-Masked Foliage Sway (Natural Wind)
    float isGreen = origColor.g - max(origColor.r, origColor.b) * 0.8;
    float foliageMask = smoothstep(0.02, 0.2, isGreen) * smoothstep(0.2, 0.9, uv.y);
    
    float windSpeed = uTime * 1.0;
    float windDisplacement = (noise(uv * 12.0 + vec2(windSpeed, windSpeed * 0.5)) - 0.5) * 0.004 * foliageMask;
    uv.x += windDisplacement;
    uv.y += windDisplacement * 0.3;

    vec4 color = texture2D(uImage, clamp(uv, 0.001, 0.999));

    // 3. Warm Golden Hour Sunlight & Subtle Atmosphere
    vec2 sunPos = vec2(0.85, 0.15);
    float distToSun = distance(uv, sunPos);
    float sunRay = max(0.0, 1.0 - distToSun * 1.4);
    float rayNoise = noise(uv * 8.0 - vec2(uTime * 0.2, uTime * 0.1));
    vec3 goldenLight = vec3(1.0, 0.75, 0.4) * (sunRay * 0.10 + sunRay * rayNoise * 0.06);
    color.rgb += goldenLight;

    // 4. Subtle Natural Vignette
    float vig = distance(vUv, vec2(0.5));
    color.rgb *= smoothstep(0.85, 0.35, vig) * 0.12 + 0.88;

    gl_FragColor = color;
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vSource: string, fSource: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fSource);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

/* ═══════════════════════════════════════════════════════════════════
   PHYSICS & WILDLIFE CLASSES
═══════════════════════════════════════════════════════════════════ */

// 1. CHIMNEY SMOKE PARTICLE
class SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxLife: number;
  life: number;
  alpha: number;

  constructor(startX: number, startY: number) {
    this.x = startX + (Math.random() - 0.5) * 4;
    this.y = startY;
    this.vx = 0.2 + (Math.random() - 0.3) * 0.3; // Drift slightly right with the wind
    this.vy = -0.5 - Math.random() * 0.5; // Rise up
    this.size = 2 + Math.random() * 3;
    this.maxLife = 120 + Math.random() * 80;
    this.life = 0;
    this.alpha = 0.25;
  }

  update() {
    this.life++;
    this.x += this.vx;
    this.y += this.vy;
    
    // Smoke expands as it rises
    this.size += 0.15;
    
    // Wind drift increases with height
    this.vx += 0.005;

    const progress = this.life / this.maxLife;
    this.alpha = (1.0 - progress) * 0.25;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 235, 230, ${this.alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

// 2. FLYING BIRD (SKY SILHOUETTE)
class FlyingBird {
  x: number;
  y: number;
  speed: number;
  flapSpeed: number;
  flapPhase: number;
  scale: number;

  constructor(w: number, h: number) {
    this.x = -50 - Math.random() * 200; // Start offscreen left
    this.y = h * 0.05 + Math.random() * h * 0.35; // Random height in sky
    this.speed = 1.2 + Math.random() * 0.8;
    this.flapSpeed = 0.15 + Math.random() * 0.1;
    this.flapPhase = Math.random() * Math.PI * 2;
    this.scale = 0.4 + Math.random() * 0.4;
  }

  update(w: number) {
    this.x += this.speed;
    this.flapPhase += this.flapSpeed;
    
    // Gentle bobbing up and down
    this.y += Math.sin(this.flapPhase * 0.2) * 0.15;

    // Respawn if offscreen right
    if (this.x > w + 50) {
      this.x = -50;
      this.y = Math.random() * (window.innerHeight * 0.4);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    
    // Simple path drawing for a flapping bird silhouette
    ctx.strokeStyle = 'rgba(60, 50, 45, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    // Flapping calculation (wings go up and down)
    const wingY = Math.sin(this.flapPhase) * 6;
    
    // Left wing
    ctx.moveTo(-12, wingY);
    ctx.quadraticCurveTo(-6, -2, 0, 0);
    // Right wing
    ctx.quadraticCurveTo(6, -2, 12, wingY);
    
    ctx.stroke();
    ctx.restore();
  }
}

// 3. WANDERING BUTTERFLY (GARDEN)
class Butterfly {
  x: number;
  y: number;
  color: string;
  vx: number;
  vy: number;
  flapPhase: number;
  targetX: number;
  targetY: number;

  constructor(w: number, h: number) {
    this.x = w * 0.1 + Math.random() * w * 0.7;
    this.y = h * 0.7 + Math.random() * h * 0.25;
    this.color = ['#ff88aa', '#ffbb33', '#44ccff', '#ccff33'][Math.floor(Math.random() * 4)];
    this.vx = 0;
    this.vy = 0;
    this.flapPhase = Math.random() * Math.PI * 2;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  update(w: number, h: number, mouseX: number, mouseY: number) {
    this.flapPhase += 0.35; // Fast fluttering wing cycle

    // Choose a new target occasionally for natural wandering
    if (Math.random() < 0.02 || Math.hypot(this.x - this.targetX, this.y - this.targetY) < 10) {
      this.targetX = w * 0.05 + Math.random() * w * 0.8;
      this.targetY = h * 0.65 + Math.random() * h * 0.3;
    }

    // Gentle attraction to target
    let ax = (this.targetX - this.x) * 0.002;
    let ay = (this.targetY - this.y) * 0.002;

    // React to mouse (flutter away)
    const distToMouse = Math.hypot(this.x - mouseX, this.y - mouseY);
    if (distToMouse < 100) {
      const escapeForce = (100 - distToMouse) * 0.05;
      ax += ((this.x - mouseX) / distToMouse) * escapeForce;
      ay += ((this.y - mouseY) / distToMouse) * escapeForce;
    }

    this.vx += ax;
    this.vy += ay;

    // Speed limit
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 2.0) {
      this.vx = (this.vx / speed) * 2.0;
      this.vy = (this.vy / speed) * 2.0;
    }

    // Fluttering noise
    this.x += this.vx + (Math.random() - 0.5) * 1.2;
    this.y += this.vy + (Math.random() - 0.5) * 1.2;

    // Constrain to garden
    if (this.y < h * 0.6) this.targetY = h * 0.75;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Fluttering wing scaling
    const wingWidth = Math.abs(Math.sin(this.flapPhase)) * 4 + 1;
    
    ctx.fillStyle = this.color;
    
    // Left Wing
    ctx.beginPath();
    ctx.ellipse(-2, 0, wingWidth, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Right Wing
    ctx.beginPath();
    ctx.ellipse(2, 0, wingWidth, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#221100';
    ctx.fillRect(-0.7, -3, 1.4, 6);
    
    ctx.restore();
  }
}

// 4. DUCK SWIMMING IN POND (BOTTOM-RIGHT)
class SwimmingDuck {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  speed: number;
  wakes: { x: number; y: number; size: number; alpha: number }[];
  wakeTimer: number;

  constructor(w: number, h: number) {
    // Relative coordinates mapped to bottom-right pond
    this.x = w * 0.8 + (Math.random() - 0.5) * (w * 0.1);
    this.y = h * 0.8 + (Math.random() - 0.5) * (h * 0.08);
    this.targetX = this.x;
    this.targetY = this.y;
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 0.2 + Math.random() * 0.15;
    this.wakes = [];
    this.wakeTimer = 0;
  }

  update(w: number, h: number, mouseX: number, mouseY: number) {
    // Random target inside pond boundaries
    const pondMinX = w * 0.72;
    const pondMaxX = w * 0.94;
    const pondMinY = h * 0.75;
    const pondMaxY = h * 0.92;

    if (Math.random() < 0.008 || Math.hypot(this.x - this.targetX, this.y - this.targetY) < 15) {
      this.targetX = pondMinX + Math.random() * (pondMaxX - pondMinX);
      this.targetY = pondMinY + Math.random() * (pondMaxY - pondMinY);
    }

    // Gentle flight reaction if mouse cursor gets extremely close
    const distToMouse = Math.hypot(this.x - mouseX, this.y - mouseY);
    if (distToMouse < 80) {
      // Swim away from mouse
      const escapeX = this.x + ((this.x - mouseX) / distToMouse) * 100;
      const escapeY = this.y + ((this.y - mouseY) / distToMouse) * 100;
      this.targetX = Math.max(pondMinX, Math.min(pondMaxX, escapeX));
      this.targetY = Math.max(pondMinY, Math.min(pondMaxY, escapeY));
    }

    // Steering / Rotation toward target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const targetAngle = Math.atan2(dy, dx);
    
    // Smooth angle interpolation
    let angleDiff = targetAngle - this.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.angle += angleDiff * 0.03;

    // Move forward
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Constrain tightly to pond
    this.x = Math.max(pondMinX, Math.min(pondMaxX, this.x));
    this.y = Math.max(pondMinY, Math.min(pondMaxY, this.y));

    // Wake Ripples creation
    this.wakeTimer++;
    if (this.wakeTimer % 15 === 0) {
      this.wakes.push({
        x: this.x - Math.cos(this.angle) * 6,
        y: this.y - Math.sin(this.angle) * 6,
        size: 2,
        alpha: 0.3
      });
    }

    // Update existing wakes
    for (let i = this.wakes.length - 1; i >= 0; i--) {
      const wake = this.wakes[i];
      wake.size += 0.2;
      wake.alpha -= 0.004;
      if (wake.alpha <= 0) {
        this.wakes.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Draw wakes
    ctx.save();
    ctx.lineWidth = 1;
    for (const wake of this.wakes) {
      ctx.strokeStyle = `rgba(200, 220, 255, ${wake.alpha})`;
      ctx.beginPath();
      ctx.ellipse(wake.x, wake.y, wake.size * 2, wake.size, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Draw Duck
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Body
    ctx.fillStyle = '#65503b'; // Wild duck brown
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#4c3928';
    ctx.beginPath();
    ctx.ellipse(-1, -1, 5, 2, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#1e3f20'; // Mallard green head
    ctx.beginPath();
    ctx.arc(6, -2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#e5a93b'; // Orange beak
    ctx.beginPath();
    ctx.moveTo(9, -3);
    ctx.lineTo(13, -2);
    ctx.lineTo(9, -1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

// 5. GOLDEN DUST MOTES
class DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  phase: number;

  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 0.15;
    this.vy = -0.05 - Math.random() * 0.15;
    this.size = 0.5 + Math.random() * 1.0;
    this.maxAlpha = 0.15 + Math.random() * 0.35;
    this.alpha = 0;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(w: number, h: number, mouseX: number, mouseY: number, mouseVx: number, mouseVy: number) {
    this.phase += 0.015;
    
    let targetVx = (Math.sin(this.phase) * 0.15) + (Math.random() - 0.5) * 0.05;
    let targetVy = -0.1 + (Math.cos(this.phase * 0.7) * 0.05);

    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 120 && dist > 0.1) {
      const pushFactor = (120 - dist) / 120;
      targetVx += (dx / dist) * pushFactor * 1.5 + mouseVx * pushFactor * 0.08;
      targetVy += (dy / dist) * pushFactor * 1.5 + mouseVy * pushFactor * 0.08;
    }

    this.vx += (targetVx - this.vx) * 0.03;
    this.vy += (targetVy - this.vy) * 0.03;

    this.x += this.vx;
    this.y += this.vy;

    this.alpha = (Math.sin(this.phase) * 0.5 + 0.5) * this.maxAlpha;

    if (this.y < -10) this.y = h + 10;
    if (this.x < -10) this.x = w + 10;
    if (this.x > w + 10) this.x = -10;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0.01) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 230, 180, ${this.alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

export default function HomesteadBackground() {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, locs: any } | null>(null);
  
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0 });
  
  // Entity refs
  const smokeRef = useRef<SmokeParticle[]>([]);
  const birdsRef = useRef<FlyingBird[]>([]);
  const butterfliesRef = useRef<Butterfly[]>([]);
  const ducksRef = useRef<SwimmingDuck[]>([]);
  const motesRef = useRef<DustMote[]>([]);

  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
    if (!gl) return;

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    gl.useProgram(program);

    // Full screen quad using 6 vertices
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const locs = {
      uTime: gl.getUniformLocation(program, 'uTime'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uMouse: gl.getUniformLocation(program, 'uMouse'),
      uImage: gl.getUniformLocation(program, 'uImage'),
    };

    const texture = gl.createTexture();
    const image = new Image();
    image.src = '/homestead.jpg';
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };

    glRef.current = { gl, program, texture: texture!, locs };

    return () => {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
    };
  }, []);

  useEffect(() => {
    if (!glRef.current) return;
    
    let animId: number;
    const startTime = performance.now();
    
    const glCanvas = glCanvasRef.current!;
    const overlayCanvas = overlayCanvasRef.current!;
    const ctx = overlayCanvas.getContext('2d')!;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      glCanvas.width = w;
      glCanvas.height = h;
      overlayCanvas.width = w;
      overlayCanvas.height = h;
      
      if (glRef.current) {
        glRef.current.gl.viewport(0, 0, w, h);
      }
      
      // Initialize entities once or adjust on resize
      birdsRef.current = [new FlyingBird(w, h), new FlyingBird(w, h)];
      butterfliesRef.current = [new Butterfly(w, h), new Butterfly(w, h), new Butterfly(w, h)];
      ducksRef.current = [new SwimmingDuck(w, h), new SwimmingDuck(w, h)];
      
      motesRef.current = [];
      const particleCount = Math.floor((w * h) / 30000);
      for (let i = 0; i < Math.min(60, Math.max(20, particleCount)); i++) {
        motesRef.current.push(new DustMote(w, h));
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let lastMouseX = window.innerWidth / 2;
    let lastMouseY = window.innerHeight / 2;

    const onMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;

      mouseRef.current.vx = e.clientX - lastMouseX;
      mouseRef.current.vy = e.clientY - lastMouseY;

      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    const animate = () => {
      const t = (performance.now() - startTime) / 1000;
      const w = glCanvas.width;
      const h = glCanvas.height;

      // Smooth mouse damping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      mouseRef.current.vx *= 0.9;
      mouseRef.current.vy *= 0.9;

      // 1. Draw WebGL Background
      if (glRef.current) {
        const { gl, program, locs } = glRef.current;
        gl.useProgram(program);
        gl.uniform1f(locs.uTime, t);
        gl.uniform2f(locs.uResolution, w, h);
        gl.uniform2f(locs.uMouse, mouseRef.current.x, mouseRef.current.y);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // 2. Draw 2D Overlay Entities
      ctx.clearRect(0, 0, w, h);

      // A. Dust Motes
      const motes = motesRef.current;
      for (const mote of motes) {
        mote.update(w, h, mouseRef.current.targetX, mouseRef.current.targetY, mouseRef.current.vx, mouseRef.current.vy);
        mote.draw(ctx);
      }

      // B. Butterflies
      const butterflies = butterfliesRef.current;
      for (const bf of butterflies) {
        bf.update(w, h, mouseRef.current.targetX, mouseRef.current.targetY);
        bf.draw(ctx);
      }

      // C. Ducks
      const ducks = ducksRef.current;
      for (const duck of ducks) {
        duck.update(w, h, mouseRef.current.targetX, mouseRef.current.targetY);
        duck.draw(ctx);
      }

      // D. Chimney Smoke
      const smokeParticles = smokeRef.current;
      
      // Spawn new smoke particle periodically (chimney is located approx at x: 20%, y: 24%)
      if (Math.random() < 0.15) {
        smokeParticles.push(new SmokeParticle(w * 0.205, h * 0.23));
      }

      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.update();
        if (p.life >= p.maxLife || p.y < -20 || p.x > w + 20) {
          smokeParticles.splice(i, 1);
        } else {
          p.draw(ctx);
        }
      }

      // E. Flying Birds
      const birds = birdsRef.current;
      for (const bird of birds) {
        bird.update(w);
        bird.draw(ctx);
      }

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black pointer-events-none">
      {/* WebGL Parallax Shader */}
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
      {/* Wildlife & Smoke Canvas Overlay */}
      <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: 'block' }} />
    </div>
  );
}
