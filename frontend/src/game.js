import Phaser from 'phaser';
import { Background } from './animations/background.js';
import { CardDisplay } from './animations/cardDisplay.js';
import { TieSequence } from './animations/tieSequence.js';
import { LoadingScreen } from './animations/loadingScreen.js';
import { OpenMenuButton } from './hud/hudButtons/openMenuButton.js';
import { BetMenuButton } from './hud/hudButtons/betMenuButton.js';
import { PlayButton } from './hud/hudButtons/playButton.js';
import { SocialLinks } from './hud/hudButtons/socialLinks.js';
import { ETHBalanceText } from './hud/hudTexts/ethBalanceText.js';
import { GachaTokenBalanceText } from './hud/hudTexts/gachaTokenBalanceText.js';
import { GameHistory } from './hud/hudTexts/gameHistory.js';
import { MainMenu } from './menus/mainMenu.js';
import { BetMenu } from './menus/betMenu.js';
import { InsufficientBalanceMenu } from './menus/insufficientBalanceMenu.js';
import { setErrorModal, ErrorModal } from './menus/errorModal.js';
import { setGameScene, updateGameState } from './main.js';
import { printLog } from './utils/utils.js';
import { getMinimumPlayableBalance } from './web3/blockchain_stuff.js';

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
        if (this.errorModal) {
            this.errorModal.closeModal();
        }
    }

    create() {
        this.screenWidth = this.cameras.main.width;
        this.screenHeight = this.cameras.main.height;
        this.centerX = this.screenWidth / 2;
        this.centerY = this.screenHeight / 2;
        
        this.background = new Background(this);
        this.cardDisplay = new CardDisplay(this);
        this.tieSequence = new TieSequence(this);
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
        this.errorModal = new ErrorModal(this);

        setErrorModal(this.errorModal);
        setGameScene(this);

        this.time.delayedCall(100, () => {
            updateGameState();
        });

        this.time.delayedCall(1000, () => {
            printLog(['profile'], "Started lazy loading at:" + new Date().toISOString());
            this.lazyLoadCosmicScene();
            this.lazyLoadStoryImages();
        });
    }

    updateDisplay(balance = null, gachaTokenBalance = null, recentHistory = null, playerAddress = null, gameState = null) {
        this.currentBalance = balance;
        this.ethBalanceText.updateBalance(balance);
        this.gachaTokenBalanceText.updateBalance(gachaTokenBalance);
        this.cardDisplay.updateCurrentGameDisplay();
        this.gameHistory.updateGameHistory(recentHistory, playerAddress);
        
        // Update TieSequence with game state
        if (this.tieSequence && gameState) {
            this.tieSequence.gameState = gameState;
        }
        
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
        // Update the UI immediately when bet amount changes
        updateGameState();
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

    lazyLoadCosmicScene() {
        if (!this.scene.get('CosmicScene')) {
            import('./animations/cosmicScene.js').then(({ CosmicScene }) => {
                this.scene.add('CosmicScene', CosmicScene, false);
                printLog(['profile'], "CosmicScene loaded lazily at:" + new Date().toISOString());
            }).catch(error => {
                console.error('Failed to lazy load CosmicScene:', error);
            });
        }
    }

    async lazyLoadStoryImages() {
        try {
            await TieSequence.preloadStoryImages(this);
            printLog(['profile'], "Story images loaded lazily at:" + new Date().toISOString());
        } catch (error) {
            console.error('Failed to lazy load story images:', error);
        }
    }

    startCosmicScene() {
        if (!this.scene.get('CosmicScene')) {
            this.lazyLoadCosmicScene();
            this.time.delayedCall(100, () => {
                this.scene.launch('CosmicScene');
            });
        } else {
            this.scene.launch('CosmicScene');
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
        },
        audio: {
            disableWebAudio: true
        }
    };

    const game = new Phaser.Game(config);
    return game;
};

export { loadPhaser };