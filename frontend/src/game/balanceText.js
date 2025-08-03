import { applyPerspectiveToQuadImageToLeft } from '../utils.js';
import { web3 } from '../blockchain_stuff.js';

export class BalanceText {
    constructor(scene) {
        this.scene = scene;
        this.createBalanceText();
    }

    createBalanceText() {
        this.renderTexture = this.scene.add.renderTexture(0, 0, 1200, 1200);
        const balanceText = this.scene.add.text(0, 0, '0.000000 ETH', {
            font: 'bold 48px Orbitron',
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 2,
            alpha: 0.9,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        });

        balanceText.setVisible(false);

        // Draw text to render texture
        this.renderTexture.draw(balanceText, 20, 30);
        balanceText.destroy();

        // Save the texture
        this.renderTexture.saveTexture('balanceTexture');

        // Create quad image with the texture - positioned in top right, much bigger
        this.quadImage = this.scene.add.rexQuadImage(this.scene.screenWidth - 150, 200, 'balanceTexture');
        
        // Make sure it's visible and has proper size
        this.quadImage.setVisible(true);
        this.quadImage.setAlpha(1);
        
        // Apply perspective effect like game history - more pronounced
        this.quadImage.topRight.x -= 100;
        this.quadImage.topRight.y -= 100;
        this.quadImage.bottomRight.x -= 100;
        this.quadImage.bottomRight.y -= 100;
    }

    updateBalance(balance = null) {
        if (!this.renderTexture) {
            return;
        }

        // Clear the render texture
        this.renderTexture.clear();

        // Create balance text - much bigger font
        let balanceString = "Balance: 0 ETH";
        if (balance !== null) {
            try {
                if (window.web3 && window.web3.utils) {
                    const balanceInEth = window.web3.utils.fromWei(balance, 'ether');
                    balanceString = `Balance: ${parseFloat(balanceInEth).toFixed(6)} ETH`;
                } else {
                    balanceString = `Balance: ${balance} wei`;
                }
            } catch (error) {
                balanceString = `Balance: ${balance} wei`;
            }
        }

        const balanceText = this.scene.add.text(0, 0, balanceString, {
            font: 'bold 36px Orbitron',
            fill: '#00FFFF',
            stroke: '#000000',
            strokeThickness: 4
        });
        balanceText.setVisible(false);
        this.renderTexture.draw(balanceText, 20, 30);
        balanceText.destroy();

        // Update the quad image texture
        if (this.quadImage) {
            this.quadImage.setTexture('balanceTexture');
        }
    }
}