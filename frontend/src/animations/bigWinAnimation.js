import { isLandscape } from '../utils/utils.js';

export class BigWinAnimation {
    constructor(scene) {
        this.scene = scene;
        this.isActive = false;
        this.background = null;
        this.bigWinText = null;
        this.numberText = null;
        this.gachaText = null;
        this.collectButton = null;
        this.collectButtonBg = null;
        this.zoomTween = null;
        this.pulseTween = null;
    }

    startBigWinAnimation(winAmount, showBigWinText = true) {
        this.isActive = true;
        this.createBackground();
        if (showBigWinText) {
            this.createBigWinText();
        }
        this.createNumberText(winAmount);
        this.createGachaText();
        this.createCollectButton();
        this.startAnimations();
    }

    createBackground() {
        this.background = this.scene.add.rectangle(
            this.scene.centerX,
            this.scene.centerY,
            this.scene.screenWidth,
            this.scene.screenHeight,
            0x000000,
            0.9
        );
        this.background.setDepth(400);
        this.background.setInteractive();
    }

    createBigWinText() {
        const isLandscapeMode = isLandscape();
        const fontSize = isLandscapeMode 
            ? Math.max(48, this.scene.screenWidth / 15)
            : Math.max(56, this.scene.screenWidth / 8);
        
        const textY = isLandscapeMode 
            ? this.scene.centerY - (this.scene.screenHeight * 0.2)
            : this.scene.centerY - (this.scene.screenHeight * 0.25);

        this.bigWinText = this.scene.add.text(this.scene.centerX, textY, "BIG WIN", {
            font: `bold ${fontSize}px Orbitron`,
            fill: '#FFD700',
            stroke: '#FFA500',
            strokeThickness: 4,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#B8860B',
                blur: 6,
                fill: true
            }
        }).setOrigin(0.5);
        this.bigWinText.setDepth(401);
    }

    createNumberText(winAmount) {
        const isLandscapeMode = isLandscape();
        const fontSize = isLandscapeMode 
            ? Math.max(72, this.scene.screenWidth / 10)
            : Math.max(84, this.scene.screenWidth / 6);
        
        const textY = isLandscapeMode 
            ? this.scene.centerY
            : this.scene.centerY - (this.scene.screenHeight * 0.05);

        // Start with 0 and animate to the win amount
        this.numberText = this.scene.add.text(this.scene.centerX, textY, "0", {
            font: `bold ${fontSize}px Orbitron`,
            fill: '#FFD700',
            stroke: '#FFA500',
            strokeThickness: 5,
            shadow: {
                offsetX: 4,
                offsetY: 4,
                color: '#B8860B',
                blur: 8,
                fill: true
            }
        }).setOrigin(0.5);
        this.numberText.setDepth(401);
        
        // Convert win amount from wei to ether for display
        this.targetAmount = winAmount / 1e18;
    }

    createGachaText() {
        const isLandscapeMode = isLandscape();
        const fontSize = isLandscapeMode 
            ? Math.max(36, this.scene.screenWidth / 20)
            : Math.max(42, this.scene.screenWidth / 12);
        
        const textY = isLandscapeMode 
            ? this.scene.centerY + (this.scene.screenHeight * 0.15)
            : this.scene.centerY + (this.scene.screenHeight * 0.1);

        this.gachaText = this.scene.add.text(this.scene.centerX, textY, "GACHA", {
            font: `bold ${fontSize}px Orbitron`,
            fill: '#FFD700',
            stroke: '#FFA500',
            strokeThickness: 3,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#B8860B',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5);
        this.gachaText.setDepth(401);
    }

    createCollectButton() {
        const isLandscapeMode = isLandscape();
        const buttonFontSize = isLandscapeMode
            ? Math.max(24, this.scene.screenWidth / 40)
            : Math.max(28, this.scene.screenWidth / 20);
        
        const buttonWidth = isLandscapeMode ? 200 : 250;
        const buttonHeight = isLandscapeMode ? 60 : 80;
        
        const buttonX = this.scene.centerX;
        const buttonY = isLandscapeMode 
            ? this.scene.centerY + (this.scene.screenHeight * 0.3)
            : this.scene.centerY + (this.scene.screenHeight * 0.2);
        
        // Button background
        this.collectButtonBg = this.scene.add.rectangle(
            buttonX,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x0066CC,
            0.9
        );
        this.collectButtonBg.setStrokeStyle(4, 0x00FFFF);
        this.collectButtonBg.setDepth(402);
        this.collectButtonBg.setInteractive();
        
        // Button text
        this.collectButton = this.scene.add.text(buttonX, buttonY, "Collect", {
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
        this.collectButton.setDepth(403);
        this.collectButton.setInteractive();
        
        // Add click handlers
        this.collectButtonBg.on('pointerdown', () => this.closeBigWinAnimation());
        this.collectButton.on('pointerdown', () => this.closeBigWinAnimation());
    }

    startAnimations() {
        // Count up animation for the number
        this.startCountingAnimation();
        
        // Zoom in and out animation for the number
        this.zoomTween = this.scene.tweens.add({
            targets: this.numberText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        // Pulse animation for BIG WIN text (only if it exists)
        if (this.bigWinText) {
            this.pulseTween = this.scene.tweens.add({
                targets: this.bigWinText,
                alpha: 0.7,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });
        }

        // Gentle glow animation for GACHA text
        this.scene.tweens.add({
            targets: this.gachaText,
            alpha: 0.8,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });
    }

    startCountingAnimation() {
        // Animate the number from 0 to target amount
        const duration = 2000; // 2 seconds
        const steps = 60; // 60 steps for smooth animation
        const stepDuration = duration / steps;
        const increment = this.targetAmount / steps;
        
        let currentValue = 0;
        let step = 0;
        
        const countingTimer = this.scene.time.addEvent({
            delay: stepDuration,
            callback: () => {
                currentValue += increment;
                step++;
                
                // Ensure we don't go over the target
                if (currentValue >= this.targetAmount) {
                    currentValue = this.targetAmount;
                    // Format the number to show up to 4 decimal places
                    const formattedValue = currentValue.toFixed(4).replace(/\.?0+$/, '');
                    this.numberText.setText(formattedValue);
                    countingTimer.destroy();
                } else {
                    // Format the number to show up to 4 decimal places
                    const formattedValue = currentValue.toFixed(4).replace(/\.?0+$/, '');
                    this.numberText.setText(formattedValue);
                }
            },
            loop: true
        });
    }

    closeBigWinAnimation() {
        this.isActive = false;
        
        // Stop all animations
        if (this.zoomTween) {
            this.zoomTween.stop();
            this.zoomTween = null;
        }
        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
        
        // Destroy all elements
        if (this.background) {
            this.background.destroy();
            this.background = null;
        }
        
        if (this.bigWinText) {
            this.bigWinText.destroy();
            this.bigWinText = null;
        }
        
        if (this.numberText) {
            this.numberText.destroy();
            this.numberText = null;
        }
        
        if (this.gachaText) {
            this.gachaText.destroy();
            this.gachaText = null;
        }
        
        if (this.collectButtonBg) {
            this.collectButtonBg.destroy();
            this.collectButtonBg = null;
        }
        
        if (this.collectButton) {
            this.collectButton.destroy();
            this.collectButton = null;
        }
    }

    destroy() {
        this.closeBigWinAnimation();
    }
}
