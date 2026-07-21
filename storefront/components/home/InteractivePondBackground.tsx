'use client';

import { useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   WEBGL WATER SHADER — photorealistic top-down clear ocean surface
   Uses layered Simplex noise for caustics, refraction, and depth
   ═══════════════════════════════════════════════════════════════════ */

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_mouse;
  uniform float u_mouseStrength;

  // ── Simplex 2D noise ──
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // ── Fractal brownian motion ──
  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5000 * snoise(p); p *= 2.02;
    f += 0.2500 * snoise(p); p *= 2.03;
    f += 0.1250 * snoise(p); p *= 2.01;
    f += 0.0625 * snoise(p);
    return f / 0.9375;
  }

  // ── Caustics pattern (intersecting light rays through water) ──
  float caustics(vec2 p, float t) {
    float c = 0.0;
    // Layer 1: Large slow caustics
    c += 0.5 * (0.5 + 0.5 * sin(snoise(p * 3.0 + t * 0.15) * 3.14159));
    // Layer 2: Medium caustics with different direction
    c += 0.3 * (0.5 + 0.5 * sin(snoise(p * 5.0 - t * 0.22 + 50.0) * 3.14159));
    // Layer 3: Fine detail caustics
    c += 0.2 * (0.5 + 0.5 * sin(snoise(p * 8.0 + t * 0.18 + 100.0) * 3.14159));
    return c;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = uv * 4.0; // Scale for detail
    float t = u_time;

    // ── Water surface distortion ──
    float nx = fbm(p + vec2(t * 0.08, t * 0.06));
    float ny = fbm(p + vec2(t * 0.07 + 100.0, t * 0.09 + 50.0));
    vec2 distortion = vec2(nx, ny) * 0.06;

    // ── Mouse interaction ripple ──
    vec2 mouseUV = u_mouse / u_resolution;
    mouseUV.y = 1.0 - mouseUV.y; // Flip Y
    float mouseDist = length(uv - mouseUV);
    float ripple = 0.0;
    if (u_mouseStrength > 0.01) {
      ripple = sin(mouseDist * 40.0 - t * 6.0) * exp(-mouseDist * 8.0) * u_mouseStrength * 0.015;
      distortion += vec2(ripple);
    }

    vec2 distortedUV = uv + distortion;

    // ── Deep ocean base colours (clear turquoise/teal) ──
    vec3 deepColor   = vec3(0.027, 0.216, 0.306);  // Deep teal #074E37
    vec3 midColor    = vec3(0.082, 0.384, 0.443);   // Mid teal
    vec3 shallowColor = vec3(0.173, 0.525, 0.529);  // Shallow turquoise
    vec3 surfaceColor = vec3(0.318, 0.647, 0.612);  // Surface light green

    // Depth variation using noise
    float depthNoise = fbm(distortedUV * 2.5 + t * 0.03);
    float depth = smoothstep(-0.3, 0.6, depthNoise);

    vec3 waterColor = mix(deepColor, midColor, depth);
    waterColor = mix(waterColor, shallowColor, smoothstep(0.4, 0.8, depth));
    waterColor = mix(waterColor, surfaceColor, smoothstep(0.7, 1.0, depth) * 0.4);

    // ── Caustics (underwater light patterns) ──
    float caust = caustics(distortedUV, t);
    // Caustics are brighter in shallower areas
    float caustIntensity = caust * (0.25 + depth * 0.5);
    vec3 caustColor = vec3(0.65, 0.85, 0.78); // Soft cyan-white
    waterColor += caustColor * caustIntensity * 0.35;

    // ── Surface specular highlights (sun glints) ──
    float spec1 = snoise(distortedUV * 12.0 + t * 0.35);
    float spec2 = snoise(distortedUV * 18.0 - t * 0.28 + 200.0);
    float specular = smoothstep(0.72, 0.95, spec1) * 0.4 + smoothstep(0.78, 0.98, spec2) * 0.3;
    waterColor += vec3(1.0, 0.98, 0.92) * specular * 0.6;

    // ── Subtle wave foam/froth on peaks ──
    float foam = smoothstep(0.55, 0.85, fbm(distortedUV * 6.0 + t * 0.12));
    waterColor = mix(waterColor, vec3(0.7, 0.82, 0.78), foam * 0.08);

    // ── Vignette (darker at edges for depth illusion) ──
    float vignette = 1.0 - smoothstep(0.3, 0.95, length(uv - 0.5) * 1.15);
    waterColor *= 0.85 + vignette * 0.15;

    // ── Brand tone grading (sage green warmth) ──
    waterColor = mix(waterColor, vec3(0.26, 0.35, 0.28), 0.08);

    gl_FragColor = vec4(waterColor, 1.0);
  }
`;

/* ═══════════════════════════════════════════════════════════════════
   CANVAS 2D — Photorealistic Koi Swimming Engine
   ═══════════════════════════════════════════════════════════════════ */

interface Segment { x: number; y: number; }
interface Ripple { x: number; y: number; radius: number; maxRadius: number; strength: number; speed: number; }
interface Food { x: number; y: number; size: number; age: number; isEaten: boolean; }

class KoiFish {
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  speed: number;
  targetSpeed: number;
  phase: number;
  img: HTMLImageElement;
  sizeMultiplier: number;
  segments: Segment[];
  depth: number;
  targetDepth: number;
  mouthOpen: number;

  static readonly SEG_COUNT = 18;
  static readonly SEG_SPACING = 10; // px base spacing between segments — matches uncompressed photo aspect ratio

  constructor(x: number, y: number, img: HTMLImageElement, sizeMultiplier: number) {
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.speed = 0.5 + Math.random() * 0.35;
    this.targetSpeed = this.speed;
    this.phase = Math.random() * Math.PI * 2;
    this.img = img;
    this.sizeMultiplier = sizeMultiplier;
    this.depth = 0.12 + Math.random() * 0.3;
    this.targetDepth = this.depth;
    this.mouthOpen = 0;

    this.segments = [];
    const spacing = KoiFish.SEG_SPACING * sizeMultiplier;
    for (let i = 0; i < KoiFish.SEG_COUNT; i++) {
      this.segments.push({ x: x - i * spacing, y });
    }
  }

  update(width: number, height: number, mouseX: number, mouseY: number, foods: Food[], ripples: Ripple[]) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 180) {
      this.targetAngle = Math.atan2(this.y - mouseY, this.x - mouseX);
      this.targetSpeed = 2.6;
      this.targetDepth = 0.5;
    } else {
      const activeFoods = foods.filter(f => !f.isEaten);
      let closestFood: Food | null = null;
      let minDist = 400;

      for (const food of activeFoods) {
        const fDist = Math.hypot(food.x - this.x, food.y - this.y);
        if (fDist < minDist) {
          minDist = fDist;
          closestFood = food;
        }
      }

      if (closestFood) {
        this.targetAngle = Math.atan2(closestFood.y - this.y, closestFood.x - this.x);
        this.targetSpeed = 1.4 + Math.random() * 0.4;
        this.targetDepth = 0.08;
        this.mouthOpen = Math.min(1, this.mouthOpen + 0.05);

        if (minDist < 20) {
          closestFood.isEaten = true;
          this.targetSpeed = 3.0;
          this.mouthOpen = 1;
          ripples.push({ x: closestFood.x, y: closestFood.y, radius: 2, maxRadius: 50, strength: 0.9, speed: 1.3 });
        }
      } else {
        this.mouthOpen = Math.max(0, this.mouthOpen - 0.03);
        if (Math.random() < 0.01) {
          this.targetAngle = this.angle + (Math.random() - 0.5) * 1.0;
          this.targetDepth = 0.12 + Math.random() * 0.35;
        }
        this.targetSpeed = 0.5 + Math.random() * 0.35;
      }
    }

    // Boundary avoidance — push away from edges
    const margin = 120;
    if (this.x < margin) this.targetAngle = 0;
    else if (this.x > width - margin) this.targetAngle = Math.PI;
    if (this.y < margin) this.targetAngle = Math.PI / 2;
    else if (this.y > height - margin) this.targetAngle = -Math.PI / 2;

    const angleDiff = this.targetAngle - this.angle;
    this.angle += Math.sin(angleDiff) * 0.05;
    this.speed = this.speed * 0.96 + this.targetSpeed * 0.04;
    this.depth = this.depth * 0.97 + this.targetDepth * 0.03;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Undulating body chain with smooth, graceful S-curve tail sweep
    this.segments[0] = { x: this.x, y: this.y };
    const wiggleAmp = 2.8 * this.sizeMultiplier;
    const segLen = KoiFish.SEG_SPACING * this.sizeMultiplier;
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];
      const t = i / (this.segments.length - 1); // 0..1 head to tail
      const wiggle = Math.sin(this.phase + i * 0.38) * wiggleAmp * t * t; // Smooth S-curve ramp

      let segAngle = this.angle;
      if (i > 1) {
        const pp = this.segments[i - 2];
        segAngle = Math.atan2(prev.y - pp.y, prev.x - pp.x);
      }

      const idealX = prev.x - Math.cos(segAngle) * segLen + Math.cos(segAngle + Math.PI / 2) * wiggle;
      const idealY = prev.y - Math.sin(segAngle) * segLen + Math.sin(segAngle + Math.PI / 2) * wiggle;

      const sDx = idealX - prev.x;
      const sDy = idealY - prev.y;
      const sDist = Math.hypot(sDx, sDy);
      const sAngle = Math.atan2(sDy, sDx);
      curr.x = prev.x + Math.cos(sAngle) * Math.min(sDist, segLen);
      curr.y = prev.y + Math.sin(sAngle) * Math.min(sDist, segLen);
    }

    this.phase += this.speed * 0.07;
  }

  private getSegAngle(i: number): number {
    if (this.segments.length < 2) return this.angle;
    const prev = this.segments[Math.max(0, i - 1)];
    const next = this.segments[Math.min(this.segments.length - 1, i + 1)];
    if (prev === next) return this.angle;
    return Math.atan2(prev.y - next.y, prev.x - next.x);
  }

  drawShadow(ctx: CanvasRenderingContext2D) {
    if (!this.img || !this.img.complete || this.img.naturalWidth === 0) return;
    const shadowOffset = 14 + this.depth * 26;
    const alpha = 0.18 - this.depth * 0.08;
    const scale = 1.0 - this.depth * 0.12;
    const s = (this.sizeMultiplier * 0.38) * scale;

    ctx.save();
    ctx.globalAlpha = alpha;

    const numSlices = this.segments.length;
    const imgH = this.img.naturalHeight;
    const imgW = this.img.naturalWidth;
    const sliceH = imgH / numSlices;

    for (let i = numSlices - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const segAngle = this.getSegAngle(i);
      const sy = i * sliceH;
      const dw = imgW * s;
      const dh = sliceH * s * 1.1;

      ctx.save();
      ctx.translate(seg.x + shadowOffset, seg.y + shadowOffset + 6);
      ctx.rotate(segAngle + Math.PI / 2);
      ctx.drawImage(this.img, 0, sy, imgW, sliceH, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.img || !this.img.complete || this.img.naturalWidth === 0) return;
    const scale = 1.0 - this.depth * 0.12;
    const alpha = 0.92 - this.depth * 0.2;
    const s = (this.sizeMultiplier * 0.38) * scale;

    ctx.save();
    ctx.globalAlpha = alpha;

    const numSlices = this.segments.length;
    const imgH = this.img.naturalHeight;
    const imgW = this.img.naturalWidth;
    const sliceH = imgH / numSlices;

    // Render texture slices along spine from tail to head
    for (let i = numSlices - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const segAngle = this.getSegAngle(i);
      const sy = i * sliceH;
      const dw = imgW * s;
      const dh = sliceH * s * 1.1; // Exact uncompressed ratio

      ctx.save();
      ctx.translate(seg.x, seg.y);
      ctx.rotate(segAngle + Math.PI / 2);
      ctx.drawImage(this.img, 0, sy, imgW, sliceH, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }

    ctx.restore();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENT — dual-layer WebGL water + Canvas 2D fish
   ═══════════════════════════════════════════════════════════════════ */

export default function InteractivePondBackground() {
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fishCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, lastX: -1000, lastY: -1000, strength: 0 });
  const ripplesRef = useRef<Ripple[]>([]);
  const fishRef = useRef<KoiFish[]>([]);
  const foodsRef = useRef<Food[]>([]);
  const glRef = useRef<{
    gl: WebGLRenderingContext;
    program: WebGLProgram;
    uTime: WebGLUniformLocation | null;
    uResolution: WebGLUniformLocation | null;
    uMouse: WebGLUniformLocation | null;
    uMouseStrength: WebGLUniformLocation | null;
  } | null>(null);

  const initWebGL = useCallback(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
    if (!gl) return;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX_SHADER);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT_SHADER);
    gl.compileShader(fs);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Full-screen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    glRef.current = {
      gl,
      program,
      uTime: gl.getUniformLocation(program, 'u_time'),
      uResolution: gl.getUniformLocation(program, 'u_resolution'),
      uMouse: gl.getUniformLocation(program, 'u_mouse'),
      uMouseStrength: gl.getUniformLocation(program, 'u_mouseStrength'),
    };
  }, []);

  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    const fishCanvas = fishCanvasRef.current;
    if (!glCanvas || !fishCanvas) return;

    const ctx = fishCanvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    const resize = () => {
      width = glCanvas.offsetWidth;
      height = glCanvas.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio, 1.25);
      glCanvas.width = width * dpr;
      glCanvas.height = height * dpr;
      fishCanvas.width = width;
      fishCanvas.height = height;
      if (glRef.current) {
        glRef.current.gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      }
    };

    initWebGL();
    resize();
    window.addEventListener('resize', resize);

    // ── Load Photorealistic Koi Assets ──
    const assetUrls = [
      '/images/home/koi-kohaku.png',
      '/images/home/koi-showa.png',
      '/images/home/koi-ogon.png',
      '/images/home/koi-kohaku.png',
      '/images/home/koi-showa.png',
    ];

    const scales = [1.0, 1.15, 0.9, 1.1, 0.95];

    const loadedImages: HTMLImageElement[] = assetUrls.map((url) => {
      const img = new Image();
      img.src = url;
      return img;
    });

    fishRef.current = loadedImages.map((img, idx) => new KoiFish(
      Math.random() * (width - 200) + 100,
      Math.random() * (height - 200) + 100,
      img,
      scales[idx]
    ));

    // ── Events ──
    const onMove = (e: MouseEvent) => {
      const rect = fishCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current.x = x;
      mouseRef.current.y = y;
      mouseRef.current.strength = Math.min(1, mouseRef.current.strength + 0.15);

      const dist = Math.hypot(x - mouseRef.current.lastX, y - mouseRef.current.lastY);
      if (dist > 30) {
        ripplesRef.current.push({
          x, y, radius: 2, maxRadius: 60 + Math.random() * 30,
          strength: 0.85, speed: 1.0 + Math.random() * 0.6,
        });
        mouseRef.current.lastX = x;
        mouseRef.current.lastY = y;
      }
    };

    const onLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    const onClick = (e: MouseEvent) => {
      const rect = fishCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      foodsRef.current.push({ x, y, size: 4, age: 0, isEaten: false });
      ripplesRef.current.push({ x, y, radius: 2, maxRadius: 55, strength: 0.9, speed: 1.2 });
    };

    fishCanvas.addEventListener('mousemove', onMove);
    fishCanvas.addEventListener('mouseleave', onLeave);
    fishCanvas.addEventListener('click', onClick);

    const startTime = performance.now();

    const animate = () => {
      const t = (performance.now() - startTime) / 1000;
      const mouse = mouseRef.current;

      // ── Render WebGL water ──
      if (glRef.current) {
        const { gl, uTime, uResolution, uMouse, uMouseStrength } = glRef.current;
        gl.uniform1f(uTime, t);
        gl.uniform2f(uResolution, glCanvasRef.current!.width, glCanvasRef.current!.height);
        const dpr = Math.min(window.devicePixelRatio, 1.25);
        gl.uniform2f(uMouse, mouse.x * dpr, mouse.y * dpr);
        gl.uniform1f(uMouseStrength, mouse.strength);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      // Decay mouse strength
      mouse.strength *= 0.96;

      // ── Render Canvas 2D fish layer ──
      ctx.clearRect(0, 0, width, height);

      // Shadows first
      fishRef.current.forEach(fish => fish.drawShadow(ctx));

      // Food pellets
      foodsRef.current = foodsRef.current.filter(food => {
        if (food.isEaten) return false;
        food.age++;
        const bob = Math.sin(food.age * 0.07) * 1.0;
        ctx.fillStyle = 'rgba(0,20,15,0.3)';
        ctx.beginPath();
        ctx.arc(food.x + 2, food.y + 3, food.size * 0.75, 0, Math.PI * 2);
        ctx.fill();
        const pelletGrad = ctx.createRadialGradient(food.x - 1, food.y + bob - 1, 0, food.x, food.y + bob, food.size);
        pelletGrad.addColorStop(0, '#CD853F');
        pelletGrad.addColorStop(1, '#6B3A1F');
        ctx.fillStyle = pelletGrad;
        ctx.beginPath();
        ctx.arc(food.x, food.y + bob, food.size, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      // Fish bodies
      fishRef.current.forEach(fish => {
        fish.update(width, height, mouse.x, mouse.y, foodsRef.current, ripplesRef.current);
        fish.draw(ctx);
      });

      // Ripples
      ripplesRef.current = ripplesRef.current.filter(ripple => {
        ripple.radius += ripple.speed;
        ripple.strength = 1.0 - ripple.radius / ripple.maxRadius;
        if (ripple.strength <= 0) return false;

        ctx.strokeStyle = `rgba(200, 230, 220, ${ripple.strength * 0.35})`;
        ctx.lineWidth = 2.2 * ripple.strength;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (ripple.radius > 12) {
          ctx.strokeStyle = `rgba(200, 230, 220, ${ripple.strength * 0.15})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.radius - 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        return true;
      });

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      fishCanvas.removeEventListener('mousemove', onMove);
      fishCanvas.removeEventListener('mouseleave', onLeave);
      fishCanvas.removeEventListener('click', onClick);
    };
  }, [initWebGL]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      {/* Layer 1: WebGL procedural water surface */}
      <canvas
        ref={glCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />
      {/* Layer 2: Canvas 2D interactive fish & ripples */}
      <canvas
        ref={fishCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ display: 'block' }}
      />
    </div>
  );
}
