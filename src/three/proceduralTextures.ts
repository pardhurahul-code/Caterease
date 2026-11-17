import * as THREE from 'three';

export interface RendererCapabilitiesProfile {
  isSoftwareGl: boolean;
  maxAnisotropy: number;
}

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return true;
  let gpu = String(gl.getParameter(gl.RENDERER) || '');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) {
    const unmasked = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    if (unmasked) gpu += ` ${String(unmasked)}`;
  }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export function probeRendererCapabilities(renderer: THREE.WebGLRenderer): RendererCapabilitiesProfile {
  const gl = renderer.getContext();
  let rendererStr = String(gl.getParameter(gl.RENDERER) || '');
  const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugExt) {
    const unmasked = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL);
    if (unmasked) rendererStr += ` ${String(unmasked)}`;
  }
  const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);

  return {
    isSoftwareGl,
    maxAnisotropy: Math.min(isSoftwareGl ? 2 : 8, renderer.capabilities.getMaxAnisotropy()),
  };
}

export function createMarbleFloorTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ece6db';
  ctx.fillRect(0, 0, 512, 512);

  // Checker warm travertine / marble tone shift
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#efe9df' : '#e5ddd0';
      ctx.fillRect(tx * 256, ty * 256, 256, 256);
    }
  }

  // Subtle organic stone veins
  ctx.strokeStyle = 'rgba(155, 138, 114, 0.20)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    let x = ((i * 73) % 512);
    let y = ((i * 137) % 512);
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += Math.sin(i + s * 1.4) * 52 + 24;
      y += Math.cos(i * 0.7 + s) * 44 + 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Grout lines + warm brass corner inlay dot
  ctx.strokeStyle = 'rgba(120, 108, 92, 0.28)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 509, 509);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  ctx.fillStyle = '#b9893d';
  ctx.fillRect(251, 251, 10, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createDamaskClothTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8f4ec';
  ctx.fillRect(0, 0, 256, 256);

  // Fine linen weave
  ctx.strokeStyle = 'rgba(190, 178, 158, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 256; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Subtle woven diamond motifs
  ctx.strokeStyle = 'rgba(180, 152, 104, 0.14)';
  ctx.lineWidth = 1.2;
  for (let y = 16; y < 256; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 10, y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWalnutWoodTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4a2e1d';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 3) {
    const shade = 52 + Math.sin(y * 0.18) * 14 + Math.cos(y * 0.45) * 6;
    ctx.fillStyle = `rgb(${Math.round(shade * 1.4)}, ${Math.round(shade * 0.85)}, ${Math.round(shade * 0.52)})`;
    ctx.fillRect(0, y, 256, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(20, 14, 8, 0.48)');
  grad.addColorStop(0.55, 'rgba(20, 14, 8, 0.18)');
  grad.addColorStop(1, 'rgba(20, 14, 8, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function createSteamParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255, 250, 240, 0.72)');
  grad.addColorStop(0.5, 'rgba(255, 246, 232, 0.25)');
  grad.addColorStop(1, 'rgba(255, 246, 232, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function disposeSceneResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh || obj instanceof THREE.Points) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        Object.values(m).forEach((val) => {
          if (val && typeof val === 'object' && 'isTexture' in val) {
            (val as THREE.Texture).dispose();
          }
        });
        m.dispose();
      }
    }
  });
}
