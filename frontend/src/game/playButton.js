import { commitGame } from '../main.js';
import { isLandscape } from '../utils.js';
import { web3, getPlayerETHBalance } from '../blockchain_stuff.js';
import { getLocalWallet, getMinimumPlayableBalance, getSelectedBetAmount } from '../blockchain_stuff.js';

export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Check if fonts are already ready
        if (window.fontsReady) {
            this.createPlayButtonTexture();
        } else {
            // Wait for fonts to be ready
            window.onFontsReady = () => {
                this.createPlayButtonTexture();
            };
        }
    }

    createPlayButtonTexture() {
        const isLandscapeMode = isLandscape();
        
        const x = this.scene.centerX;
        // Position relative to bottom of screen, higher up in portrait to avoid mobile browser UI
        const bottomMargin = isLandscapeMode ? 120 : 500;
        const y = this.scene.screenHeight - bottomMargin;
        
        // Much bigger font and button on portrait (mobile)
        const fontSize = isLandscapeMode ? Math.max(48, this.scene.screenWidth / 15) : Math.max(72, this.scene.screenWidth / 10);
        
        const playButtonText = "PLAY";
        const playButtonWidth = isLandscapeMode ? Math.max(600, playButtonText.length * 40) : Math.max(800, playButtonText.length * 60);
        const playButtonHeight = isLandscapeMode ? 150 : 200;
        
        this.buttonBg = this.scene.add.rectangle(
            x,
            y,
            playButtonWidth,
            playButtonHeight,
            0x0066CC,
            0.4
        );
        this.buttonBg.setStrokeStyle(3, 0x00FFFF);
        this.buttonBg.setDepth(199);
        
        // Make the background clickable
        this.buttonBg.setInteractive();
        
        this.button = this.scene.add.text(x, y - 20, "PLAY", {
            font: `bold ${fontSize}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 3,
            alpha: 0.95,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#003366',
                blur: 6,
                fill: true
            }
        }).setOrigin(0.5).setInteractive();

        this.button.setDepth(200);
        
        // Bigger hit area on portrait (mobile)
        const hitAreaWidth = isLandscapeMode ? this.button.width + 200 : this.button.width + 300;
        const hitAreaHeight = isLandscapeMode ? this.button.height + 100 : this.button.height + 150;
        this.button.setSize(hitAreaWidth, hitAreaHeight);

        // Create bet amount display inside the button (below the PLAY text)
        this.createBetAmountDisplay(x, y + 50, isLandscapeMode);

        // Add click handler to both background and text
        const clickHandler = async () => {
            const hasInsufficientBalance = await this.checkInsufficientBalance();
            
            if (hasInsufficientBalance) {
                if (this.scene.insufficientBalanceScreen) {
                    this.scene.insufficientBalanceScreen.show(true); // Force show when play button is clicked
                    this.scene.insufficientBalanceScreen.triggerShakeAnimation();
                }
                return;
            }
            
            // Proceed with normal game flow
            if (this.scene.cardDisplay && this.scene.cardDisplay.currentGameText) {
                this.scene.cardDisplay.currentGameText.setText(`Please wait...`);
            }
            
            if (this.scene.background && this.scene.background.startBoostAnimation) {
                this.scene.background.startBoostAnimation();
            }
            
            commitGame();
        };

        this.buttonBg.on('pointerdown', clickHandler);
        this.button.on('pointerdown', clickHandler);
    }

    createBetAmountDisplay(x, y, isLandscapeMode) {
        // Convert bet amount from Wei to ETH
        let betAmountText = "loading...";
        try {
            const betAmount = getSelectedBetAmount();
            if (betAmount) {
                const betAmountEth = web3.utils.fromWei(betAmount.toString(), 'ether');
                betAmountText = `${parseFloat(betAmountEth).toFixed(6)} ETH per game`;
            } else {
                betAmountText = "Loading bet amount...";
            }
        } catch (error) {
            console.error('Error converting bet amount:', error);
            const betAmount = getSelectedBetAmount();
            betAmountText = betAmount ? `${betAmount} WEI per game` : "Loading bet amount...";
        }

        const betFontSize = isLandscapeMode ? Math.max(14, this.scene.screenWidth / 80) : Math.max(16, this.scene.screenWidth / 60);
        
        this.betAmountText = this.scene.add.text(x, y, betAmountText, {
            font: `${betFontSize}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 1,
            alpha: 0.8,
            shadow: {
                offsetX: 1,
                offsetY: 1,
                color: '#003366',
                blur: 2,
                fill: true
            }
        }).setOrigin(0.5);
        
        this.betAmountText.setDepth(201);
    }

    async checkInsufficientBalance() {
        try {
            const wallet = getLocalWallet();
            if (!wallet) return false;

            const balance = await getPlayerETHBalance();
            const minBalanceWei = getMinimumPlayableBalance();
            
            return BigInt(balance) < BigInt(minBalanceWei);
        } catch (error) {
            console.error('Error checking balance:', error);
            return false;
        }
    }

    // Add method to update bet amount display if needed
    updateBetAmountDisplay() {
        if (this.betAmountText) {
            try {
                const betAmount = getSelectedBetAmount();
                if (betAmount) {
                    const betAmountEth = web3.utils.fromWei(betAmount.toString(), 'ether');
                    const betAmountText = `${parseFloat(betAmountEth).toFixed(6)} ETH per game`;
                    this.betAmountText.setText(betAmountText);
                } else {
                    this.betAmountText.setText("Loading bet amount...");
                }
            } catch (error) {
                console.error('Error updating bet amount display:', error);
                const betAmount = getSelectedBetAmount();
                this.betAmountText.setText(betAmount ? `${betAmount} WEI per game` : "Loading bet amount...");
            }
        }
    }
}