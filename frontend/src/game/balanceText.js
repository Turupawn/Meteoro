
import { applyPerspectiveToQuadImageToLeft } from '../utils.js';
import { web3 } from '../blockchain_stuff.js';
import { isLandscape } from '../utils.js';

export class BalanceText {
    constructor(scene) {
        this.scene = scene;
        this.createBalanceText();
    }

    createBalanceText() {
        // Create a render texture for the balance display - much bigger
        if(isLandscape()) {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 1200, 1200);
        } else {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 600, 220);
        }
        
        // Create the text content first - much bigger font
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
        if(isLandscape()) {
            this.renderTexture.draw(balanceText);
        } else {
            this.renderTexture.draw(balanceText, 20, 30);
        }
        balanceText.destroy();

        // Save the texture
        this.renderTexture.saveTexture('balanceTexture');

        if(isLandscape()) {
            this.quadImage = this.scene.add.rexQuadImage({
                x: this.scene.screenWidth - 40,
                y: 500,
                texture: 'balanceTexture',
                ninePointMode: true,
            });
            this.quadImage.setScale(50,50);
            this.quadImage.setAlpha(0.85);
            let perspectiveX = this.quadImage.centerLeft.x - 1000;
            let perspectiveY = this.quadImage.centerLeft.y + 0;
            applyPerspectiveToQuadImageToLeft(this.quadImage, perspectiveX, perspectiveY);
        } else {
            this.quadImage = this.scene.add.rexQuadImage(this.scene.screenWidth - 150, 200, 'balanceTexture');            
            this.quadImage.setAlpha(1);
            this.quadImage.topRight.x -= 100;
            this.quadImage.topRight.y -= 100;
            this.quadImage.bottomRight.x -= 100;
            this.quadImage.bottomRight.y -= 100;
        }
        this.quadImage.setVisible(false);
    }

    updateBalance(balance = null) {
        if (!this.renderTexture) {
            return;
        }

        // Clear the render texture
        this.renderTexture.clear();


        let balanceString = "0.000000 ETH";
        if (balance !== null) {
            try {
                if (web3 && web3.utils) {
                    const balanceInEth = web3.utils.fromWei(balance, 'ether');
                    balanceString = `${parseFloat(balanceInEth).toFixed(6)} ETH`;
                } else {
                    balanceString = `${balance} WEI`;
                }
            } catch (error) {
                balanceString = `${balance} WEI`;
            }
        }

        const balanceText = this.scene.add.text(0, 0, balanceString, {
            font: 'bold 32px Orbitron',
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
        if(isLandscape()) {
            this.renderTexture.draw(balanceText, 320, 100);
        } else {
            this.renderTexture.draw(balanceText, 20, 30);
        }
        balanceText.destroy();

        // Update the quad image texture
        if (this.quadImage) {
            this.quadImage.setTexture('balanceTexture');
            this.quadImage.setVisible(true);
        }
    }
}