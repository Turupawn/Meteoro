import { DepositButton } from './game/depositButton.js';
import { WithdrawButton } from './game/withdrawButton.js';
import { PlayButton } from './game/playButton.js';
import { BalanceText } from './game/balanceText.js';
import { GameHistory } from './game/gameHistory.js';
import { CardDisplay } from './game/cardDisplay.js';
import { Background } from './game/background.js';

class Screen extends Phaser.Scene {
    preload() {
        this.load.image("logo", "/g20.png");
    }

    create() {
        // Get screen dimensions
        this.screenWidth = this.cameras.main.width;
        this.screenHeight = this.cameras.main.height;
        this.centerX = this.screenWidth / 2;
        this.centerY = this.screenHeight / 2;

        // Create background using the new class
        this.background = new Background(this);

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
    const container = document.querySelector(".container");
    
    // Get container dimensions or use window size
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    
    const config = {
        type: Phaser.AUTO,
        parent: container,
        width: width,
        height: height,
        scene: [Screen],
        title: "War Game",
        version: "1.0",
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };
  
    const game = new Phaser.Game(config);
    return game
}

export { loadPhaser };