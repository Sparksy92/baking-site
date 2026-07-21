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
   CANVAS 2D — Elegant koi fish with realistic anatomy
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
  baseColor: string;
  bodyGradColors: string[];
  patchColor: string;
  patchPositions: { segIdx: number; offset: number; size: number }[];
  sizeMultiplier: number;
  segments: Segment[];
  depth: number;
  targetDepth: number;
  mouthOpen: number;

  constructor(x: number, y: number, config: {
    baseColor: string;
    bodyGradColors: string[];
    patchColor: string;
    patchCount: number;
    sizeMultiplier: number;
  }) {
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.speed = 0.6 + Math.random() * 0.4;
    this.targetSpeed = this.speed;
    this.phase = Math.random() * Math.PI * 2;
    this.baseColor = config.baseColor;
    this.bodyGradColors = config.bodyGradColors;
    this.patchColor = config.patchColor;
    this.sizeMultiplier = config.sizeMultiplier;
    this.depth = 0.15 + Math.random() * 0.35;
    this.targetDepth = this.depth;
    this.mouthOpen = 0;

    // Generate random patch positions
    this.patchPositions = [];
    for (let i = 0; i < config.patchCount; i++) {
      this.patchPositions.push({
        segIdx: 1 + Math.floor(Math.random() * 6),
        offset: (Math.random() - 0.5) * 0.7,
        size: 0.5 + Math.random() * 0.6,
      });
    }

    this.segments = [];
    for (let i = 0; i < 10; i++) {
      this.segments.push({ x: x - i * 8 * config.sizeMultiplier, y });
    }
  }

  update(width: number, height: number, mouseX: number, mouseY: number, foods: Food[], ripples: Ripple[]) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 140) {
      this.targetAngle = Math.atan2(this.y - mouseY, this.x - mouseX);
      this.targetSpeed = 3.0;
      this.targetDepth = 0.6;
    } else {
      const activeFoods = foods.filter(f => !f.isEaten);
      let closestFood: Food | null = null;
      let minDist = 300;

      for (const food of activeFoods) {
        const fDist = Math.hypot(food.x - this.x, food.y - this.y);
        if (fDist < minDist) {
          minDist = fDist;
          closestFood = food;
        }
      }

      if (closestFood) {
        this.targetAngle = Math.atan2(closestFood.y - this.y, closestFood.x - this.x);
        this.targetSpeed = 1.6 + Math.random() * 0.4;
        this.targetDepth = 0.1;
        this.mouthOpen = Math.min(1, this.mouthOpen + 0.05);

        if (minDist < 14) {
          closestFood.isEaten = true;
          this.targetSpeed = 3.5;
          this.mouthOpen = 1;
          ripples.push({ x: closestFood.x, y: closestFood.y, radius: 2, maxRadius: 40, strength: 0.9, speed: 1.3 });
        }
      } else {
        this.mouthOpen = Math.max(0, this.mouthOpen - 0.03);
        if (Math.random() < 0.012) {
          this.targetAngle = this.angle + (Math.random() - 0.5) * 1.2;
          this.targetDepth = 0.15 + Math.random() * 0.4;
        }
        this.targetSpeed = 0.6 + Math.random() * 0.4;
      }
    }

    // Boundary avoidance
    const margin = 70;
    if (this.x < margin) this.targetAngle = 0;
    else if (this.x > width - margin) this.targetAngle = Math.PI;
    if (this.y < margin) this.targetAngle = Math.PI / 2;
    else if (this.y > height - margin) this.targetAngle = -Math.PI / 2;

    const angleDiff = this.targetAngle - this.angle;
    this.angle += Math.sin(angleDiff) * 0.06;
    this.speed = this.speed * 0.95 + this.targetSpeed * 0.05;
    this.depth = this.depth * 0.97 + this.targetDepth * 0.03;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Undulating body chain
    this.segments[0] = { x: this.x, y: this.y };
    const wiggleAmp = 2.5 * this.sizeMultiplier;
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];
      const segLen = 8 * this.sizeMultiplier;
      const wiggle = Math.sin(this.phase + i * 0.65) * wiggleAmp * (i / this.segments.length);

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

    this.phase += this.speed * 0.12;
  }

  private getSegRadius(i: number): number {
    // Realistic koi body profile: head → thick body → tapered tail
    const profile = [6.5, 7.8, 8.2, 8.0, 7.2, 6.0, 4.5, 3.0, 1.8, 0.5];
    return (profile[i] || 0) * this.sizeMultiplier;
  }

  private getSegAngle(i: number): number {
    if (i === 0) return this.angle;
    const prev = this.segments[i - 1];
    const curr = this.segments[i];
    return Math.atan2(curr.y - prev.y, curr.x - prev.x);
  }

  drawShadow(ctx: CanvasRenderingContext2D) {
    const shadowOffset = 10 + this.depth * 20;
    const alpha = 0.25 - this.depth * 0.15;
    ctx.save();
    ctx.fillStyle = `rgba(0, 30, 20, ${alpha})`;
    ctx.filter = `blur(${(6 + this.depth * 10) * this.sizeMultiplier}px)`;
    this.buildBodyPath(ctx, shadowOffset, shadowOffset + 4);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }

  private buildBodyPath(ctx: CanvasRenderingContext2D, offX = 0, offY = 0) {
    const leftPts: Segment[] = [];
    const rightPts: Segment[] = [];

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const r = this.getSegRadius(i);
      if (r <= 0) continue;
      const a = this.getSegAngle(i);
      leftPts.push({ x: seg.x + offX + Math.cos(a - Math.PI / 2) * r, y: seg.y + offY + Math.sin(a - Math.PI / 2) * r });
      rightPts.push({ x: seg.x + offX + Math.cos(a + Math.PI / 2) * r, y: seg.y + offY + Math.sin(a + Math.PI / 2) * r });
    }

    ctx.beginPath();
    // Rounded head
    const headA = this.getSegAngle(0);
    const headSeg = this.segments[0];
    ctx.arc(headSeg.x + offX, headSeg.y + offY, this.getSegRadius(0), headA - Math.PI / 2, headA + Math.PI / 2, true);

    // Left side spline
    for (let i = 0; i < leftPts.length - 1; i++) {
      const mx = (leftPts[i].x + leftPts[i + 1].x) / 2;
      const my = (leftPts[i].y + leftPts[i + 1].y) / 2;
      ctx.quadraticCurveTo(leftPts[i].x, leftPts[i].y, mx, my);
    }

    // Tail tip
    const tail = this.segments[this.segments.length - 1];
    ctx.lineTo(tail.x + offX, tail.y + offY);

    // Right side spline (reversed)
    for (let i = rightPts.length - 1; i > 0; i--) {
      const mx = (rightPts[i].x + rightPts[i - 1].x) / 2;
      const my = (rightPts[i].y + rightPts[i - 1].y) / 2;
      ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, mx, my);
    }

    ctx.closePath();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const scale = 1.0 - this.depth * 0.15;
    const alpha = 0.88 - this.depth * 0.25;
    ctx.globalAlpha = alpha;

    const head = this.segments[0];
    const tail = this.segments[this.segments.length - 1];
    const tailPrev = this.segments[this.segments.length - 2];
    const tailAngle = Math.atan2(tail.y - tailPrev.y, tail.x - tailPrev.x);
    const finWiggle = Math.sin(this.phase) * 0.2;
    const tailSweep = Math.sin(this.phase) * 0.45;

    // ── Dorsal fin (top of body, segments 2-5) ──
    ctx.fillStyle = this.bodyGradColors[1] || this.baseColor;
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    const dorsalStart = this.segments[2];
    const dorsalEnd = this.segments[5];
    const dorsalMid = this.segments[3];
    const dorsalAngle = this.getSegAngle(3);
    ctx.moveTo(dorsalStart.x, dorsalStart.y);
    ctx.quadraticCurveTo(
      dorsalMid.x + Math.cos(dorsalAngle - Math.PI / 2) * 14 * this.sizeMultiplier * scale,
      dorsalMid.y + Math.sin(dorsalAngle - Math.PI / 2) * 14 * this.sizeMultiplier * scale,
      dorsalEnd.x, dorsalEnd.y
    );
    ctx.fill();
    ctx.globalAlpha = alpha;

    // ── Pectoral fins ──
    const pectSeg = this.segments[2];
    const pectAngle = this.getSegAngle(2);
    ctx.fillStyle = this.baseColor;
    ctx.globalAlpha = alpha * 0.45;

    // Left pectoral
    ctx.beginPath();
    ctx.moveTo(pectSeg.x, pectSeg.y);
    ctx.bezierCurveTo(
      pectSeg.x + Math.cos(pectAngle - Math.PI / 2 - 0.3 + finWiggle) * 22 * this.sizeMultiplier * scale,
      pectSeg.y + Math.sin(pectAngle - Math.PI / 2 - 0.3 + finWiggle) * 22 * this.sizeMultiplier * scale,
      pectSeg.x + Math.cos(pectAngle - Math.PI / 2 - 0.6 + finWiggle) * 30 * this.sizeMultiplier * scale,
      pectSeg.y + Math.sin(pectAngle - Math.PI / 2 - 0.6 + finWiggle) * 30 * this.sizeMultiplier * scale,
      this.segments[4].x, this.segments[4].y
    );
    ctx.fill();

    // Right pectoral
    ctx.beginPath();
    ctx.moveTo(pectSeg.x, pectSeg.y);
    ctx.bezierCurveTo(
      pectSeg.x + Math.cos(pectAngle + Math.PI / 2 + 0.3 - finWiggle) * 22 * this.sizeMultiplier * scale,
      pectSeg.y + Math.sin(pectAngle + Math.PI / 2 + 0.3 - finWiggle) * 22 * this.sizeMultiplier * scale,
      pectSeg.x + Math.cos(pectAngle + Math.PI / 2 + 0.6 - finWiggle) * 30 * this.sizeMultiplier * scale,
      pectSeg.y + Math.sin(pectAngle + Math.PI / 2 + 0.6 - finWiggle) * 30 * this.sizeMultiplier * scale,
      this.segments[4].x, this.segments[4].y
    );
    ctx.fill();

    ctx.globalAlpha = alpha;

    // ── Tail fin (forked) ──
    ctx.fillStyle = this.baseColor;
    ctx.globalAlpha = alpha * 0.6;
    // Left lobe
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.bezierCurveTo(
      tail.x + Math.cos(tailAngle + Math.PI - 0.5 + tailSweep) * 22 * this.sizeMultiplier * scale,
      tail.y + Math.sin(tailAngle + Math.PI - 0.5 + tailSweep) * 22 * this.sizeMultiplier * scale,
      tail.x + Math.cos(tailAngle + Math.PI - 1.0 + tailSweep) * 28 * this.sizeMultiplier * scale,
      tail.y + Math.sin(tailAngle + Math.PI - 1.0 + tailSweep) * 28 * this.sizeMultiplier * scale,
      tail.x + Math.cos(tailAngle + Math.PI) * 12 * this.sizeMultiplier * scale,
      tail.y + Math.sin(tailAngle + Math.PI) * 12 * this.sizeMultiplier * scale
    );
    ctx.fill();
    // Right lobe
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.bezierCurveTo(
      tail.x + Math.cos(tailAngle + Math.PI + 0.5 + tailSweep) * 22 * this.sizeMultiplier * scale,
      tail.y + Math.sin(tailAngle + Math.PI + 0.5 + tailSweep) * 22 * this.sizeMultiplier * scale,
      tail.x + Math.cos(tailAngle + Math.PI + 1.0 + tailSweep) * 28 * this.sizeMultiplier * scale,
      tail.y + Math.sin(tailAngle + Math.PI + 1.0 + tailSweep) * 28 * this.sizeMultiplier * scale,
      tail.x + Math.cos(tailAngle + Math.PI) * 12 * this.sizeMultiplier * scale,
      tail.y + Math.sin(tailAngle + Math.PI) * 12 * this.sizeMultiplier * scale
    );
    ctx.fill();
    ctx.globalAlpha = alpha;

    // ── Main body fill ──
    this.buildBodyPath(ctx);
    const bodyGrad = ctx.createLinearGradient(
      head.x + Math.cos(this.angle) * 10, head.y + Math.sin(this.angle) * 10,
      tail.x, tail.y
    );
    bodyGrad.addColorStop(0, this.bodyGradColors[0]);
    bodyGrad.addColorStop(0.4, this.bodyGradColors[1]);
    bodyGrad.addColorStop(1, this.bodyGradColors[2] || this.bodyGradColors[1]);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // ── Colour patches (Kohaku / Showa style) ──
    if (this.patchColor) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = this.patchColor;
      for (const patch of this.patchPositions) {
        const seg = this.segments[patch.segIdx];
        if (!seg) continue;
        const r = this.getSegRadius(patch.segIdx) * patch.size;
        const a = this.getSegAngle(patch.segIdx);
        const ox = Math.cos(a + Math.PI / 2) * this.getSegRadius(patch.segIdx) * patch.offset;
        const oy = Math.sin(a + Math.PI / 2) * this.getSegRadius(patch.segIdx) * patch.offset;
        ctx.beginPath();
        ctx.ellipse(seg.x + ox, seg.y + oy, r * 1.2, r * 0.85, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Scale texture ──
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.6;
    for (let i = 1; i < this.segments.length - 2; i++) {
      const seg = this.segments[i];
      const r = this.getSegRadius(i);
      const a = this.getSegAngle(i);
      for (let row = -0.5; row <= 0.5; row += 0.25) {
        const cx = seg.x + Math.cos(a + Math.PI / 2) * r * row;
        const cy = seg.y + Math.sin(a + Math.PI / 2) * r * row;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.22, a - 0.8, a + 0.8);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── 3D cylindrical shading ──
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const sideAngle = this.angle + Math.PI / 2;
    const shadeGrad = ctx.createLinearGradient(
      head.x + Math.cos(sideAngle) * 10, head.y + Math.sin(sideAngle) * 10,
      head.x - Math.cos(sideAngle) * 10, head.y - Math.sin(sideAngle) * 10
    );
    shadeGrad.addColorStop(0, 'rgba(0,0,0,0.28)');
    shadeGrad.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    shadeGrad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    shadeGrad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    shadeGrad.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = shadeGrad;
    this.buildBodyPath(ctx);
    ctx.fill();
    ctx.restore();

    // ── Gill marks ──
    ctx.strokeStyle = `rgba(0,0,0,0.15)`;
    ctx.lineWidth = 1.0;
    const gillR = 5.5 * this.sizeMultiplier * scale;
    ctx.beginPath();
    ctx.arc(head.x, head.y, gillR, this.angle - Math.PI / 2 - 0.4, this.angle - Math.PI / 2 + 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(head.x, head.y, gillR, this.angle + Math.PI / 2 - 0.4, this.angle + Math.PI / 2 + 0.4);
    ctx.stroke();

    // ── Barbels (whiskers) ──
    ctx.strokeStyle = this.bodyGradColors[0];
    ctx.lineWidth = 1.0;
    const noseX = head.x + Math.cos(this.angle) * this.getSegRadius(0);
    const noseY = head.y + Math.sin(this.angle) * this.getSegRadius(0);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(noseX, noseY);
      ctx.quadraticCurveTo(
        noseX + Math.cos(this.angle + side * 0.35) * 10 * this.sizeMultiplier * scale,
        noseY + Math.sin(this.angle + side * 0.35) * 10 * this.sizeMultiplier * scale,
        noseX + Math.cos(this.angle + side * 0.7) * 13 * this.sizeMultiplier * scale,
        noseY + Math.sin(this.angle + side * 0.7) * 13 * this.sizeMultiplier * scale
      );
      ctx.stroke();
    }

    // ── Eyes (golden iris + black pupil + specular highlight) ──
    const eyeR = 1.8 * this.sizeMultiplier * scale;
    for (const side of [-1, 1]) {
      const ex = head.x + Math.cos(this.angle + side * 0.5) * 4.5 * this.sizeMultiplier * scale;
      const ey = head.y + Math.sin(this.angle + side * 0.5) * 4.5 * this.sizeMultiplier * scale;
      // Iris
      const irisGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, eyeR);
      irisGrad.addColorStop(0, '#DAA520');
      irisGrad.addColorStop(0.5, '#B8860B');
      irisGrad.addColorStop(1, '#8B6914');
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Specular
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.2, ey - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2);
      ctx.fill();
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
      const dpr = Math.min(window.devicePixelRatio, 2);
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

    // ── Fish species ──
    const species = [
      { baseColor: '#E86F51', bodyGradColors: ['#F4A261', '#E86F51', '#C45A3B'], patchColor: '#FFFCF0', patchCount: 4, sizeMultiplier: 2.2 },
      { baseColor: '#FFFCF0', bodyGradColors: ['#FFFCF0', '#FFF5E6', '#F5E6D0'], patchColor: '#E86F51', patchCount: 5, sizeMultiplier: 2.0 },
      { baseColor: '#F4A261', bodyGradColors: ['#F4C78E', '#F4A261', '#D4894F'], patchColor: '', patchCount: 0, sizeMultiplier: 1.7 },
      { baseColor: '#FFFCF0', bodyGradColors: ['#FFFCF0', '#FFF8F0', '#FAF0E6'], patchColor: '#264653', patchCount: 3, sizeMultiplier: 2.4 },
      { baseColor: '#2A9D8F', bodyGradColors: ['#3DB8A9', '#2A9D8F', '#1F7A6E'], patchColor: '#FFFCF0', patchCount: 3, sizeMultiplier: 1.6 },
      { baseColor: '#E9C46A', bodyGradColors: ['#F0D48A', '#E9C46A', '#C9A84E'], patchColor: '#E86F51', patchCount: 4, sizeMultiplier: 1.9 },
    ];

    fishRef.current = species.map(cfg => new KoiFish(
      Math.random() * (width - 200) + 100,
      Math.random() * (height - 200) + 100,
      cfg
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
        const dpr = Math.min(window.devicePixelRatio, 2);
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
