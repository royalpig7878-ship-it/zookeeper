import Phaser from 'phaser';

export const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';

export const COLORS = {
  panel: 0x2d3b2a,
  panelEdge: 0xf4ecd0,
  button: 0x4b8f5a,
  buttonHover: 0x5fae70,
  buttonDisabled: 0x55605a,
  text: '#f4ecd0',
};

export interface ButtonHandle {
  container: Phaser.GameObjects.Container;
  setLabel(text: string): void;
  setEnabled(enabled: boolean): void;
}

/** A large, touch-friendly rounded button. */
export function makeButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string,
  onClick: () => void, opts: { fontSize?: number; color?: number } = {},
): ButtonHandle {
  const color = opts.color ?? COLORS.button;
  const bg = scene.add.graphics();
  const text = scene.add.text(0, 0, label, {
    fontFamily: FONT, fontSize: `${opts.fontSize ?? 22}px`, fontStyle: 'bold', color: COLORS.text, align: 'center',
    resolution: 2, wordWrap: { width: w - 12 },
  }).setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  container.setSize(w, h);
  let enabled = true;
  const draw = (pressed: boolean) => {
    bg.clear();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
    bg.fillStyle(enabled ? (pressed ? COLORS.buttonHover : color) : COLORS.buttonDisabled, 1).fillRoundedRect(-w / 2, -h / 2 + (pressed ? 3 : 0), w, h, 12);
    bg.lineStyle(3, COLORS.panelEdge, enabled ? 0.9 : 0.35).strokeRoundedRect(-w / 2, -h / 2 + (pressed ? 3 : 0), w, h, 12);
    text.setY(pressed ? 3 : 0).setAlpha(enabled ? 1 : 0.55);
  };
  draw(false);
  container.setInteractive({ useHandCursor: true });
  container.on('pointerdown', () => enabled && draw(true));
  container.on('pointerout', () => draw(false));
  container.on('pointerup', () => {
    if (!enabled) return;
    draw(false);
    onClick();
  });
  return {
    container,
    setLabel: (t) => text.setText(t),
    setEnabled: (e) => {
      enabled = e;
      draw(false);
    },
  };
}

export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.clear();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, 14);
  g.fillStyle(COLORS.panel, 0.96).fillRoundedRect(x, y, w, h, 14);
  g.lineStyle(3, COLORS.panelEdge, 1).strokeRoundedRect(x, y, w, h, 14);
}
