'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number; // 0 to 1 relative
  y: number; // 0 to 1 relative
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: 'fire' | 'steam' | 'dust';
  angle?: number;
  spin?: number;
}

export default function KitchenEffectsCanvas({ 
  prefersReducedMotion,
  mouseX,
  mouseY,
  isHovering
}: { 
  prefersReducedMotion: boolean,
  mouseX: number,
  mouseY: number,
  isHovering: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Emitters
    const emitFire = () => {
      particles.push({
        x: 0.58 + (Math.random() - 0.5) * 0.05, // Oven opening relative X
        y: 0.46 + Math.random() * 0.02, // Oven opening relative Y
        vx: (Math.random() - 0.5) * 0.0005,
        vy: -0.001 - Math.random() * 0.0015,
        life: 0,
        maxLife: 40 + Math.random() * 30,
        size: 3 + Math.random() * 8,
        type: 'fire'
      });
    };

    const emitSteam = () => {
      // Bread table
      particles.push({
        x: 0.45 + (Math.random()) * 0.3,
        y: 0.65 + (Math.random() - 0.5) * 0.05,
        vx: (Math.random() - 0.5) * 0.0005,
        vy: -0.0005 - Math.random() * 0.001,
        life: 0,
        maxLife: 100 + Math.random() * 100,
        size: 15 + Math.random() * 20,
        type: 'steam',
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.02
      });
    };

    const emitDust = () => {
      // Window area
      particles.push({
        x: 0.1 + Math.random() * 0.3,
        y: 0.2 + Math.random() * 0.4,
        vx: (Math.random() - 0.5) * 0.0002 + 0.0001, // Drift right
        vy: (Math.random() - 0.5) * 0.0002,
        life: 0,
        maxLife: 200 + Math.random() * 200,
        size: 0.5 + Math.random() * 1.5,
        type: 'dust'
      });
    };

    // Pre-fill dust
    for(let i=0; i<40; i++) {
       emitDust();
       particles[particles.length-1].life = Math.random() * particles[particles.length-1].maxLife;
    }

    const drawParticles = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Flashlight mask effect (drawn first using standard comp, then particles over it)
      // Actually we can do a dark overlay and 'destination-out' to punch a hole for the light
      // Let's draw the darkness
      ctx.fillStyle = 'rgba(15, 10, 5, 0.45)'; // Amber-tinted darkness
      ctx.fillRect(0, 0, w, h);

      // Punch hole where mouse is
      if (isHovering && mouseX >= 0 && mouseY >= 0) {
        ctx.globalCompositeOperation = 'destination-out';
        const grad = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 300);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.5)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 300, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      // Add a warm ambient glow near the oven opening unconditionally
      ctx.globalCompositeOperation = 'screen';
      const ovenX = w * 0.58;
      const ovenY = h * 0.46;
      const ovenGrad = ctx.createRadialGradient(ovenX, ovenY, 0, ovenX, ovenY, w * 0.15);
      ovenGrad.addColorStop(0, 'rgba(255, 120, 20, 0.3)');
      ovenGrad.addColorStop(1, 'rgba(255, 120, 20, 0)');
      ctx.fillStyle = ovenGrad;
      ctx.beginPath();
      ctx.arc(ovenX, ovenY, w * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Emit new
      if (Math.random() < 0.3) emitFire();
      if (Math.random() < 0.1) emitSteam();
      if (Math.random() < 0.05) emitDust();

      // Update & Draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        if (p.type === 'steam' && p.angle !== undefined && p.spin !== undefined) {
           p.angle += p.spin;
        }

        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const px = p.x * w;
        const py = p.y * h;
        const progress = p.life / p.maxLife;

        ctx.save();
        ctx.translate(px, py);

        if (p.type === 'fire') {
          const alpha = Math.max(0, 1 - progress) * 0.8;
          ctx.fillStyle = `rgba(255, ${Math.floor(150 - progress*150)}, 0, ${alpha})`;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (1 - progress*0.5), 0, Math.PI * 2);
          ctx.fill();
        } 
        else if (p.type === 'steam') {
          const alpha = Math.sin(progress * Math.PI) * 0.15; // fade in and out
          ctx.rotate(p.angle || 0);
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
          ctx.fillStyle = grad;
          ctx.scale(1, 0.6); // slight flatten
          ctx.beginPath();
          ctx.arc(0, 0, p.size + (progress * 20), 0, Math.PI * 2);
          ctx.fill();
        }
        else if (p.type === 'dust') {
          // Twinkling effect
          const alpha = Math.sin(progress * Math.PI) * (0.3 + Math.sin(p.life * 0.1)*0.2);
          ctx.fillStyle = `rgba(255, 230, 150, ${alpha})`;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      animId = requestAnimationFrame(drawParticles);
    };

    animId = requestAnimationFrame(drawParticles);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [prefersReducedMotion, mouseX, mouseY, isHovering]);

  if (prefersReducedMotion) return null;

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none mix-blend-hard-light"
      style={{ zIndex: 5 }}
    />
  );
}
