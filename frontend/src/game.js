import Phaser from 'phaser';
import { PlayButton } from './game/playButton.js';
import { BalanceText } from './game/balanceText.js';
import { GameHistory } from './game/gameHistory.js';
import { CardDisplay } from './game/cardDisplay.js';
import { Background } from './game/background.js';
import { Menu } from './game/menu/menu.js';
import { OpenMenuButton } from './game/openMenuButton.js';

class Screen extends Phaser.Scene {
    preload() {
        this.load.image("card", "/g20.png");
        this.load.plugin('rexquadimageplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexquadimageplugin.min.js', true);
    }

    closeAllModals() {
        if (this.menu) {
            this.menu.closeMenu();
        }
    }

    create() {
        this.screenWidth = this.cameras.main.width;
        this.screenHeight = this.cameras.main.height;
        this.centerX = this.screenWidth / 2;
        this.centerY = this.screenHeight / 2;
        this.background = new Background(this);
        this.cardDisplay = new CardDisplay(this);
        this.balanceText = new BalanceText(this);
        this.gameHistory = new GameHistory(this);
        this.playButton = new PlayButton(this);
        this.menu = new Menu(this);
        this.openMenuButton = new OpenMenuButton(this, () => {
            this.menu.toggleMenu();
        });
    }

    updateDisplay(balance = null, recentHistory = null, playerAddress = null) {
        this.currentBalance = balance;
        this.balanceText.updateBalance(balance);
        this.cardDisplay.updateCurrentGameDisplay();
        this.gameHistory.updateGameHistory(recentHistory, playerAddress);
    }

    updateCardDisplay(playerCard, houseCard) {
        this.cardDisplay.updateCurrentGameDisplay(playerCard, houseCard);
    }
}

const loadPhaser = async () => {
    const container = document.querySelector(".container");
    
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