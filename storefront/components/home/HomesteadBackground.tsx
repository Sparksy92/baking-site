'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import FishingUI from './FishingUI';

/* ═══════════════════════════════════════════════════════════════════
   WEBGL 4D HOMESTEAD SHADER
═══════════════════════════════════════════════════════════════════ */
const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    vUv.y = 1.0 - vUv.y; // flip Y for image coordinates
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
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                 mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  void main() {
    vec2 uv = vUv;

    // 1. Parallax Depth: bottom of image moves more than top
    float depth = uv.y; // 0.0 top, 1.0 bottom
    vec2 parallaxOffset = (uMouse / uResolution - 0.5) * depth * 0.03;
    uv -= parallaxOffset; // shift image based on mouse

    // Clamp to avoid edge wrap
    uv = clamp(uv, 0.0, 1.0);

    // 2. Heat Haze around oven (approx x: 0.85, y: 0.6)
    float distToOven = distance(uv, vec2(0.85, 0.6));
    float heatHaze = smoothstep(0.2, 0.0, distToOven) * noise(uv * 30.0 + uTime * 3.0) * 0.003;
    uv.y += heatHaze;

    // 3. Wind on foliage (middle depths)
    float wind = noise(uv * 10.0 + uTime * 0.5) * 0.002 * (1.0 - abs(depth - 0.5)*2.0);
    uv.x += wind;

    vec4 color = texture2D(uImage, uv);
    
    // Golden Hour God Rays
    vec2 lightOrigin = vec2(0.8, 0.1); // Sun in top right
    float ray = max(0.0, 1.0 - distance(uv, lightOrigin) * 1.5) * 0.15;
    float rayNoise = noise(uv * 15.0 - uTime * 0.3);
    color.rgb += ray * rayNoise * vec3(1.0, 0.7, 0.3);

    // Vignette
    float vig = distance(vUv, vec2(0.5));
    color.rgb *= smoothstep(0.8, 0.4, vig) * 0.2 + 0.8;

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
   CLASSES
═══════════════════════════════════════════════════════════════════ */
type Ripple = {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  speed: number;
};

class KoiFish {
  x: number;
  y: number;
  angle: number;
  sizeMultiplier: number;
  
  targetAngle: number;
  targetSpeed: number;
  speed: number;
  
  segments: { x: number, y: number, angle: number }[] = [];
  numSegments = 16;
  baseLength = 4;
  mouthOpen = 0;
  colorType: number;
  
  pondCx: number;
  pondCy: number;
  pondRx: number;
  pondRy: number;

  constructor(x: number, y: number, pondCx: number, pondCy: number, pondRx: number, pondRy: number) {
    this.x = x;
    this.y = y;
    this.pondCx = pondCx;
    this.pondCy = pondCy;
    this.pondRx = pondRx;
    this.pondRy = pondRy;
    this.angle = Math.random() * Math.PI * 2;
    this.sizeMultiplier = 0.5 + Math.random() * 0.4;
    this.targetAngle = this.angle;
    this.targetSpeed = 0.5;
    this.speed = 0.5;
    this.colorType = Math.floor(Math.random() * 4);

    for (let i = 0; i < this.numSegments; i++) {
      this.segments.push({ x: this.x, y: this.y, angle: this.angle });
    }
  }

  update(width: number, height: number, gameState: any, ripples: Ripple[]) {
    if (gameState.hookedFish === this) {
      if (gameState.phase === 'biting' || gameState.phase === 'reeling') {
        this.targetAngle = Math.atan2(this.y - gameState.bobberY, this.x - gameState.bobberX) + (Math.random() - 0.5) * 2;
        this.targetSpeed = 4.0;
        this.mouthOpen = 1;
        if (Math.random() < 0.1) {
          ripples.push({ x: this.x, y: this.y, radius: 2, maxRadius: 40, strength: 0.8, speed: 2.0 });
        }
      } else if (gameState.phase === 'caught') {
        this.targetSpeed = 0;
        this.x = gameState.bobberX;
        this.y = gameState.bobberY;
      }
    } else {
      let minDist = 400;
      let bobberActive = (gameState.phase === 'cast' && gameState.bobberZ === 0);
      
      if (bobberActive) {
        const fDist = Math.hypot(gameState.bobberX - this.x, gameState.bobberY - this.y);
        if (fDist < minDist) {
          minDist = fDist;
        }
      }

      if (bobberActive && minDist < 150) {
        this.targetAngle = Math.atan2(gameState.bobberY - this.y, gameState.bobberX - this.x);
        this.targetSpeed = 1.4 + (gameState.baitLevel * 0.2);
        this.mouthOpen = Math.min(1, this.mouthOpen + 0.05);

        if (minDist < 15 && !gameState.hookedFish) {
          gameState.hookedFish = this;
          gameState.phase = 'biting';
          gameState.timeInPhase = 0;
          this.targetSpeed = 0;
          this.mouthOpen = 1;
          ripples.push({ x: this.x, y: this.y, radius: 2, maxRadius: 80, strength: 1.0, speed: 2.0 });
        }
      } else {
        this.mouthOpen = Math.max(0, this.mouthOpen - 0.03);
        if (Math.random() < 0.01) {
          this.targetAngle = this.angle + (Math.random() - 0.5) * 2.0;
        }
        this.targetSpeed = 0.5 + Math.random() * 0.3;
      }
    }

    this.speed += (this.targetSpeed - this.speed) * 0.1;
    
    let diff = this.targetAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.angle += diff * 0.05;

    let nx = this.x + Math.cos(this.angle) * this.speed;
    let ny = this.y + Math.sin(this.angle) * this.speed;

    const dx = (nx - this.pondCx) / this.pondRx;
    const dy = (ny - this.pondCy) / this.pondRy;
    if (dx*dx + dy*dy > 1 && gameState.hookedFish !== this) {
      this.targetAngle += Math.PI;
      this.angle += Math.PI;
      nx = this.x + Math.cos(this.angle) * this.speed;
      ny = this.y + Math.sin(this.angle) * this.speed;
    }

    this.x = nx;
    this.y = ny;

    this.segments[0].x = this.x;
    this.segments[0].y = this.y;
    this.segments[0].angle = this.angle;

    for (let i = 1; i < this.numSegments; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];
      const sdx = prev.x - curr.x;
      const sdy = prev.y - curr.y;
      const sDist = Math.hypot(sdx, sdy);
      const segAng = Math.atan2(sdy, sdx);
      
      const desiredLength = this.baseLength * this.sizeMultiplier * (1 - i * 0.02);
      
      if (sDist > desiredLength) {
        curr.x = prev.x - Math.cos(segAng) * desiredLength;
        curr.y = prev.y - Math.sin(segAng) * desiredLength;
      }
      
      let angleDiff = segAng - curr.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      curr.angle += angleDiff * 0.3;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    ctx.beginPath();
    const bodyW = [6, 8, 9, 8.5, 7.5, 6, 4.5, 3, 2, 1, 0.5, 0.3, 0.2, 0.1, 0.1, 0];
    
    for (let i=0; i<this.numSegments; i++) {
      const s = this.segments[i];
      const w = bodyW[i] * this.sizeMultiplier * 2;
      const px = s.x + Math.cos(s.angle - Math.PI/2) * w;
      const py = s.y + Math.sin(s.angle - Math.PI/2) * w;
      if (i===0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i=this.numSegments-1; i>=0; i--) {
      const s = this.segments[i];
      const w = bodyW[i] * this.sizeMultiplier * 2;
      const px = s.x + Math.cos(s.angle + Math.PI/2) * w;
      const py = s.y + Math.sin(s.angle + Math.PI/2) * w;
      ctx.lineTo(px, py);
    }
    ctx.closePath();

    if (this.colorType === 0) ctx.fillStyle = '#f87c2b';
    else if (this.colorType === 1) ctx.fillStyle = '#222222';
    else if (this.colorType === 2) ctx.fillStyle = '#ffffff';
    else ctx.fillStyle = '#d4af37';

    ctx.fill();
    ctx.restore();
  }
}

export default function HomesteadBackground() {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const fishCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, locs: any } | null>(null);

  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const ripplesRef = useRef<Ripple[]>([]);
  const fishRef = useRef<KoiFish[]>([]);
  
  const gameStateRef = useRef({
    phase: 'idle',
    tension: 0.5,
    points: typeof window !== 'undefined' ? Number(localStorage.getItem('fishing_points') || 0) : 0,
    poleLevel: typeof window !== 'undefined' ? Number(localStorage.getItem('fishing_poleLevel') || 1) : 1,
    baitLevel: typeof window !== 'undefined' ? Number(localStorage.getItem('fishing_baitLevel') || 1) : 1,
    bobberX: -1000,
    bobberY: -1000,
    bobberZ: 0,
    hookedFish: null as KoiFish | null,
    timeInPhase: 0,
  });
  
  const [uiState, setUiState] = useState({ ...gameStateRef.current });

  useEffect(() => {
    const t = setInterval(() => setUiState({ ...gameStateRef.current }), 50);
    return () => clearInterval(t);
  }, []);

  const saveProgress = useCallback(() => {
    localStorage.setItem('fishing_points', gameStateRef.current.points.toString());
    localStorage.setItem('fishing_poleLevel', gameStateRef.current.poleLevel.toString());
    localStorage.setItem('fishing_baitLevel', gameStateRef.current.baitLevel.toString());
  }, []);

  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false });
    if (!gl) return;

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    gl.useProgram(program);

    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1, -1,
       1,  1,
      -1,  1,
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
    const fishCanvas = fishCanvasRef.current!;
    const ctx = fishCanvas.getContext('2d')!;

    const resize = () => {
      glCanvas.width = window.innerWidth;
      glCanvas.height = window.innerHeight;
      fishCanvas.width = window.innerWidth;
      fishCanvas.height = window.innerHeight;
      
      if (glRef.current) {
        glRef.current.gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      }

      const pCx = glCanvas.width * 0.85;
      const pCy = glCanvas.height * 0.85;
      const pRx = glCanvas.width * 0.12;
      const pRy = glCanvas.height * 0.08;
      
      fishRef.current = [];
      for (let i = 0; i < 4; i++) {
        fishRef.current.push(new KoiFish(pCx + (Math.random()-0.5)*pRx, pCy + (Math.random()-0.5)*pRy, pCx, pCy, pRx, pRy));
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      mouseRef.current.tx = e.clientX;
      mouseRef.current.ty = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    const onClick = (e: MouseEvent) => {
      const state = gameStateRef.current;
      if (state.phase === 'highscore') return; 
      
      const pCx = fishCanvas.width * 0.85;
      const pCy = fishCanvas.height * 0.85;
      const pRx = fishCanvas.width * 0.12;
      const pRy = fishCanvas.height * 0.08;
      
      const dx = (e.clientX - pCx) / pRx;
      const dy = (e.clientY - pCy) / pRy;
      
      if (dx*dx + dy*dy <= 1.5) {
        if (state.phase === 'idle') {
          state.bobberX = e.clientX;
          state.bobberY = e.clientY;
          state.bobberZ = 100;
          state.phase = 'cast';
          state.timeInPhase = 0;
        }
      }

      if (state.phase === 'biting') {
        state.phase = 'reeling';
        state.timeInPhase = 0;
        state.tension = 0.5;
      }
    };
    fishCanvas.addEventListener('click', onClick);

    const animate = () => {
      const t = (performance.now() - startTime) / 1000;
      const width = fishCanvas.width;
      const height = fishCanvas.height;

      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.1;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.1;

      const state = gameStateRef.current;
      state.timeInPhase += 16;

      if (state.phase === 'cast') {
        if (state.bobberZ > 0) {
          state.bobberZ -= 5;
          if (state.bobberZ <= 0) {
            state.bobberZ = 0;
            ripplesRef.current.push({ x: state.bobberX, y: state.bobberY, radius: 2, maxRadius: 30, strength: 0.8, speed: 1.0 });
          }
        }
      } else if (state.phase === 'biting') {
        if (state.timeInPhase > 1500) {
          state.phase = 'escaped';
          state.timeInPhase = 0;
          state.hookedFish = null;
        }
      } else if (state.phase === 'reeling') {
        state.tension -= 0.005;
        if (state.tension <= 0) {
          state.phase = 'escaped';
          state.timeInPhase = 0;
          state.hookedFish = null;
        } else if (state.tension >= 1) {
          state.phase = 'caught';
          state.timeInPhase = 0;
          const pointsEarned = Math.floor(state.hookedFish!.sizeMultiplier * 50);
          state.points += pointsEarned;
          saveProgress();
          state.hookedFish!.x = width * 0.85;
          state.hookedFish!.y = height * 0.85;
        }
      } else if (state.phase === 'escaped') {
        if (state.timeInPhase > 2000) {
          state.phase = 'idle';
          state.bobberX = -1000;
        }
      } else if (state.phase === 'caught') {
        if (state.timeInPhase > 3000) {
          if (state.points > 0 && Math.random() < 0.3) state.phase = 'highscore';
          else {
            state.phase = 'idle';
            state.bobberX = -1000;
            state.hookedFish = null;
          }
        }
      }

      if (glRef.current) {
        const { gl, program, locs } = glRef.current;
        gl.useProgram(program);
        gl.uniform1f(locs.uTime, t);
        gl.uniform2f(locs.uResolution, width, height);
        gl.uniform2f(locs.uMouse, mouseRef.current.x, mouseRef.current.y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      ctx.clearRect(0, 0, width, height);

      // Water distortion/darkening for pond
      ctx.save();
      ctx.fillStyle = 'rgba(0, 40, 20, 0.4)';
      ctx.beginPath();
      ctx.ellipse(width * 0.85, height * 0.85, width * 0.12, height * 0.08, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      fishRef.current.forEach(fish => {
        fish.update(width, height, state, ripplesRef.current);
        fish.draw(ctx);
      });

      if (state.phase !== 'idle' && state.phase !== 'highscore') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const startX = width / 2;
        const startY = height + 100;
        ctx.moveTo(startX, startY);
        
        const bX = state.bobberX;
        const bY = state.bobberY - state.bobberZ;
        
        if (state.phase === 'reeling') {
           ctx.quadraticCurveTo((startX + bX)/2 + 50 * state.tension, (startY + bY)/2, bX, bY);
        } else {
           ctx.lineTo(bX, bY);
        }
        ctx.stroke();

        ctx.fillStyle = (state.phase === 'biting' && Math.floor(state.timeInPhase / 100) % 2 === 0) ? '#ff4444' : '#ff3333';
        ctx.beginPath();
        ctx.arc(bX, bY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bX, bY - 4, 2, 0, Math.PI * 2);
        ctx.fill();
        
        if (state.phase === 'biting') {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          for (let i=0; i<5; i++) {
            ctx.beginPath();
            ctx.arc(bX + (Math.random()-0.5)*15, bY + (Math.random()-0.5)*15, Math.random()*2, 0, Math.PI*2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      ripplesRef.current = ripplesRef.current.filter(ripple => {
        ripple.radius += ripple.speed;
        ripple.strength = 1.0 - ripple.radius / ripple.maxRadius;
        if (ripple.strength <= 0) return false;

        ctx.strokeStyle = `rgba(200, 230, 220, ${ripple.strength * 0.4})`;
        ctx.lineWidth = 1.5 * ripple.strength;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.stroke();
        return true;
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      fishCanvas.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
      <canvas ref={fishCanvasRef} className="absolute inset-0 w-full h-full pointer-events-auto mix-blend-screen" style={{ display: 'block' }} />
      <FishingUI 
        points={uiState.points} poleLevel={uiState.poleLevel} baitLevel={uiState.baitLevel}
        gamePhase={uiState.phase} tension={uiState.tension}
        onReel={() => {
          gameStateRef.current.tension = Math.min(1.0, gameStateRef.current.tension + 0.1 + (gameStateRef.current.poleLevel * 0.02));
        }}
        onUpgradePole={() => {
          const cost = gameStateRef.current.poleLevel * 150;
          if (gameStateRef.current.points >= cost) {
            gameStateRef.current.points -= cost;
            gameStateRef.current.poleLevel += 1;
            saveProgress();
          }
        }}
        onUpgradeBait={() => {
          const cost = gameStateRef.current.baitLevel * 100;
          if (gameStateRef.current.points >= cost) {
            gameStateRef.current.points -= cost;
            gameStateRef.current.baitLevel += 1;
            saveProgress();
          }
        }}
        onSubmitHighscore={async (initials) => {
          await fetch('/api/highscores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initials, score: gameStateRef.current.points })
          });
          gameStateRef.current.phase = 'idle';
          gameStateRef.current.bobberX = -1000;
          gameStateRef.current.hookedFish = null;
        }}
      />
    </div>
  );
}
