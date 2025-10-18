import { getSelectedBetAmount, web3 } from '../../web3/blockchain_stuff.js';
import { isLandscape } from '../../utils/utils.js';

export class BetMenuButton {
    constructor(scene, betMenu) {
        this.scene = scene;
        this.betMenu = betMenu;
        this.createButton();
    }

    createButton() {
        const isLandscapeMode = isLandscape();
        // Font size proportional to button dimensions (bigger text)
        const buttonWidth = 280;
        const buttonHeight = 80;
        const buttonFontSize = Math.min(buttonWidth, buttonHeight) / 2.5;
        
        // Position below portrait in landscape mode, below portrait in portrait mode
        let x, y;
        if (isLandscapeMode) {
            // In landscape mode, position below the portrait (portrait is at screenWidth - 190, screenHeight - 260 with size 300)
            x = this.scene.screenWidth - 190; // Same X as portrait
            y = (this.scene.screenHeight - 260) + 150 + 50; // Portrait Y + half portrait size + margin
        } else {
            // In portrait mode, position below the portrait (portrait is at 170, 270 with size 256)
            x = 170; // Same X as portrait
            y = 270 + 128 + 50; // Portrait Y + half portrait size + margin
        }
        
        const currentBetAmount = getSelectedBetAmount();
        const displayText = this.getDisplayText(currentBetAmount);
        
        this.buttonBg = this.scene.add.rectangle(
            x,
            y,
            280,
            80,
            0x0066CC,
            0.4
        );
        this.buttonBg.setStrokeStyle(2, 0x00FFFF);
        this.buttonBg.setDepth(49);
        this.buttonBg.setOrigin(0.5, 0.5);
        
        this.buttonBg.setInteractive();
        
        const betText = this.scene.add.text(x, y - 20, "BET", {
            font: `bold ${buttonFontSize + 8}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 2,
            alpha: 0.95,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5, 0.5).setInteractive();

        betText.setDepth(51);

        const amountText = this.scene.add.text(x, y + 15, this.getAmountText(currentBetAmount), {
            font: `bold ${buttonFontSize - 8}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 2,
            alpha: 0.95,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5, 0.5).setInteractive();

        amountText.setDepth(52);

        this.button = betText;
        this.amountText = amountText;

        const clickHandler = () => this.betMenu.toggleMenu();

        this.buttonBg.on('pointerdown', clickHandler);
        betText.on('pointerdown', clickHandler);
        amountText.on('pointerdown', clickHandler);
    }

    getDisplayText(betAmount) {
        if (!betAmount) {
            return "Loading...";
        }

        try {
            const ethAmount = web3.utils.fromWei(betAmount, 'ether');
            return `BET\n${parseFloat(ethAmount).toFixed(6)} ETH`;
        } catch (error) {
            console.error('Error converting bet amount:', error);
            return "BET\nError";
        }
    }

    getAmountText(betAmount) {
        if (!betAmount) {
            return "Loading...";
        }
        
        try {
            const ethAmount = web3.utils.fromWei(betAmount, 'ether');
            return `${parseFloat(ethAmount).toFixed(6)} ETH`;
        } catch (error) {
            console.error('Error converting bet amount:', error);
            return "Error";
        }
    }

    updateDisplay() {
        const currentBetAmount = getSelectedBetAmount();
        if (this.amountText) {
            this.amountText.setText(this.getAmountText(currentBetAmount));
        } else {
            const displayText = this.getDisplayText(currentBetAmount);
            this.button.setText(displayText);
        }
    }

    destroy() {
        if (this.buttonBg) {
            this.buttonBg.destroy();
        }
        if (this.button) {
            this.button.destroy();
        }
        if (this.amountText) {
            this.amountText.destroy();
        }
    }
} 