import { applyPerspectiveToQuadImageToRight } from '../utils.js';

export class GameHistory {
    constructor(scene) {
        this.scene = scene;
        this.createGameHistory();
    }

    createGameHistory() {
        // Create a render texture for the game history - made it bigger
        this.renderTexture = this.scene.add.renderTexture(0, 0, 300, 400);
        
        // Create the text content first with Orbitron font
        const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
            font: 'bold 24px Orbitron', // Changed to Orbitron font
            fill: '#00FFFF',
            stroke: '#000000',
            strokeThickness: 2
        });
        titleText.setVisible(false);

        // Draw text to render texture
        this.renderTexture.draw(titleText, 10, 10);
        titleText.destroy();

        // Add sample text for testing with Orbitron font
        const sampleText = this.scene.add.text(0, 0, '', {
            font: '18px Orbitron', // Changed to Orbitron font
            fill: '#00FF00',
            stroke: '#000000',
            strokeThickness: 1
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

        let perspectiveX = this.quadImage.topLeft.x + 1200;
        let perspectiveY = this.quadImage.topLeft.y + 300;

        applyPerspectiveToQuadImageToRight(this.quadImage, perspectiveX, perspectiveY);
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

        // Create title text with Orbitron font
        const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
            font: 'bold 24px Orbitron', // Changed to Orbitron font
            fill: '#00FFFF',
            stroke: '#000000',
            strokeThickness: 2
        });
        titleText.setVisible(false);
        this.renderTexture.draw(titleText, 10, 10);
        titleText.destroy();

        // Add game entries with Orbitron font
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
            
            const color = isWin ? '#00FF00' : '#FF4444';
            const result = isWin ? 'WIN' : 'LOSS';
            const score = `${game.playerCard}-${game.houseCard}`;
            
            const gameText = this.scene.add.text(0, 0, `${result} ${score}`, {
                font: '18px Orbitron', // Changed to Orbitron font
                fill: color,
                stroke: '#000000',
                strokeThickness: 1
            });
            gameText.setVisible(false);
            this.renderTexture.draw(gameText, 10, yOffset);
            gameText.destroy();
            
            yOffset += 25;
        });

        // Update the quad image texture
        if (this.quadImage) {
            this.quadImage.setTexture('gameHistoryTexture');
        }
    }
}