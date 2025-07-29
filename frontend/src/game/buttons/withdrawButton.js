export class WithdrawButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
        this.modalElements = [];
    }

    createButton() {
        // Responsive withdraw button - positioned in top right
        const x = this.scene.screenWidth - 20;
        const y = 100;
        const fontSize = Math.max(12, this.scene.screenWidth / 60); // Responsive font size
        
        this.button = this.scene.add.text(x, y, "WITHDRAW", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(1, 0).setInteractive();

        // Make button area larger for mobile touch
        this.button.setSize(this.button.width + 20, this.button.height + 10);

        // Simple click handler
        this.button.on('pointerdown', () => {
            // Close any other open modals first
            this.scene.closeAllModals();
            // Get balance from the scene's current balance
            const currentBalance = this.scene.currentBalance || null;
            this.showWithdrawModal(currentBalance);
        });
    }

    showWithdrawModal(balance = null) {
        // Responsive modal - positioned at top center
        const modalBg = this.scene.add.rectangle(this.scene.centerX, this.scene.centerY, this.scene.screenWidth, this.scene.screenHeight, 0x000000, 0.5);
        const modalWidth = Math.min(400, this.scene.screenWidth * 0.8);
        const modalHeight = Math.min(400, this.scene.screenHeight * 0.6);
        const modalY = this.scene.screenHeight * 0.25; // Position at 25% from top
        const modal = this.scene.add.rectangle(this.scene.centerX, modalY, modalWidth, modalHeight, 0xffffff);

        let currentBalance = "0 ETH";
        if (balance !== null) {
            try {
                if (window.web3 && window.web3.utils) {
                    const balanceInEth = window.web3.utils.fromWei(balance, 'ether');
                    currentBalance = `${parseFloat(balanceInEth).toFixed(6)} ETH`;
                } else {
                    currentBalance = `${balance} wei`;
                }
            } catch (error) {
                currentBalance = `${balance} wei`;
            }
        }

        const fontSize = Math.max(12, this.scene.screenWidth / 60);
        const balanceText = this.scene.add.text(this.scene.centerX, modalY - 80, `Balance: ${currentBalance}`, {
            font: `${fontSize}px Arial`,
            fill: "#000000"
        }).setOrigin(0.5);

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.placeholder = 'Enter address...';
        inputField.style.position = 'absolute';
        inputField.style.left = `${this.scene.centerX - 100}px`;
        inputField.style.top = `${modalY - 20}px`;
        inputField.style.width = '200px';
        inputField.style.fontSize = `${fontSize}px`;
        inputField.style.padding = '8px';
        document.body.appendChild(inputField);

        const withdrawButton = this.scene.add.text(this.scene.centerX, modalY + 30, "WITHDRAW", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        const closeButton = this.scene.add.text(this.scene.centerX, modalY + 80, "CLOSE", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        // Make buttons larger for mobile touch
        withdrawButton.setSize(withdrawButton.width + 20, withdrawButton.height + 10);
        closeButton.setSize(closeButton.width + 20, closeButton.height + 10);

        // Store all modal elements for cleanup
        this.modalElements = [modalBg, modal, balanceText, withdrawButton, closeButton, inputField];

        // Add click outside to close functionality
        modalBg.setInteractive();
        modalBg.on('pointerdown', (pointer) => {
            // Only close if clicking on the background, not on modal content
            if (pointer.y < modalY - modalHeight/2 || pointer.y > modalY + modalHeight/2 || 
                pointer.x < this.scene.centerX - modalWidth/2 || pointer.x > this.scene.centerX + modalWidth/2) {
                this.closeModal();
            }
        });

        withdrawButton.on('pointerdown', () => {
            const address = inputField.value.trim();
            if (address && address.startsWith('0x') && address.length === 42) {
                window.withdrawFunds(address);
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
}