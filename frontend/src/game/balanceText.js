import { applyPerspectiveToQuadImageToLeft } from '../utils.js';
import { web3 } from '../blockchain_stuff.js';
import { isLandscape } from '../utils.js';

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

        this.renderTexture.draw(balanceText);
        balanceText.destroy();
        
        this.renderTexture.saveTexture('balanceTexture');

        const isLandscapeMode = isLandscape();
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Adjust position for mobile
        const x = isMobile ? this.scene.screenWidth - 60 : this.scene.screenWidth - 40;
        const y = isMobile ? 400 : 500;

        this.quadImage = this.scene.add.rexQuadImage({
            x: x,
            y: y,
            texture: 'balanceTexture',
            ninePointMode: true,
        });

        
        this.quadImage.setVisible(false); // Start invisible
        this.quadImage.setScale(50,50);
        this.quadImage.setAlpha(0.85);
        
        // Adjust perspective for mobile
        const perspectiveOffset = isMobile ? 500 : 1000;
        let perspectiveX = this.quadImage.centerLeft.x - perspectiveOffset;
        let perspectiveY = this.quadImage.centerLeft.y + 0;
        
        applyPerspectiveToQuadImageToLeft(this.quadImage, perspectiveX, perspectiveY);
    }

    updateBalance(balance = null) {
        if (!this.renderTexture) {
            return;
        }

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
        this.renderTexture.draw(balanceText, 320, 100);
        balanceText.destroy();

        if (this.quadImage) {
            this.quadImage.setTexture('balanceTexture');
            this.quadImage.setVisible(true); // Show after first update
        }
    }
}