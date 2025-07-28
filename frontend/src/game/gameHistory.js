export class GameHistory {
    constructor(scene) {
        this.scene = scene;
        this.createGameHistory();
    }

    createGameHistory() {
        // Responsive game history title
        const titleX = 20;
        const titleY = 20;
        const titleFontSize = Math.max(12, this.scene.screenWidth / 60);
        
        this.scene.add.text(titleX, titleY, "Games:", {
            font: `${titleFontSize}px Arial`,
            fill: "#FF0000"
        });

        // Pre-create text objects for game history (up to 10 games)
        this.gameHistoryTexts = [];
        const historyFontSize = Math.max(10, this.scene.screenWidth / 70);
        const lineHeight = Math.max(15, historyFontSize + 5);
        
        for (let i = 0; i < 10; i++) {
            const textObj = this.scene.add.text(titleX, titleY + 30 + i * lineHeight, "", {
                font: `${historyFontSize}px Arial`,
                fill: "#FF0000"
            });
            this.gameHistoryTexts.push(textObj);
        }
    }

    updateGameHistory(recentHistory = null, playerAddress = null) {
        // Update game history efficiently
        if (recentHistory && recentHistory.length > 0) {
            const recentGames = recentHistory.slice(-10);
            
            // Update existing text objects instead of creating new ones
            for (let i = 0; i < 10; i++) {
                if (i < recentGames.length) {
                    const game = recentGames[i];
                    const isForfeit = game.playerCard === 0 && game.houseCard === 0;
                    const playerCard = this.getCardDisplay(parseInt(game.playerCard));
                    const houseCard = this.getCardDisplay(parseInt(game.houseCard));
                    const isWin = playerAddress && game.winner.toLowerCase() === playerAddress.toLowerCase();
                    
                    let gameText = "";
                    if (isForfeit) {
                        gameText = `Forfeit`;
                    } else if (isWin) {
                        gameText = `Win ${playerCard}-${houseCard}`;
                    } else {
                        gameText = `Lose ${playerCard}-${houseCard}`;
                    }
                    
                    this.gameHistoryTexts[i].setText(gameText);
                    this.gameHistoryTexts[i].setVisible(true);
                } else {
                    this.gameHistoryTexts[i].setVisible(false);
                }
            }
        } else {
            // Hide all history texts
            this.gameHistoryTexts.forEach(text => text.setVisible(false));
        }
    }

    getCardDisplay(cardValue) {
        if (cardValue === 1) return "A";
        if (cardValue === 11) return "J";
        if (cardValue === 12) return "Q";
        if (cardValue === 13) return "K";
        return cardValue.toString();
    }
}