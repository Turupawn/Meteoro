import Phaser from 'phaser';
import { LoadingScreen } from './game/loadingScreen.js';
import { PlayButton } from './game/playButton.js';
import { ETHBalanceText } from './game/ethBalanceText.js';
import { GachaTokenBalanceText } from './game/gachaTokenBalanceText.js';
import { GameHistory } from './game/gameHistory.js';
import { CardDisplay } from './game/cardDisplay.js';
import { Background } from './game/background.js';
import { MainMenu } from './game/menu/mainMenu/mainMenu.js';
import { BetMenu } from './game/menu/betMenu/betMenu.js';
import { BetMenuButton } from './game/menu/betMenu/betMenuButton.js';
import { OpenMenuButton } from './game/menu/mainMenu/openMenuButton.js';
import { SocialLinks } from './game/socialLinks.js';
import { InsufficientBalanceMenu } from './game/menu/unsufficientBalanceMenu/insufficientBalanceMenu.js';
import { CosmicScene } from './game/cosmicScene.js';
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
        if (this.betMenu) {
            this.betMenu.closeMenu();
        }
    }

    create() {
        this.screenWidth = this.cameras.main.width;
        this.screenHeight = this.cameras.main.height;
        this.centerX = this.screenWidth / 2;
        this.centerY = this.screenHeight / 2;
        
        this.background = new Background(this);
        this.cardDisplay = new CardDisplay(this);
        this.ethBalanceText = new ETHBalanceText(this);
        this.gachaTokenBalanceText = new GachaTokenBalanceText(this);
        this.gameHistory = new GameHistory(this);
        this.playButton = new PlayButton(this);
        this.mainMenu = new MainMenu(this);
        this.betMenu = new BetMenu(this);
        this.betMenuButton = new BetMenuButton(this, this.betMenu);
        this.openMenuButton = new OpenMenuButton(this, () => {
            this.mainMenu.toggleMenu();
        });
        this.socialLinks = new SocialLinks(this);
        this.insufficientBalanceMenu = new InsufficientBalanceMenu(this);
        // Removed cosmicButton
        
        // Set the game scene reference for main.js
        setGameScene(this);
    }

    updateDisplay(balance = null, gachaTokenBalance = null, recentHistory = null, playerAddress = null) {
        this.currentBalance = balance;
        this.ethBalanceText.updateBalance(balance);
        this.gachaTokenBalanceText.updateBalance(gachaTokenBalance);
        this.cardDisplay.updateCurrentGameDisplay();
        this.gameHistory.updateGameHistory(recentHistory, playerAddress);
        
        if (this.betMenuButton) {
            this.betMenuButton.updateDisplay();
        }
        
        // Check if we should show the insufficient balance screen
        this.checkInsufficientBalance(balance);
    }

    updateCardDisplay(playerCard, houseCard) {
        this.cardDisplay.updateCurrentGameDisplay(playerCard, houseCard);
    }

    onBetAmountChanged(newBetAmount) {
        console.log('Bet amount changed to:', newBetAmount);
    }

    checkInsufficientBalance(balance) {
        try {
            const hasInsufficientBalance = BigInt(balance) < BigInt(getMinimumPlayableBalance());
            
            if (hasInsufficientBalance && this.cardDisplay && 
                (!this.cardDisplay.playerCardSprite || !this.cardDisplay.playerCardSprite.active)) {
                this.insufficientBalanceMenu.show(false);
            } else if (!hasInsufficientBalance) {
                this.insufficientBalanceMenu.hide();
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
        scene: [LoadingScreen, GameScene, CosmicScene],
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