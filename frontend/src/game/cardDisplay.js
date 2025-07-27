export class CardDisplay {
    constructor(scene) {
        this.scene = scene;
        this.createCardDisplay();
    }

    createCardDisplay() {
        // Current game display
        this.currentGameText = this.scene.add.text(400, 400, "", {
            font: "16px Arial",
            fill: "#000000"
        }).setOrigin(0.5);
    }

    updateCurrentGameDisplay(playerCard = null, houseCard = null) {
        if (playerCard !== null && houseCard !== null) {
            const playerCardDisplay = this.getCardDisplay(playerCard);
            const houseCardDisplay = this.getCardDisplay(houseCard);
            const winner = playerCard > houseCard ? "Player" : "House";
            
            this.currentGameText.setText(`Your card: ${playerCardDisplay} | House card: ${houseCardDisplay} | ${winner} wins!`);
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