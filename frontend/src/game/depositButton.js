export class DepositButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Simple deposit button - just text
        this.button = this.scene.add.text(750, 50, "DEPOSIT", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(1, 0).setInteractive();

        // Simple click handler
        this.button.on('pointerdown', () => {
            this.showDepositModal();
        });
    }

    showDepositModal() {
        // Simple modal - just text
        const modalBg = this.scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.5);
        const modal = this.scene.add.rectangle(400, 300, 400, 300, 0xffffff);
        
        const wallet = window.getLocalWallet();
        const addressText = this.scene.add.text(400, 250, wallet ? wallet.address : 'No wallet', {
            font: "12px Arial",
            fill: "#000000"
        }).setOrigin(0.5);

        const copyButton = this.scene.add.text(400, 300, "COPY", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        const closeButton = this.scene.add.text(400, 350, "CLOSE", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        copyButton.on('pointerdown', () => {
            if (wallet) {
                navigator.clipboard.writeText(wallet.address);
            }
        });

        const closeClickHandler = () => {
            modalBg.destroy();
            modal.destroy();
            addressText.destroy();
            copyButton.destroy();
            closeButton.destroy();
        };

        closeButton.on('pointerdown', closeClickHandler);
    }
}