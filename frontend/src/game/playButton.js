import { commitGame } from '../main.js';

export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        const x = this.scene.centerX;
        const y = this.scene.screenHeight * 0.85;
        const fontSize = Math.max(36, this.scene.screenWidth / 20);
        
        const playButtonText = "PLAY";
        const playButtonWidth = Math.max(400, playButtonText.length * 25);
        
        this.buttonBg = this.scene.add.rectangle(
            x,
            y,
            playButtonWidth,
            100,
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
        
        this.button.setSize(this.button.width + 160, this.button.height + 80);

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