import { PlayButton } from './game/buttons/playButton.js';
import { BalanceText } from './game/balanceText.js';
import { GameHistory } from './game/gameHistory.js';
import { CardDisplay } from './game/cardDisplay.js';
import { Background } from './game/background.js';
import { GenericMenu } from './game/menu/genericMenu.js';

class Screen extends Phaser.Scene {
    preload() {
        this.load.image("card", "/g20.png");
        this.load.plugin('rexquadimageplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexquadimageplugin.min.js', true);
    }

    closeAllModals() {
        // Close menu if open
        if (this.genericMenu) {
            this.genericMenu.closeMenu();
        }
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

        // Create game history using the new class
        this.gameHistory = new GameHistory(this);

        this.playButton = new PlayButton(this);

        // Create generic menu (LAST, so it's on top)
        this.genericMenu = new GenericMenu(this);

        console.log("finished screen");
    }

    updateDisplay(balance = null, recentHistory = null, playerAddress = null) {
        // Store balance for menu access
        this.currentBalance = balance;

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
        dom: {
            createContainer: true
        },
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH
        }
    };

    const game = new Phaser.Game(config);
    return game;
};

export { loadPhaser };