import * as THREE from 'three';

/**
 * Generates a high-resolution procedural Crema Marfil polished marble tile texture
 * with subtle warm veining and hairline brass grout inlays. Zero external 404 assets.
 */
export function createMarbleFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Warm silk ivory base matching #FFF8EF / #FFE4C7
  ctx.fillStyle = '#F5E8D8';
  ctx.fillRect(0, 0, size, size);

  // Soft marble clouds
  for (let i = 0; i < 42; i++) {
    const x = ((i * 97) % size);
    const y = ((i * 151) % size);
    const r = 45 + (i % 5) * 28;
    const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
    grad.addColorStop(0, i % 2 === 0 ? 'rgba(255, 248, 239, 0.55)' : 'rgba(221, 193, 160, 0.24)');
    grad.addColorStop(1, 'rgba(245, 232, 216, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // Subtle gold/amber mineral veins
  ctx.strokeStyle = 'rgba(184, 146, 102, 0.24)';
  ctx.lineWidth = 1.4;
  for (let v = 0; v < 9; v++) {
    ctx.beginPath();
    let vx = (v * 63) % size;
    let vy = 0;
    ctx.moveTo(vx, vy);
    for (let step = 1; step <= 8; step++) {
      vx += Math.sin(step * 1.3 + v) * 24;
      vy = (step / 8) * size;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  // Tile grout lines (2x2 slabs per repeat)
  ctx.strokeStyle = 'rgba(196, 152, 92, 0.38)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 9);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Generates fluted deep obsidian (#1F1D2B) wall paneling with vertical brushed brass slats.
 */
export function createFlutedWallTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1F1D2B';
  ctx.fillRect(0, 0, w, h);

  const slatCount = 16;
  const slatW = w / slatCount;
  for (let i = 0; i < slatCount; i++) {
    const x = i * slatW;
    const grad = ctx.createLinearGradient(x, 0, x + slatW, 0);
    grad.addColorStop(0, '#161420');
    grad.addColorStop(0.25, '#272436');
    grad.addColorStop(0.5, '#342F46');
    grad.addColorStop(0.82, '#1A1826');
    grad.addColorStop(0.92, '#B67A36'); // subtle brass edge accent
    grad.addColorStop(1, '#14121C');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, slatW, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Generates crisp illuminated luxury boutique signage textures (Zero external fonts/images).
 */
export function createSignageTexture(
  title: string,
  subtitle = '3D JUMMO LUXURY ATELIER',
  accentHex = '#FF7A00'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian backing
  ctx.fillStyle = '#1F1D2B';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle brass frame border
  ctx.strokeStyle = '#FFA94D';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

  // Decorative accent rule
  ctx.fillStyle = accentHex;
  ctx.fillRect(canvas.width / 2 - 90, 44, 180, 4);

  // Primary luxury typography
  ctx.fillStyle = '#FFF8EF';
  ctx.font = '700 72px Poppins, Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, canvas.width / 2, 124);

  // Subtitle
  ctx.fillStyle = '#FFA94D';
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillText(subtitle, canvas.width / 2, 194);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
