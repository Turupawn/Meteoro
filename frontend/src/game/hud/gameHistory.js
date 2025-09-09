import { applyPerspectiveToQuadImageToRight, isLandscape } from '../../utils.js';

export class GameHistory {
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
        } else {
            this.quadImage = this.scene.add.rexQuadImage({
                x: 236+50,
                y: 350,
                texture: 'gameHistoryTexture',
                ninePointMode: false
            
            });
            this.quadImage.setScale(16,16);
        }
        this.quadImage.setVisible(false);
    }

    updateGameHistory(recentHistory = null, playerAddress = null) {
        if (!this.renderTexture) {
            return;
        }

        if (!recentHistory || recentHistory.length === 0) {
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
        recentHistory.forEach((game, index) => {
            let isWin = false;
            if (game.result === 'WIN' || game.result === 'win' || game.result === 1 || game.result === true) {
                isWin = true;
            } else if (game.result === 'LOSS' || game.result === 'loss' || game.result === 0 || game.result === false) {
                isWin = false;
            } else {
                if (game.playerCard && game.houseCard) {
                    const playerCard = parseInt(game.playerCard);
                    const houseCard = parseInt(game.houseCard);
                    if (!isNaN(playerCard) && !isNaN(houseCard)) {
                        isWin = playerCard > houseCard;
                    }
                }
            }
            
            const score = `${game.playerCard}-${game.houseCard}`;
            
            const textColor = isWin ? '#00FF00' : '#FF4444';
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
    }
}