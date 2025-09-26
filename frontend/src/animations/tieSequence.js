import { isLandscape } from '../utils/utils.js';
import { getSelectedBetAmount, getBetAmountsArray } from '../web3/blockchain_stuff.js';

export class TieSequence {
    constructor(scene) {
        this.scene = scene;
        this.currentImageIndex = 0;
        this.storyImages = [];
        this.nextButton = null;
        this.background = null;
        this.isActive = false;
        this.betLevel = null;
    }

    startTieSequence() {
        this.isActive = true;
        this.currentImageIndex = 0;
        
        // Determine bet level based on selected bet amount
        this.betLevel = this.getBetLevel();
        
        // Create background overlay
        this.createBackground();
        
        // Display first image (images should already be loaded)
        this.displayCurrentImage();
        this.createNextButton();
    }

    getBetLevel() {
        const betAmountsArray = getBetAmountsArray();
        const selectedBetAmount = getSelectedBetAmount();
        
        if (!betAmountsArray || !selectedBetAmount) {
            return '01'; // Default to lowest bet level
        }
        
        const selectedIndex = betAmountsArray.indexOf(selectedBetAmount);
        
        if (selectedIndex === 0) {
            return '01'; // Lowest bet
        } else if (selectedIndex === betAmountsArray.length - 1) {
            return '03'; // Highest bet
        } else {
            return '02'; // Middle bet
        }
    }

    createBackground() {
        this.background = this.scene.add.rectangle(
            this.scene.centerX,
            this.scene.centerY,
            this.scene.screenWidth,
            this.scene.screenHeight,
            0x000000,
            0.8
        );
        this.background.setDepth(300);
        this.background.setInteractive();
    }

    static async preloadStoryImages(scene) {
        const imagePromises = [];
        
        // Load all story images for all bet levels (01, 02, 03)
        for (let betLevel = 1; betLevel <= 3; betLevel++) {
            const betLevelStr = betLevel.toString().padStart(2, '0');
            for (let imageNum = 1; imageNum <= 3; imageNum++) {
                const imageKey = `story_${betLevelStr}_${imageNum.toString().padStart(2, '0')}`;
                const imagePath = `/story/${betLevelStr}/${imageNum.toString().padStart(2, '0')}.png`;
                
                // Check if image is already loaded
                if (!scene.textures.exists(imageKey)) {
                    imagePromises.push(
                        new Promise((resolve, reject) => {
                            scene.load.image(imageKey, imagePath);
                            scene.load.once('filecomplete-image-' + imageKey, resolve);
                            scene.load.once('loaderror', reject);
                            scene.load.start();
                        })
                    );
                }
            }
        }
        
        try {
            await Promise.all(imagePromises);
            console.log('All story images loaded successfully');
        } catch (error) {
            console.error('Error loading story images:', error);
        }
    }


    displayCurrentImage() {
        // Clear previous image
        if (this.storyImages.length > 0) {
            this.storyImages.forEach(image => {
                if (image && image.active) {
                    image.destroy();
                }
            });
            this.storyImages = [];
        }

        const imageKey = `story_${this.betLevel}_${(this.currentImageIndex + 1).toString().padStart(2, '0')}`;
        
        if (this.scene.textures.exists(imageKey)) {
            // Calculate position based on orientation
            const isLandscapeMode = isLandscape();
            const imageX = this.scene.centerX;
            const imageY = isLandscapeMode 
                ? this.scene.centerY 
                : 50 + (this.scene.screenHeight * 0.4); // 50px from top + 40% of screen height for better positioning
            
            const image = this.scene.add.image(imageX, imageY, imageKey);
            
            // Scale image to fit screen while maintaining aspect ratio
            const scale = this.calculateImageScale(image);
            image.setScale(scale);
            image.setDepth(301);
            
            this.storyImages.push(image);
        } else {
            console.error(`Story image not found: ${imageKey}`);
        }
    }

    calculateImageScale(image) {
        const maxWidth = this.scene.screenWidth * 0.9;
        const maxHeight = this.scene.screenHeight * 0.8;
        
        const scaleX = maxWidth / image.width;
        const scaleY = maxHeight / image.height;
        
        return Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size
    }

    createNextButton() {
        const isLandscapeMode = isLandscape();
        const buttonFontSize = isLandscapeMode
            ? Math.max(24, this.scene.screenWidth / 40)
            : Math.max(28, this.scene.screenWidth / 20);
        
        const buttonWidth = isLandscapeMode ? 200 : 250;
        const buttonHeight = isLandscapeMode ? 60 : 80;
        
        // Position button based on orientation
        const buttonX = this.scene.centerX;
        const buttonY = isLandscapeMode 
            ? this.scene.centerY + (this.scene.screenHeight * 0.35) // Original positioning for landscape
            : 50 + (this.scene.screenHeight * 0.4) + (this.scene.screenHeight * 0.3); // Below the image in portrait mode
        
        // Button background
        this.nextButtonBg = this.scene.add.rectangle(
            buttonX,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x0066CC,
            0.8
        );
        this.nextButtonBg.setStrokeStyle(3, 0x00FFFF);
        this.nextButtonBg.setDepth(302);
        this.nextButtonBg.setInteractive();
        
        // Button text
        const buttonText = this.currentImageIndex < 2 ? "NEXT" : "CLOSE";
        this.nextButton = this.scene.add.text(buttonX, buttonY, buttonText, {
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
        }).setOrigin(0.5);
        this.nextButton.setDepth(303);
        this.nextButton.setInteractive();
        
        // Add click handlers
        this.nextButtonBg.on('pointerdown', () => this.handleNextClick());
        this.nextButton.on('pointerdown', () => this.handleNextClick());
    }

    handleNextClick() {
        if (this.currentImageIndex < 2) {
            // Go to next image
            this.currentImageIndex++;
            this.displayCurrentImage();
            this.updateNextButton();
        } else {
            // Close the sequence
            this.closeTieSequence();
        }
    }

    updateNextButton() {
        if (this.nextButton) {
            const buttonText = this.currentImageIndex < 2 ? "NEXT" : "CLOSE";
            this.nextButton.setText(buttonText);
        }
    }

    closeTieSequence() {
        this.isActive = false;
        
        // Destroy all elements
        if (this.background) {
            this.background.destroy();
            this.background = null;
        }
        
        this.storyImages.forEach(image => {
            if (image && image.active) {
                image.destroy();
            }
        });
        this.storyImages = [];
        
        if (this.nextButtonBg) {
            this.nextButtonBg.destroy();
            this.nextButtonBg = null;
        }
        
        if (this.nextButton) {
            this.nextButton.destroy();
            this.nextButton = null;
        }
    }

    destroy() {
        this.closeTieSequence();
    }
}
