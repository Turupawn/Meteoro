import { applyPerspectiveToQuadImageToRight, isLandscape, getCardDisplay } from '../../utils/utils.js';

export class GameHistory {
    recentHistory = [];
    
    constructor(scene) {
        this.scene = scene;
        this.createGameHistory();
    }

    createGameHistory() {
        // Check if fonts are already ready
        if (window.fontsReady) {
            this.createGameHistoryTexture();
        } else {
            // Wait for fonts to be ready
            window.onFontsReady = () => {
                this.createGameHistoryTexture();
            };
        }
    }

    createGameHistoryTexture() {
        this.renderTexture = this.scene.add.renderTexture(0, 0, 300, 400);
        
        const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
            font: 'bold 28px Orbitron',
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
        titleText.setVisible(false);
        
        this.renderTexture.draw(titleText, 10, 10);
        titleText.destroy();

        const sampleText = this.scene.add.text(0, 0, '', {
            font: '18px Orbitron',
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 1,
            alpha: 0.9
        });
        sampleText.setVisible(false);
        this.renderTexture.draw(sampleText, 10, 40);
        sampleText.destroy();

        this.renderTexture.saveTexture('gameHistoryTexture');

        // Only create quadImage in landscape mode
        if(isLandscape()) {
            this.quadImage = this.scene.add.rexQuadImage({
                x: 236+50,
                y: 300,
                texture: 'gameHistoryTexture',
                ninePointMode: true
            
            });

            this.quadImage.setScale(16,16);
            this.quadImage.setAlpha(0.85);

            let perspectiveX = this.quadImage.topLeft.x + 1200;
            let perspectiveY = this.quadImage.topLeft.y + 300;

            applyPerspectiveToQuadImageToRight(this.quadImage, perspectiveX, perspectiveY);
            this.quadImage.setVisible(false);
        } else {
            // In portrait mode, don't create the quadImage at all
            this.quadImage = null;
        }
    }

    updateGameHistory(playerAddress = null) {
        this.scene.time.delayedCall(250, () => {
            if (!this.renderTexture) {
                return;
            }
            
            // Don't update game history in portrait mode
            if (!isLandscape()) {
                return;
            }

            this.renderTexture.clear();

            if(isLandscape()) {
                const titleText = this.scene.add.text(0, 0, 'GAME HISTORY', {
                    font: 'bold 24px Orbitron',
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
                titleText.setVisible(false);
                this.renderTexture.draw(titleText, 10, 10);
                titleText.destroy();
            }
            
            let yOffset = 40;
            this.recentHistory.forEach((game, index) => {
                let isWin = false;
                let isTie = false;
                let isPending = false;

                if (game.playerCard === "?" && game.houseCard === "?") {
                    isPending = true;
                } else if (game.playerCard && game.houseCard) {
                    let playerCard = game.playerCard;
                    let houseCard = game.houseCard;
                    if (playerCard === houseCard) {
                        isTie = true;
                    } else {
                        if (playerCard == "J") playerCard = 11;
                        else if (playerCard == "Q") playerCard = 12;
                        else if (playerCard == "K") playerCard = 13;
                        else if (playerCard == "A") playerCard = 14;
                        else playerCard = parseInt(playerCard);

                        if (houseCard == "J") houseCard = 11;
                        else if (houseCard == "Q") houseCard = 12;
                        else if (houseCard == "K") houseCard = 13;
                        else if (houseCard == "A") houseCard = 14;
                        else houseCard = parseInt(houseCard);

                        isWin = playerCard > houseCard;
                    }
                }
                
                const score = `${getCardDisplay(game.playerCard)}-${getCardDisplay(game.houseCard)}`;
                
                // Set color based on game state
                let textColor;
                if (isPending || isTie) {
                    textColor = '#FFFFFF'; // White for pending games or ties
                } else {
                    textColor = isWin ? '#00FF00' : '#FF4444'; // Green for win, red for loss
                }
                const gameText = this.scene.add.text(0, 0, score, {
                    font: '18px Orbitron',
                    fill: textColor,
                    stroke: '#0066CC',
                    strokeThickness: 1,
                    alpha: 0.9
                });
                gameText.setVisible(false);
                this.renderTexture.draw(gameText, 10, yOffset);
                gameText.destroy();
                
                yOffset += 25;
            });

            if (this.quadImage) {
                this.quadImage.setTexture('gameHistoryTexture');
                this.quadImage.setVisible(true);
            }
        });
    }

    initializeHistory(recentHistory) {
        this.recentHistory = recentHistory;
    }

    addPendingGameToHistory() {
        // Don't add to history in portrait mode
        if (!isLandscape()) {
            return;
        }
        
        // Check if there's already a pending game (most recent game with ?-?)
        if (this.recentHistory.length > 0) {
            const mostRecentGame = this.recentHistory[0];
            if (mostRecentGame && mostRecentGame.playerCard === "?" && mostRecentGame.houseCard === "?") {
                // Already have a pending game, don't add another one
                return;
            }
        }
        
        const newGame = {
            gameState: 1, // Committed state
            playerAddress: "0x0", // Will be updated when we have access to wallet
            playerCommit: "0x0",
            commitTimestamp: Math.floor(Date.now() / 1000),
            betAmount: "0", // Will be updated when we have access to bet amount
            houseRandomness: "0x0",
            houseRandomnessTimestamp: 0,
            playerSecret: "0x0",
            playerCard: "?", // Placeholder
            houseCard: "?", // Placeholder
            revealTimestamp: 0
        };
        
        // Add to the beginning of the array (most recent first)
        this.recentHistory.unshift(newGame);
        
        // Keep only the first 10 games
        if (this.recentHistory.length > 10) {
            this.recentHistory = this.recentHistory.slice(0, 10);
        }
        
        // Update the display
        this.updateGameHistory(this.recentHistory);
    }
    
    updateLastGameInHistory(playerCard, houseCard) {
        // Don't update history in portrait mode
        if (!isLandscape()) {
            return;
        }
        
        if (!this.recentHistory || this.recentHistory.length === 0) {
            return;
        }

        // Update the first (most recent) game with the actual results
        const lastGame = this.recentHistory[0];
        if (lastGame && lastGame.playerCard === "?" && lastGame.houseCard === "?") {
            lastGame.playerCard = getCardDisplay(playerCard);
            lastGame.houseCard = getCardDisplay(houseCard);
            lastGame.revealTimestamp = Math.floor(Date.now() / 1000);
            
            // Update the display
            this.updateGameHistory(this.recentHistory);
        }
    }
}