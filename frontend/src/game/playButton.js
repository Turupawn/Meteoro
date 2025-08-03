import { commitGame } from '../main.js';
import { isLandscape } from '../utils.js';

export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Check if fonts are already ready
        if (window.fontsReady) {
            this.createPlayButtonTexture();
        } else {
            // Wait for fonts to be ready
            window.onFontsReady = () => {
                this.createPlayButtonTexture();
            };
        }
    }

    createPlayButtonTexture() {
        const isLandscapeMode = isLandscape();
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        const x = this.scene.centerX;
        const y = isLandscapeMode ? this.scene.screenHeight * 0.85 : this.scene.screenHeight * 0.75;
        
        // Much bigger font and button on mobile
        const fontSize = isMobile ? Math.max(72, this.scene.screenWidth / 10) : Math.max(48, this.scene.screenWidth / 15);
        
        const playButtonText = "PLAY";
        const playButtonWidth = isMobile ? Math.max(800, playButtonText.length * 60) : Math.max(600, playButtonText.length * 40);
        const playButtonHeight = isMobile ? 200 : 150;
        
        this.buttonBg = this.scene.add.rectangle(
            x,
            y,
            playButtonWidth,
            playButtonHeight,
            0x0066CC,
            0.4
        );
        this.buttonBg.setStrokeStyle(3, 0x00FFFF);
        this.buttonBg.setDepth(199);
        
        this.button = this.scene.add.text(x, y, "PLAY", {
            font: `bold ${fontSize}px Orbitron`,
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

        this.button.setDepth(200);
        
        // Bigger hit area on mobile
        const hitAreaWidth = isMobile ? this.button.width + 300 : this.button.width + 200;
        const hitAreaHeight = isMobile ? this.button.height + 150 : this.button.height + 100;
        this.button.setSize(hitAreaWidth, hitAreaHeight);

        this.button.on('pointerdown', () => {
            if (this.scene.cardDisplay && this.scene.cardDisplay.currentGameText) {
                this.scene.cardDisplay.currentGameText.setText(`Please wait...`);
            }
            
            if (this.scene.background && this.scene.background.startBoostAnimation) {
                this.scene.background.startBoostAnimation();
            }
            
            commitGame();
        });
    }
}