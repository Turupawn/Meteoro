export class DepositButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
        this.modalElements = [];
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
            // Close any other open modals first
            this.scene.closeAllModals();
            this.showDepositModal();
        });
    }

    showDepositModal() {
        // Responsive modal - positioned at top center
        const modalBg = this.scene.add.rectangle(this.scene.centerX, this.scene.centerY, this.scene.screenWidth, this.scene.screenHeight, 0x000000, 0.5);
        const modalWidth = Math.min(400, this.scene.screenWidth * 0.8);
        const modalHeight = Math.min(350, this.scene.screenHeight * 0.6); // Increased height for faucet link
        const modalY = this.scene.screenHeight * 0.2; // Position at 20% from top
        const modal = this.scene.add.rectangle(this.scene.centerX, modalY, modalWidth, modalHeight, 0xffffff);
        
        const wallet = window.getLocalWallet();
        const fontSize = Math.max(12, this.scene.screenWidth / 60);
        
        // Title text
        const titleText = this.scene.add.text(this.scene.centerX, modalY - 80, "DEPOSIT ADDRESS", {
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
        addressInput.style.top = `${modalY - 40}px`;
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
        const instructionText = this.scene.add.text(this.scene.centerX, modalY + 10, "Long press to copy address", {
            font: `${fontSize - 2}px Arial`,
            fill: "#666666"
        }).setOrigin(0.5);

        // Faucet link
        const faucetText = this.scene.add.text(this.scene.centerX, modalY + 50, "Get test tokens from faucet:", {
            font: `${fontSize - 2}px Arial`,
            fill: "#666666"
        }).setOrigin(0.5);

        const faucetLink = this.scene.add.text(this.scene.centerX, modalY + 80, "https://testnet.megaeth.com/", {
            font: `${fontSize - 2}px Arial`,
            fill: "#0066CC"
        }).setOrigin(0.5).setInteractive();

        // Make faucet link clickable
        faucetLink.setSize(faucetLink.width + 20, faucetLink.height + 10);
        faucetLink.on('pointerdown', () => {
            window.open('https://testnet.megaeth.com/', '_blank');
        });

        const closeButton = this.scene.add.text(this.scene.centerX, modalY + 120, "CLOSE", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        // Make button larger for mobile touch
        closeButton.setSize(closeButton.width + 20, closeButton.height + 10);

        // Store all modal elements for cleanup
        this.modalElements = [modalBg, modal, titleText, instructionText, faucetText, faucetLink, closeButton, addressInput];

        // Add click outside to close functionality
        modalBg.setInteractive();
        modalBg.on('pointerdown', (pointer) => {
            // Only close if clicking on the background, not on modal content
            if (pointer.y < modalY - modalHeight/2 || pointer.y > modalY + modalHeight/2 || 
                pointer.x < this.scene.centerX - modalWidth/2 || pointer.x > this.scene.centerX + modalWidth/2) {
                this.closeModal();
            }
        });

        const closeClickHandler = () => {
            this.closeModal();
        };

        closeButton.on('pointerdown', closeClickHandler);
    }

    closeModal() {
        this.modalElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            } else if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.modalElements = [];
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