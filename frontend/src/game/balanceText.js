import { applyPerspectiveToQuadImageToLeft } from '../utils.js';

export class BalanceText {
    constructor(scene) {
        this.scene = scene;
        this.createBalanceText();
    }

    createBalanceText() {
        // Create a render texture for the balance display - much bigger
        console.log("starting balance text");
        this.renderTexture = this.scene.add.renderTexture(0, 0, 1200, 1200);

        
        // Create the text content first - futuristic Metroid Prime style with Orbitron
        const balanceText = this.scene.add.text(0, 0, '0.000000 ETH', {
            font: 'bold 48px Orbitron', // Back to Orbitron for futuristic feel
            fill: '#E0F6FF', // Bright cyan-white
            stroke: '#0066CC', // Deep blue stroke
            strokeThickness: 2,
            alpha: 0.9, // Slight transparency
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

        
        // Make sure it's visible and has proper size with transparency
        this.quadImage.setVisible(true);
        this.quadImage.setScale(50,50);
        this.quadImage.setAlpha(0.85); // Add transparency to the quad image
        
        // Apply perspective effect using the utils function
        let perspectiveX = this.quadImage.centerLeft.x - 1000;
        let perspectiveY = this.quadImage.centerLeft.y + 0;
        
        applyPerspectiveToQuadImageToLeft(this.quadImage, perspectiveX, perspectiveY);
        console.log("finished balance text");

    }

    updateBalance(balance = null) {
        console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        if (!this.renderTexture) {
            return;
        }

        // Clear the render texture
        this.renderTexture.clear();

        // Create balance text - futuristic Metroid Prime style
        let balanceString = "0.000000 ETH";
        if (balance !== null) {
            try {
                if (window.web3 && window.web3.utils) {
                    const balanceInEth = window.web3.utils.fromWei(balance, 'ether');
                    balanceString = `${parseFloat(balanceInEth).toFixed(6)} ETH`;
                } else {
                    balanceString = `${balance} WEI`;
                }
            } catch (error) {
                balanceString = `${balance} WEI`;
            }
        }

        // Create the main balance text with futuristic styling and transparency
        const balanceText = this.scene.add.text(0, 0, balanceString, {
            font: 'bold 32px Orbitron', // Back to Orbitron for futuristic feel
            fill: '#E0F6FF', // Bright cyan-white
            stroke: '#0066CC', // Deep blue stroke
            strokeThickness: 2,
            alpha: 0.9, // Slight transparency
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
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