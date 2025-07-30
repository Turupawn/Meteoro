export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Responsive play button - positioned in bottom center
        const x = this.scene.centerX;
        const y = this.scene.screenHeight * 0.85; // 85% down the screen
        const fontSize = Math.max(28, this.scene.screenWidth / 25); // Much larger font
        
        this.button = this.scene.add.text(x, y, "PLAY", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5).setInteractive();

        // Set high depth to ensure it's on top
        this.button.setDepth(200);

        // Make button area much larger for mobile touch
        this.button.setSize(this.button.width + 120, this.button.height + 60);

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