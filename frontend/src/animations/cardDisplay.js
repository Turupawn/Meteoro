import { isLandscape } from '../utils/utils.js';

export class CardDisplay {
    constructor(scene) {
        this.scene = scene;
        this.createCardDisplay();
        this.playerCardSprite = null;
        this.houseCardSprite = null;
        this.playerCardText = null;
        this.houseCardText = null;
        this.cardDistance = 300;
        this.particleEmitter = null;
        this.goldParticles = [];
        this.cardSuits = ['clover', 'diamond', 'heart', 'spade'];
        this.inforFontSize = 70;
        const isLandscapeMode = isLandscape();
        this.cardFontSize = isLandscapeMode ? 160 : 160;
        this.baseScale = 0.7;
    }

    createCardDisplay() {
        const x = this.scene.centerX;
        const y = this.scene.centerY + 150; // Position below the cards from the start
        
        this.currentGameText = this.scene.add.text(x, y, "", {
            font: `bold 80px Orbitron`, // Changed to match other UI elements
            fill: "#E0F6FF", // Changed to match other text colors
            stroke: "#0066CC", // Changed to match other text strokes
            strokeThickness: 3, // Changed to match other text strokes
            alpha: 0.95, // Added alpha to match other text
            shadow: { // Added shadow to match other text
                offsetX: 3,
                offsetY: 3,
                color: '#003366',
                blur: 6,
                fill: true
            }
        }).setOrigin(0.5);
    }

    updateCurrentGameDisplay(playerCard = null, houseCard = null) {
        if (playerCard !== null && houseCard !== null) {
            // Clear any existing animations before creating new ones
            this.clearCardSprites();
            
            // Randomly select card suits for each card individually
            this.playerCardSuit = this.cardSuits[Math.floor(Math.random() * this.cardSuits.length)];
            this.houseCardSuit = this.cardSuits[Math.floor(Math.random() * this.cardSuits.length)];
            
            this.createCardSprites(playerCard, houseCard);
            
            const winner = playerCard > houseCard ? "Player" : "House";
            
            // Just update the text, no position change needed
            
            if(winner === "Player") {
                this.currentGameText.setText(`You win!`);
            }else{
                this.currentGameText.setText(`House wins`);
            }
            
            if (this.scene.background && this.scene.background.endBoostAnimation) {
                this.scene.background.endBoostAnimation();
            }

            if (playerCard > houseCard) {
                this.scene.time.delayedCall(1000, () => {
                    // Add null check before triggering animation
                    if (this.houseCardSprite && this.houseCardSprite.active) {
                        this.triggerWinParticleAnimation();
                    }
                });
            }
        }
    }

    createCardSprites(playerCard, houseCard) {
        const cardScale = 5; // Increased from 0.8 to 1.5 - MUCH BIGGER CARDS!
        const cardSpacing = 400; // Increased from 300 to 400 for more spacing
        
        const leftCardX = this.scene.centerX - cardSpacing / 2;
        const rightCardX = this.scene.centerX + cardSpacing / 2;
        const cardY = this.scene.centerY - 100; // Move cards up by 100 pixels
        
        const startZ = -1000;
        const startX1 = (Math.random() - 0.5) * this.scene.screenWidth * 2;
        const startY1 = (Math.random() - 0.5) * this.scene.screenHeight * 2;
        const startX2 = (Math.random() - 0.5) * this.scene.screenWidth * 2;
        const startY2 = (Math.random() - 0.5) * this.scene.screenHeight * 2;
        
        this.playerCardSprite = this.scene.add.image(startX1, startY1, this.playerCardSuit)
            .setScale(cardScale)
            .setOrigin(0.5)
            .setAlpha(0);
        
        this.houseCardSprite = this.scene.add.image(startX2, startY2, this.houseCardSuit)
            .setScale(cardScale)
            .setOrigin(0.5)
            .setAlpha(0);
        
        this.playerCardText = this.scene.add.text(leftCardX, cardY, this.getCardDisplay(playerCard), {
            font: `${this.cardFontSize}px Orbitron`, // Changed from Arial to Orbitron
            fill: "#FFFFFF",
            stroke: "#000000",
            strokeThickness: 8 // Increased from 5 to 8 for better visibility
        }).setOrigin(0.5).setAlpha(0);
        
        this.houseCardText = this.scene.add.text(rightCardX, cardY, this.getCardDisplay(houseCard), {
            font: `${this.cardFontSize}px Orbitron`, // Changed from Arial to Orbitron
            fill: "#FFFFFF",
            stroke: "#000000",
            strokeThickness: 8 // Increased from 5 to 8 for better visibility
        }).setOrigin(0.5).setAlpha(0);
        
        this.playerCardData = {
            sprite: this.playerCardSprite,
            text: this.playerCardText,
            startX: startX1,
            startY: startY1,
            startZ: startZ,
            finalX: leftCardX,
            finalY: cardY,
            finalZ: 0
        };
        
        this.houseCardData = {
            sprite: this.houseCardSprite,
            text: this.houseCardText,
            startX: startX2,
            startY: startY2,
            startZ: startZ,
            finalX: rightCardX,
            finalY: cardY,
            finalZ: 0
        };
        
        this.animateCardsFromSpace();
    }

    animateCardsFromSpace() {
        const animationDuration = 600;
        const steps = 20;
        const stepDuration = animationDuration / steps;
        
        let currentStep = 0;
        
        const animateStep = () => {
            // Add null checks to prevent errors if sprites were destroyed
            if (!this.playerCardData || !this.houseCardData) {
                return;
            }
            
            if (currentStep >= steps) {
                this.showCardNumbers();
                return;
            }
            
            const progress = currentStep / steps;
            const easeProgress = this.easeInOutCubic(progress);
            
            this.animateCardInSpace(this.playerCardData, easeProgress);
            
            if (currentStep > steps * 0.1) {
                const houseProgress = Math.max(0, (currentStep - steps * 0.1) / (steps * 0.9));
                const houseEaseProgress = this.easeInOutCubic(houseProgress);
                this.animateCardInSpace(this.houseCardData, houseEaseProgress);
            }
            
            currentStep++;
            this.scene.time.delayedCall(stepDuration, animateStep);
        };
        
        animateStep();
    }

    animateCardInSpace(cardData, progress) {
        // Add null checks to prevent errors
        if (!cardData || !cardData.sprite || !cardData.sprite.active) {
            return;
        }
        
        const currentX = cardData.startX + (cardData.finalX - cardData.startX) * progress;
        const currentY = cardData.startY + (cardData.finalY - cardData.startY) * progress;
        const currentZ = cardData.startZ + (cardData.finalZ - cardData.startZ) * progress;
        
        const perspective = this.cardDistance / (this.cardDistance - currentZ);
        const x_coord = this.scene.centerX + (currentX - this.scene.centerX) * perspective;
        const y_coord = this.scene.centerY + (currentY - this.scene.centerY) * perspective;
        
        cardData.sprite.setPosition(x_coord, y_coord);
        
        // Make the cards bigger at the end of animation
        const scale = Math.max(0.1, perspective * this.baseScale);
        cardData.sprite.setScale(scale);
        
        const alpha = Math.min(1, progress * 2);
        cardData.sprite.setAlpha(alpha);
    }

    showCardNumbers() {
        // Add null checks before creating tweens
        if (this.playerCardText && this.playerCardText.active) {
            this.scene.tweens.add({
                targets: this.playerCardText,
                alpha: 1,
                duration: 300,
                ease: 'Power2'
            });
        }
        
        if (this.houseCardText && this.houseCardText.active) {
            this.scene.tweens.add({
                targets: this.houseCardText,
                alpha: 1,
                duration: 300,
                delay: 100,
                ease: 'Power2'
            });
        }
    }

    triggerWinParticleAnimation() {
        // Add null check to prevent error
        if (!this.houseCardSprite || !this.houseCardSprite.active) return;

        this.createScreenFlash();
        
        this.shakeHouseCard();
        
        const targetX = this.scene.screenWidth - 150;
        const targetY = 200;
        this.createGoldFlowToPlayerPOV(this.houseCardSprite.x, this.houseCardSprite.y, targetX, targetY);
    }

    createFireworkToPlayerPOV() {
        const explosionX = this.scene.centerX;
        const explosionY = this.scene.centerY;
        
        const targetX = this.scene.screenWidth - 150;
        const targetY = 200;
        
        this.particleEmitter = this.scene.add.particles(explosionX, explosionY, this.currentCardSuit, {
            frame: this.currentCardSuit,
            lifespan: 2000,
            speed: { min: 300, max: 800 },
            scale: { start: 1.5, end: 0.1 },
            alpha: { start: 1, end: 0 },
            blendMode: 'ADD',
            frequency: 15,
            quantity: 5,
            angle: { min: 0, max: 360 },
            gravityY: -400,
            on: false
        });

        const sparkleEmitter = this.scene.add.particles(explosionX, explosionY, this.currentCardSuit, {
            frame: this.currentCardSuit,
            lifespan: 1500,
            speed: { min: 200, max: 600 },
            scale: { start: 1.0, end: 0.05 },
            alpha: { start: 0.9, end: 0 },
            blendMode: 'ADD',
            frequency: 10,
            quantity: 3,
            angle: { min: 0, max: 360 },
            gravityY: -300,
            on: false
        });

        this.particleEmitter.explode(80, explosionX, explosionY);
        sparkleEmitter.explode(60, explosionX, explosionY);

        this.createGoldFlowToPlayerPOV(explosionX, explosionY, targetX, targetY);

        this.scene.time.delayedCall(4000, () => {
            if (this.particleEmitter) {
                this.particleEmitter.destroy();
                this.particleEmitter = null;
            }
            sparkleEmitter.destroy();
        });
    }

    createGoldFlowToPlayerPOV(startX, startY, targetX, targetY) {
        for (let i = 0; i < 40; i++) {
            const delay = Math.random() * 50;
            
            this.scene.time.delayedCall(delay, () => {
                const cubeSize = 8 + Math.random() * 12;
                const cubeFaces = this.create3DCube(startX, startY, cubeSize);
                
                const explosionAngle = Math.random() * Math.PI * 2;
                const explosionDistance = 150 + Math.random() * 200;
                const explosionX = startX + Math.cos(explosionAngle) * explosionDistance;
                const explosionY = startY + Math.sin(explosionAngle) * explosionDistance;
                
                cubeFaces.forEach((face, index) => {
                    const randomOffsetX = (Math.random() - 0.5) * 60;
                    const randomOffsetY = (Math.random() - 0.5) * 60;
                    
                    this.scene.tweens.add({
                        targets: face,
                        x: explosionX + randomOffsetX,
                        y: explosionY + randomOffsetY,
                        scale: 1.5 + Math.random() * 2,
                        alpha: 1,
                        duration: 400 + Math.random() * 200,
                        ease: 'Power2',
                        onComplete: () => {
                            this.scene.time.delayedCall(200 + Math.random() * 200, () => {
                                const finalTargetX = targetX + (Math.random() - 0.5) * 120;
                                const finalTargetY = targetY + (Math.random() - 0.5) * 60;
                                
                                this.scene.tweens.add({
                                    targets: face,
                                    x: finalTargetX,
                                    y: finalTargetY,
                                    scale: 4 + Math.random() * 6,
                                    alpha: 0,
                                    duration: 1000 + Math.random() * 500,
                                    ease: 'Power2',
                                    onComplete: () => {
                                        face.destroy();
                                    }
                                });
                            });
                        }
                    });
                    
                    this.scene.tweens.add({
                        targets: face,
                        angle: 360,
                        duration: 600 + Math.random() * 400,
                        ease: 'Linear',
                        repeat: -1
                    });
                });
            });
        }

        for (let i = 0; i < 25; i++) {
            const delay = 25 + Math.random() * 75;
            
            this.scene.time.delayedCall(delay, () => {
                const sparkleFaces = this.create3DCube(startX, startY, 5);
                sparkleFaces.forEach(face => face.setAlpha(0.9));
                
                const sparkleAngle = Math.random() * Math.PI * 2;
                const sparkleDistance = 100 + Math.random() * 150;
                const sparkleX = startX + Math.cos(sparkleAngle) * sparkleDistance;
                const sparkleY = startY + Math.sin(sparkleAngle) * sparkleDistance;
                
                sparkleFaces.forEach((face, index) => {
                    this.scene.tweens.add({
                        targets: face,
                        x: sparkleX + (Math.random() - 0.5) * 40,
                        y: sparkleY + (Math.random() - 0.5) * 40,
                        scale: 1.2 + Math.random() * 1.5,
                        alpha: 0.8,
                        duration: 300 + Math.random() * 150,
                        ease: 'Power2',
                        onComplete: () => {
                            this.scene.time.delayedCall(150 + Math.random() * 150, () => {
                                this.scene.tweens.add({
                                    targets: face,
                                    x: targetX + (Math.random() - 0.5) * 100,
                                    y: targetY + (Math.random() - 0.5) * 50,
                                    scale: 3.5,
                                    alpha: 0,
                                    duration: 900 + Math.random() * 400,
                                    ease: 'Power2',
                                    onComplete: () => {
                                        face.destroy();
                                    }
                                });
                            });
                        }
                    });
                    
                    this.scene.tweens.add({
                        targets: face,
                        angle: 720,
                        duration: 1000 + Math.random() * 500,
                        ease: 'Linear'
                    });
                });
            });
        }
    }

    create3DCube(x, y, size) {
        const cubeFaces = [];
        
        const frontFace = this.scene.add.rectangle(x, y, size, size, 0xFFD700);
        frontFace.setAlpha(1);
        cubeFaces.push(frontFace);
        
        const backFace = this.scene.add.rectangle(x, y, size, size, 0xDAA520);
        backFace.setAlpha(0.8);
        cubeFaces.push(backFace);
        
        const topFace = this.scene.add.rectangle(x, y - size/2, size, size/2, 0xFFFF00);
        topFace.setAlpha(0.9);
        cubeFaces.push(topFace);
        
        const bottomFace = this.scene.add.rectangle(x, y + size/2, size, size/2, 0xB8860B);
        bottomFace.setAlpha(0.7);
        cubeFaces.push(bottomFace);
        
        const leftFace = this.scene.add.rectangle(x - size/2, y, size/2, size, 0xFFA500);
        leftFace.setAlpha(0.8);
        cubeFaces.push(leftFace);
        
        const rightFace = this.scene.add.rectangle(x + size/2, y, size/2, size, 0xFFA500);
        rightFace.setAlpha(0.8);
        cubeFaces.push(rightFace);
        
        const glowCube = this.scene.add.rectangle(x, y, size + 8, size + 8, 0xFFFF00);
        glowCube.setAlpha(0.3);
        cubeFaces.push(glowCube);
        
        return cubeFaces;
    }

    createScreenFlash() {
        const flash = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.scene.screenWidth, 
            this.scene.screenHeight, 
            0xFFFFFF
        );
        flash.setAlpha(0);
        
        this.scene.tweens.add({
            targets: flash,
            alpha: 0.4,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: flash,
                    alpha: 0,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: () => {
                        flash.destroy();
                    }
                });
            }
        });
    }

    shakeHouseCard() {
        // Add null check to prevent error
        if (!this.houseCardSprite) return;
        
        const originalX = this.houseCardSprite.x;
        const originalY = this.houseCardSprite.y;
        
        this.scene.tweens.add({
            targets: this.houseCardSprite,
            x: originalX + 15,
            duration: 60,
            ease: 'Power2',
            yoyo: true,
            repeat: 10,
            onComplete: () => {
                // Add null check before setting position
                if (this.houseCardSprite && this.houseCardSprite.active) {
                    this.houseCardSprite.setPosition(originalX, originalY);
                }
            }
        });
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    clearCardSprites() {
        // Stop any running tweens on the sprites before destroying them
        if (this.playerCardSprite) {
            this.scene.tweens.killTweensOf(this.playerCardSprite);
            this.playerCardSprite.destroy();
            this.playerCardSprite = null;
        }
        if (this.houseCardSprite) {
            this.scene.tweens.killTweensOf(this.houseCardSprite);
            this.houseCardSprite.destroy();
            this.houseCardSprite = null;
        }
        if (this.playerCardText) {
            this.scene.tweens.killTweensOf(this.playerCardText);
            this.playerCardText.destroy();
            this.playerCardText = null;
        }
        if (this.houseCardText) {
            this.scene.tweens.killTweensOf(this.houseCardText);
            this.houseCardText.destroy();
            this.houseCardText = null;
        }
        
        if (this.particleEmitter) {
            this.particleEmitter.destroy();
            this.particleEmitter = null;
        }
        
        this.playerCardData = null;
        this.houseCardData = null;
    }

    getCardDisplay(cardValue) {
        if (cardValue === 1) return "A";
        if (cardValue === 11) return "J";
        if (cardValue === 12) return "Q";
        if (cardValue === 13) return "K";
        return cardValue.toString();
    }
}