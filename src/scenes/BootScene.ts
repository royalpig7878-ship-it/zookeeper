import Phaser from 'phaser';
import { generateAnimationArt } from '../art/animationArt';
import { generateAllTextures } from '../art/pixelArt';

/** Draws all pixel art into textures, then opens the main menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    generateAllTextures(this);
    generateAnimationArt(this);
    this.scene.start('Menu');
  }
}
