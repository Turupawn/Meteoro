
import { applyPerspectiveToQuadImageToLeft, isLandscape } from '../../utils/utils.js';
import { formatBalance } from '../../web3/blockchain_stuff.js';

export class GachaTokenBalanceText {
    constructor(scene) {
        this.scene = scene;
        this.createGachaTokenBalanceText();
    }

    createGachaTokenBalanceText() {
        // Create a render texture for the balance display - much bigger
        if(isLandscape()) {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 1200, 1200);
        } else {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 600, 220);
        }
        
        // Create the text content first - much bigger font
        const gachaTokenBalanceText = this.scene.add.text(0, 0, '     0 GACHA', {
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
        gachaTokenBalanceText.setVisible(false);

        // Draw text to render texture
        if(isLandscape()) {
            this.renderTexture.draw(gachaTokenBalanceText);
        } else {
            this.renderTexture.draw(gachaTokenBalanceText, 20, 30);
        }
        gachaTokenBalanceText.destroy();

        // Save the texture
        this.renderTexture.saveTexture('gachaTokenBalanceTexture');

        if(isLandscape()) {
            this.quadImage = this.scene.add.rexQuadImage({
                x: this.scene.screenWidth - 40,
                y: 550,
                texture: 'gachaTokenBalanceTexture',
                ninePointMode: true,
            });
            this.quadImage.setScale(50,50);
            this.quadImage.setAlpha(0.85);
            let perspectiveX = this.quadImage.centerLeft.x - 1000;
            let perspectiveY = this.quadImage.centerLeft.y + 0;
            applyPerspectiveToQuadImageToLeft(this.quadImage, perspectiveX, perspectiveY);
        } else {
            this.quadImage = this.scene.add.rexQuadImage(
                this.scene.screenWidth - 5,
                350,
                'gachaTokenBalanceTexture');            
            this.quadImage.setAlpha(1);
            this.quadImage.setScale(1.6,1.6);
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


        let gachaTokenBalanceString = "     0 GACHA";
        if (balance !== null) {
            gachaTokenBalanceString = `${formatBalance(balance, 0)} GACHA`;
        }

        const gachaTokenBalanceText = this.scene.add.text(0, 0, gachaTokenBalanceString, {
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
        gachaTokenBalanceText.setVisible(false);
        if(isLandscape()) {
            this.renderTexture.draw(gachaTokenBalanceText, 320, 100);
        } else {
            this.renderTexture.draw(gachaTokenBalanceText, 20, 30);
        }
        gachaTokenBalanceText.destroy();

        // Update the quad image texture
        if (this.quadImage) {
            this.quadImage.setTexture('gachaTokenBalanceTexture');
            this.quadImage.setVisible(true);
        }
    }
}