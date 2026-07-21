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

// Calculate refraction displacement from water waves
function getWaterRefraction(x: number, y: number, ripples: Ripple[]) {
  let rx = 0;
  let ry = 0;
  for (const rip of ripples) {
    const dx = x - rip.x;
    const dy = y - rip.y;
    const dist = Math.hypot(dx, dy);

    // Wavefront zone
    const waveDist = Math.abs(dist - rip.radius);
    if (waveDist < 30) {
      const force = (1.0 - waveDist / 30) * rip.strength * 7.5;
      const angle = Math.atan2(dy, dx);
      rx += Math.cos(angle) * force;
      ry += Math.sin(angle) * force;
    }
  }
  return { rx, ry };
}

class Pebble {
  x: number;
  y: number;
  r: number;
  color: string;
  angle: number;
  aspectRatio: number;

  constructor(x: number, y: number, r: number) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.angle = Math.random() * Math.PI * 2;
    this.aspectRatio = 0.65 + Math.random() * 0.3;
    
    // Warm earthy sage stone color palette
    const stoneColors = ['#4E5340', '#5B624D', '#414736', '#545C47', '#393F2F', '#626B54', '#4B503D'];
    this.color = stoneColors[Math.floor(Math.random() * stoneColors.length)];
  }

  draw(ctx: CanvasRenderingContext2D, ripples: Ripple[]) {
    const ref = getWaterRefraction(this.x, this.y, ripples);
    ctx.save();
    ctx.translate(this.x + ref.rx, this.y + ref.ry);
    ctx.rotate(this.angle);

    // Shadow
    ctx.fillStyle = 'rgba(10, 16, 10, 0.35)';
    ctx.beginPath();
    ctx.ellipse(3, 4, this.r, this.r * this.aspectRatio, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft 3D spherical shading (less harsh highlights)
    const grad = ctx.createRadialGradient(
      -this.r * 0.2, -this.r * 0.2 * this.aspectRatio, this.r * 0.1,
      0, 0, this.r
    );
    grad.addColorStop(0, '#868F7E'); // Soft top highlight
    grad.addColorStop(0.4, this.color);
    grad.addColorStop(1, '#1E2319'); // Bottom shadow
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r, this.r * this.aspectRatio, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class Eelgrass {
  x: number;
  y: number;
  height: number;
  phase: number;
  swaySpeed: number;
  swayWidth: number;
  color: string;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.height = 110 + Math.random() * 90;
    this.phase = Math.random() * Math.PI * 2;
    this.swaySpeed = 0.012 + Math.random() * 0.008;
    this.swayWidth = 12 + Math.random() * 15;
    
    const greens = ['rgba(79, 107, 72, 0.18)', 'rgba(64, 89, 58, 0.15)', 'rgba(92, 120, 84, 0.20)'];
    this.color = greens[Math.floor(Math.random() * greens.length)];
  }

  update() {
    this.phase += this.swaySpeed;
  }

  draw(ctx: CanvasRenderingContext2D, ripples: Ripple[]) {
    const sway = Math.sin(this.phase) * this.swayWidth;
    
    const refBase = getWaterRefraction(this.x, this.y, ripples);
    const refTip = getWaterRefraction(this.x + sway, this.y - this.height, ripples);

    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 5 * (this.height / 200);
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(this.x + refBase.rx, this.y + refBase.ry);
    ctx.quadraticCurveTo(
      this.x + sway * 0.5 + (refBase.rx + refTip.rx) * 0.5, 
      this.y - this.height * 0.5 + (refBase.ry + refTip.ry) * 0.5,
      this.x + sway + refTip.rx, 
      this.y - this.height + refTip.ry
    );
    ctx.stroke();
    ctx.restore();
  }
}

class LilyPad {
  x: number;
  y: number;
  radius: number;
  angle: number;
  bobPhase: number;
  bobSpeed: number;
  bobOffset: number;

  constructor(x: number, y: number, radius: number) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.angle = Math.random() * Math.PI * 2;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobSpeed = 0.01 + Math.random() * 0.015;
    this.bobOffset = 0;
  }

  update() {
    this.bobPhase += this.bobSpeed;
    this.bobOffset = Math.sin(this.bobPhase) * 1.5;
  }

  drawShadow(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x + 16, this.y + 22 + this.bobOffset);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'rgba(5, 12, 5, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0.3, Math.PI * 2 - 0.3);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y + this.bobOffset);
    ctx.rotate(this.angle);

    const leafGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
    leafGrad.addColorStop(0, '#5D8A4E');
    leafGrad.addColorStop(0.7, '#446E34');
    leafGrad.addColorStop(1, '#2D4B20');
    
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0.3, Math.PI * 2 - 0.3);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(235, 230, 210, 0.16)';
    ctx.lineWidth = 1.3;
    const veinCount = 8;
    for (let i = 0; i < veinCount; i++) {
      const a = 0.45 + (i * (Math.PI * 2 - 0.9)) / (veinCount - 1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * this.radius * 0.9, Math.sin(a) * this.radius * 0.9);
      ctx.stroke();
    }

    ctx.restore();
  }
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
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = 0.4 + Math.random() * 0.4;
    this.size = 5 + Math.random() * 4;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.02;
    this.color = color;
    this.opacity = 0.5 + Math.random() * 0.4;
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

    const windX = 0.25;
    const windY = 0.15;

    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);
    if (dist < 80) {
      const force = (80 - dist) / 80;
      const angle = Math.atan2(dy, dx);
      this.vx += Math.cos(angle) * force * 1.5;
      this.vy += Math.sin(angle) * force * 1.5;

      if (force > 0.6 && Math.random() < 0.04) {
        ripples.push({
          x: this.x,
          y: this.y,
          radius: 1,
          maxRadius: 15,
          strength: 0.25,
          speed: 0.8,
        });
      }
    }

    this.vx *= 0.94;
    this.vy *= 0.94;

    this.x += this.vx + windX;
    this.y += this.vy + windY;
    this.angle += this.spin;

    if (this.y > height + 20) {
      this.y = -20;
      this.x = Math.random() * width;
      this.age = 0;
      this.isSinking = false;
      this.opacity = 0.5 + Math.random() * 0.4;
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

    ctx.fillStyle = 'rgba(15, 25, 15, 0.12)';
    ctx.beginPath();
    ctx.ellipse(3, 4, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

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
    this.size = 1.6 + Math.random() * 1.8;
    this.opacity = Math.random();
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.pulseSpeed = 0.025 + Math.random() * 0.035;
    this.targetX = x;
    this.targetY = y;
  }

  update(width: number, height: number, mouseX: number, mouseY: number) {
    this.pulsePhase += this.pulseSpeed;
    this.opacity = 0.3 + Math.sin(this.pulsePhase) * 0.4;

    if (Math.random() < 0.02) {
      this.targetX = this.x + (Math.random() - 0.5) * 130;
      this.targetY = this.y + (Math.random() - 0.5) * 130;
    }

    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.hypot(dx, dy);

    if (dist < 100) {
      const force = (100 - dist) / 100;
      const angle = Math.atan2(dy, dx);
      this.vx += Math.cos(angle) * force * 3.5;
      this.vy += Math.sin(angle) * force * 3.5;
    } else {
      const tDx = this.targetX - this.x;
      const tDy = this.targetY - this.y;
      this.vx += tDx * 0.003;
      this.vy += tDy * 0.003;
    }

    this.vx *= 0.93;
    this.vy *= 0.93;

    this.x += this.vx;
    this.y += this.vy;

    const margin = 50;
    if (this.x < margin) { this.x = margin; this.vx *= -0.5; }
    else if (this.x > width - margin) { this.x = width - margin; this.vx *= -0.5; }
    if (this.y < margin) { this.y = margin; this.vy *= -0.5; }
    else if (this.y > height - margin) { this.y = height - margin; this.vy *= -0.5; }
  }

  drawReflection(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = `rgba(238, 225, 140, ${this.opacity * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 40, this.size * 3.0, this.size * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const glowRad = this.size * 7.0;
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRad);
    gradient.addColorStop(0, `rgba(238, 225, 140, ${this.opacity})`);
    gradient.addColorStop(0.3, `rgba(238, 225, 140, ${this.opacity * 0.35})`);
    gradient.addColorStop(1, 'rgba(238, 225, 140, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glowRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = this.opacity * 0.95;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.4, 0, Math.PI * 2);
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
  depth: number; 
  targetDepth: number;

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
    this.depth = 0.2 + Math.random() * 0.4;
    this.targetDepth = this.depth;

    this.segments = [];
    // Increase fish segment length slightly for a more elongated realistic body shape
    for (let i = 0; i < 8; i++) {
      this.segments.push({ x: x - i * 10 * sizeMultiplier, y: y });
    }
  }

  update(width: number, height: number, mouseX: number, mouseY: number, foods: Food[], ripples: Ripple[]) {
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 150) {
      this.targetAngle = Math.atan2(this.y - mouseY, this.x - mouseX);
      this.targetSpeed = 3.5;
      this.targetDepth = 0.8; 
    } else {
      const activeFoods = foods.filter((f) => !f.isEaten);
      let closestFood: Food | null = null;
      let minDist = 350;

      for (const food of activeFoods) {
        const fDist = Math.hypot(food.x - this.x, food.y - this.y);
        if (fDist < minDist) {
          minDist = fDist;
          closestFood = food;
        }
      }

      if (closestFood) {
        this.targetAngle = Math.atan2(closestFood.y - this.y, closestFood.x - this.x);
        this.targetSpeed = 1.9 + Math.random() * 0.6;
        this.targetDepth = 0.15; 

        if (minDist < 12) {
          closestFood.isEaten = true;
          this.targetSpeed = 4.2;
          
          ripples.push({
            x: closestFood.x,
            y: closestFood.y,
            radius: 2,
            maxRadius: 35,
            strength: 0.8,
            speed: 1.4,
          });
        }
      } else {
        if (Math.random() < 0.015) {
          this.targetAngle = this.angle + (Math.random() - 0.5) * 1.5;
          this.targetDepth = 0.2 + Math.random() * 0.5; 
        }
        this.targetSpeed = 1.0 + Math.random() * 0.5;
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
    this.depth = this.depth * 0.96 + this.targetDepth * 0.04;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    this.segments[0] = { x: this.x, y: this.y };

    const segLength = 10 * this.sizeMultiplier;
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

  drawShadow(ctx: CanvasRenderingContext2D, ripples: Ripple[]) {
    const shadowDist = 12 + this.depth * 22; 
    const shadowBlur = 8 + this.depth * 15;  
    const shadowAlpha = 0.5 - this.depth * 0.35; 

    ctx.save();
    ctx.shadowColor = `rgba(5, 12, 5, ${shadowAlpha})`;
    ctx.shadowBlur = shadowBlur * this.sizeMultiplier;
    ctx.shadowOffsetX = shadowDist * this.sizeMultiplier;
    ctx.shadowOffsetY = (shadowDist + 4) * this.sizeMultiplier;

    this.buildBodyPath(ctx, ripples);
    ctx.fill();
    ctx.restore();
  }

  // Smooth quadratic spline math to outline the fish body (completely removes polygon straight lines)
  buildBodyPath(ctx: CanvasRenderingContext2D, ripples: Ripple[]) {
    const leftPoints: Segment[] = [];
    const rightPoints: Segment[] = [];

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const radius = (8 - i * 0.85) * this.sizeMultiplier;
      if (radius <= 0) continue;

      let segAngle = this.angle;
      if (i > 0) {
        const prev = this.segments[i - 1];
        segAngle = Math.atan2(seg.y - prev.y, seg.x - prev.x);
      }

      const ref = getWaterRefraction(seg.x, seg.y, ripples);

      leftPoints.push({
        x: seg.x + ref.rx + Math.cos(segAngle - Math.PI / 2) * radius,
        y: seg.y + ref.ry + Math.sin(segAngle - Math.PI / 2) * radius,
      });
      rightPoints.push({
        x: seg.x + ref.rx + Math.cos(segAngle + Math.PI / 2) * radius,
        y: seg.y + ref.ry + Math.sin(segAngle + Math.PI / 2) * radius,
      });
    }

    ctx.beginPath();
    ctx.moveTo(leftPoints[0].x, leftPoints[0].y);

    // Left spline curve using quadratic midpoints
    for (let i = 0; i < leftPoints.length - 1; i++) {
      const xc = (leftPoints[i].x + leftPoints[i + 1].x) / 2;
      const yc = (leftPoints[i].y + leftPoints[i + 1].y) / 2;
      ctx.quadraticCurveTo(leftPoints[i].x, leftPoints[i].y, xc, yc);
    }
    
    // Connect to tail tip
    const tailTip = this.segments[this.segments.length - 1];
    const tailRef = getWaterRefraction(tailTip.x, tailTip.y, ripples);
    ctx.lineTo(tailTip.x + tailRef.rx, tailTip.y + tailRef.ry);

    // Right spline curve going backwards
    ctx.lineTo(rightPoints[rightPoints.length - 1].x, rightPoints[rightPoints.length - 1].y);
    for (let i = rightPoints.length - 1; i > 0; i--) {
      const xc = (rightPoints[i].x + rightPoints[i - 1].x) / 2;
      const yc = (rightPoints[i].y + rightPoints[i - 1].y) / 2;
      ctx.quadraticCurveTo(rightPoints[i].x, rightPoints[i].y, xc, yc);
    }
    ctx.closePath();
  }

  draw(ctx: CanvasRenderingContext2D, ripples: Ripple[]) {
    ctx.save();
    const head = this.segments[0];
    
    const scale = 1.0 - this.depth * 0.22;
    const refHead = getWaterRefraction(this.x, this.y, ripples);
    ctx.translate(refHead.rx * this.depth, refHead.ry * this.depth);

    const tailSeg = this.segments[this.segments.length - 1];
    const preTailSeg = this.segments[this.segments.length - 2];
    const tailAngle = Math.atan2(tailSeg.y - preTailSeg.y, tailSeg.x - preTailSeg.x);
    const refTail = getWaterRefraction(tailSeg.x, tailSeg.y, ripples);

    const finWiggle = Math.sin(this.phase) * 0.16;
    const tailSweep = Math.sin(this.phase) * 0.4;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = (0.75 - this.depth * 0.2) * scale; 

    // Left pectoral
    ctx.beginPath();
    ctx.moveTo(this.segments[1].x + refHead.rx, this.segments[1].y + refHead.ry);
    ctx.bezierCurveTo(
      this.segments[1].x + refHead.rx + Math.cos(this.angle - Math.PI/2 - 0.2 + finWiggle) * 28 * this.sizeMultiplier * scale,
      this.segments[1].y + refHead.ry + Math.sin(this.angle - Math.PI/2 - 0.2 + finWiggle) * 28 * this.sizeMultiplier * scale,
      this.segments[2].x + refHead.rx + Math.cos(this.angle - Math.PI/2 - 0.5 + finWiggle) * 35 * this.sizeMultiplier * scale,
      this.segments[2].y + refHead.ry + Math.sin(this.angle - Math.PI/2 - 0.5 + finWiggle) * 35 * this.sizeMultiplier * scale,
      this.segments[3].x + refHead.rx, this.segments[3].y + refHead.ry
    );
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.8;
    for (let r = 0.1; r < 0.6; r += 0.1) {
      ctx.beginPath();
      ctx.moveTo(this.segments[1].x + refHead.rx, this.segments[1].y + refHead.ry);
      ctx.lineTo(
        this.segments[1].x + refHead.rx + Math.cos(this.angle - Math.PI/2 - r + finWiggle) * 26 * this.sizeMultiplier * scale,
        this.segments[1].y + refHead.ry + Math.sin(this.angle - Math.PI/2 - r + finWiggle) * 26 * this.sizeMultiplier * scale
      );
      ctx.stroke();
    }

    // Right pectoral
    ctx.beginPath();
    ctx.moveTo(this.segments[1].x + refHead.rx, this.segments[1].y + refHead.ry);
    ctx.bezierCurveTo(
      this.segments[1].x + refHead.rx + Math.cos(this.angle + Math.PI/2 + 0.2 - finWiggle) * 28 * this.sizeMultiplier * scale,
      this.segments[1].y + refHead.ry + Math.sin(this.angle + Math.PI/2 + 0.2 - finWiggle) * 28 * this.sizeMultiplier * scale,
      this.segments[2].x + refHead.rx + Math.cos(this.angle + Math.PI/2 + 0.5 - finWiggle) * 35 * this.sizeMultiplier * scale,
      this.segments[2].y + refHead.ry + Math.sin(this.angle + Math.PI/2 + 0.5 - finWiggle) * 35 * this.sizeMultiplier * scale,
      this.segments[3].x + refHead.rx, this.segments[3].y + refHead.ry
    );
    ctx.fill();

    for (let r = 0; r < 0.5; r += 0.1) {
      ctx.beginPath();
      ctx.moveTo(this.segments[1].x + refHead.rx, this.segments[1].y + refHead.ry);
      ctx.lineTo(
        this.segments[1].x + refHead.rx + Math.cos(this.angle + Math.PI/2 + r - finWiggle) * 26 * this.sizeMultiplier * scale,
        this.segments[1].y + refHead.ry + Math.sin(this.angle + Math.PI/2 + r - finWiggle) * 26 * this.sizeMultiplier * scale
      );
      ctx.stroke();
    }

    // Tail Lobe Left
    ctx.beginPath();
    ctx.moveTo(tailSeg.x + refTail.rx, tailSeg.y + refTail.ry);
    ctx.bezierCurveTo(
      tailSeg.x + refTail.rx + Math.cos(tailAngle + Math.PI - 0.4 + tailSweep) * 26 * this.sizeMultiplier * scale,
      tailSeg.y + refTail.ry + Math.sin(tailAngle + Math.PI - 0.4 + tailSweep) * 26 * this.sizeMultiplier * scale,
      tailSeg.x + refTail.rx + Math.cos(tailAngle + Math.PI - 0.9 + tailSweep) * 32 * this.sizeMultiplier * scale,
      tailSeg.y + refTail.ry + Math.sin(tailAngle + Math.PI - 0.9 + tailSweep) * 32 * this.sizeMultiplier * scale,
      tailSeg.x + refTail.rx + Math.cos(tailAngle + Math.PI - 0.25 + tailSweep) * 18 * this.sizeMultiplier * scale,
      tailSeg.y + refTail.ry + Math.sin(tailAngle + Math.PI - 0.25 + tailSweep) * 18 * this.sizeMultiplier * scale
    );
    ctx.closePath();
    ctx.fill();

    // Tail Lobe Right
    ctx.beginPath();
    ctx.moveTo(tailSeg.x + refTail.rx, tailSeg.y + refTail.ry);
    ctx.bezierCurveTo(
      tailSeg.x + refTail.rx + Math.cos(tailAngle + Math.PI + 0.4 + tailSweep) * 26 * this.sizeMultiplier * scale,
      tailSeg.y + refTail.ry + Math.sin(tailAngle + Math.PI + 0.4 + tailSweep) * 26 * this.sizeMultiplier * scale,
      tailSeg.x + refTail.rx + Math.cos(tailAngle + Math.PI + 0.9 + tailSweep) * 32 * this.sizeMultiplier * scale,
      tailSeg.y + refTail.ry + Math.sin(tailAngle + Math.PI + 0.9 + tailSweep) * 32 * this.sizeMultiplier * scale,
      tailSeg.x + refTail.rx + Math.cos(tailAngle + Math.PI + 0.25 + tailSweep) * 18 * this.sizeMultiplier * scale,
      tailSeg.y + refTail.ry + Math.sin(tailAngle + Math.PI + 0.25 + tailSweep) * 18 * this.sizeMultiplier * scale
    );
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = (1.0 - this.depth * 0.4) * scale; 

    // Smooth spline body path
    this.buildBodyPath(ctx, ripples);
    ctx.fillStyle = this.color;
    ctx.fill();

    ctx.globalCompositeOperation = 'source-atop';
    
    const gradAngle = this.angle + Math.PI / 2;
    const shadGrad = ctx.createLinearGradient(
      head.x + refHead.rx + Math.cos(gradAngle) * 8 * this.sizeMultiplier * scale,
      head.y + refHead.ry + Math.sin(gradAngle) * 8 * this.sizeMultiplier * scale,
      head.x + refHead.rx - Math.cos(gradAngle) * 8 * this.sizeMultiplier * scale,
      head.y + refHead.ry - Math.sin(gradAngle) * 8 * this.sizeMultiplier * scale
    );
    shadGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    shadGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.15)');
    shadGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.42)'); 
    shadGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.15)');
    shadGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');

    ctx.fillStyle = shadGrad;
    this.buildBodyPath(ctx, ripples);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over'; 

    // Eyes
    const eyeRadius = 1.3 * this.sizeMultiplier * scale;
    const eyeOffsetAngle = 0.55;
    ctx.fillStyle = '#000000';
    
    ctx.beginPath();
    ctx.arc(
      head.x + refHead.rx + Math.cos(this.angle - eyeOffsetAngle) * 5 * this.sizeMultiplier * scale,
      head.y + refHead.ry + Math.sin(this.angle - eyeOffsetAngle) * 5 * this.sizeMultiplier * scale,
      eyeRadius, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.beginPath();
    ctx.arc(
      head.x + refHead.rx + Math.cos(this.angle + eyeOffsetAngle) * 5 * this.sizeMultiplier * scale,
      head.y + refHead.ry + Math.sin(this.angle + eyeOffsetAngle) * 5 * this.sizeMultiplier * scale,
      eyeRadius, 0, Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }
}

export default function InteractivePondBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, lastX: -1000, lastY: -1000 });
  const ripplesRef = useRef<Ripple[]>([]);
  const fishRef = useRef<KoiFish[]>([]);
  const pebblesRef = useRef<Pebble[]>([]);
  const reedsRef = useRef<Eelgrass[]>([]);
  const lilyPadsRef = useRef<LilyPad[]>([]);
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
    let globalTime = 0;

    // Generate static river stones
    const tempPebbles: Pebble[] = [];
    const stoneCount = 55;
    for (let i = 0; i < stoneCount; i++) {
      tempPebbles.push(
        new Pebble(
          Math.random() * width,
          Math.random() * height,
          15 + Math.random() * 25
        )
      );
    }
    pebblesRef.current = tempPebbles;

    // Generate swaying eelgrass weeds
    reedsRef.current = Array.from({ length: 15 }, () => {
      return new Eelgrass(
        Math.random() * width,
        height - Math.random() * 80
      );
    });

    // Generate bobbing lily pads (Enlarged for substantial realistic flora coverage)
    lilyPadsRef.current = Array.from({ length: 6 }, () => {
      return new LilyPad(
        Math.random() * width,
        Math.random() * height,
        55 + Math.random() * 25
      );
    });

    // Fish configs (Enlarged sizing parameters to look prominent and majestic)
    const fishColors = [
      { body: '#E86F51', spot: '#264653', size: 2.1 },   
      { body: '#F4A261', spot: '#E76F51', size: 1.8 },   
      { body: '#E9C46A', spot: '#E76F51', size: 1.95 },    
      { body: '#FFFFFF', spot: '#E76F51', size: 2.2 },    
      { body: '#FFFFFF', spot: '#2A9D8F', size: 1.85 },   
      { body: '#E86F51', spot: '', size: 1.5 },           
      { body: '#C8A2A8', spot: '#FFFFFF', size: 2.0 },   
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

    // Generate Sakura petals & fall leaves
    const petalColors = ['#FFB7C5', '#FFA6B9', '#FFD1DC', '#6E7D5F', '#8C9A7D'];
    petalsRef.current = Array.from({ length: 26 }, () => {
      return new Petal(
        Math.random() * width,
        Math.random() * height,
        petalColors[Math.floor(Math.random() * petalColors.length)]
      );
    });

    // Generate fireflies
    firefliesRef.current = Array.from({ length: 14 }, () => {
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

      const lastX = mouseRef.current.lastX;
      const lastY = mouseRef.current.lastY;
      const moveDist = Math.hypot(x - lastX, y - lastY);

      if (moveDist > 25) {
        ripplesRef.current.push({
          x,
          y,
          radius: 2,
          maxRadius: 75 + Math.random() * 40,
          strength: 0.95,
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

      foodsRef.current.push({
        x,
        y,
        size: 4.5 + Math.random() * 1.5,
        age: 0,
        isEaten: false,
      });

      ripplesRef.current.push({
        x,
        y,
        radius: 2,
        maxRadius: 65,
        strength: 0.95,
        speed: 1.4,
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleMouseClick);

    // Sunlight caustics web rendering (wavy sine-wave curves replace blocky straight-segment polygons)
    const drawCaustics = (cCtx: CanvasRenderingContext2D, time: number) => {
      cCtx.save();
      cCtx.strokeStyle = 'rgba(238, 235, 205, 0.055)';
      cCtx.lineWidth = 2.2;
      cCtx.globalCompositeOperation = 'screen';
      
      cCtx.shadowColor = 'rgba(238, 235, 205, 0.25)';
      cCtx.shadowBlur = 4;
      
      // Horizontal wavy lines
      for (let y = 0; y < height + 40; y += 45) {
        cCtx.beginPath();
        for (let x = 0; x < width + 40; x += 15) {
          const yOffset = Math.sin(x * 0.015 + time * 0.02) * 7 + Math.cos(x * 0.007 - time * 0.015) * 5;
          if (x === 0) cCtx.moveTo(x, y + yOffset);
          else cCtx.lineTo(x, y + yOffset);
        }
        cCtx.stroke();
      }
      
      // Vertical wavy lines
      for (let x = 0; x < width + 40; x += 45) {
        cCtx.beginPath();
        for (let y = 0; y < height + 40; y += 15) {
          const xOffset = Math.sin(y * 0.015 + time * 0.02) * 7 + Math.cos(y * 0.007 - time * 0.015) * 5;
          if (y === 0) cCtx.moveTo(x + xOffset, y);
          else cCtx.lineTo(x + xOffset, y);
        }
        cCtx.stroke();
      }
      cCtx.restore();
    };

    // Main animation loop
    const animate = () => {
      globalTime++;
      
      // 1. Water Background deep gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#535F44'); 
      grad.addColorStop(0.5, '#424D35'); 
      grad.addColorStop(1, '#343E2A'); 
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Pebbles (bottom layer)
      pebblesRef.current.forEach((stone) => {
        stone.draw(ctx, ripplesRef.current);
      });

      // 3. Draw Sunlight Caustics on the bottom bed
      drawCaustics(ctx, globalTime);

      // 4. Update and Draw Reeds
      reedsRef.current.forEach((reed) => {
        reed.update();
        reed.draw(ctx, ripplesRef.current);
      });

      // 5. Lily pad shadows on bottom
      lilyPadsRef.current.forEach((pad) => {
        pad.update();
        pad.drawShadow(ctx);
      });

      const mouse = mouseRef.current;

      // 6. Koi Fish shadows on bottom
      fishRef.current.forEach((fish) => {
        fish.drawShadow(ctx, ripplesRef.current);
      });

      // 7. Update and Draw Food Pellets
      foodsRef.current = foodsRef.current.filter((food) => {
        if (food.isEaten) return false;
        food.age++;
        const bob = Math.sin(food.age * 0.08) * 0.6;
        const ref = getWaterRefraction(food.x, food.y, ripplesRef.current);

        ctx.fillStyle = 'rgba(10, 15, 10, 0.35)';
        ctx.beginPath();
        ctx.arc(food.x + ref.rx + 3, food.y + ref.ry + 4, food.size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#8B5A2B';
        ctx.beginPath();
        ctx.arc(food.x + ref.rx, food.y + ref.ry + bob, food.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#CD853F';
        ctx.beginPath();
        ctx.arc(food.x + ref.rx - 1, food.y + ref.ry + bob - 1, food.size * 0.45, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // 8. Update and Draw Koi Fish
      fishRef.current.forEach((fish) => {
        fish.update(width, height, mouse.x, mouse.y, foodsRef.current, ripplesRef.current);
        fish.draw(ctx, ripplesRef.current);
      });

      // 9. Firefly reflections on water surface
      firefliesRef.current.forEach((firefly) => {
        firefly.drawReflection(ctx);
      });

      // 10. Update and Draw Lily Pads (surface layer)
      lilyPadsRef.current.forEach((pad) => {
        pad.draw(ctx);
      });

      // 11. Update and Draw Sakura Petals
      petalsRef.current = petalsRef.current.filter((petal) => {
        const keep = petal.update(width, height, mouse.x, mouse.y, ripplesRef.current);
        if (keep) petal.draw(ctx);
        return keep;
      });

      // 12. Update and Draw Water Ripples
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

      // 13. Update and Draw Bioluminescent Fireflies (air layer)
      firefliesRef.current.forEach((firefly) => {
        firefly.update(width, height, mouse.x, mouse.y);
        firefly.draw(ctx);
      });

      // 14. Sun glare sheer
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
