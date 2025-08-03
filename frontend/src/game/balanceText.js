import { applyPerspectiveToQuadImageToLeft } from '../utils.js';

export class BalanceText {
    constructor(scene) {
        this.scene = scene;
        this.createBalanceText();
    }

    createBalanceText() {
        // Create a render texture for the balance display - much bigger
        this.renderTexture = this.scene.add.renderTexture(0, 0, 1200, 1200);

        console.log(this.renderTexture)
        
        // Create the text content first - much bigger font
        const balanceText = this.scene.add.text(0, 0, 'Balance: 0 ETH', {
            font: 'bold 60px Orbitron', // Changed to Orbitron font
            fill: '#00FFFF',
            stroke: '#000000',
            strokeThickness: 4
        });
        balanceText.setVisible(false);

        // Draw text to render texture
        this.renderTexture.draw(balanceText);
        balanceText.destroy();

        // Save the texture
        this.renderTexture.saveTexture('balanceTexture');

        // Create quad image with the texture - positioned in top right, much bigger
        this.quadImage = this.scene.add.rexQuadImage({
            x: this.scene.screenWidth - 100,
            y: 500,
            texture: 'balanceTexture',
            ninePointMode: true,
        });

        
        // Make sure it's visible and has proper size
        this.quadImage.setVisible(true);
        this.quadImage.setScale(50,50);
        this.quadImage.setAlpha(1);
        
        // Apply perspective effect using the utils function
        let perspectiveX = this.quadImage.centerLeft.x - 1000;
        let perspectiveY = this.quadImage.centerLeft.y + 0;
        
        applyPerspectiveToQuadImageToLeft(this.quadImage, perspectiveX, perspectiveY);
    }

    updateBalance(balance = null) {
        if (!this.renderTexture) {
            return;
        }

        // Clear the render texture
        this.renderTexture.clear();

        // Create balance text - much bigger font
        let balanceString = "0 ETH";
        if (balance !== null) {
            try {
                if (window.web3 && window.web3.utils) {
                    const balanceInEth = window.web3.utils.fromWei(balance, 'ether');
                    balanceString = `${parseFloat(balanceInEth).toFixed(6)} ETH`;
                } else {
                    balanceString = `${balance} wei`;
                }
            } catch (error) {
                balanceString = `${balance} wei`;
            }
        }

        const balanceText = this.scene.add.text(0, 0, balanceString, {
            font: 'bold 36px Orbitron', // Changed to Orbitron font
            fill: '#00FFFF',
            stroke: '#000000',
            strokeThickness: 4
        });
        balanceText.setVisible(false);
        this.renderTexture.draw(balanceText, 320, 100);
        balanceText.destroy();

        // Update the quad image texture
        if (this.quadImage) {
            this.quadImage.setTexture('balanceTexture');
        }
    }
}