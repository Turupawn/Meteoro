import { getSelectedBetAmount, web3 } from '../../../blockchain_stuff.js';
import { isLandscape } from '../../../utils.js';

export class BetMenuButton {
    constructor(scene, betMenu) {
        this.scene = scene;
        this.betMenu = betMenu;
        this.createButton();
    }

    createButton() {
        const isLandscapeMode = isLandscape();
        const buttonFontSize = isLandscapeMode
            ? Math.max(20, this.scene.screenWidth / 50)
            : Math.max(24, this.scene.screenWidth / 25);
        
        // Position at the same height as social links but on the right side
        const bottomMargin = isLandscapeMode ? 50 : 300;
        const rightMargin = isLandscapeMode ? 50 : 45;
        const x = this.scene.screenWidth - rightMargin;
        const y = this.scene.screenHeight - bottomMargin;
        
        const currentBetAmount = getSelectedBetAmount();
        const displayText = this.getDisplayText(currentBetAmount);
        
        this.buttonBg = this.scene.add.rectangle(
            x,
            y,
            280,
            60,
            0x0066CC,
            0.4
        );
        this.buttonBg.setStrokeStyle(2, 0x00FFFF);
        this.buttonBg.setDepth(50); // Same depth as social links
        this.buttonBg.setOrigin(1, 1); // Right-aligned, bottom-aligned
        
        this.buttonBg.setInteractive();
        
        this.button = this.scene.add.text(x, y, displayText, {
            font: `bold ${buttonFontSize}px Orbitron`,
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
        }).setOrigin(1, 1).setInteractive(); // Right-aligned, bottom-aligned

        this.button.setDepth(51);
        
        // Make both background and text clickable
        this.buttonBg.on('pointerdown', () => this.betMenu.toggleMenu());
        this.button.on('pointerdown', () => this.betMenu.toggleMenu());
    }

    getDisplayText(betAmount) {
        if (!betAmount) {
            return "Loading...";
        }
        
        try {
            const ethAmount = web3.utils.fromWei(betAmount, 'ether');
            return `BET: ${parseFloat(ethAmount).toFixed(6)} ETH`;
        } catch (error) {
            console.error('Error converting bet amount:', error);
            return "BET: Error";
        }
    }

    updateDisplay() {
        const currentBetAmount = getSelectedBetAmount();
        const displayText = this.getDisplayText(currentBetAmount);
        this.button.setText(displayText);
    }

    destroy() {
        if (this.buttonBg) {
            this.buttonBg.destroy();
        }
        if (this.button) {
            this.button.destroy();
        }
    }
} 