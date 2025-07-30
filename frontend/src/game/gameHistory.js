export class GameHistory {
    constructor(scene) {
        this.scene = scene;
        this.createGameHistory();
    }

    createGameHistory() {
        // Create a render texture for the game history - made it bigger
        this.renderTexture = this.scene.add.renderTexture(0, 0, 300, 400);
        
        // Create the text content first
        const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
            font: 'bold 24px Courier New',
            fill: '#00FFFF',
            stroke: '#000000',
            strokeThickness: 2
        });
        titleText.setVisible(false);

        // Draw text to render texture
        this.renderTexture.draw(titleText, 10, 10);
        titleText.destroy();

        // Add sample text for testing
        const sampleText = this.scene.add.text(0, 0, 'WIN 10-5\nLOSS 3-8\nWIN Q-6', {
            font: '18px Courier New',
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
        this.quadImage = this.scene.add.rexQuadImage(200, 300, 'gameHistoryTexture');
        
        // Make sure it's visible and has proper size
        this.quadImage.setVisible(true);
        this.quadImage.setAlpha(1);
        
        this.quadImage.topRight.x -= 100;
        this.quadImage.topRight.y += 100;
        this.quadImage.bottomRight.x -= 100;
        this.quadImage.bottomRight.y += 100;
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

        // Create title text
        const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
            font: 'bold 24px Courier New',
            fill: '#00FFFF',
            stroke: '#000000',
            strokeThickness: 2
        });
        titleText.setVisible(false);
        this.renderTexture.draw(titleText, 10, 10);
        titleText.destroy();

        // Add game entries
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
                font: '18px Courier New',
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