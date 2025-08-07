import { isLandscape } from '../../utils.js';

export class MenuText {
    constructor(scene, x, y, text, fontSize, options = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.text = text;
        this.fontSize = fontSize;
        this.options = {
            interactive: false,
            onClick: null,
            depth: 254,
            wordWrap: null,
            align: 'center',
            ...options
        };
        
        this.createText();
    }

    createText() {
        const textStyle = {
            font: `bold ${this.fontSize}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 2,
            alpha: 0.9,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        };

        // Add link styling if specified
        if (this.options.isLink) {
            textStyle.fill = '#00BFFF'; // Bright blue for links
            textStyle.stroke = '#0066CC';
            textStyle.strokeThickness = 1;
            textStyle.underline = true; // Add underline
            textStyle.underlineColor = '#00BFFF';
            textStyle.underlineThickness = 2;
        }

        // Add wordWrap if specified
        if (this.options.wordWrap) {
            textStyle.wordWrap = this.options.wordWrap;
            textStyle.align = this.options.align;
        }

        this.textElement = this.scene.add.text(this.x, this.y, this.text, textStyle).setOrigin(0.5);
        this.textElement.setDepth(this.options.depth);

        // Make interactive if specified
        if (this.options.interactive) {
            this.textElement.setInteractive();
            
            // Set clickable size for better touch targets
            const isLandscapeMode = isLandscape();
            this.textElement.setSize(
                this.textElement.width + (isLandscapeMode ? 40 : 20), 
                this.textElement.height + (isLandscapeMode ? 20 : 10)
            );
            
            if (this.options.onClick && typeof this.options.onClick === 'function') {
                this.textElement.on('pointerdown', this.options.onClick);
            }
        }
    }

    setText(text) {
        this.textElement.setText(text);
    }

    destroy() {
        if (this.textElement) {
            this.textElement.destroy();
        }
    }
} 