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

export default function HomesteadBackground() {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGLRenderingContext, program: WebGLProgram, texture: WebGLTexture, locs: any } | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

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

    const resize = () => {
      glCanvas.width = window.innerWidth;
      glCanvas.height = window.innerHeight;
      
      if (glRef.current) {
        glRef.current.gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      mouseRef.current.tx = e.clientX;
      mouseRef.current.ty = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    const animate = () => {
      const t = (performance.now() - startTime) / 1000;
      const width = glCanvas.width;
      const height = glCanvas.height;

      mouseRef.current.x += (mouseRef.current.tx - mouseRef.current.x) * 0.1;
      mouseRef.current.y += (mouseRef.current.ty - mouseRef.current.y) * 0.1;

      if (glRef.current) {
        const { gl, program, locs } = glRef.current;
        gl.useProgram(program);
        gl.uniform1f(locs.uTime, t);
        gl.uniform2f(locs.uResolution, width, height);
        gl.uniform2f(locs.uMouse, mouseRef.current.x, mouseRef.current.y);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
    </div>
  );
}
