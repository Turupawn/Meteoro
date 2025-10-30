import { applyPerspectiveToQuadImageToLeft, isLandscape, ETH_BALANCE_DECIMALS } from '../../utils/utils.js';
import { formatBalance } from '../../web3/blockchain_stuff.js';

export class ETHBalanceText {

    balanceText = '';

    constructor(scene) {
        this.scene = scene;
        this.createETHBalanceText();
    }

    async createETHBalanceText() {
        if(isLandscape()) {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 1200, 1200);
        } else {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 600, 220);
        }
        
        const ethBalanceText = this.scene.add.text(0, 0, '', {
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
        ethBalanceText.setVisible(false);

        if(isLandscape()) {
            this.renderTexture.draw(ethBalanceText);
        } else {
            this.renderTexture.draw(ethBalanceText, 20, 30);
        }
        ethBalanceText.destroy();

        this.renderTexture.saveTexture('ethBalanceTexture');

        if(isLandscape()) {
            this.quadImage = this.scene.add.rexQuadImage({
                x: this.scene.screenWidth - 40,
                y: 500,
                texture: 'ethBalanceTexture',
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
                300,
                'ethBalanceTexture');            
            this.quadImage.setAlpha(1);
            this.quadImage.setScale(1.6,1.6);
            this.quadImage.topRight.x -= 100;
            this.quadImage.topRight.y -= 100;
            this.quadImage.bottomRight.x -= 100;
            this.quadImage.bottomRight.y -= 100;
        }
        this.quadImage.setVisible(false);

        // add a blocking delay here
        await new Promise(resolve => setTimeout(resolve, 500));

        this.updateBalance();
    }

    updateBalance(balance = null) {
        this.scene.time.delayedCall(250, () => {
            if (!this.renderTexture) {
                return;
            }

            this.renderTexture.clear();

            if (balance !== null) {
                this.balanceText = `${formatBalance(balance, ETH_BALANCE_DECIMALS)} ETH`;
            }

            const ethBalanceText = this.scene.add.text(0, 0, this.balanceText, {
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
            ethBalanceText.setVisible(false);
            if(isLandscape()) {
                this.renderTexture.draw(ethBalanceText, 320, 100);
            } else {
                this.renderTexture.draw(ethBalanceText, 20, 30);
            }
            ethBalanceText.destroy();

            if (this.quadImage) {
                this.quadImage.setTexture('ethBalanceTexture');
                this.quadImage.setVisible(true);
            }
        });
    }
}