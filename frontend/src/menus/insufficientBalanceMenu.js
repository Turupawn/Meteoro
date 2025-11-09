import { getLocalWallet, getPlayerETHBalance, getMinimumPlayableBalance } from '../web3/blockchain_stuff.js';
import { isLandscape } from '../utils/utils.js';
import { MenuText } from './menuElements/menuText.js';
import { MenuInput } from './menuElements/menuInput.js';

const NETWORK = import.meta.env.NETWORK || 'rise testnet';

export class InsufficientBalanceMenu {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.elements = [];
        this.checkInterval = null;
        this.isAnimating = false;
        this.isDisabled = false; // Add disabled state
        this.forceShow = false; // Add flag to force show when play button is clicked
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
            : Math.max(24, this.scene.screenWidth / 30); // Smaller on portrait
        
        // Closer Y positioning - reduced spacing between elements
        const titleY = this.scene.centerY - (isLandscapeMode ? 130 : 250);
        const addressY = this.scene.centerY - (isLandscapeMode ? 20 : 120);
        const faucetTextY = this.scene.centerY + (isLandscapeMode ? 120 : 60);
        const faucetLinkY = this.scene.centerY + (isLandscapeMode ? 160 : 100);
        
        // Title - now shows the instruction text instead of "INSUFFICIENT BALANCE"
        const networkName = NETWORK === 'rise testnet' ? 'Rise Testnet' : 'Rise Mainnet';
        this.title = new MenuText(
            this.scene,
            this.scene.centerX, 
            titleY, 
            `Deposit ETH on ${networkName} to start playing.\nGas fees applies.`,
            titleFontSize,
            { depth: 302 }
        );
        this.title.textElement.setVisible(false);
        
        // Get wallet address
        const wallet = getLocalWallet();
        const address = wallet ? wallet.address : 'No wallet';

        const addressInputWidth = isLandscapeMode
            ? Math.min(800, this.scene.screenWidth * 0.85)
            : Math.min(700, this.scene.screenWidth * 0.95);

        this.addressInput = new MenuInput(
            this.scene,
            this.scene.centerX,
            addressY,
            '',
            isLandscapeMode ? titleFontSize - 10 : titleFontSize - 6,
            {
                readOnly: true,
                value: address,
                width: addressInputWidth
            }
        );
        this.addressInput.inputElement.style.display = 'none';

        this.faucetText = new MenuText(
            this.scene,
            this.scene.centerX, 
            faucetTextY, 
            "Get test tokens from faucet:", 
            titleFontSize - 4,
            { depth: 302 }
        );
        this.faucetText.textElement.setVisible(false);

        this.faucetLink = new MenuText(
            this.scene,
            this.scene.centerX, 
            faucetLinkY, 
            "https://faucet.testnet.riselabs.xyz/",
            titleFontSize - 4,
            {
                interactive: true,
                isLink: true, // Add link styling
                onClick: () => window.open('https://faucet.testnet.riselabs.xyz/', '_blank'),
                depth: 302
            }
        );
        this.faucetLink.textElement.setVisible(false);

        this.elements = [
            this.title,
            this.addressInput
        ];
        
        if (NETWORK === 'rise testnet') {
            this.elements.push(this.faucetText, this.faucetLink);
        }
    }

    show(force = false) {
        // Only show if forced (play button click) or if no cards are being displayed
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
            if (element && element.setVisible) {
                element.setVisible(true);
            } else if (element && element.inputElement) {
                element.inputElement.style.display = 'block';
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
            if (element && element.setVisible) {
                element.setVisible(false);
            } else if (element && element.inputElement) {
                element.inputElement.style.display = 'none';
            } else if (element && element.textElement) {
                element.textElement.setVisible(false);
            }
        });
        
        // Stop checking for balance updates
        this.stopBalanceCheck();
    }

    // Add new methods to disable/enable the screen
    disable() {
        this.isDisabled = true;
        
        // Make all interactive elements non-interactive
        this.elements.forEach(element => {
            if (element && element.textElement && element.textElement.input) {
                element.textElement.disableInteractive();
            }
        });
        
        // Make all elements invisible
        this.elements.forEach(element => {
            if (element && element.textElement) {
                element.textElement.setVisible(false);
            } else if (element && element.inputElement) {
                element.inputElement.style.display = 'none';
            }
        });
    }

    enable() {
        this.isDisabled = false;
        
        // Restore interactivity
        this.elements.forEach(element => {
            if (element && element.textElement && element.options && element.options.interactive) {
                element.textElement.setInteractive();
                if (element.options.onClick) {
                    element.textElement.on('pointerdown', element.options.onClick);
                }
            }
        });
        
        // Restore visibility only if the screen was originally visible
        if (this.isVisible) {
            this.elements.forEach(element => {
                if (element && element.textElement) {
                    element.textElement.setVisible(true);
                } else if (element && element.inputElement) {
                    element.inputElement.style.display = 'block';
                }
            });
        }
    }

    triggerShakeAnimation() {
        // Stop any existing animation
        if (this.isAnimating) {
            this.scene.tweens.killTweensOf(this.title.textElement);
        }
        
        this.isAnimating = true;
        
        // Store original positions
        const originalTitleX = this.title.textElement.x;
        
        // Less prominent, synchronized shake animation
        const distance = 15; // Reduced from 40 to 15
        const duration = 100; // Slightly slower for smoother animation
        const repeats = 6; // Reduced from 8 to 6
        
        // Animate the title using Phaser tweens
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
        
        // Synchronized animation for the input element
        this.animateInputElement(distance, duration, repeats);
    }

    animateInputElement(distance, duration, repeats) {
        const inputElement = this.addressInput.inputElement;
        let direction = 1;
        let count = 0;
        const maxCount = repeats * 2; // Each repeat is back-and-forth
        
        const animate = () => {
            if (count >= maxCount) {
                // Reset to original position
                inputElement.style.transform = 'translateX(0px)';
                return;
            }
            
            const translateX = direction * distance;
            inputElement.style.transition = `transform ${duration}ms ease-in-out`;
            inputElement.style.transform = `translateX(${translateX}px)`;
            
            direction *= -1; // Reverse direction
            count++;
            
            setTimeout(animate, duration);
        };
        
        animate();
    }

    startBalanceCheck() {
        // Check balance every 2 seconds
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

            if (BigInt(getPlayerETHBalance()) >= BigInt(getMinimumPlayableBalance())) {
                // User now has sufficient balance, hide the screen
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