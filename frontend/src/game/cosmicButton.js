import { isLandscape } from '../utils.js';

export class CosmicButton {
    constructor(scene) {
        this.scene = scene;
        this.create();
    }

    create() {
        const isLandscapeMode = isLandscape();
        const iconSize = isLandscapeMode ? 80 : 70;
        
        // Position relative to bottom of screen, to the left of social buttons
        const bottomMargin = isLandscapeMode ? 50 : 300;
        const rightMargin = isLandscapeMode ? 50 : 45;
        const spacing = isLandscapeMode ? 100 : 90;
        
        // Position to the left of social buttons (Telegram is at screenWidth - rightMargin - spacing)
        // Place cosmic button to the left of Telegram icon
        const buttonX = this.scene.screenWidth - rightMargin - spacing - spacing;
        const buttonY = this.scene.screenHeight - bottomMargin;

        const button = this.scene.add.text(buttonX, buttonY, '👁️', {
            fontSize: isLandscapeMode ? '32px' : '28px',
            fill: '#ffffff',
            backgroundColor: '#4A148C',
            padding: { x: 15, y: 10 },
            borderRadius: 10
        })
        .setOrigin(1, 1) // Align to bottom-right like social icons
        .setInteractive()
        .setDepth(50) // Same depth as social icons
        .on('pointerdown', () => {
            // Launch cosmic scene without pausing the main scene
            this.scene.scene.launch('CosmicScene');
        })
        .on('pointerover', () => {
            button.setStyle({ backgroundColor: '#6A1B9A' });
        })
        .on('pointerout', () => {
            button.setStyle({ backgroundColor: '#4A148C' });
        });

        // Add tooltip positioned above the button
        const tooltip = this.scene.add.text(buttonX, buttonY - 40, 'Test Cosmic Animation', {
            fontSize: '12px',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 2 }
        })
        .setOrigin(1, 1)
        .setAlpha(0)
        .setDepth(51); // Above the button

        button.on('pointerover', () => {
            tooltip.setAlpha(1);
        });

        button.on('pointerout', () => {
            tooltip.setAlpha(0);
        });

        // Store references for cleanup
        this.button = button;
        this.tooltip = tooltip;
    }

    destroy() {
        if (this.button) {
            this.button.destroy();
        }
        if (this.tooltip) {
            this.tooltip.destroy();
        }
    }
}