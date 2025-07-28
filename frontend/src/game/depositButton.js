export class DepositButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Responsive deposit button - positioned in top right
        const x = this.scene.screenWidth - 20;
        const y = 60;
        const fontSize = Math.max(12, this.scene.screenWidth / 60); // Responsive font size
        
        this.button = this.scene.add.text(x, y, "DEPOSIT", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(1, 0).setInteractive();

        // Make button area larger for mobile touch
        this.button.setSize(this.button.width + 20, this.button.height + 10);

        // Simple click handler
        this.button.on('pointerdown', () => {
            this.showDepositModal();
        });
    }

    showDepositModal() {
        // Responsive modal - positioned at top center
        const modalBg = this.scene.add.rectangle(this.scene.centerX, this.scene.centerY, this.scene.screenWidth, this.scene.screenHeight, 0x000000, 0.5);
        const modalWidth = Math.min(400, this.scene.screenWidth * 0.8);
        const modalHeight = Math.min(300, this.scene.screenHeight * 0.5);
        const modalY = this.scene.screenHeight * 0.2; // Position at 20% from top
        const modal = this.scene.add.rectangle(this.scene.centerX, modalY, modalWidth, modalHeight, 0xffffff);
        
        const wallet = window.getLocalWallet();
        const fontSize = Math.max(12, this.scene.screenWidth / 60);
        const addressText = this.scene.add.text(this.scene.centerX, modalY - 50, wallet ? wallet.address : 'No wallet', {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5);

        const copyButton = this.scene.add.text(this.scene.centerX, modalY, "COPY", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        const closeButton = this.scene.add.text(this.scene.centerX, modalY + 50, "CLOSE", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        // Make buttons larger for mobile touch
        copyButton.setSize(copyButton.width + 20, copyButton.height + 10);
        closeButton.setSize(closeButton.width + 20, closeButton.height + 10);

        copyButton.on('pointerdown', () => {
            if (wallet) {
                // Visual feedback
                copyButton.setText("COPIED!");
                copyButton.setFill("#00FF00");
                
                // Try modern clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(wallet.address)
                        .then(() => {
                            console.log("Address copied to clipboard");
                        })
                        .catch(err => {
                            console.error("Failed to copy to clipboard:", err);
                            this.fallbackCopy(wallet.address);
                        });
                } else {
                    // Fallback for older browsers or mobile
                    this.fallbackCopy(wallet.address);
                }
                
                // Reset button after 2 seconds
                setTimeout(() => {
                    copyButton.setText("COPY");
                    copyButton.setFill("#FF0000");
                }, 2000);
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

    fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            console.log("Address copied to clipboard (fallback)");
        } catch (err) {
            console.error("Failed to copy to clipboard (fallback):", err);
        }

        document.body.removeChild(textArea);
    }
}