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
        
        // Title text
        const titleText = this.scene.add.text(this.scene.centerX, modalY - 60, "DEPOSIT ADDRESS", {
            font: `${fontSize}px Arial`,
            fill: "#000000"
        }).setOrigin(0.5);

        // Create selectable text element for the address
        const addressInput = document.createElement('input');
        addressInput.type = 'text';
        addressInput.value = wallet ? wallet.address : 'No wallet';
        addressInput.readOnly = true;
        addressInput.style.position = 'absolute';
        addressInput.style.left = `${this.scene.centerX - 150}px`;
        addressInput.style.top = `${modalY - 20}px`;
        addressInput.style.width = '300px';
        addressInput.style.fontSize = `${fontSize}px`;
        addressInput.style.padding = '8px';
        addressInput.style.textAlign = 'center';
        addressInput.style.border = '1px solid #ccc';
        addressInput.style.backgroundColor = '#f0f0f0';
        addressInput.style.userSelect = 'text';
        addressInput.style.webkitUserSelect = 'text';
        document.body.appendChild(addressInput);

        // Instructions text
        const instructionText = this.scene.add.text(this.scene.centerX, modalY + 20, "Long press to copy address", {
            font: `${fontSize - 2}px Arial`,
            fill: "#666666"
        }).setOrigin(0.5);

        const closeButton = this.scene.add.text(this.scene.centerX, modalY + 60, "CLOSE", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        // Make button larger for mobile touch
        closeButton.setSize(closeButton.width + 20, closeButton.height + 10);

        const closeClickHandler = () => {
            modalBg.destroy();
            modal.destroy();
            titleText.destroy();
            instructionText.destroy();
            closeButton.destroy();
            if (addressInput.parentNode) {
                addressInput.parentNode.removeChild(addressInput);
            }
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