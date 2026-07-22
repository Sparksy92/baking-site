'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   PHOTOREALISTIC 4D HOMESTEAD SHADER
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

  float fbm(vec2 p) {
      float val = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
          val += amp * noise(p);
          p *= 2.02;
          amp *= 0.5;
      }
      return val;
  }

  void main() {
    vec2 uv = vUv;

    // 1. Damped 3D Parallax Window
    // Shifts slightly based on mouse position relative to center of screen
    vec2 mouseOffset = (uMouse / uResolution - 0.5);
    float depth = uv.y; // Bottom of image moves slightly more for depth perspective
    vec2 parallax = mouseOffset * (0.015 + depth * 0.02);
    uv -= parallax;

    // Clamp UV to avoid edge repetition
    uv = clamp(uv, 0.001, 0.999);

    // Sample initial texture for color-masking
    vec4 origColor = texture2D(uImage, uv);

    // 2. Color-Masked Foliage Sway (Natural Wind)
    // Identify vegetation (greenish/yellowish tones in lower half of image)
    float isGreen = origColor.g - max(origColor.r, origColor.b) * 0.8;
    float foliageMask = smoothstep(0.02, 0.2, isGreen) * smoothstep(0.2, 0.9, uv.y);
    
    float windSpeed = uTime * 1.2;
    float windDisplacement = (noise(uv * 12.0 + vec2(windSpeed, windSpeed * 0.5)) - 0.5) * 0.005 * foliageMask;
    uv.x += windDisplacement;
    uv.y += windDisplacement * 0.3;

    // Re-sample color after subtle wind sway
    vec4 color = texture2D(uImage, clamp(uv, 0.001, 0.999));

    // 3. Chimney Smoke Effect (Around chimney area: x ~0.15 - 0.25, y ~0.15 - 0.35)
    vec2 chimneyPos = vec2(0.20, 0.25);
    vec2 smokeUv = (uv - chimneyPos) * vec2(2.5, 1.0); // Stretch vertically
    if (smokeUv.y < 0.0 && smokeUv.y > -0.35 && abs(smokeUv.x) < 0.15) {
        float rise = -smokeUv.y;
        vec2 smokeNoiseUv = vec2(smokeUv.x * 4.0, rise * 3.0 - uTime * 0.8);
        float smoke = fbm(smokeNoiseUv) * smoothstep(0.0, 0.08, rise) * (1.0 - smoothstep(0.1, 0.35, rise));
        smoke *= (1.0 - abs(smokeUv.x) / 0.15);
        color.rgb = mix(color.rgb, vec3(0.9, 0.88, 0.85), smoke * 0.25);
    }

    // 4. Warm Golden Hour Sunlight & Subtle Atmosphere
    vec2 sunPos = vec2(0.85, 0.15);
    float distToSun = distance(uv, sunPos);
    float sunRay = max(0.0, 1.0 - distToSun * 1.4);
    float rayNoise = noise(uv * 8.0 - vec2(uTime * 0.2, uTime * 0.1));
    vec3 goldenLight = vec3(1.0, 0.75, 0.4) * (sunRay * 0.12 + sunRay * rayNoise * 0.08);
    color.rgb += goldenLight;

    // 5. Subtle Natural Vignette
    float vig = distance(vUv, vec2(0.5));
    color.rgb *= smoothstep(0.85, 0.35, vig) * 0.15 + 0.85;

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
   GOLDEN DUST MOTES (AERODYNAMIC ATMOSPHERIC PARTICLES)
═══════════════════════════════════════════════════════════════════ */
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
    this.vx = (Math.random() - 0.5) * 0.2;
    this.vy = -0.1 - Math.random() * 0.3; // Slow upward drift
    this.size = 0.8 + Math.random() * 1.5;
    this.maxAlpha = 0.2 + Math.random() * 0.5;
    this.alpha = 0;
    this.phase = Math.random() * Math.PI * 2;
  }

  update(w: number, h: number, mouseX: number, mouseY: number, mouseVx: number, mouseVy: number) {
    this.phase += 0.02;
    
    // Natural floating wander
    let targetVx = (Math.sin(this.phase) * 0.3) + (Math.random() - 0.5) * 0.1;
    let targetVy = -0.15 + (Math.cos(this.phase * 0.7) * 0.1);

    // Aerodynamic Mouse Draft Push
    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 180 && dist > 0.1) {
      const pushFactor = (180 - dist) / 180;
      targetVx += (dx / dist) * pushFactor * 3.0 + mouseVx * pushFactor * 0.15;
      targetVy += (dy / dist) * pushFactor * 3.0 + mouseVy * pushFactor * 0.15;
    }

    this.vx += (targetVx - this.vx) * 0.04;
    this.vy += (targetVy - this.vy) * 0.04;

    this.x += this.vx;
    this.y += this.vy;

    // Fade in and out
    this.alpha = (Math.sin(this.phase) * 0.5 + 0.5) * this.maxAlpha;

    // Wrap around screen boundaries
    if (this.y < -10) this.y = h + 10;
    if (this.x < -10) this.x = w + 10;
    if (this.x > w + 10) this.x = -10;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0.01) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 220, 150, ${this.alpha})`;
    ctx.shadowBlur = 4;
    ctx.shadowColor = `rgba(255, 200, 100, ${this.alpha})`;
    ctx.fill();
    ctx.restore();
  }
}

export default function HomesteadBackground() {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const dustCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, locs: any } | null>(null);
  
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0 });
  const motesRef = useRef<DustMote[]>([]);

  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
    if (!gl) return;

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    gl.useProgram(program);

    // Full screen quad using 2 TRIANGLES (6 vertices) to avoid diagonal clipping
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
    const dustCanvas = dustCanvasRef.current!;
    const ctx = dustCanvas.getContext('2d')!;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      glCanvas.width = w;
      glCanvas.height = h;
      dustCanvas.width = w;
      dustCanvas.height = h;
      
      if (glRef.current) {
        glRef.current.gl.viewport(0, 0, w, h);
      }
      
      // Re-initialize golden dust motes
      motesRef.current = [];
      const particleCount = Math.floor((w * h) / 25000); // Responsive count
      for (let i = 0; i < Math.min(80, Math.max(30, particleCount)); i++) {
        motesRef.current.push(new DustMote(w, h));
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let lastMouseX = 0;
    let lastMouseY = 0;

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

      // Damped mouse movement for realistic smooth parallax
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      mouseRef.current.vx *= 0.9;
      mouseRef.current.vy *= 0.9;

      // 1. Draw WebGL Homestead Background
      if (glRef.current) {
        const { gl, program, locs } = glRef.current;
        gl.useProgram(program);
        gl.uniform1f(locs.uTime, t);
        gl.uniform2f(locs.uResolution, w, h);
        gl.uniform2f(locs.uMouse, mouseRef.current.x, mouseRef.current.y);
        
        // Draw 2 Triangles (6 vertices)
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // 2. Draw Atmospheric Dust Motes
      ctx.clearRect(0, 0, w, h);
      const motes = motesRef.current;
      for (let i = 0; i < motes.length; i++) {
        motes[i].update(w, h, mouseRef.current.targetX, mouseRef.current.targetY, mouseRef.current.vx, mouseRef.current.vy);
        motes[i].draw(ctx);
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
      {/* Photorealistic WebGL Layer */}
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
      {/* Golden Dust Layer */}
      <canvas ref={dustCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: 'block' }} />
    </div>
  );
}
