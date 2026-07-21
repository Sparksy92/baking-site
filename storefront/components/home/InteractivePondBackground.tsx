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

    // Segmented body array (8 segments for natural wiggle follow-the-leader motion)
    this.segments = [];
    for (let i = 0; i < 8; i++) {
      this.segments.push({ x: x - i * 8 * sizeMultiplier, y: y });
    }
  }

  update(width: number, height: number, mouseX: number, mouseY: number) {
    // Distance to mouse
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.hypot(dx, dy);

    // AI logic: wander or flee from mouse
    if (dist < 180) {
      // Flee away from mouse direction
      this.targetAngle = Math.atan2(this.y - mouseY, this.x - mouseX);
      this.targetSpeed = 3.2; // Dash speed
    } else {
      // Wandering steer logic
      if (Math.random() < 0.015) {
        this.targetAngle = this.angle + (Math.random() - 0.5) * 1.5;
      }
      this.targetSpeed = 1.0 + Math.random() * 0.6;
    }

    // Pond boundary checks (turn around if heading out of boundaries)
    const margin = 80;
    if (this.x < margin) this.targetAngle = 0;
    else if (this.x > width - margin) this.targetAngle = Math.PI;
    if (this.y < margin) this.targetAngle = Math.PI / 2;
    else if (this.y > height - margin) this.targetAngle = -Math.PI / 2;

    // Smoothly interpolate angle and speed
    const angleDiff = this.targetAngle - this.angle;
    this.angle += Math.sin(angleDiff) * 0.08;
    this.speed = this.speed * 0.94 + this.targetSpeed * 0.06;

    // Update head position
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // First segment is the head position
    this.segments[0] = { x: this.x, y: this.y };

    // Update body segments following the leader
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

    // Wiggle tail phase (based on current speed)
    this.phase += this.speed * 0.14;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // 1. Draw smooth soft shadow under the fish for realistic depth
    ctx.save();
    ctx.shadowColor = 'rgba(10, 20, 10, 0.4)';
    ctx.shadowBlur = 12 * this.sizeMultiplier;
    ctx.shadowOffsetX = 10 * this.sizeMultiplier;
    ctx.shadowOffsetY = 15 * this.sizeMultiplier;

    // Draw main body segments
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const radius = (8 - i * 0.85) * this.sizeMultiplier;
      if (radius <= 0) continue;

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw spots on body
      if (this.spotColor && i > 0 && i < 6 && (i % 2 === 0)) {
        ctx.fillStyle = this.spotColor;
        ctx.beginPath();
        ctx.arc(seg.x + (i % 4 - 2), seg.y + (i % 3 - 1), radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw head detail (eyes and whiskers)
    const head = this.segments[0];
    const eyeRadius = 1.5 * this.sizeMultiplier;
    const eyeOffsetAngle = 0.55;
    ctx.fillStyle = '#000000';
    
    // Left eye
    ctx.beginPath();
    ctx.arc(
      head.x + Math.cos(this.angle - eyeOffsetAngle) * 5 * this.sizeMultiplier,
      head.y + Math.sin(this.angle - eyeOffsetAngle) * 5 * this.sizeMultiplier,
      eyeRadius, 0, Math.PI * 2
    );
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.arc(
      head.x + Math.cos(this.angle + eyeOffsetAngle) * 5 * this.sizeMultiplier,
      head.y + Math.sin(this.angle + eyeOffsetAngle) * 5 * this.sizeMultiplier,
      eyeRadius, 0, Math.PI * 2
    );
    ctx.fill();

    // Draw fins (wiggling)
    const tailSeg = this.segments[this.segments.length - 1];
    const preTailSeg = this.segments[this.segments.length - 2];
    const tailAngle = Math.atan2(tailSeg.y - preTailSeg.y, tailSeg.x - preTailSeg.x);

    // Pectoral Fins (on the sides of the head area)
    const finWiggle = Math.sin(this.phase) * 0.25;
    ctx.fillStyle = this.color;
    
    // Left fin
    ctx.beginPath();
    ctx.moveTo(this.segments[1].x, this.segments[1].y);
    ctx.quadraticCurveTo(
      this.segments[1].x + Math.cos(this.angle - Math.PI/2 + finWiggle) * 16 * this.sizeMultiplier,
      this.segments[1].y + Math.sin(this.angle - Math.PI/2 + finWiggle) * 16 * this.sizeMultiplier,
      this.segments[2].x, this.segments[2].y
    );
    ctx.fill();

    // Right fin
    ctx.beginPath();
    ctx.moveTo(this.segments[1].x, this.segments[1].y);
    ctx.quadraticCurveTo(
      this.segments[1].x + Math.cos(this.angle + Math.PI/2 - finWiggle) * 16 * this.sizeMultiplier,
      this.segments[1].y + Math.sin(this.angle + Math.PI/2 - finWiggle) * 16 * this.sizeMultiplier,
      this.segments[2].x, this.segments[2].y
    );
    ctx.fill();

    // Tail Fin (organic sweep movement)
    const tailSweep = Math.sin(this.phase) * 0.6;
    ctx.beginPath();
    ctx.moveTo(tailSeg.x, tailSeg.y);
    ctx.lineTo(
      tailSeg.x + Math.cos(tailAngle + Math.PI + tailSweep) * 15 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI + tailSweep) * 15 * this.sizeMultiplier
    );
    ctx.lineTo(
      tailSeg.x + Math.cos(tailAngle + Math.PI + 0.35 + tailSweep) * 12 * this.sizeMultiplier,
      tailSeg.y + Math.sin(tailAngle + Math.PI + 0.35 + tailSweep) * 12 * this.sizeMultiplier
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    // Initialize fish with warm, branding-aligned colors (Sage, Cream, Peach, Terracotta)
    const fishColors = [
      { body: '#E86F51', spot: '#264653', size: 1.2 },    // Terracotta Orange w/ Dark Teal
      { body: '#F4A261', spot: '#E76F51', size: 0.95 },   // Soft Peach w/ Dark Orange
      { body: '#E9C46A', spot: '#E76F51', size: 1.1 },    // Golden Yellow w/ Orange
      { body: '#FFFFFF', spot: '#E76F51', size: 1.3 },    // Pearlescent White w/ Orange Spots
      { body: '#FFFFFF', spot: '#2A9D8F', size: 1.0 },    // Pure White w/ Sage Green Spots
      { body: '#E86F51', spot: '', size: 0.8 },           // Pure Orange Solid
      { body: '#C8A2A8', spot: '#FFFFFF', size: 1.15 },   // Dusty Rose w/ White Spots
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

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);

    // Track mouse coordinates relative to canvas bounding rect
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

      if (moveDist > 25) {
        ripplesRef.current.push({
          x,
          y,
          radius: 2,
          maxRadius: 75 + Math.random() * 40,
          strength: 1.0,
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

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Main animation loop
    const animate = () => {
      // 1. Draw Pond Water Background (sage-cream deep gradient)
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#535F44'); // Deep sage green
      grad.addColorStop(0.5, '#424D35'); // Dark forest shadow
      grad.addColorStop(1, '#343E2A'); // Deep pond bottom
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw subtle pond bottom details (pebbles/stones)
      ctx.fillStyle = 'rgba(235, 230, 220, 0.05)';
      for (let i = 0; i < 40; i++) {
        const seedX = (Math.sin(i * 123.45) * 0.5 + 0.5) * width;
        const seedY = (Math.cos(i * 543.21) * 0.5 + 0.5) * height;
        const r = (Math.sin(i * 789.1) * 0.5 + 0.5) * 15 + 5;
        ctx.beginPath();
        ctx.arc(seedX, seedY, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Update and Draw Koi Fish
      const mouse = mouseRef.current;
      fishRef.current.forEach((fish) => {
        fish.update(width, height, mouse.x, mouse.y);
        fish.draw(ctx);
      });

      // 3. Update and Draw Water Ripples (propagating concentric rings)
      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        ripple.radius += ripple.speed;
        ripple.strength = 1.0 - ripple.radius / ripple.maxRadius;

        if (ripple.strength <= 0) return false;

        ctx.strokeStyle = `rgba(227, 221, 211, ${ripple.strength * 0.25})`;
        ctx.lineWidth = 2.5 * ripple.strength;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner concentric ring
        if (ripple.radius > 15) {
          ctx.strokeStyle = `rgba(227, 221, 211, ${ripple.strength * 0.12})`;
          ctx.lineWidth = 1.2 * ripple.strength;
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, ripple.radius - 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        return true;
      });

      // 4. Draw high-fidelity reflection sheen / sun glares
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
