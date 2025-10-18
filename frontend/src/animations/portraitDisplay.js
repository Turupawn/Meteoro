import { isLandscape } from '../utils/utils.js';
import { getSelectedBetAmount, getBetAmountsArray } from '../web3/blockchain_stuff.js';

export class PortraitDisplay {
    constructor(scene) {
        this.scene = scene;
        this.portraitSprite = null;
        this.currentBetAmount = null;
        this.isAnimationActive = false;
        this.landscapeModeSize = 300;
        this.portraitModeSize = 256; // 512x512 scaled down to 128x128
        this.create();
    }

    create() {
        // Load all portrait images
        this.loadPortraitImages();
        
        // Initial positioning
        this.updatePosition();
    }

    loadPortraitImages() {
        const betAmountsArray = getBetAmountsArray();
        if (!betAmountsArray || betAmountsArray.length === 0) {
            console.warn('No bet amounts available for portrait loading');
            return;
        }

        // Load images for each bet amount folder (01, 02, 03, etc.)
        betAmountsArray.forEach((betAmount, index) => {
            const folderNumber = String(index + 1).padStart(2, '0');
            
            // Load 01.png (default portrait)
            this.scene.load.image(
                `portrait_${folderNumber}_01`, 
                `/portraits/${folderNumber}/01.png`
            );
            
            // Load 02.png (animation portrait)
            this.scene.load.image(
                `portrait_${folderNumber}_02`, 
                `/portraits/${folderNumber}/02.png`
            );
        });
        
        // Start loading the images
        this.scene.load.start();
    }

    updatePortrait() {
        const currentBetAmount = getSelectedBetAmount();
        const betAmountsArray = getBetAmountsArray();
        
        if (!currentBetAmount || !betAmountsArray || betAmountsArray.length === 0) {
            this.hidePortrait();
            return;
        }

        // Find the index of current bet amount
        const betIndex = betAmountsArray.findIndex(amount => amount === currentBetAmount);
        if (betIndex === -1) {
            this.hidePortrait();
            return;
        }

        const folderNumber = String(betIndex + 1).padStart(2, '0');
        const portraitKey = this.isAnimationActive ? 
            `portrait_${folderNumber}_02` : 
            `portrait_${folderNumber}_01`;

        // If bet amount changed, update the portrait
        if (this.currentBetAmount !== currentBetAmount) {
            this.currentBetAmount = currentBetAmount;
            this.showPortrait(portraitKey);
        } else if (this.portraitSprite) {
            // Just update the texture if it's the same bet amount
            this.portraitSprite.setTexture(portraitKey);
        }
    }

    showPortrait(portraitKey) {
        // Check if the texture exists
        if (!this.scene.textures.exists(portraitKey)) {
            console.warn(`Portrait texture ${portraitKey} not found`);
            return;
        }

        // Remove existing portrait
        if (this.portraitSprite) {
            this.portraitSprite.destroy();
        }

        // Create new portrait sprite
        this.portraitSprite = this.scene.add.image(0, 0, portraitKey);
        this.portraitSprite.setDepth(100); // Above most UI elements
        
        this.updatePosition();
    }

    hidePortrait() {
        if (this.portraitSprite) {
            this.portraitSprite.destroy();
            this.portraitSprite = null;
        }
        this.currentBetAmount = null;
    }

    updatePosition() {
        if (!this.portraitSprite) return;

        const isLandscapeMode = isLandscape();
        
        if (isLandscapeMode) {
            this.portraitSprite.setDisplaySize(this.landscapeModeSize, this.landscapeModeSize);
            // In landscape mode, position on top of bet amount
            // This would be near the bet menu button area
            this.portraitSprite.setPosition(
                this.scene.screenWidth - 190, // Right side, above bet button
                this.scene.screenHeight - 260 // Above the bottom UI
            );
        } else {
            this.portraitSprite.setDisplaySize(this.portraitModeSize, this.portraitModeSize);
            // In portrait mode, position on top left
            this.portraitSprite.setPosition(
                170, // Left side
                270  // Top
            );
        }
    }

    startAnimation() {
        this.isAnimationActive = true;
        this.updatePortrait();
    }

    endAnimation() {
        this.isAnimationActive = false;
        this.updatePortrait();
    }

    destroy() {
        if (this.portraitSprite) {
            this.portraitSprite.destroy();
        }
    }
}
