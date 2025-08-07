import { isLandscape } from '../../utils.js';

export class MenuButton {
    constructor(scene, x, y, text, fontSize, onClick) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSize = fontSize;
        this.onClick = onClick;
        
        this.createButton();
    }

    createButton() {
        const isLandscapeMode = isLandscape();
        const buttonWidth = isLandscapeMode
            ? Math.max(500, this.text.length * 30)
            : Math.max(600, this.text.length * 35);
        const buttonHeight = isLandscapeMode ? 80 : 100;
        
        this.buttonBg = this.scene.add.rectangle(
            this.x,
            this.y,
            buttonWidth,
            buttonHeight,
            0x0066CC,
            0.4
        );
        this.buttonBg.setStrokeStyle(3, 0x00FFFF);
        this.buttonBg.setDepth(255);
        
        this.buttonBg.setInteractive();
        
        this.button = this.scene.add.text(this.x, this.y, this.text, {
            font: `bold ${this.fontSize}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 3,
            alpha: 0.95,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#003366',
                blur: 6,
                fill: true
            }
        }).setOrigin(0.5).setInteractive();

        this.button.setDepth(256);
        
        // Make both background and text clickable
        if (this.onClick && typeof this.onClick === 'function') {
            this.buttonBg.on('pointerdown', this.onClick);
            this.button.on('pointerdown', this.onClick);
        }
    }

    destroy() {
        if (this.buttonBg) {
            this.buttonBg.destroy();
        }
        if (this.button) {
            this.button.destroy();
        }
    }
} 