import { applyPerspectiveToQuadImageToDown, isLandscape } from '../../utils/utils.js';

export class OpenMenuButton {
    constructor(scene, onToggle) {
        this.scene = scene;
        this.onToggle = onToggle;
        this.createMenuButton();
    }

    createMenuButton() {
        // Check if fonts are already ready
        if (window.fontsReady) {
            this.createMenuButtonTexture();
        } else {
            // Wait for fonts to be ready
            window.onFontsReady = () => {
                this.createMenuButtonTexture();
            };
        }
    }

    createMenuButtonTexture() {
        this.menuRenderTexture = this.scene.add.renderTexture(0, 0, 400, 400);
        
        const menuText = this.scene.add.text(0, 0, "MENU", {
            font: 'bold 120px Orbitron',
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
        });

        this.menuRenderTexture.draw(menuText);
        menuText.destroy();

        this.menuRenderTexture.saveTexture('menuButtonTexture');

        const x = this.scene.centerX;
        const y = 120;
        
        const isLandscapeMode = isLandscape();
        const menuButtonText = "MENU";
        const menuButtonWidth = isLandscapeMode
            ? Math.max(300, menuButtonText.length * 20)
            : Math.max(250, menuButtonText.length * 18);
        
        this.menuButtonBg = this.scene.add.rectangle(
            x,
            y - (isLandscapeMode ? 70 : 60),
            menuButtonWidth,
            isLandscapeMode ? 80 : 70,
            0x0066CC,
            0.3
        );
        this.menuButtonBg.setStrokeStyle(2, 0x00FFFF);
        this.menuButtonBg.setDepth(99);
        
        // Make the background clickable
        this.menuButtonBg.setInteractive();
        
        this.menuButton = this.scene.add.rexQuadImage({
            x: x,
            y: y,
            texture: 'menuButtonTexture',
            ninePointMode: true,
        });
        
        this.menuButton.setVisible(true);
        this.menuButton.setAlpha(0.85);
        this.menuButton.setInteractive();
        this.menuButton.setDepth(100);
        this.menuButton.setScale(isLandscapeMode ? 0.60 : 0.50, isLandscapeMode ? 0.60 : 0.50);
        
        let perspectiveX = this.menuButton.topCenter.x + 0;
        let perspectiveY = this.menuButton.topCenter.y + 60;
        
        applyPerspectiveToQuadImageToDown(this.menuButton, perspectiveX, perspectiveY);
        
        this.menuButton.setSize(isLandscapeMode ? 300 : 250, isLandscapeMode ? 120 : 100);
        
        // Add click handler to both background and text/image
        const clickHandler = () => {
            if (this.onToggle && typeof this.onToggle === 'function') {
                this.onToggle();
            }
        };
        
        this.menuButtonBg.on('pointerdown', clickHandler);
        this.menuButton.on('pointerdown', clickHandler);

        this.menuButton.setTexture('menuButtonTexture');
    }

    destroy() {
        if (this.menuButtonBg) {
            this.menuButtonBg.destroy();
        }
        if (this.menuButton) {
            this.menuButton.destroy();
        }
        if (this.menuRenderTexture) {
            this.menuRenderTexture.destroy();
        }
    }
}