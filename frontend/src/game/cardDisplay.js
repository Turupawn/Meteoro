export class CardDisplay {
    constructor(scene) {
        this.scene = scene;
        this.createCardDisplay();
    }

    createCardDisplay() {
        // Responsive current game display - positioned in center bottom
        const x = this.scene.centerX;
        const y = this.scene.screenHeight * 0.8; // 80% down the screen
        const fontSize = Math.max(14, this.scene.screenWidth / 50); // Responsive font size
        
        this.currentGameText = this.scene.add.text(x, y, "", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(0.5);
    }

    updateCurrentGameDisplay(playerCard = null, houseCard = null) {
        if (playerCard !== null && houseCard !== null) {
            const playerCardDisplay = this.getCardDisplay(playerCard);
            const houseCardDisplay = this.getCardDisplay(houseCard);
            const winner = playerCard > houseCard ? "Player" : "House";
            
            this.currentGameText.setText(`Your card: ${playerCardDisplay} | House card: ${houseCardDisplay} | ${winner} wins!`);
            
            // End boost animation when results are displayed
            if (this.scene.background && this.scene.background.endBoostAnimation) {
                this.scene.background.endBoostAnimation();
            }
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