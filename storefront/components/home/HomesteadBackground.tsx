'use client';

import { useEffect, useRef } from 'react';

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
  uniform vec2 uMouseVelocity;
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
    float aspect = uResolution.x / uResolution.y;

    // 1. Mouse Liquid Distortion (Shockwave / Ripple under cursor)
    vec2 mouseUV = uMouse / uResolution;
    mouseUV.y = 1.0 - mouseUV.y; // Flip Y for WebGL vs Screen coords
    
    // Correct aspect ratio for distance calculation
    vec2 diff = uv - mouseUV;
    diff.x *= aspect;
    float distToMouse = length(diff);
    
    // Create a smooth ripple/bulge effect around the mouse
    float mouseIntensity = length(uMouseVelocity) * 0.002;
    mouseIntensity = clamp(mouseIntensity, 0.0, 0.05); // cap the intensity
    
    // Subtle constant liquid lens, enhanced by movement
    float lensEffect = smoothstep(0.3, 0.0, distToMouse) * (0.01 + mouseIntensity);
    
    // Push UVs away from mouse
    vec2 dir = normalize(diff + vec2(0.001)); // add tiny offset to avoid div by zero
    uv -= dir * lensEffect * sin(distToMouse * 30.0 - uTime * 5.0);

    // 2. Parallax Depth: bottom of image moves more than top
    float depth = uv.y; // 0.0 top, 1.0 bottom
    vec2 parallaxOffset = (uMouse / uResolution - 0.5) * depth * 0.03;
    uv -= parallaxOffset;

    // Clamp to avoid edge wrap
    uv = clamp(uv, 0.0, 1.0);

    // Sample the base image to find foliage
    vec4 baseColor = texture2D(uImage, uv);
    
    // 3. Color-Masked Wind (Only affects greens/yellows of foliage)
    // Calculate how "green/yellow" a pixel is
    float foliageMask = smoothstep(0.0, 0.2, baseColor.g - (baseColor.r * 0.3 + baseColor.b * 0.7));
    // Amplify mask for the grassy areas in the lower half
    foliageMask *= smoothstep(0.3, 0.8, uv.y); 

    float wind = noise(uv * 10.0 + uTime * 0.5) * 0.004 * foliageMask;
    
    // Apply wind distortion to UV and re-sample
    vec2 finalUv = clamp(uv + vec2(wind, 0.0), 0.0, 1.0);
    
    // 4. Cinematic Chromatic Aberration based on Mouse Velocity
    // Split RGB slightly along the velocity vector
    vec2 caOffset = normalize(uMouseVelocity + vec2(0.001)) * mouseIntensity * 0.5;
    
    float r = texture2D(uImage, clamp(finalUv + caOffset, 0.0, 1.0)).r;
    float g = texture2D(uImage, finalUv).g;
    float b = texture2D(uImage, clamp(finalUv - caOffset, 0.0, 1.0)).b;
    
    vec4 color = vec4(r, g, b, 1.0);
    
    // Heat Haze around oven (approx x: 0.85, y: 0.6) - kept for atmosphere
    float distToOven = distance(finalUv, vec2(0.85, 0.6));
    float heatHaze = smoothstep(0.2, 0.0, distToOven) * noise(finalUv * 30.0 + uTime * 3.0) * 0.003;
    finalUv.y += heatHaze;
    color = texture2D(uImage, finalUv); // re-sample with heat haze
    
    // Re-apply CA to the final sampled color if we want it to affect everything, 
    // but doing it once above is usually enough. Let's stick to the heat haze re-sample 
    // and manually mix the CA back in.
    color.r = texture2D(uImage, clamp(finalUv + caOffset, 0.0, 1.0)).r;
    color.b = texture2D(uImage, clamp(finalUv - caOffset, 0.0, 1.0)).b;

    // Golden Hour God Rays
    vec2 lightOrigin = vec2(0.8, 0.1); 
    float ray = max(0.0, 1.0 - distance(finalUv, lightOrigin) * 1.5) * 0.15;
    float rayNoise = noise(finalUv * 15.0 - uTime * 0.3);
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
   FIREFLIES PARTICLE SYSTEM
═══════════════════════════════════════════════════════════════════ */
class Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  baseVx: number;
  baseVy: number;
  phase: number;

  constructor(w: number, h: number) {
    this.x = Math.random() * w;
    this.y = h * 0.6 + Math.random() * h * 0.4; // Primarily in the lower garden area
    this.baseVx = (Math.random() - 0.5) * 0.5;
    this.baseVy = -Math.random() * 0.5;
    this.vx = this.baseVx;
    this.vy = this.baseVy;
    this.size = 1 + Math.random() * 2;
    this.maxLife = 200 + Math.random() * 400;
    this.life = Math.random() * this.maxLife; // start at random life
    this.phase = Math.random() * Math.PI * 2;
  }

  update(mouseX: number, mouseY: number, mouseVelocityX: number, mouseVelocityY: number) {
    this.life += 1;
    
    // Hovering / wandering motion
    this.phase += 0.05;
    let tvx = this.baseVx + Math.sin(this.phase) * 0.5;
    let tvy = this.baseVy + Math.cos(this.phase * 0.8) * 0.5;

    // Mouse Interaction (Scattering)
    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 150) {
      const force = (150 - dist) / 150;
      // Push away from mouse
      tvx += (dx / dist) * force * 5;
      tvy += (dy / dist) * force * 5;
      
      // Also get carried by mouse velocity
      tvx += mouseVelocityX * force * 0.1;
      tvy += mouseVelocityY * force * 0.1;
    }

    // Apply drag to return to target velocity
    this.vx += (tvx - this.vx) * 0.05;
    this.vy += (tvy - this.vy) * 0.05;

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const progress = this.life / this.maxLife;
    // Fade in and out
    const alpha = Math.sin(progress * Math.PI) * (0.6 + Math.sin(this.phase)*0.4);
    
    if (alpha <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    
    // Core
    ctx.fillStyle = `rgba(200, 255, 150, ${alpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow
    ctx.fillStyle = `rgba(150, 255, 50, ${alpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}


export default function HomesteadBackground() {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const fireflyCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, locs: any } | null>(null);
  
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 });
  const firefliesRef = useRef<Firefly[]>([]);

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
      uMouseVelocity: gl.getUniformLocation(program, 'uMouseVelocity'),
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
    const ffCanvas = fireflyCanvasRef.current!;
    const ctx = ffCanvas.getContext('2d')!;

    const resize = () => {
      glCanvas.width = window.innerWidth;
      glCanvas.height = window.innerHeight;
      ffCanvas.width = window.innerWidth;
      ffCanvas.height = window.innerHeight;
      
      if (glRef.current) {
        glRef.current.gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      }
      
      // Init fireflies
      firefliesRef.current = [];
      for(let i=0; i<60; i++) {
        firefliesRef.current.push(new Firefly(ffCanvas.width, ffCanvas.height));
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let lastMouseX = 0;
    let lastMouseY = 0;

    const onMove = (e: MouseEvent) => {
      mouseRef.current.tx = e.clientX;
      mouseRef.current.ty = e.clientY;
      
      // Calculate instantaneous velocity
      mouseRef.current.vx = e.clientX - lastMouseX;
      mouseRef.current.vy = e.clientY - lastMouseY;
      
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    const animate = () => {
      const t = (performance.now() - startTime) / 1000;
      const width = glCanvas.width;
      const height = glCanvas.height;

      // Smooth mouse position for the parallax
      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.1;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.1;
      
      // Decay mouse velocity naturally if mouse stops moving
      mouseRef.current.vx *= 0.9;
      mouseRef.current.vy *= 0.9;

      if (glRef.current) {
        const { gl, program, locs } = glRef.current;
        gl.useProgram(program);
        gl.uniform1f(locs.uTime, t);
        gl.uniform2f(locs.uResolution, width, height);
        gl.uniform2f(locs.uMouse, mouseRef.current.x, mouseRef.current.y);
        gl.uniform2f(locs.uMouseVelocity, mouseRef.current.vx, mouseRef.current.vy);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      // Draw Fireflies
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'screen';
      
      const fireflies = firefliesRef.current;
      for (let i = fireflies.length - 1; i >= 0; i--) {
        const ff = fireflies[i];
        ff.update(mouseRef.current.tx, mouseRef.current.ty, mouseRef.current.vx, mouseRef.current.vy);
        
        if (ff.life >= ff.maxLife || ff.y < 0 || ff.x < 0 || ff.x > width) {
          fireflies.splice(i, 1);
          fireflies.push(new Firefly(width, height)); // respawn
        } else {
          ff.draw(ctx);
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
      {/* WebGL Shader Layer */}
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
      {/* Interactive Fireflies Layer */}
      <canvas ref={fireflyCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: 'block' }} />
    </div>
  );
}
