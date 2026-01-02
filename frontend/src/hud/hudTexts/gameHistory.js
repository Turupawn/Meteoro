import { applyPerspectiveToQuadImageToRight, isLandscape, getCardDisplay } from '../../utils/utils.js';

export class GameHistory {
    recentHistory = [];
    pendingRender = null;

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
        if (isLandscape()) {
            this.quadImage = this.scene.add.rexQuadImage({
                x: 236 + 50,
                y: 300,
                texture: 'gameHistoryTexture',
                ninePointMode: true

            });

            this.quadImage.setScale(16, 16);
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
        // Cancel any pending render to avoid race conditions
        if (this.pendingRender) {
            this.pendingRender.destroy();
            this.pendingRender = null;
        }
        
        this.pendingRender = this.scene.time.delayedCall(250, () => {
            this.pendingRender = null;
            
            if (!this.renderTexture) {
                return;
            }

            // Don't update game history in portrait mode
            if (!isLandscape()) {
                return;
            }

            this.renderTexture.clear();

            if (isLandscape()) {
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
        // Filter out any games with state 0 (NotStarted) or with card values of 0
        // These are incomplete games that shouldn't be in history
        const validGames = recentHistory ? recentHistory.filter(g => {
            const hasValidCards = g.playerCard && g.houseCard && 
                                  BigInt(g.playerCard) > 0n && BigInt(g.houseCard) > 0n;
            const isCompleted = g.gameState === 2 || g.gameState === 2n;
            return hasValidCards && isCompleted;
        }) : [];
        
        this.recentHistory = [...validGames].reverse();
        
        // Update display with the initialized history
        if (isLandscape()) {
            this.updateGameHistory(this.recentHistory);
        }
    }

    addPendingGameToHistory() {
        // Don't add to history in portrait mode
        if (!isLandscape()) {
            return;
        }

        // Check if there's ANY pending game in history (not just the most recent)
        const hasPendingGame = this.recentHistory.some(
            game => game && game.playerCard === "?" && game.houseCard === "?"
        );
        
        if (hasPendingGame) {
            return;
        }

        const newGame = {
            gameState: 1, // Pending state
            playerCard: "?", // Placeholder until VRF completes
            houseCard: "?", // Placeholder until VRF completes
            timestamp: Math.floor(Date.now() / 1000)
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

        // Find the first pending game (should be most recent, but search to be safe)
        const pendingGameIndex = this.recentHistory.findIndex(
            game => game && game.playerCard === "?" && game.houseCard === "?"
        );
        
        if (pendingGameIndex !== -1) {
            const pendingGame = this.recentHistory[pendingGameIndex];
            pendingGame.playerCard = getCardDisplay(playerCard);
            pendingGame.houseCard = getCardDisplay(houseCard);
            pendingGame.gameState = 2; // Completed

            // Update the display
            this.updateGameHistory(this.recentHistory);
        }
    }
    
    // Remove any stale pending games (called when we know there shouldn't be any)
    clearPendingGames() {
        if (!this.recentHistory) return;
        
        this.recentHistory = this.recentHistory.filter(
            game => !(game && game.playerCard === "?" && game.houseCard === "?")
        );
        
        if (isLandscape()) {
            this.updateGameHistory(this.recentHistory);
        }
    }
}