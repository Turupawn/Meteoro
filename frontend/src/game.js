import Phaser from 'phaser';
import { LoadingScreen } from './game/loadingScreen.js';
import { PlayButton } from './game/playButton.js';
import { BalanceText } from './game/balanceText.js';
import { GameHistory } from './game/gameHistory.js';
import { CardDisplay } from './game/cardDisplay.js';
import { Background } from './game/background.js';
import { Menu } from './game/menu/menu.js';
import { OpenMenuButton } from './game/openMenuButton.js';
import { SocialLinks } from './game/socialLinks.js';
import { InsufficientBalanceScreen } from './game/insufficientBalanceScreen.js';
import { setGameScene } from './main.js';
import { getMinimumPlayableBalance } from './blockchain_stuff.js';

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Assets are already loaded in LoadingScreen
        // This is just for reference
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
        this.socialLinks = new SocialLinks(this);
        this.insufficientBalanceScreen = new InsufficientBalanceScreen(this);
        
        // Set the game scene reference for main.js
        setGameScene(this);
    }

    updateDisplay(balance = null, recentHistory = null, playerAddress = null) {
        this.currentBalance = balance;
        this.balanceText.updateBalance(balance);
        this.cardDisplay.updateCurrentGameDisplay();
        this.gameHistory.updateGameHistory(recentHistory, playerAddress);
        
        // Check if we should show the insufficient balance screen
        this.checkInsufficientBalance(balance);
    }

    updateCardDisplay(playerCard, houseCard) {
        this.cardDisplay.updateCurrentGameDisplay(playerCard, houseCard);
    }

    checkInsufficientBalance(balance) {
        try {
            const hasInsufficientBalance = BigInt(balance) < BigInt(getMinimumPlayableBalance());
            if (hasInsufficientBalance) {
                this.insufficientBalanceScreen.show();
            } else {
                this.insufficientBalanceScreen.hide();
            }
        } catch (error) {
            console.error('Error checking insufficient balance:', error);
        }
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
        scene: [LoadingScreen, GameScene],
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