import { MenuText } from './menuElements/menuText.js';
import { isLandscape } from '../utils/utils.js';

export class PleaseWaitScreen {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.background = null;
        this.textElement = null;
    }

    show() {
        if (this.isVisible) {
            return;
        }

        this.isVisible = true;

        // Create black transparent background that covers the entire screen
        this.background = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.scene.screenWidth, 
            this.scene.screenHeight, 
            0x000000, 
            0.7
        );
        this.background.setDepth(300); // Higher depth than menus to be on top
        this.background.setInteractive();
        
        // Block all interactions - do nothing on click
        this.background.on('pointerdown', () => {
            // Intentionally empty - blocks all interactions
        });

        // Create "Please wait" text in the center
        const isLandscapeMode = isLandscape();
        const fontSize = isLandscapeMode
            ? Math.max(48, this.scene.screenWidth / 25)
            : Math.max(40, this.scene.screenWidth / 18);

        this.textElement = new MenuText(
            this.scene,
            this.scene.centerX,
            this.scene.centerY,
            "Please wait...",
            fontSize,
            { depth: 301 }
        );
    }

    hide() {
        if (!this.isVisible) {
            return;
        }

        this.isVisible = false;

        if (this.background) {
            this.background.destroy();
            this.background = null;
        }

        if (this.textElement) {
            this.textElement.destroy();
            this.textElement = null;
        }
    }

    isOpen() {
        return this.isVisible;
    }
}

