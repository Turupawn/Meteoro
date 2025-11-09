import { getLocalWallet, getPlayerETHBalance, getMinimumPlayableBalance } from '../web3/blockchain_stuff.js';
import { isLandscape } from '../utils/utils.js';
import { MenuText } from './menuElements/menuText.js';
import { MenuButton } from './menuElements/menuButton.js';
import { MenuInput } from './menuElements/menuInput.js';

export class WalletWarningScreen {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.elements = [];
        this.insufficientBalanceInputWasVisible = false; // Track previous state
        this.createScreen();
    }

    createScreen() {
        // Check if fonts are already ready
        if (window.fontsReady) {
            this.createScreenElements();
        } else {
            // Wait for fonts to be ready
            window.onFontsReady = () => {
                this.createScreenElements();
            };
        }
    }

    createScreenElements() {
        const isLandscapeMode = isLandscape();
        
        this.screenWidth = isLandscapeMode
            ? Math.min(1000, this.scene.screenWidth * 0.95)
            : Math.min(850, this.scene.screenWidth * 0.97);
        this.screenHeight = isLandscapeMode
            ? Math.min(700, this.scene.screenHeight * 0.85)
            : Math.min(600, this.scene.screenHeight * 0.8);

        const titleFontSize = isLandscapeMode
            ? Math.max(22, this.scene.screenWidth / 50)
            : Math.max(24, this.scene.screenWidth / 30);
        
        // Create background overlay
        this.background = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.scene.screenWidth, 
            this.scene.screenHeight, 
            0x000000, 
            0.7
        );
        this.background.setDepth(350);
        this.background.setInteractive();
        this.background.setVisible(false);

        // Create container
        this.container = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.screenWidth, 
            this.screenHeight, 
            0x000000, 
            0.95
        );
        this.container.setStrokeStyle(2, 0x00FFFF);
        this.container.setDepth(351);
        this.container.setVisible(false);

        // Position elements
        const warningY = this.scene.centerY - (isLandscapeMode ? 150 : 180);
        const privateKeyY = this.scene.centerY - (isLandscapeMode ? 40 : 60);
        const acceptButtonY = this.scene.centerY + (isLandscapeMode ? 120 : 100);

        this.warningText = new MenuText(
            this.scene,
            this.scene.centerX,
            warningY, 
            "Back up your local storage wallet private key, you can also view it anytime on the menu. Don't use it for large amounts. Click to learn more", 
            isLandscapeMode ? titleFontSize - 12 : titleFontSize - 10,
            { 
                depth: 352,
                wordWrap: { width: this.screenWidth - 100 },
                align: 'center',
                interactive: true,
                color: '#00ff00',
                onClick: () => window.open('https://dev.to/filosofiacodigoen/how-local-storage-wallets-on-ethereum-work-4c0p', '_blank')
            }
        );
        this.warningText.textElement.setVisible(false);

        // Get wallet private key
        const wallet = getLocalWallet();
        const privateKey = wallet ? wallet.privateKey : 'No wallet';

        const privateKeyInputWidth = isLandscapeMode 
            ? Math.min(800, this.scene.screenWidth * 0.85)
            : Math.min(700, this.scene.screenWidth * 0.95);
        
        this.privateKeyInput = new MenuInput(
            this.scene,
            this.scene.centerX,
            privateKeyY,
            '',
            isLandscapeMode ? titleFontSize - 14 : titleFontSize - 8,
            {
                readOnly: true,
                value: privateKey,
                width: privateKeyInputWidth
            }
        );
        this.privateKeyInput.inputElement.style.color = '#FFFFFF';
        this.privateKeyInput.inputElement.style.display = 'none';

        // Accept button
        this.acceptButton = new MenuButton(
            this.scene,
            this.scene.centerX,
            acceptButtonY,
            "Accept",
            titleFontSize,
            () => this.accept()
        );
        // Set initial visibility
        this.acceptButton.buttonBg.setVisible(false);
        this.acceptButton.button.setVisible(false);
        // Set proper depth to be above background
        this.acceptButton.buttonBg.setDepth(352);
        this.acceptButton.button.setDepth(353);

        this.elements = [
            this.background,
            this.container,
            this.warningText,
            this.privateKeyInput,
            this.acceptButton
        ];
    }

    show() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        
        // Hide insufficient balance menu's address input if it exists
        if (this.scene.insufficientBalanceMenu && this.scene.insufficientBalanceMenu.addressInput) {
            const inputElement = this.scene.insufficientBalanceMenu.addressInput.inputElement;
            if (inputElement) {
                // Store current visibility state
                this.insufficientBalanceInputWasVisible = inputElement.style.display !== 'none';
                // Hide the input
                inputElement.style.display = 'none';
            }
        }
        
        // Show all elements
        if (this.background) this.background.setVisible(true);
        if (this.container) this.container.setVisible(true);
        if (this.warningText && this.warningText.textElement) this.warningText.textElement.setVisible(true);
        if (this.privateKeyInput && this.privateKeyInput.inputElement) {
            this.privateKeyInput.inputElement.style.display = 'block';
        }
        if (this.acceptButton) {
            if (this.acceptButton.buttonBg) this.acceptButton.buttonBg.setVisible(true);
            if (this.acceptButton.button) this.acceptButton.button.setVisible(true);
        }
    }

    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        
        // Restore insufficient balance menu's address input visibility if it was visible before
        // Only restore if the insufficient balance menu itself is visible
        if (this.scene.insufficientBalanceMenu && 
            this.scene.insufficientBalanceMenu.isVisible &&
            this.scene.insufficientBalanceMenu.addressInput) {
            const inputElement = this.scene.insufficientBalanceMenu.addressInput.inputElement;
            if (inputElement && this.insufficientBalanceInputWasVisible) {
                // Restore previous visibility state
                inputElement.style.display = 'block';
            }
        }
        
        // Hide all elements
        if (this.background) this.background.setVisible(false);
        if (this.container) this.container.setVisible(false);
        if (this.warningText && this.warningText.textElement) this.warningText.textElement.setVisible(false);
        if (this.privateKeyInput && this.privateKeyInput.inputElement) {
            this.privateKeyInput.inputElement.style.display = 'none';
        }
        if (this.acceptButton) {
            if (this.acceptButton.buttonBg) this.acceptButton.buttonBg.setVisible(false);
            if (this.acceptButton.button) this.acceptButton.button.setVisible(false);
        }
        
        // Check if insufficient balance menu should be shown after closing wallet warning
        if (this.scene && this.scene.checkInsufficientBalance) {
            try {
                const balance = getPlayerETHBalance();
                const hasInsufficientBalance = BigInt(balance) < BigInt(getMinimumPlayableBalance());
                
                if (hasInsufficientBalance && this.scene.cardDisplay && 
                    (!this.scene.cardDisplay.playerCardSprite || !this.scene.cardDisplay.playerCardSprite.active)) {
                    // Show insufficient balance menu if balance is insufficient
                    if (this.scene.insufficientBalanceMenu) {
                        this.scene.insufficientBalanceMenu.show(false);
                    }
                }
            } catch (error) {
                console.error('Error checking insufficient balance after wallet warning close:', error);
            }
        }
    }

    accept() {
        // Warning accepted, no need to store anything since we check wallet existence at startup
        this.hide();
    }

    destroy() {
        this.elements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            }
        });
        
        this.elements = [];
    }
}

