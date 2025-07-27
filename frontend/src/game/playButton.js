export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Simple play button - just text
        this.button = this.scene.add.text(400, 300, "PLAY", {
            font: "20px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        // Simple click handler
        this.button.on('pointerdown', () => {
            if (this.scene.cardDisplay && this.scene.cardDisplay.currentGameText) {
                this.scene.cardDisplay.currentGameText.setText(`Please wait...`);
            }
            if (window.commit) {
                window.commit();
            }
        });
    }
}