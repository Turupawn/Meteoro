import { commitGame } from '../../main.js';
import { isLandscape } from '../../utils/utils.js';
import { getPlayerETHBalance, getLocalWallet, getMinimumPlayableBalance } from '../../web3/blockchain_stuff.js';

export class PlayButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        if (window.fontsReady) {
            this.createPlayButtonTexture();
        } else {
            window.onFontsReady = () => {
                this.createPlayButtonTexture();
            };
        }
    }

    createPlayButtonTexture() {
        const isLandscapeMode = isLandscape();
        
        const x = this.scene.centerX;

        const bottomMargin = isLandscapeMode ? 120 : 500;
        const y = this.scene.screenHeight - bottomMargin;
        
        const fontSize = isLandscapeMode ? Math.max(48, this.scene.screenWidth / 15) : Math.max(72, this.scene.screenWidth / 10);
        
        const playButtonText = "PLAY";
        const playButtonWidth = isLandscapeMode ? Math.max(600, playButtonText.length * 40) : Math.max(800, playButtonText.length * 60);
        const playButtonHeight = isLandscapeMode ? 200 : 280;
        
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
        
        this.buttonBg.setInteractive();
        
        this.button = this.scene.add.text(x, y, "PLAY", {
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
        
        const hitAreaWidth = isLandscapeMode ? this.button.width + 200 : this.button.width + 300;
        const hitAreaHeight = isLandscapeMode ? this.button.height + 100 : this.button.height + 150;
        this.button.setSize(hitAreaWidth, hitAreaHeight);

        const clickHandler = async () => {
            const hasInsufficientBalance = await this.checkInsufficientBalance();
            
            if (hasInsufficientBalance) {
                if (this.scene.insufficientBalanceMenu) {
                    this.scene.insufficientBalanceMenu.show(true); // Force show when play button is clicked
                    this.scene.insufficientBalanceMenu.triggerShakeAnimation();
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
}