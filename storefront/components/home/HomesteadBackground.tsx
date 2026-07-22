'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   WEBGL MULTI-RIPPLE DISPLACEMENT SHADER
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
  
  // Ripple uniform array: xy = position, z = life progress (0.0 to 1.0)
  // We use a fixed loop size of 20 for WebGL 1.0 compatibility
  uniform vec3 uRipples[20];
  
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
    float aspect = uResolution.x / uResolution.y;

    // 1. Calculate Multi-Ripple Water/Glass Distortion
    vec2 rippleOffset = vec2(0.0);
    
    for (int i = 0; i < 20; i++) {
      vec3 r = uRipples[i];
      // Active ripples have progress between 0.0 and 1.0
      if (r.z > 0.0 && r.z < 1.0) {
        vec2 diff = uv - r.xy;
        diff.x *= aspect; // Correct aspect ratio for circular ripples
        float dist = length(diff);
        
        float progress = r.z;
        float radius = progress * 0.35; // ripple expands outwards
        
        if (dist < radius) {
          // Decays over time (linear fadeout)
          float strength = 0.02 * (1.0 - progress);
          // Sine wave modulation based on distance from ripple edge
          float wave = sin((radius - dist) * 45.0) * strength;
          rippleOffset += normalize(diff) * wave;
        }
      }
    }
    
    uv += rippleOffset;
    uv = clamp(uv, 0.001, 0.999);

    // Re-sample color after ripple displacement
    vec4 color = texture2D(uImage, uv);

    // 2. Hearth Fire Glow Pulsation (Oven is around x: 0.67, y: 0.44)
    vec2 ovenPos = vec2(0.67, 0.44);
    float distToOven = distance(uv, ovenPos);
    if (distToOven < 0.18) {
      float glowIntensity = noise(vec2(uTime * 4.0, uTime * 3.0)) * 0.12 * (1.0 - distToOven / 0.18);
      color.rgb += vec3(0.18, 0.09, 0.0) * glowIntensity; // Add warm orange/amber glow
    }

    // 3. Golden Window Light Rays (Sunlight beams from left window)
    float windowBeam = max(0.0, 1.0 - uv.x * 1.5) * (0.8 - uv.y * 0.8);
    float rayNoise = noise(uv * 6.0 - vec2(uTime * 0.1, uTime * 0.05));
    color.rgb += vec3(1.0, 0.8, 0.5) * windowBeam * (0.05 + rayNoise * 0.04);

    // 4. Subtle Natural Vignette
    float vig = distance(vUv, vec2(0.5));
    color.rgb *= smoothstep(0.85, 0.4, vig) * 0.1 + 0.9;

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
   ATMOSPHERIC FLOUR DUST & STEAM PARTICLES (2D CANVAS)
═══════════════════════════════════════════════════════════════════ */
class FlourDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  phase: number;

  constructor(w: number, h: number) {
    // Flour dust primarily floats in the sun rays coming from the left window (x < 40%)
    this.x = Math.random() * (w * 0.45);
    this.y = Math.random() * h;
    this.vx = 0.1 + Math.random() * 0.2; // Drift slowly away from window
    this.vy = (Math.random() - 0.5) * 0.15;
    this.size = 0.5 + Math.random() * 1.2;
    this.maxAlpha = 0.1 + Math.random() * 0.35;
    this.alpha = 0;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(w: number, h: number, mouseX: number, mouseY: number) {
    this.phase += 0.01;
    
    let targetVx = this.vx + Math.sin(this.phase) * 0.05;
    let targetVy = this.vy + Math.cos(this.phase * 0.8) * 0.05;

    // React to mouse
    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 100) {
      const push = (100 - dist) / 100;
      targetVx += (dx / dist) * push * 1.5;
      targetVy += (dy / dist) * push * 1.5;
    }

    this.x += targetVx;
    this.y += targetVy;

    this.alpha = (Math.sin(this.phase) * 0.5 + 0.5) * this.maxAlpha;

    // Recirculate
    if (this.x > w * 0.5 || this.y < -10 || this.y > h + 10) {
      this.x = -10;
      this.y = Math.random() * h;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0.01) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 245, 230, ${this.alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

class BreadSteam {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxLife: number;
  life: number;
  alpha: number;

  constructor(startX: number, startY: number) {
    this.x = startX + (Math.random() - 0.5) * 60; // Spread across bread area
    this.y = startY;
    this.vx = (Math.random() - 0.4) * 0.15; // Slow drift
    this.vy = -0.3 - Math.random() * 0.4; // Slowly rise
    this.size = 2 + Math.random() * 3;
    this.maxLife = 90 + Math.random() * 60;
    this.life = 0;
    this.alpha = 0.08;
  }

  update() {
    this.life++;
    this.x += this.vx;
    this.y += this.vy;
    this.size += 0.08; // expand slightly
    const progress = this.life / this.maxLife;
    this.alpha = (1.0 - progress) * 0.08;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

interface Ripple {
  x: number;
  y: number;
  age: number;
}

export default function HomesteadBackground() {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, locs: any } | null>(null);
  
  const mouseRef = useRef({ lastX: 0, lastY: 0 });
  const ripplesRef = useRef<Ripple[]>([]);
  const dustRef = useRef<FlourDust[]>([]);
  const steamRef = useRef<BreadSteam[]>([]);

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
      uRipples: gl.getUniformLocation(program, 'uRipples'),
      uImage: gl.getUniformLocation(program, 'uImage'),
    };

    const texture = gl.createTexture();
    const image = new Image();
    image.src = '/bakery_hearth.jpg';
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };

    glRef.current = { gl, program, texture: texture!, locs };

    // Fill circular buffer of ripples with inactive state
    ripplesRef.current = Array.from({ length: 20 }, () => ({ x: 0, y: 0, age: 1.0 }));

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
      
      // Initialize dust particles
      dustRef.current = [];
      for (let i = 0; i < 40; i++) {
        dustRef.current.push(new FlourDust(w, h));
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let nextRippleIndex = 0;

    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      const distMoved = Math.hypot(mouseX - mouseRef.current.lastX, mouseY - mouseRef.current.lastY);
      
      // Spawn a ripple if mouse moves significantly
      if (distMoved > 25) {
        const u = mouseX / w;
        const v = 1.0 - (mouseY / h); // Flip Y to match WebGL coordinates

        ripplesRef.current[nextRippleIndex] = {
          x: u,
          y: v,
          age: 0.0
        };

        nextRippleIndex = (nextRippleIndex + 1) % 20;

        mouseRef.current.lastX = mouseX;
        mouseRef.current.lastY = mouseY;
      }
    };
    window.addEventListener('mousemove', onMove);

    const animate = () => {
      const t = (performance.now() - startTime) / 1000;
      const w = glCanvas.width;
      const h = glCanvas.height;

      // 1. Update Ripples Age
      const ripples = ripplesRef.current;
      const rippleData = new Float32Array(20 * 3);
      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i];
        if (r.age < 1.0) {
          r.age += 0.012; // Controls ripple speed/duration
        }
        rippleData[i * 3 + 0] = r.x;
        rippleData[i * 3 + 1] = r.y;
        rippleData[i * 3 + 2] = r.age;
      }

      // 2. Draw WebGL Background
      if (glRef.current) {
        const { gl, program, locs } = glRef.current;
        gl.useProgram(program);
        gl.uniform1f(locs.uTime, t);
        gl.uniform2f(locs.uResolution, w, h);
        gl.uniform3fv(locs.uRipples, rippleData);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // 3. Draw 2D Overlay Entities (Dust and Steam)
      ctx.clearRect(0, 0, w, h);

      // Flour Dust in window rays
      const dustParticles = dustRef.current;
      for (const dust of dustParticles) {
        dust.update(w, h, mouseRef.current.lastX, mouseRef.current.lastY);
        dust.draw(ctx);
      }

      // Steam rising from loaves on table (approx x: 44%, y: 72%)
      const steamParticles = steamRef.current;
      if (Math.random() < 0.12) {
        steamParticles.push(new BreadSteam(w * 0.44, h * 0.72));
      }
      for (let i = steamParticles.length - 1; i >= 0; i--) {
        const p = steamParticles[i];
        p.update();
        if (p.life >= p.maxLife || p.y < 0) {
          steamParticles.splice(i, 1);
        } else {
          p.draw(ctx);
        }
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
      {/* WebGL Multi-Ripple Shader */}
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
      {/* 2D Overlay for Flour Dust & Hot Sourdough Steam */}
      <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: 'block' }} />
    </div>
  );
}
