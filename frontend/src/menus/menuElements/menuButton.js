import { isLandscape } from '../../utils/utils.js';

export class MenuButton {
    constructor(scene, x, y, text, fontSize, onClick, options = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSize = fontSize;
        this.onClick = onClick;
        this.options = options;
        
        this.createButton();
    }

    createButton() {
        const isLandscapeMode = isLandscape();
        const buttonWidth = isLandscapeMode
            ? Math.max(700, this.text.length * 40)
            : Math.max(800, this.text.length * 50);
        const buttonHeight = isLandscapeMode ? 80 : 100;
        
        // Support custom colors via options
        const bgColor = this.options.bgColor || 0x0066CC;
        const strokeColor = this.options.strokeColor || 0x00FFFF;
        const textColor = this.options.color || '#E0F6FF';
        const textStrokeColor = this.options.textStroke || '#0066CC';
        
        this.buttonBg = this.scene.add.rectangle(
            this.x,
            this.y,
            buttonWidth,
            buttonHeight,
            bgColor,
            0.4
        );
        this.buttonBg.setStrokeStyle(3, strokeColor);
        this.buttonBg.setDepth(255);
        
        this.buttonBg.setInteractive();
        
        this.button = this.scene.add.text(this.x, this.y, this.text, {
            font: `bold ${this.fontSize}px Orbitron`,
            fill: textColor,
            stroke: textStrokeColor,
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