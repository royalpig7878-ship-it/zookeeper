import Phaser from 'phaser';
import { generateAllTextures } from '../art/pixelArt';

/** Draws all pixel art into textures, then opens the main menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create() {
    generateAllTextures(this);
    this.scene.start('Menu');
  }
}
