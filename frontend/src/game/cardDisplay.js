export class CardDisplay {
    constructor(scene) {
        this.scene = scene;
        this.createCardDisplay();
        this.playerCardSprite = null;
        this.houseCardSprite = null;
        this.playerCardText = null;
        this.houseCardText = null;
        this.cardDistance = 300; // Same as background distance
        this.particleEmitter = null;
        this.goldParticles = [];
    }

    createCardDisplay() {
        // Responsive current game display - positioned in top center
        const x = this.scene.centerX;
        const y = this.scene.screenHeight * 0.15; // 15% down from top
        const fontSize = Math.max(18, this.scene.screenWidth / 40); // Larger font for readability
        
        this.currentGameText = this.scene.add.text(x, y, "", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5);
    }

    updateCurrentGameDisplay(playerCard = null, houseCard = null) {
        if (playerCard !== null && houseCard !== null) {
            // Clear any existing card sprites
            this.clearCardSprites();
            
            // Create card sprites that appear from space
            this.createCardSprites(playerCard, houseCard);
            
            const playerCardDisplay = this.getCardDisplay(playerCard);
            const houseCardDisplay = this.getCardDisplay(houseCard);
            const winner = playerCard > houseCard ? "Player" : "House";
            
            this.currentGameText.setText(`${winner} wins!`);
            
            // End boost animation when results are displayed
            if (this.scene.background && this.scene.background.endBoostAnimation) {
                this.scene.background.endBoostAnimation();
            }

            // If player wins, trigger particle animation
            if (playerCard > houseCard) {
                this.scene.time.delayedCall(1000, () => { // Wait for card animation to complete
                    this.triggerWinParticleAnimation();
                });
            }
        }
    }

    createCardSprites(playerCard, houseCard) {
        const cardScale = 0.3; // Adjust scale as needed
        const cardSpacing = 200; // Space between cards
        
        // Calculate final positions for the two cards
        const leftCardX = this.scene.centerX - cardSpacing / 2;
        const rightCardX = this.scene.centerX + cardSpacing / 2;
        const cardY = this.scene.centerY;
        
        // Start cards from deep space (far away)
        const startZ = -1000; // Start from far away like stars
        const startX1 = (Math.random() - 0.5) * this.scene.screenWidth * 2; // Random starting X
        const startY1 = (Math.random() - 0.5) * this.scene.screenHeight * 2; // Random starting Y
        const startX2 = (Math.random() - 0.5) * this.scene.screenWidth * 2;
        const startY2 = (Math.random() - 0.5) * this.scene.screenHeight * 2;
        
        // Create player card (left) - start from space
        this.playerCardSprite = this.scene.add.image(startX1, startY1, "card")
            .setScale(cardScale * 0.1) // Start very small
            .setOrigin(0.5)
            .setAlpha(0); // Start invisible
        
        // Create house card (right) - start from space
        this.houseCardSprite = this.scene.add.image(startX2, startY2, "card")
            .setScale(cardScale * 0.1) // Start very small
            .setOrigin(0.5)
            .setAlpha(0); // Start invisible
        
        // Add card numbers/text
        const fontSize = Math.max(24, this.scene.screenWidth / 30);
        
        this.playerCardText = this.scene.add.text(leftCardX, cardY, this.getCardDisplay(playerCard), {
            font: `${fontSize}px Arial`,
            fill: "#FFFFFF",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5).setAlpha(0);
        
        this.houseCardText = this.scene.add.text(rightCardX, cardY, this.getCardDisplay(houseCard), {
            font: `${fontSize}px Arial`,
            fill: "#FFFFFF",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5).setAlpha(0);
        
        // Store animation properties
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
        
        // Start the space animation (faster)
        this.animateCardsFromSpace();
    }

    animateCardsFromSpace() {
        const animationDuration = 600; // Much faster: 0.6 seconds
        const steps = 20; // Fewer steps for faster animation
        const stepDuration = animationDuration / steps;
        
        let currentStep = 0;
        
        const animateStep = () => {
            if (currentStep >= steps) {
                // Animation complete, show card numbers
                this.showCardNumbers();
                return;
            }
            
            const progress = currentStep / steps;
            const easeProgress = this.easeInOutCubic(progress);
            
            // Animate player card
            this.animateCardInSpace(this.playerCardData, easeProgress);
            
            // Animate house card with slight delay
            if (currentStep > steps * 0.1) { // Start house card after 10% of animation
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
        // Interpolate position from space to final position
        const currentX = cardData.startX + (cardData.finalX - cardData.startX) * progress;
        const currentY = cardData.startY + (cardData.finalY - cardData.startY) * progress;
        const currentZ = cardData.startZ + (cardData.finalZ - cardData.startZ) * progress;
        
        // Calculate perspective effect (same as stars)
        const perspective = this.cardDistance / (this.cardDistance - currentZ);
        const x_coord = this.scene.centerX + (currentX - this.scene.centerX) * perspective;
        const y_coord = this.scene.centerY + (currentY - this.scene.centerY) * perspective;
        
        // Update card position
        cardData.sprite.setPosition(x_coord, y_coord);
        
        // Scale card based on perspective (closer = bigger)
        const scale = Math.max(0.1, perspective * 0.3);
        cardData.sprite.setScale(scale);
        
        // Fade in as card gets closer
        const alpha = Math.min(1, progress * 2); // Start fading in halfway through
        cardData.sprite.setAlpha(alpha);
    }

    showCardNumbers() {
        // Show card numbers with fade-in effect
        this.scene.tweens.add({
            targets: this.playerCardText,
            alpha: 1,
            duration: 300, // Faster fade-in
            ease: 'Power2'
        });
        
        this.scene.tweens.add({
            targets: this.houseCardText,
            alpha: 1,
            duration: 300, // Faster fade-in
            delay: 100, // Shorter delay
            ease: 'Power2'
        });
    }

    triggerWinParticleAnimation() {
        if (!this.houseCardSprite) return;

        // Add screen flash effect
        this.createScreenFlash();
        
        // Add card shake effect
        this.shakeHouseCard();
        
        // Create gold particles that flow toward balance text (ETH transfer)
        const targetX = this.scene.screenWidth - 150; // Balance text X position
        const targetY = 200; // Balance text Y position
        this.createGoldFlowToPlayerPOV(this.houseCardSprite.x, this.houseCardSprite.y, targetX, targetY);
    }

    createFireworkToPlayerPOV() {
        // Use center position instead of house card position
        const explosionX = this.scene.centerX;
        const explosionY = this.scene.centerY;
        
        // Target is balance text position
        const targetX = this.scene.screenWidth - 150;
        const targetY = 200;
        
        // MEGA FIREWORK explosion from center
        this.particleEmitter = this.scene.add.particles(explosionX, explosionY, 'card', {
            frame: 'card',
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

        // Secondary sparkle explosion
        const sparkleEmitter = this.scene.add.particles(explosionX, explosionY, 'card', {
            frame: 'card',
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

        // Start the firework explosions
        this.particleEmitter.explode(80, explosionX, explosionY);
        sparkleEmitter.explode(60, explosionX, explosionY);

        // Create gold particles that flow toward balance text (ETH transfer)
        this.createGoldFlowToPlayerPOV(explosionX, explosionY, targetX, targetY);

        // Clean up emitters
        this.scene.time.delayedCall(4000, () => {
            if (this.particleEmitter) {
                this.particleEmitter.destroy();
                this.particleEmitter = null;
            }
            sparkleEmitter.destroy();
        });
    }

    createGoldFlowToPlayerPOV(startX, startY, targetX, targetY) {
        // Create FIREWORK effect: particles explode outward first, then flow to balance text
        for (let i = 0; i < 40; i++) { // Fewer particles for cleaner effect
            const delay = Math.random() * 50; // Much faster initial explosion
            
            this.scene.time.delayedCall(delay, () => {
                // Create 3D-looking rotating gold cube
                const cubeSize = 8 + Math.random() * 12; // Bigger cubes 8-20
                const cubeFaces = this.create3DCube(startX, startY, cubeSize);
                
                // Calculate random explosion direction (360 degrees)
                const explosionAngle = Math.random() * Math.PI * 2;
                const explosionDistance = 150 + Math.random() * 200; // Explode 150-350 pixels away
                const explosionX = startX + Math.cos(explosionAngle) * explosionDistance;
                const explosionY = startY + Math.sin(explosionAngle) * explosionDistance;
                
                // PHASE 1: Explode outward to random positions
                cubeFaces.forEach((face, index) => {
                    // Add slight randomness to explosion position
                    const randomOffsetX = (Math.random() - 0.5) * 60;
                    const randomOffsetY = (Math.random() - 0.5) * 60;
                    
                    this.scene.tweens.add({
                        targets: face,
                        x: explosionX + randomOffsetX,
                        y: explosionY + randomOffsetY,
                        scale: 1.5 + Math.random() * 2, // Grow during explosion
                        alpha: 1,
                        duration: 400 + Math.random() * 200, // Much faster explosion
                        ease: 'Power2',
                        onComplete: () => {
                            // PHASE 2: Stay in place for a moment (0.2-0.4 seconds)
                            this.scene.time.delayedCall(200 + Math.random() * 200, () => {
                                // PHASE 3: Flow toward balance text
                                const finalTargetX = targetX + (Math.random() - 0.5) * 120;
                                const finalTargetY = targetY + (Math.random() - 0.5) * 60;
                                
                                this.scene.tweens.add({
                                    targets: face,
                                    x: finalTargetX,
                                    y: finalTargetY,
                                    scale: 4 + Math.random() * 6, // Much bigger as they approach balance text
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
                    
                    // Add rotation animation to each face
                    this.scene.tweens.add({
                        targets: face,
                        angle: 360,
                        duration: 600 + Math.random() * 400,
                        ease: 'Linear',
                        repeat: -1 // Infinite rotation
                    });
                });
            });
        }

        // Create additional sparkle trail effect with 3D cubes
        for (let i = 0; i < 25; i++) {
            const delay = 25 + Math.random() * 75;
            
            this.scene.time.delayedCall(delay, () => {
                const sparkleFaces = this.create3DCube(startX, startY, 5);
                sparkleFaces.forEach(face => face.setAlpha(0.9));
                
                // Calculate sparkle explosion direction
                const sparkleAngle = Math.random() * Math.PI * 2;
                const sparkleDistance = 100 + Math.random() * 150;
                const sparkleX = startX + Math.cos(sparkleAngle) * sparkleDistance;
                const sparkleY = startY + Math.sin(sparkleAngle) * sparkleDistance;
                
                sparkleFaces.forEach((face, index) => {
                    // PHASE 1: Explode outward
                    this.scene.tweens.add({
                        targets: face,
                        x: sparkleX + (Math.random() - 0.5) * 40,
                        y: sparkleY + (Math.random() - 0.5) * 40,
                        scale: 1.2 + Math.random() * 1.5,
                        alpha: 0.8,
                        duration: 300 + Math.random() * 150,
                        ease: 'Power2',
                        onComplete: () => {
                            // PHASE 2: Stay in place briefly
                            this.scene.time.delayedCall(150 + Math.random() * 150, () => {
                                // PHASE 3: Flow to balance text
                                this.scene.tweens.add({
                                    targets: face,
                                    x: targetX + (Math.random() - 0.5) * 100,
                                    y: targetY + (Math.random() - 0.5) * 50,
                                    scale: 3.5, // Sparkles also get bigger
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
                    
                    // Add rotation to sparkle cube
                    this.scene.tweens.add({
                        targets: face,
                        angle: 720, // Double rotation
                        duration: 1000 + Math.random() * 500,
                        ease: 'Linear'
                    });
                });
            });
        }
    }

    create3DCube(x, y, size) {
        // Create array to hold all cube faces
        const cubeFaces = [];
        
        // Front face (main gold face)
        const frontFace = this.scene.add.rectangle(x, y, size, size, 0xFFD700);
        frontFace.setAlpha(1);
        cubeFaces.push(frontFace);
        
        // Back face (darker gold)
        const backFace = this.scene.add.rectangle(x, y, size, size, 0xDAA520);
        backFace.setAlpha(0.8);
        cubeFaces.push(backFace);
        
        // Top face (lighter gold)
        const topFace = this.scene.add.rectangle(x, y - size/2, size, size/2, 0xFFFF00);
        topFace.setAlpha(0.9);
        cubeFaces.push(topFace);
        
        // Bottom face (darker gold)
        const bottomFace = this.scene.add.rectangle(x, y + size/2, size, size/2, 0xB8860B);
        bottomFace.setAlpha(0.7);
        cubeFaces.push(bottomFace);
        
        // Left face (medium gold)
        const leftFace = this.scene.add.rectangle(x - size/2, y, size/2, size, 0xFFA500);
        leftFace.setAlpha(0.8);
        cubeFaces.push(leftFace);
        
        // Right face (medium gold)
        const rightFace = this.scene.add.rectangle(x + size/2, y, size/2, size, 0xFFA500);
        rightFace.setAlpha(0.8);
        cubeFaces.push(rightFace);
        
        // Add glow effect
        const glowCube = this.scene.add.rectangle(x, y, size + 8, size + 8, 0xFFFF00);
        glowCube.setAlpha(0.3);
        cubeFaces.push(glowCube);
        
        return cubeFaces;
    }

    createScreenFlash() {
        // Create a bright flash overlay
        const flash = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.scene.screenWidth, 
            this.scene.screenHeight, 
            0xFFFFFF
        );
        flash.setAlpha(0);
        
        // Flash animation
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
        // Add shake effect to house card
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
                this.houseCardSprite.setPosition(originalX, originalY);
            }
        });
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    clearCardSprites() {
        // Remove existing card sprites and text
        if (this.playerCardSprite) {
            this.playerCardSprite.destroy();
            this.playerCardSprite = null;
        }
        if (this.houseCardSprite) {
            this.houseCardSprite.destroy();
            this.houseCardSprite = null;
        }
        if (this.playerCardText) {
            this.playerCardText.destroy();
            this.playerCardText = null;
        }
        if (this.houseCardText) {
            this.houseCardText.destroy();
            this.houseCardText = null;
        }
        
        // Clear particle emitter
        if (this.particleEmitter) {
            this.particleEmitter.destroy();
            this.particleEmitter = null;
        }
        
        // Clear animation data
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