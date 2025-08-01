export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Responsive play button - positioned in bottom center
        const x = this.scene.centerX;
        const y = this.scene.screenHeight * 0.85; // 85% down the screen
        const fontSize = Math.max(36, this.scene.screenWidth / 20); // Much larger font for prominence
        
        // Calculate button width based on text
        const playButtonText = "PLAY";
        const playButtonWidth = Math.max(400, playButtonText.length * 25); // Much wider for prominence
        
        // Create button background - much bigger and more prominent
        this.buttonBg = this.scene.add.rectangle(
            x,
            y,
            playButtonWidth, // Dynamic width based on text
            100,  // Much taller for prominence
            0x0066CC, // Blue background
            0.4 // More opaque for prominence
        );
        this.buttonBg.setStrokeStyle(3, 0x00FFFF); // Thicker cyan border for prominence
        this.buttonBg.setDepth(199); // Just below the text
        
        this.button = this.scene.add.text(x, y, "PLAY", {
            font: `bold ${fontSize}px Orbitron`, // Changed to Orbitron and bold for prominence
            fill: '#E0F6FF', // Same as balance text
            stroke: '#0066CC', // Same as balance text
            strokeThickness: 3,
            alpha: 0.95, // More opaque for prominence
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#003366',
                blur: 6,
                fill: true
            }
        }).setOrigin(0.5).setInteractive();

        // Set high depth to ensure it's on top
        this.button.setDepth(200);

        // Make button area much larger for mobile touch and prominence
        this.button.setSize(this.button.width + 160, this.button.height + 80); // Much larger click area

        // Simple click handler
        this.button.on('pointerdown', () => {
            if (this.scene.cardDisplay && this.scene.cardDisplay.currentGameText) {
                this.scene.cardDisplay.currentGameText.setText(`Please wait...`);
            }
            
            // Start boost animation when play button is pressed
            if (this.scene.background && this.scene.background.startBoostAnimation) {
                this.scene.background.startBoostAnimation();
            }
            
            window.commitGame();
        });
    }
}