import { isLandscape } from '../utils/utils.js';
import { MenuButton } from './menuElements/menuButton.js';
import { MenuText } from './menuElements/menuText.js';

export class ErrorModal {
    constructor(scene) {
        this.scene = scene;
        this.menuElements = [];
        this.isOpen = false;
    }

    showErrorModal(message) {
        if (this.isOpen) return;
        
        this.isOpen = true;
        
        if (this.scene.insufficientBalanceMenu) {
            this.scene.insufficientBalanceMenu.disable();
        }

        this.background = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.scene.screenWidth, 
            this.scene.screenHeight, 
            0x000000, 
            0.8
        );
        this.background.setDepth(300);
        this.background.setInteractive();
        this.background.on('pointerdown', () => {
            this.closeModal();
        });

        const isLandscapeMode = isLandscape();
        const modalWidth = isLandscapeMode
            ? Math.min(800, this.scene.screenWidth * 0.8)
            : Math.min(700, this.scene.screenWidth * 0.9);
        const modalHeight = isLandscapeMode
            ? Math.min(400, this.scene.screenHeight * 0.6)
            : Math.min(350, this.scene.screenHeight * 0.7);
        
        this.modalContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            modalWidth, 
            modalHeight, 
            0x1a1a1a, 
            0.95
        );
        this.modalContainer.setStrokeStyle(3, 0xFF6B6B);
        this.modalContainer.setDepth(301);

        const titleFontSize = isLandscapeMode
            ? Math.max(28, this.scene.screenWidth / 40)
            : Math.max(32, this.scene.screenWidth / 30);
        
        this.modalTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            this.scene.centerY - modalHeight/2 + 50, 
            "An error was found", 
            titleFontSize,
            { depth: 302, color: '#FF6B6B' }
        );

        this.createCloseButton(modalWidth, modalHeight);
        this.createErrorMessage(message, modalWidth, modalHeight);

        this.menuElements = [
            this.background, 
            this.modalContainer, 
            this.modalTitle,
            this.closeButton,
            this.errorMessage
        ];
    }

    createCloseButton(modalWidth, modalHeight) {
        const x = this.scene.centerX + (modalWidth / 2) - 30;
        const y = this.scene.centerY - (modalHeight / 2) + 30;
        
        this.closeButton = this.scene.add.text(x, y, "✕", {
            font: '36px Arial',
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5).setInteractive();

        this.closeButton.setDepth(305);
        const isLandscapeMode = isLandscape();
        this.closeButton.setSize(
            this.closeButton.width + (isLandscapeMode ? 120 : 100), 
            this.closeButton.height + (isLandscapeMode ? 120 : 100)
        );
        this.closeButton.on('pointerdown', () => this.closeModal());
    }

    createErrorMessage(message, modalWidth, modalHeight) {
        const isLandscapeMode = isLandscape();
        const fontSize = isLandscapeMode ? 18 : 20;
        
        // Truncate message if too long
        const maxMessageLength = isLandscapeMode ? 80 : 60;
        const displayMessage = message.length > maxMessageLength 
            ? message.substring(0, maxMessageLength) + '...'
            : message;
        
        this.errorMessage = new MenuText(
            this.scene,
            this.scene.centerX,
            this.scene.centerY,
            `An error was found: ${displayMessage}`,
            fontSize,
            { 
                depth: 303, 
                color: '#E0F6FF',
                wordWrap: { width: modalWidth - 100 },
                align: 'center'
            }
        );
    }

    closeModal() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        if (this.scene.insufficientBalanceMenu) {
            this.scene.insufficientBalanceMenu.enable();
        }

        this.menuElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            }
        });
        this.menuElements = [];
    }

    destroy() {
        this.closeModal();
    }
}

// Global error modal instance
let errorModal = null;

// Simple function to show error modal
export function showErrorModal(message) {
    console.error(`[ERROR] ${message}`);
    if (errorModal) {
        errorModal.showErrorModal(message);
    }
}

// Set the error modal instance
export function setErrorModal(modal) {
    errorModal = modal;
}