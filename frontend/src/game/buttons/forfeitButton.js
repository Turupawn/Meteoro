export class ForfeitButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
        this.modalElements = [];
    }

    createButton() {
        // Responsive forfeit button - positioned in top right below withdraw button
        const x = this.scene.screenWidth - 20;
        const y = 140; // Below withdraw button
        const fontSize = Math.max(12, this.scene.screenWidth / 60); // Responsive font size
        
        this.button = this.scene.add.text(x, y, "FORFEIT", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(1, 0).setInteractive();

        // Make button area larger for mobile touch
        this.button.setSize(this.button.width + 20, this.button.height + 10);

        // Simple click handler
        this.button.on('pointerdown', () => {
            // Close any other open modals first
            this.scene.closeAllModals();
            this.showForfeitModal();
        });
    }

    showForfeitModal() {
        // Responsive modal - positioned at top center
        const modalBg = this.scene.add.rectangle(this.scene.centerX, this.scene.centerY, this.scene.screenWidth, this.scene.screenHeight, 0x000000, 0.5);
        const modalWidth = Math.min(400, this.scene.screenWidth * 0.8);
        const modalHeight = Math.min(300, this.scene.screenHeight * 0.4);
        const modalY = this.scene.screenHeight * 0.2; // Position at 20% from top
        const modal = this.scene.add.rectangle(this.scene.centerX, modalY, modalWidth, modalHeight, 0xffffff);

        const fontSize = Math.max(12, this.scene.screenWidth / 60);
        
        const titleText = this.scene.add.text(this.scene.centerX, modalY - 60, "FORFEIT GAME", {
            font: `${fontSize}px Arial`,
            fill: "#000000"
        }).setOrigin(0.5);

        const warningText = this.scene.add.text(this.scene.centerX, modalY - 20, "This will forfeit your current game and clear all cached data.", {
            font: `${fontSize - 2}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5);

        const confirmButton = this.scene.add.text(this.scene.centerX, modalY + 20, "CONFIRM FORFEIT", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5).setInteractive();

        const cancelButton = this.scene.add.text(this.scene.centerX, modalY + 60, "CANCEL", {
            font: `${fontSize}px Arial`,
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        // Make buttons larger for mobile touch
        confirmButton.setSize(confirmButton.width + 20, confirmButton.height + 10);
        cancelButton.setSize(cancelButton.width + 20, cancelButton.height + 10);

        // Store all modal elements for cleanup
        this.modalElements = [modalBg, modal, titleText, warningText, confirmButton, cancelButton];

        // Add click outside to close functionality
        modalBg.setInteractive();
        modalBg.on('pointerdown', (pointer) => {
            // Only close if clicking on the background, not on modal content
            if (pointer.y < modalY - modalHeight/2 || pointer.y > modalY + modalHeight/2 || 
                pointer.x < this.scene.centerX - modalWidth/2 || pointer.x > this.scene.centerX + modalWidth/2) {
                this.closeModal();
            }
        });

        confirmButton.on('pointerdown', () => {
            this.executeForfeit();
            this.closeModal();
        });

        const closeClickHandler = () => {
            this.closeModal();
        };

        cancelButton.on('pointerdown', closeClickHandler);
    }

    closeModal() {
        this.modalElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            }
        });
        this.modalElements = [];
    }

    async executeForfeit() {
        try {
            // Clear all cached data
            this.clearAllCache();
            
            // Call forfeit function on chain
            if (window.forfeit) {
                await window.forfeit();
                console.log("Forfeit transaction completed successfully");
            } else {
                console.error("Forfeit function not available");
            }
        } catch (error) {
            console.error("Error executing forfeit:", error);
        }
    }

    clearAllCache() {
        // Clear all localStorage items
        localStorage.removeItem('playerSecret');
        localStorage.removeItem('pendingCommit');
        localStorage.removeItem('pendingReveal');
        
        console.log("All cached data cleared");
    }
} 