import { applyPerspectiveToQuadImageToRight } from '../utils.js';

export class GameHistory {
    constructor(scene) {
        this.scene = scene;
        this.createGameHistory();
    }

    createGameHistory() {
        // Create a render texture for the game history - made it bigger
        console.log("starting game history");

        this.renderTexture = this.scene.add.renderTexture(0, 0, 300, 400);
        
        // Create the text content first with Orbitron font - Metroid Prime style
        const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
            font: 'bold 28px Orbitron',
            fill: '#E0F6FF', // Same as balance text
            stroke: '#0066CC', // Same as balance text
            strokeThickness: 2,
            alpha: 0.9, // Same transparency as balance text
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        });
        titleText.setVisible(false);

        // Draw text to render texture
        this.renderTexture.draw(titleText, 10, 10);
        titleText.destroy();

        // Add sample text for testing with Orbitron font
        const sampleText = this.scene.add.text(0, 0, '', {
            font: '18px Orbitron', // Changed to Orbitron font
            fill: '#E0F6FF', // Same as balance text
            stroke: '#0066CC', // Same as balance text
            strokeThickness: 1,
            alpha: 0.9 // Same transparency as balance text
        });
        sampleText.setVisible(false);
        this.renderTexture.draw(sampleText, 10, 40);
        sampleText.destroy();

        // Save the texture
        this.renderTexture.saveTexture('gameHistoryTexture');

        // Create quad image with the texture - moved to the left
        this.quadImage = this.scene.add.rexQuadImage({
                x: 236+50,
                y: 300,
                texture: 'gameHistoryTexture',
                ninePointMode: true
            
        });

        this.quadImage.setScale(16,16);
        this.quadImage.setAlpha(0.85); // Same transparency as balance text

        let perspectiveX = this.quadImage.topLeft.x + 1200;
        let perspectiveY = this.quadImage.topLeft.y + 300;

        applyPerspectiveToQuadImageToRight(this.quadImage, perspectiveX, perspectiveY);
        console.log("finished game history");

    }

    updateGameHistory(recentHistory = null, playerAddress = null) {
        if (!this.renderTexture) {
            return;
        }

        if (!recentHistory || recentHistory.length === 0) {
            return;
        }

        // Clear the render texture
        this.renderTexture.clear();

        // Create title text with Orbitron font - same styling as balance text
        const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
            font: 'bold 24px Orbitron',
            fill: '#E0F6FF', // Same as balance text
            stroke: '#0066CC', // Same as balance text
            strokeThickness: 2,
            alpha: 0.9, // Same transparency as balance text
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        });
        titleText.setVisible(false);
        this.renderTexture.draw(titleText, 10, 10);
        titleText.destroy();

        // Add game entries with Orbitron font - same styling as balance text
        let yOffset = 40;
        recentHistory.forEach((game, index) => {
            // Check for different possible result formats
            let isWin = false;
            if (game.result === 'WIN' || game.result === 'win' || game.result === 1 || game.result === true) {
                isWin = true;
            } else if (game.result === 'LOSS' || game.result === 'loss' || game.result === 0 || game.result === false) {
                isWin = false;
            } else {
                // If result is not a standard format, try to determine from other properties
                if (game.playerCard && game.houseCard) {
                    // Try to determine win/loss from card values
                    const playerCard = parseInt(game.playerCard);
                    const houseCard = parseInt(game.houseCard);
                    if (!isNaN(playerCard) && !isNaN(houseCard)) {
                        isWin = playerCard > houseCard;
                    }
                }
            }
            
            const score = `${game.playerCard}-${game.houseCard}`;
            
            // Create the game text with win/loss color styling
            const textColor = isWin ? '#00FF00' : '#FF4444'; // Green for win, red for loss
            const gameText = this.scene.add.text(0, 0, score, {
                font: '18px Orbitron',
                fill: textColor, // Color based on win/loss
                stroke: '#0066CC', // Same as balance text
                strokeThickness: 1,
                alpha: 0.9 // Same transparency as balance text
            });
            gameText.setVisible(false);
            this.renderTexture.draw(gameText, 10, yOffset); // Back to original position
            gameText.destroy();
            
            yOffset += 25;
        });

        // Update the quad image texture
        if (this.quadImage) {
            this.quadImage.setTexture('gameHistoryTexture');
        }
    }
}