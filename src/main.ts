import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { StaffRoomScene } from './scenes/StaffRoomScene';
import { UIScene } from './scenes/UIScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1c2b1c',
  pixelArt: true, // nearest-neighbour scaling, no blur
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, GameScene, StaffRoomScene, UIScene],
});
