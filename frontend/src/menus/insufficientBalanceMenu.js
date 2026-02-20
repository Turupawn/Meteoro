import { getLocalWallet, getPlayerUsdcBalance, getMinimumPlayableBalance, mintTestUsdc } from '../web3/blockchain_stuff.js';
import { isLandscape } from '../utils/utils.js';
import { MenuText } from './menuElements/menuText.js';
import { MenuButton } from './menuElements/menuButton.js';

export class InsufficientBalanceMenu {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.elements = [];
        this.checkInterval = null;
        this.isAnimating = false;
        this.isDisabled = false;
        this.forceShow = false;
        this.isMinting = false;
        this.createScreen();
    }

    createScreen() {
        if (window.fontsReady) {
            this.createScreenElements();
        } else {
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

        const titleY = this.scene.centerY - (isLandscapeMode ? 130 : 250);
        const buttonY = this.scene.centerY - (isLandscapeMode ? 20 : 120);
        const statusY = this.scene.centerY + (isLandscapeMode ? 80 : 0);

        // Title
        this.title = new MenuText(
            this.scene,
            this.scene.centerX,
            titleY,
            'Insufficient USDC to play.\nMint test tokens to start!',
            titleFontSize,
            { depth: 302 }
        );
        this.title.textElement.setVisible(false);

        // Mint button
        const buttonFontSize = isLandscapeMode
            ? Math.max(18, this.scene.screenWidth / 60)
            : Math.max(20, this.scene.screenWidth / 35);

        this.mintButton = new MenuButton(
            this.scene,
            this.scene.centerX,
            buttonY,
            'MINT 1000 USDC',
            buttonFontSize,
            () => this.handleMint(),
            {
                bgColor: 0x00994C,
                strokeColor: 0x00FF88,
                color: '#E0F6FF',
                textStroke: '#006633'
            }
        );
        this.mintButton.buttonBg.setVisible(false);
        this.mintButton.button.setVisible(false);
        this.mintButton.buttonBg.setDepth(303);
        this.mintButton.button.setDepth(304);

        // Status text (for minting feedback)
        this.statusText = new MenuText(
            this.scene,
            this.scene.centerX,
            statusY,
            '',
            titleFontSize - 6,
            { depth: 302 }
        );
        this.statusText.textElement.setVisible(false);

        this.elements = [
            this.title,
            this.mintButton,
            this.statusText
        ];
    }

    async handleMint() {
        if (this.isMinting) return;
        this.isMinting = true;

        this.statusText.setText('Minting...');
        this.statusText.textElement.setVisible(true);
        // Disable button visually
        this.mintButton.buttonBg.setAlpha(0.3);
        this.mintButton.button.setAlpha(0.3);

        try {
            await mintTestUsdc();
            this.statusText.setText('Minted! Waiting for balance update...');
        } catch (error) {
            console.error('Mint failed:', error);
            const msg = error.message || 'Mint failed';
            if (msg.includes('cooldown')) {
                this.statusText.setText('Mint cooldown active. Try again later.');
            } else {
                this.statusText.setText('Mint failed. Try again.');
            }
        } finally {
            this.isMinting = false;
            this.mintButton.buttonBg.setAlpha(1);
            this.mintButton.button.setAlpha(1);
        }
    }

    show(force = false) {
        if (!force && this.scene.cardDisplay && this.scene.cardDisplay.playerCardSprite && this.scene.cardDisplay.playerCardSprite.active) {
            return;
        }

        if (this.isVisible) return;

        this.isVisible = true;
        this.forceShow = force;

        // Hide the card display message
        if (this.scene.cardDisplay && this.scene.cardDisplay.currentGameText) {
            this.scene.cardDisplay.currentGameText.setVisible(false);
        }

        // Hide the card sprites if they exist
        if (this.scene.cardDisplay) {
            if (this.scene.cardDisplay.playerCardSprite && this.scene.cardDisplay.playerCardSprite.active) {
                this.scene.cardDisplay.playerCardSprite.setVisible(false);
            }
            if (this.scene.cardDisplay.houseCardSprite && this.scene.cardDisplay.houseCardSprite.active) {
                this.scene.cardDisplay.houseCardSprite.setVisible(false);
            }
            if (this.scene.cardDisplay.playerCardText && this.scene.cardDisplay.playerCardText.active) {
                this.scene.cardDisplay.playerCardText.setVisible(false);
            }
            if (this.scene.cardDisplay.houseCardText && this.scene.cardDisplay.houseCardText.active) {
                this.scene.cardDisplay.houseCardText.setVisible(false);
            }
        }

        // Show all elements
        this.elements.forEach(element => {
            if (element === this.statusText) {
                // Don't auto-show status text, it's shown on mint action
                return;
            }
            if (element && element.buttonBg) {
                // MenuButton
                element.buttonBg.setVisible(true);
                element.button.setVisible(true);
            } else if (element && element.setVisible) {
                element.setVisible(true);
            } else if (element && element.textElement) {
                element.textElement.setVisible(true);
            }
        });

        // Start checking for balance updates
        this.startBalanceCheck();
    }

    hide() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.forceShow = false;

        // Show the card display message again
        if (this.scene.cardDisplay && this.scene.cardDisplay.currentGameText) {
            this.scene.cardDisplay.currentGameText.setVisible(true);
        }

        // Show the card sprites again if they exist
        if (this.scene.cardDisplay) {
            if (this.scene.cardDisplay.playerCardSprite && this.scene.cardDisplay.playerCardSprite.active) {
                this.scene.cardDisplay.playerCardSprite.setVisible(true);
            }
            if (this.scene.cardDisplay.houseCardSprite && this.scene.cardDisplay.houseCardSprite.active) {
                this.scene.cardDisplay.houseCardSprite.setVisible(true);
            }
            if (this.scene.cardDisplay.playerCardText && this.scene.cardDisplay.playerCardText.active) {
                this.scene.cardDisplay.playerCardText.setVisible(true);
            }
            if (this.scene.cardDisplay.houseCardText && this.scene.cardDisplay.houseCardText.active) {
                this.scene.cardDisplay.houseCardText.setVisible(true);
            }
        }

        // Hide all elements
        this.elements.forEach(element => {
            if (element && element.buttonBg) {
                element.buttonBg.setVisible(false);
                element.button.setVisible(false);
            } else if (element && element.setVisible) {
                element.setVisible(false);
            } else if (element && element.textElement) {
                element.textElement.setVisible(false);
            }
        });

        // Stop checking for balance updates
        this.stopBalanceCheck();
    }

    disable() {
        this.isDisabled = true;

        this.elements.forEach(element => {
            if (element && element.buttonBg) {
                element.buttonBg.setVisible(false);
                element.button.setVisible(false);
            } else if (element && element.textElement) {
                element.textElement.setVisible(false);
            }
        });
    }

    enable() {
        this.isDisabled = false;

        if (this.isVisible) {
            this.elements.forEach(element => {
                if (element === this.statusText) return;
                if (element && element.buttonBg) {
                    element.buttonBg.setVisible(true);
                    element.button.setVisible(true);
                } else if (element && element.textElement) {
                    element.textElement.setVisible(true);
                }
            });
        }
    }

    triggerShakeAnimation() {
        if (this.isAnimating) {
            this.scene.tweens.killTweensOf(this.title.textElement);
        }

        this.isAnimating = true;

        const originalTitleX = this.title.textElement.x;
        const distance = 15;
        const duration = 100;
        const repeats = 6;

        this.scene.tweens.add({
            targets: this.title.textElement,
            x: originalTitleX - distance,
            duration: duration,
            ease: 'Power2',
            yoyo: true,
            repeat: repeats,
            onComplete: () => {
                this.title.textElement.setPosition(originalTitleX, this.title.textElement.y);
                this.isAnimating = false;
            }
        });
    }

    startBalanceCheck() {
        this.checkInterval = setInterval(() => {
            this.checkBalance();
        }, 2000);
    }

    stopBalanceCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async checkBalance() {
        try {
            const wallet = getLocalWallet();
            if (!wallet) return;

            if (BigInt(getPlayerUsdcBalance()) >= BigInt(getMinimumPlayableBalance())) {
                this.hide();
            }
        } catch (error) {
            console.error('Error checking balance:', error);
        }
    }

    destroy() {
        this.stopBalanceCheck();

        this.elements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            }
        });

        this.elements = [];
    }
}
