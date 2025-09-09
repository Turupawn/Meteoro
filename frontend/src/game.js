import Phaser from 'phaser';
import { LoadingScreen } from './animations/loadingScreen.js';
import { PlayButton } from './hud/playButton.js';
import { ETHBalanceText } from './hud/ethBalanceText.js';
import { GachaTokenBalanceText } from './hud/gachaTokenBalanceText.js';
import { GameHistory } from './hud/gameHistory.js';
import { CardDisplay } from './animations/cardDisplay.js';
import { Background } from './animations/background.js';
import { MainMenu } from './menu/mainMenu/mainMenu.js';
import { BetMenu } from './menu/betMenu/betMenu.js';
import { BetMenuButton } from './menu/betMenu/betMenuButton.js';
import { OpenMenuButton } from './menu/mainMenu/openMenuButton.js';
import { SocialLinks } from './hud/socialLinks.js';
import { InsufficientBalanceMenu } from './menu/unsufficientBalanceMenu/insufficientBalanceMenu.js';
import { CosmicScene } from './animations/cosmicScene.js';
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