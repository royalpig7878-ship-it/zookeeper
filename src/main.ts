import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { StaffRoomScene } from './scenes/StaffRoomScene';
import { UIScene } from './scenes/UIScene';

/** True if this browser can use WebGL (the fast renderer). Otherwise we fall back to plain canvas drawing. */
function webglWorks(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Start the game only once the page has a real size. Starting while the window is still 0 by 0
 * (a background tab, a slow phone) makes the graphics set-up fail and leaves a blank green screen.
 */
function start(tries = 0) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if ((width < 2 || height < 2) && tries < 600) {
    requestAnimationFrame(() => start(tries + 1));
    return;
  }
  const game = new Phaser.Game({
    type: webglWorks() ? Phaser.AUTO : Phaser.CANVAS,
    parent: 'game',
    backgroundColor: '#1c2b1c',
    pixelArt: true, // nearest-neighbour scaling, no blur
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: Math.max(2, width),
      height: Math.max(2, height),
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    input: { activePointers: 3 },
    scene: [BootScene, MenuScene, GameScene, StaffRoomScene, UIScene],
  });
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = game; // for testing in the browser
}

start();
