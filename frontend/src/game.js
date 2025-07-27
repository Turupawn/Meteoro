import { DepositButton } from './game/depositButton.js';
import { WithdrawButton } from './game/withdrawButton.js';
import { PlayButton } from './game/playButton.js';
import { BalanceText } from './game/balanceText.js';
import { GameHistory } from './game/gameHistory.js';
import { CardDisplay } from './game/cardDisplay.js';

class Screen extends Phaser.Scene {
    preload() {
        this.load.image("logo", "/g20.png");
    }

    create() {
        // Simple white background
        this.add.rectangle(400, 300, 800, 600, 0xffffff);

        // Simple logo
        this.add.image(400, 100, "logo").setScale(0.5);

        // Simple title
        this.add.text(400, 200, "WAR GAME", {
            font: "24px Arial",
            fill: "#000000"
        }).setOrigin(0.5);

        // Create card display text using the new class
        this.cardDisplay = new CardDisplay(this);

        // Create balance text using the new class
        this.balanceText = new BalanceText(this);

        // Create play button using the new class
        this.playButton = new PlayButton(this);

        // Create deposit button using the new class
        this.depositButton = new DepositButton(this);

        // Create withdraw button using the new class
        this.withdrawButton = new WithdrawButton(this);

        // Create game history using the new class
        this.gameHistory = new GameHistory(this);
    }

    updateDisplay(balance = null, recentHistory = null, playerAddress = null) {

        // Update balance using the balance text class with parameter
        this.balanceText.updateBalance(balance);

        // Update current game display using the card display text class
        this.cardDisplay.updateCurrentGameDisplay();

        // Update game history using the game history class with parameters
        this.gameHistory.updateGameHistory(recentHistory, playerAddress);
    }

    updateCardDisplay(playerCard, houseCard) {
        this.cardDisplay.updateCurrentGameDisplay(playerCard, houseCard);
    }
}

const loadPhaser = async () => {
    const config = {
        type: Phaser.AUTO,
        parent: document.querySelector(".container"),
        width: 800,
        height: 600,
        scene: [Screen],
        title: "War Game",
        version: "1.0",
    };
  
    const game = new Phaser.Game(config);
    return game
}

export { loadPhaser };