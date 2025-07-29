export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Responsive play button - positioned in center
        const x = this.scene.centerX;
        const y = this.scene.centerY;
        const fontSize = Math.max(18, this.scene.screenWidth / 40); // Responsive font size
        
        this.button = this.scene.add.text(x, y, "PLAY", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        // Make button area larger for mobile touch
        this.button.setSize(this.button.width + 40, this.button.height + 20);

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