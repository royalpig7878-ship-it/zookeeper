import type Phaser from 'phaser';

/**
 * Development only: lay pictures out on a grid, magnified, so they can be inspected one by one.
 * In the browser console of a dev build: `__sheet('player_dig_')` shows every texture whose name starts with that,
 * `__sheet()` removes it. Never part of a production build.
 */
export function showSheet(game: Phaser.Game, prefix?: string, scale = 4, columns = 12) {
  document.getElementById('dev-sheet')?.remove();
  if (!prefix) return 0;
  // a prefix like 'player_dig_', or a pattern between slashes like '/^player_[a-z]+_down_/'
  const match: (k: string) => boolean = prefix.startsWith('/') ? ((re) => (k: string) => re.test(k))(new RegExp(prefix.slice(1, prefix.lastIndexOf('/')))) : (k) => k.startsWith(prefix);
  const keys = game.textures.getTextureKeys().filter(match).sort();
  if (keys.length === 0) return 0;
  const imgs = keys.map((k) => game.textures.get(k).getSourceImage() as HTMLCanvasElement | HTMLImageElement);
  const cw = Math.max(...imgs.map((i) => i.width)) * scale + 8;
  const ch = Math.max(...imgs.map((i) => i.height)) * scale + 18;
  const cols = Math.min(columns, keys.length);
  const rows = Math.ceil(keys.length / cols);
  const cv = document.createElement('canvas');
  cv.id = 'dev-sheet';
  cv.width = cols * cw;
  cv.height = rows * ch;
  cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#35402f;image-rendering:pixelated';
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.font = '10px sans-serif';
  c.fillStyle = '#fff';
  keys.forEach((k, i) => {
    const x = (i % cols) * cw + 4;
    const y = Math.floor(i / cols) * ch + 2;
    c.drawImage(imgs[i], x, y + 12, imgs[i].width * scale, imgs[i].height * scale);
    c.fillText(k.replace('player_', '').replace(prefix.startsWith('/') ? '' : prefix, ''), x, y + 9);
  });
  document.body.appendChild(cv);
  return keys.length;
}
