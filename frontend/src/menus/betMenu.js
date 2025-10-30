import { getBetAmountsArray, setSelectedBetAmount, getSelectedBetAmount } from '../gameState.js';
import { formatBalance } from '../web3/blockchain_stuff.js';
import { isLandscape, BET_AMOUNT_DECIMALS } from '../utils/utils.js';
import { MenuButton } from './menuElements/menuButton.js';
import { MenuText } from './menuElements/menuText.js';

export class BetMenu {
    constructor(scene) {
        this.scene = scene;
        this.menuElements = [];
        this.isOpen = false;
    }

    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        this.isOpen = true;
        
        if (this.scene.insufficientBalanceMenu) {
            this.scene.insufficientBalanceMenu.disable();
        }

        this.background = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.scene.screenWidth, 
            this.scene.screenHeight, 
            0x000000, 
            0.7
        );
        this.background.setDepth(250);
        this.background.setInteractive();
        this.background.on('pointerdown', () => {
            this.closeMenu();
        });

        const isLandscapeMode = isLandscape();
        const menuWidth = isLandscapeMode
            ? Math.min(800, this.scene.screenWidth * 0.8)
            : Math.min(700, this.scene.screenWidth * 0.9);
        const menuHeight = isLandscapeMode
            ? Math.min(600, this.scene.screenHeight * 0.7)
            : Math.min(500, this.scene.screenHeight * 0.8);
        
        this.menuContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            menuWidth, 
            menuHeight, 
            0x000000, 
            0.9
        );
        this.menuContainer.setStrokeStyle(2, 0x00FFFF);
        this.menuContainer.setDepth(251);

        const titleFontSize = isLandscapeMode
            ? Math.max(28, this.scene.screenWidth / 35)
            : Math.max(32, this.scene.screenWidth / 25);
        
        this.menuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            this.scene.centerY - menuHeight/2 + 50, 
            "SELECT BET AMOUNT", 
            titleFontSize,
            { depth: 252 }
        );

        this.createXButton(menuWidth, menuHeight);
        this.createBetAmountButtons(menuWidth, menuHeight);

        this.menuElements = [
            this.background, 
            this.menuContainer, 
            this.menuTitle,
            this.xButton,
            ...this.betAmountButtons
        ];
    }

    createXButton(menuWidth, menuHeight) {
        const x = this.scene.centerX + (menuWidth / 2) - 30;
        const y = this.scene.centerY - (menuHeight / 2) + 30;
        
        this.xButton = this.scene.add.text(x, y, "✕", {
            font: '32px Arial',
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        this.xButton.setDepth(255);
        const isLandscapeMode = isLandscape();
        this.xButton.setSize(
            this.xButton.width + (isLandscapeMode ? 100 : 80), 
            this.xButton.height + (isLandscapeMode ? 100 : 80)
        );
        this.xButton.on('pointerdown', () => this.closeMenu());
    }

    createBetAmountButtons(menuWidth, menuHeight) {
        const isLandscapeMode = isLandscape();
        const buttonFontSize = isLandscapeMode
            ? Math.max(24, this.scene.screenWidth / 40)
            : Math.max(28, this.scene.screenWidth / 20);
        const buttonSpacing = isLandscapeMode ? 80 : 90;
        const startY = this.scene.centerY - (isLandscapeMode ? 80 : 60);
        
        this.betAmountButtons = [];
        const betAmountsArray = getBetAmountsArray();
        const currentBetAmount = getSelectedBetAmount();

        if (!betAmountsArray || betAmountsArray.length === 0) {
            const noBetAmountsText = new MenuText(
                this.scene,
                this.scene.centerX, 
                this.scene.centerY, 
                "No bet amounts available", 
                buttonFontSize,
                { depth: 252 }
            );
            this.betAmountButtons.push(noBetAmountsText);
            return;
        }

        betAmountsArray.forEach((betAmount, index) => {
            const y = startY + (index * buttonSpacing);
            const displayText = `${formatBalance(betAmount, BET_AMOUNT_DECIMALS)} ETH`;
            const isSelected = betAmount === currentBetAmount;
            
            const button = new MenuButton(
                this.scene,
                this.scene.centerX, 
                y, 
                displayText, 
                buttonFontSize,
                () => this.selectBetAmount(betAmount)
            );

            // Highlight selected bet amount
            if (isSelected) {
                button.buttonBg.setFillStyle(0x00FF00, 0.3); // Green highlight
                button.buttonBg.setStrokeStyle(3, 0x00FF00);
            }

            this.betAmountButtons.push(button);
        });
    }

    selectBetAmount(betAmount) {
        setSelectedBetAmount(betAmount);
        this.closeMenu();
        
        // Notify the game scene that bet amount has changed
        if (this.scene.onBetAmountChanged) {
            this.scene.onBetAmountChanged(betAmount);
        }
    }

    closeMenu() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        
        if (this.scene.insufficientBalanceMenu) {
            this.scene.insufficientBalanceMenu.enable();
        }

        this.menuElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            }
        });
        this.menuElements = [];
    }
} 