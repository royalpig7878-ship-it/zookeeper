import Phaser from 'phaser';
import { AudioEngine } from './audio/engine';
import { settings } from './core/settingsInstance';
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
  const box = document.getElementById('game')?.getBoundingClientRect();
  const width = Math.round(box?.width || window.innerWidth);
  const height = Math.round(box?.height || window.innerHeight);
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
  keepFitted(game);
  const audio = new AudioEngine(game.events, settings);
  audio.start(); // sound begins after the first touch or key press
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>;
    w.__game = game; // for testing in the browser
    w.__settings = settings;
    w.__audio = audio;
  }
}

/**
 * Keep the game exactly the size of the visible screen. Phones change the visible size after the page has
 * loaded (full-screen mode hides the bars, turning the phone swaps width and height), and the browser's
 * own resize signal can arrive early or not at all, so we re-measure a few times after each change.
 */
function keepFitted(game: Phaser.Game) {
  const gameBox = document.getElementById('game');
  const fit = () => {
    // iPhones report the size late and sometimes wrongly just after a turn, so take the largest of the
    // honest readings (never more than the screen itself) and give the game area exactly that size.
    if (gameBox) {
      gameBox.style.width = ''; // let the page decide first (it fills the screen), so an old size can never stick
      gameBox.style.height = '';
    }
    const limitW = Math.max(screen.width, screen.height);
    const readings = [window.innerHeight, document.documentElement.clientHeight, gameBox?.getBoundingClientRect().height ?? 0, window.visualViewport?.height ?? 0];
    const widths = [window.innerWidth, document.documentElement.clientWidth, gameBox?.getBoundingClientRect().width ?? 0, window.visualViewport?.width ?? 0];
    const h = Math.max(2, Math.round(Math.min(Math.max(...readings), limitW)));
    const w = Math.max(2, Math.round(Math.min(Math.max(...widths), limitW)));
    if (gameBox) {
      gameBox.style.width = `${w}px`;
      gameBox.style.height = `${h}px`;
    }
    if (Math.round(game.scale.width) !== w || Math.round(game.scale.height) !== h) game.scale.resize(w, h);
  };
  const soon = () => {
    fit();
    for (const ms of [100, 250, 500, 1000, 1600, 2500, 4000]) window.setTimeout(fit, ms);
  };
  window.addEventListener('resize', soon);
  window.addEventListener('orientationchange', soon);
  window.addEventListener('pageshow', soon);
  window.visualViewport?.addEventListener('resize', soon);
  window.setTimeout(soon, 300);
}

start();
