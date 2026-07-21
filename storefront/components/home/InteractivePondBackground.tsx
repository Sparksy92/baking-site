'use client';

import { useEffect, useRef } from 'react';

interface Segment {
  x: number;
  y: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  speed: number;
}

interface Food {
  x: number;
  y: number;
  size: number;
  age: number;
  isEaten: boolean;
}

class Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  color: string;
  opacity: number;
  age: number;
  maxAge: number;
  isSinking: boolean;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = 0.5 + Math.random() * 0.5;
    this.size = 5 + Math.random() * 4;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.03;
    this.color = color;
    this.opacity = 0.6 + Math.random() * 0.4;
    this.age = 0;
    this.maxAge = 300 + Math.random() * 200;
    this.isSinking = false;
  }

  update(width: number, height: number, mouseX: number, mouseY: number, ripples: Ripple[]) {
    this.age++;
    if (this.age > this.maxAge) {
      this.isSinking = true;
    }

    if (this.isSinking) {
      this.opacity -= 0.008;
      this.size -= 0.05;
      if (this.opacity <= 0 || this.size <= 0) return false;
    }

    // Wind drift
    const windX = 0.3;
    const windY = 0.2;

    // Mouse push force
    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);
    if (dist < 80) {
      const force = (80 - dist) / 80;
      const angle = Math.atan2(dy, dx);
      this.vx += Math.cos(angle) * force * 1.5;
      this.vy += Math.sin(angle) * force * 1.5;

      // Tiny ripple if pushed significantly
      if (force > 0.6 && Math.random() < 0.04) {
        ripples.push({
          x: this.x,
          y: this.y,
          radius: 1,
          maxRadius: 15,
          strength: 0.3,
          speed: 0.8,
        });
      }
    }

    // Friction
    this.vx *= 0.94;
    this.vy *= 0.94;

    this.x += this.vx + windX;
    this.y += this.vy + windY;
    this.angle += this.spin;

    // Reset when floating off bottom
    if (this.y > height + 20) {
      this.y = -20;
      this.x = Math.random() * width;
      this.age = 0;
      this.isSinking = false;
      this.opacity = 0.6 + Math.random() * 0.4;
      this.size = 5 + Math.random() * 4;
    }
    if (this.x > width + 20) {
      this.x = -20;
    } else if (this.x < -20) {
      this.x = width + 20;
    }

    return true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Subtle soft shadow
    ctx.fillStyle = 'rgba(15, 25, 15, 0.15)';
    ctx.beginPath();
    ctx.ellipse(3, 4, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Petal shape
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.opacity;
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.bezierCurveTo(this.size, -this.size, this.size * 1.4, this.size * 0.5, 0, this.size);
    ctx.bezierCurveTo(-this.size * 1.4, this.size * 0.5, -this.size, -this.size, 0, -this.size);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

class Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  pulsePhase: number;
  pulseSpeed: number;
  targetX: number;
  targetY: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.size = 1.5 + Math.random() * 2.0;
    this.opacity = Math.random();
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.pulseSpeed = 0.02 + Math.random() * 0.04;
    this.targetX = x;
    this.targetY = y;
  }

  update(width: number, height: number, mouseX: number, mouseY: number) {
    this.pulsePhase += this.pulseSpeed;
    this.opacity = 0.3 + Math.sin(this.pulsePhase) * 0.45;

    // Brownian motion targets
    if (Math.random() < 0.025) {
      this.targetX = this.x + (Math.random() - 0.5) * 120;
      this.targetY = this.y + (Math.random() - 0.5) * 120;
    }

    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);

    if (dist < 110) {
      // Scare/flee force away from mouse
      const force = (110 - dist) / 110;
      const angle = Math.atan2(dy, dx);
      this.vx += Math.cos(angle) * force * 3.5;
      this.vy += Math.sin(angle) * force * 3.5;
    } else {
      // Steer to hover target
      const tDx = this.targetX - this.x;
      const tDy = this.targetY - this.y;
      this.vx += tDx * 0.003;
      this.vy += tDy * 0.003;
    }

    // Dampen speeds
    this.vx *= 0.92;
    this.vy *= 0.92;

    this.x += this.vx;
    this.y += this.vy;

    // Soft bounds check
    const margin = 50;
    if (this.x < margin) { this.x = margin; this.vx *= -0.5; }
    else if (this.x > width - margin) { this.x = width - margin; this.vx *= -0.5; }
    if (this.y < margin) { this.y = margin; this.vy *= -0.5; }
    else if (this.y > height - margin) { this.y = height - margin; this.vy *= -0.5; }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const glowRad = this.size * 6.5;
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRad);
    gradient.addColorStop(0, `rgba(238, 225, 140, ${this.opacity})`);
    gradient.addColorStop(0.3, `rgba(238, 225, 140, ${this.opacity * 0.35})`);
    gradient.addColorStop(1, 'rgba(238, 225, 140, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glowRad, 0, Math.PI * 2);
    ctx.fill();

    // White glowing core
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = this.opacity * 0.9;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class KoiFish {
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  speed: number;
  targetSpeed: number;
  phase: number;
  color: string;
  spotColor: string;
  sizeMultiplier: number;
  segments: Segment[];

  constructor(x: number, y: number, color: string, spotColor: string, sizeMultiplier = 1.0) {
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.speed = 1.0 + Math.random() * 0.5;
    this.targetSpeed = this.speed;
    this.phase = Math.random() * Math.PI * 2;
    this.color = color;
    this.spotColor = spotColor;
    this.sizeMultiplier = sizeMultiplier;

    this.segments = [];
    for (let i = 0; i < 8; i++) {
      this.segments.push({ x: x - i * 8 * sizeMultiplier, y: y });
    }
  }

  update(width: number, height: number, mouseX: number, mouseY: number, foods: Food[], ripples: Ripple[]) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 150) {
      // Dash away from cursor
      this.targetAngle = Math.atan2(this.y - mouseY, this.x - mouseX);
      this.targetSpeed = 3.2;
    } else {
      // Feed AI: steer towards closest active food pellet
      const activeFoods = foods.filter((f) => !f.isEaten);
      let closestFood: Food | null = null;
      let minDist = 350; // Attraction radius

      for (const food of activeFoods) {
        const fDist = Math.hypot(food.x - this.x, food.y - this.y);
        if (fDist < minDist) {
          minDist = fDist;
          closestFood = food;
        }
      }

      if (closestFood) {
        this.targetAngle = Math.atan2(closestFood.y - this.y, closestFood.x - this.x);
        this.targetSpeed = 1.8 + Math.random() * 0.6; // Speed up to eat

        // Eat pellet if close enough
        if (minDist < 12) {
          closestFood.isEaten = true;
          this.targetSpeed = 4.2; // Quick dash splash
          
          ripples.push({
            x: closestFood.x,
            y: closestFood.y,
            radius: 2,
            maxRadius: 35,
            strength: 0.75,
            speed: 1.4,
          });
        }
      } else {
        // Wandering steer logic
        if (Math.random() < 0.015) {
          this.targetAngle = this.angle + (Math.random() - 0.5) * 1.5;
        }
        this.targetSpeed = 1.0 + Math.random() * 0.6;
      }
    }

    const margin = 80;
    if (this.x < margin) this.targetAngle = 0;
    else if (this.x > width - margin) this.targetAngle = Math.PI;
    if (this.y < margin) this.targetAngle = Math.PI / 2;
    else if (this.y > height - margin) this.targetAngle = -Math.PI / 2;

    const angleDiff = this.targetAngle - this.angle;
    this.angle += Math.sin(angleDiff) * 0.08;
    this.speed = this.speed * 0.94 + this.targetSpeed * 0.06;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    this.segments[0] = { x: this.x, y: this.y };

    const segLength = 8 * this.sizeMultiplier;
    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];
      const sDx = curr.x - prev.x;
      const sDy = curr.y - prev.y;
      const sDist = Math.hypot(sDx, sDy);

      if (sDist > segLength) {
        const segAngle = Math.atan2(sDy, sDx);
        curr.x = prev.x + Math.cos(segAngle) * segLength;
        curr.y = prev.y + Math.sin(segAngle) * segLength;
      }
    }

    this.phase += this.speed * 0.14;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // Draw smooth drop shadow representing depth in water
    ctx.shadowColor = 'rgba(5, 15, 5, 0.45)';
    ctx.shadowBlur = 12 * this.sizeMultiplier;
    ctx.shadowOffsetX = 12 * this.sizeMultiplier;
    ctx.shadowOffsetY = 15 * this.sizeMultiplier;

    // Draw segmented body
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const radius = (8 - i * 0.85) * this.sizeMultiplier;
      if (radius <= 0) continue;

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Colored spots
      if (this.spotColor && i > 0 && i < 6 && (i % 2 === 0)) {
        ctx.fillStyle = this.spotColor;
        ctx.beginPath();
        ctx.arc(seg.x + (i % 4 - 2), seg.y + (i % 3 - 1), radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const head = this.segments[0];
    const eyeRadius = 1.4 * this.sizeMultiplier;
    const eyeOffsetAngle = 0.55;
    ctx.fillStyle = '#000000';
    
    // Draw Eyes
    ctx.beginPath();
    ctx.arc(
      head.x + Math.cos(this.angle - eyeOffsetAngle) * 5 * this.sizeMultiplier,
      head.y + Math.sin(this.angle - eyeOffsetAngle) * 5 * this.sizeMultiplier,
      eyeRadius, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      head.x + Math.cos(this.angle + eyeOffsetAngle) * 5 * this.sizeMultiplier,
      head.y + Math.sin(this.angle + eyeOffsetAngle) * 5 * this.sizeMultiplier,
      eyeRadius, 0, Math.PI * 2
    );
    ctx.fill();

    // Fins Setup
    const tailSeg = this.segments[this.segments.length - 1];
    const preTailSeg = this.segments[this.segments.length - 2];
    const tailAngle = Math.atan2(tailSeg.y - preTailSeg.y, tailSeg.x - preTailSeg.x);

    // Butterfly style semi-transparent flowing pectoral fins
    const finWiggle = Math.sin(this.phase) * 0.18;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.72;

    // Left butterfly fin
    ctx.beginPath();
    ctx.moveTo(this.segments[1].x, this.segments[1].y);
    ctx.bezierCurveTo(
      this.segments[1].x + Math.cos(this.angle - Math.PI/2 - 0.2 + finWiggle) * 28 * this.sizeMultiplier,
      this.segments[1].y + Math.sin(this.angle - Math.PI/2 - 0.2 + finWiggle) * 28 * this.sizeMultiplier,
      this.segments[2].x + Math.cos(this.angle - Math.PI/2 - 0.5 + finWiggle) * 35 * this.sizeMultiplier,
      this.segments[2].y + Math.sin(this.angle - Math.PI/2 - 0.5 + finWiggle) * 35 * this.sizeMultiplier,
      this.segments[3].x, this.segments[3].y
    );
    ctx.fill();

    // Right butterfly fin
    ctx.beginPath();
    ctx.moveTo(this.segments[1].x, this.segments[1].y);
    ctx.bezierCurveTo(
      this.segments[1].x + Math.cos(this.angle + Math.PI/2 + 0.2 - finWiggle) * 28 * this.sizeMultiplier,
      this.segments[1].y + Math.sin(this.angle + Math.PI/2 + 0.2 - finWiggle) * 28 * this.sizeMultiplier,
      this.segments[2].x + Math.cos(this.angle + Math.PI/2 + 0.5 - finWiggle) * 35 * this.sizeMultiplier,
      this.segments[2].y + Math.sin(this.angle + Math.PI/2 + 0.5 - finWiggle) * 35 * this.sizeMultiplier,
      this.segments[3].x, this.segments[3].y
    );
    ctx.fill();

    // Long double-lobed butterfly tail fin
    const tailSweep = Math.sin(this.phase) * 0.45;

    // Left tail lobe
    ctx.beginPath();
    ctx.moveTo(tailSeg.x, tailSeg.y);
    ctx.bezierCurveTo(
      tailSeg.x + Math.cos(tailAngle + Math.PI - 0.4 + tailSweep) * 26 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI - 0.4 + tailSweep) * 26 * this.sizeMultiplier,
      tailSeg.x + Math.cos(tailAngle + Math.PI - 0.9 + tailSweep) * 32 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI - 0.9 + tailSweep) * 32 * this.sizeMultiplier,
      tailSeg.x + Math.cos(tailAngle + Math.PI - 0.25 + tailSweep) * 18 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI - 0.25 + tailSweep) * 18 * this.sizeMultiplier
    );
    ctx.closePath();
    ctx.fill();

    // Right tail lobe
    ctx.beginPath();
    ctx.moveTo(tailSeg.x, tailSeg.y);
    ctx.bezierCurveTo(
      tailSeg.x + Math.cos(tailAngle + Math.PI + 0.4 + tailSweep) * 26 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI + 0.4 + tailSweep) * 26 * this.sizeMultiplier,
      tailSeg.x + Math.cos(tailAngle + Math.PI + 0.9 + tailSweep) * 32 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI + 0.9 + tailSweep) * 32 * this.sizeMultiplier,
      tailSeg.x + Math.cos(tailAngle + Math.PI + 0.25 + tailSweep) * 18 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI + 0.25 + tailSweep) * 18 * this.sizeMultiplier
    );
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

export default function InteractivePondBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, lastX: -1000, lastY: -1000 });
  const ripplesRef = useRef<Ripple[]>([]);
  const fishRef = useRef<KoiFish[]>([]);
  const petalsRef = useRef<Petal[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const foodsRef = useRef<Food[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    // Fish configuration matching sage/terracotta/peach palette
    const fishColors = [
      { body: '#E86F51', spot: '#264653', size: 1.25 },   // Terracotta / Dark Teal spots
      { body: '#F4A261', spot: '#E76F51', size: 0.95 },   // Peach / Terracotta spots
      { body: '#E9C46A', spot: '#E76F51', size: 1.1 },    // Gold / Terracotta spots
      { body: '#FFFFFF', spot: '#E76F51', size: 1.3 },    // White / Terracotta spots
      { body: '#FFFFFF', spot: '#2A9D8F', size: 1.05 },   // White / Sage spots
      { body: '#E86F51', spot: '', size: 0.8 },           // Pure Terracotta Solid
      { body: '#C8A2A8', spot: '#FFFFFF', size: 1.15 },   // Dusty Rose / White spots
    ];

    fishRef.current = fishColors.map((cfg) => {
      return new KoiFish(
        Math.random() * width,
        Math.random() * height,
        cfg.body,
        cfg.spot,
        cfg.size
      );
    });

    // Populate Sakura petals & sage leaves
    const petalColors = ['#FFB7C5', '#FFA6B9', '#FFD1DC', '#6E7D5F', '#8C9A7D'];
    petalsRef.current = Array.from({ length: 28 }, () => {
      return new Petal(
        Math.random() * width,
        Math.random() * height,
        petalColors[Math.floor(Math.random() * petalColors.length)]
      );
    });

    // Populate glowing fireflies
    firefliesRef.current = Array.from({ length: 15 }, () => {
      return new Firefly(Math.random() * width, Math.random() * height);
    });

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current.x = x;
      mouseRef.current.y = y;

      // Spawn ripples as the mouse moves
      const lastX = mouseRef.current.lastX;
      const lastY = mouseRef.current.lastY;
      const moveDist = Math.hypot(x - lastX, y - lastY);

      if (moveDist > 28) {
        ripplesRef.current.push({
          x,
          y,
          radius: 2,
          maxRadius: 75 + Math.random() * 40,
          strength: 0.9,
          speed: 1.2 + Math.random() * 0.8,
        });
        mouseRef.current.lastX = x;
        mouseRef.current.lastY = y;
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    const handleMouseClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Spawn food pellet
      foodsRef.current.push({
        x,
        y,
        size: 4 + Math.random() * 2,
        age: 0,
        isEaten: false,
      });

      // Spawn click splash ripple
      ripplesRef.current.push({
        x,
        y,
        radius: 2,
        maxRadius: 60,
        strength: 0.9,
        speed: 1.4,
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleMouseClick);

    // Main render/update loops
    const animate = () => {
      // 1. Water Background (sage-cream deep gradient)
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#535F44'); 
      grad.addColorStop(0.5, '#424D35'); 
      grad.addColorStop(1, '#343E2A'); 
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Pond bottom pebbles
      ctx.fillStyle = 'rgba(235, 230, 220, 0.05)';
      for (let i = 0; i < 40; i++) {
        const seedX = (Math.sin(i * 123.45) * 0.5 + 0.5) * width;
        const seedY = (Math.cos(i * 543.21) * 0.5 + 0.5) * height;
        const r = (Math.sin(i * 789.1) * 0.5 + 0.5) * 15 + 5;
        ctx.beginPath();
        ctx.arc(seedX, seedY, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const mouse = mouseRef.current;

      // 2. Update and Draw Food Pellets
      foodsRef.current = foodsRef.current.filter((food) => {
        if (food.isEaten) return false;
        food.age++;

        // Bob pellet up/down
        const bob = Math.sin(food.age * 0.08) * 0.6;

        // Shadow
        ctx.fillStyle = 'rgba(10, 15, 10, 0.35)';
        ctx.beginPath();
        ctx.arc(food.x + 3, food.y + 4, food.size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Pellet shape (brownish)
        ctx.fillStyle = '#8B5A2B';
        ctx.beginPath();
        ctx.arc(food.x, food.y + bob, food.size, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#CD853F';
        ctx.beginPath();
        ctx.arc(food.x - 1, food.y + bob - 1, food.size * 0.45, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // 3. Update and Draw Koi Fish
      fishRef.current.forEach((fish) => {
        fish.update(width, height, mouse.x, mouse.y, foodsRef.current, ripplesRef.current);
        fish.draw(ctx);
      });

      // 4. Update and Draw Sakura Petals
      petalsRef.current = petalsRef.current.filter((petal) => {
        const keep = petal.update(width, height, mouse.x, mouse.y, ripplesRef.current);
        if (keep) petal.draw(ctx);
        return keep;
      });

      // 5. Update and Draw Water Ripples
      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        ripple.radius += ripple.speed;
        ripple.strength = 1.0 - ripple.radius / ripple.maxRadius;

        if (ripple.strength <= 0) return false;

        ctx.strokeStyle = `rgba(227, 221, 211, ${ripple.strength * 0.28})`;
        ctx.lineWidth = 2.5 * ripple.strength;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (ripple.radius > 15) {
          ctx.strokeStyle = `rgba(227, 221, 211, ${ripple.strength * 0.14})`;
          ctx.lineWidth = 1.2 * ripple.strength;
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.radius - 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        return true;
      });

      // 6. Update and Draw Bioluminescent Fireflies
      firefliesRef.current.forEach((firefly) => {
        firefly.update(width, height, mouse.x, mouse.y);
        firefly.draw(ctx);
      });

      // 7. Sun glare sheer
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.beginPath();
      ctx.ellipse(width * 0.7, height * 0.3, width * 0.3, height * 0.2, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        canvas.removeEventListener('click', handleMouseClick);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover pointer-events-auto"
      style={{ mixBlendMode: 'normal' }}
    />
  );
}
