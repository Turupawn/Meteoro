import { applyPerspectiveToQuadImageToLeft, isLandscape, USDC_BALANCE_DECIMALS } from '../../utils/utils.js';
import { formatTokenBalance } from '../../web3/blockchain_stuff.js';

export class UsdcBalanceText {

    usdcBalanceText = '';

    constructor(scene) {
        this.scene = scene;
        this.createUsdcBalanceText();
    }

    createUsdcBalanceText() {
        if(isLandscape()) {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 1200, 1200);
        } else {
            this.renderTexture = this.scene.add.renderTexture(0, 0, 600, 220);
        }

        const usdcBalanceText = this.scene.add.text(0, 0, '     0 USDC', {
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
        usdcBalanceText.setVisible(false);

        if(isLandscape()) {
            this.renderTexture.draw(usdcBalanceText);
        } else {
            this.renderTexture.draw(usdcBalanceText, 20, 30);
        }
        usdcBalanceText.destroy();

        this.renderTexture.saveTexture('usdcBalanceTexture');

        if(isLandscape()) {
            this.quadImage = this.scene.add.rexQuadImage({
                x: this.scene.screenWidth - 40,
                y: 600,
                texture: 'usdcBalanceTexture',
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
                400,
                'usdcBalanceTexture');
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
        this.scene.time.delayedCall(250, () => {
            if (!this.renderTexture) {
                return;
            }

            this.renderTexture.clear();

            if (balance !== null) {
                this.usdcBalanceText = `${formatTokenBalance(balance, 6, USDC_BALANCE_DECIMALS)} USDC`;
            }

            const usdcBalanceText = this.scene.add.text(0, 0, this.usdcBalanceText, {
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
            usdcBalanceText.setVisible(false);
            if(isLandscape()) {
                this.renderTexture.draw(usdcBalanceText, 320, 100);
            } else {
                this.renderTexture.draw(usdcBalanceText, 20, 30);
            }
            usdcBalanceText.destroy();

            if (this.quadImage) {
                this.quadImage.setTexture('usdcBalanceTexture');
                this.quadImage.setVisible(true);
            }
        });
    }
}
