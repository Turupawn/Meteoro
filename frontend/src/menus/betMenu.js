import { getBetAmountsArray, setSelectedBetAmount, getSelectedBetAmount, getUsdcDecimals } from '../gameState.js';
import { formatTokenBalance } from '../web3/blockchain_stuff.js';
import { isLandscape } from '../utils/utils.js';
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
            ? Math.min(1400, this.scene.screenWidth * 0.95)
            : Math.min(900, this.scene.screenWidth * 0.98);
        const menuHeight = isLandscapeMode
            ? Math.min(750, this.scene.screenHeight * 0.8)
            : Math.min(700, this.scene.screenHeight * 0.9);
        
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
        this.createCharacterSelectButtons(menuWidth, menuHeight);

        this.menuElements = [
            this.background, 
            this.menuContainer, 
            this.menuTitle,
            this.xButton,
            ...this.characterButtons
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

    createCharacterSelectButtons(menuWidth, menuHeight) {
        const isLandscapeMode = isLandscape();
        const betAmountsArray = getBetAmountsArray();
        const currentBetAmount = getSelectedBetAmount();

        if (!betAmountsArray || betAmountsArray.length === 0) {
            const noBetAmountsText = new MenuText(
                this.scene,
                this.scene.centerX, 
                this.scene.centerY, 
                "No characters available", 
                Math.max(24, this.scene.screenWidth / 40),
                { depth: 252 }
            );
            this.characterButtons = [noBetAmountsText];
            return;
        }

        this.characterButtons = [];
        
        // Calculate layout: arrange portraits in a grid
        const portraitSize = isLandscapeMode ? 200 : 180;
        const portraitSpacing = isLandscapeMode ? 280 : 260;
        const verticalSpacing = isLandscapeMode ? 280 : 260;
        const labelFontSize = isLandscapeMode
            ? Math.max(14, this.scene.screenWidth / 60)
            : Math.max(16, this.scene.screenWidth / 35);
        
        // Calculate grid dimensions - 3 characters per row
        const cols = 3;
        const rows = Math.ceil(betAmountsArray.length / cols);
        
        // Calculate starting position to center the grid
        const totalWidth = (cols - 1) * portraitSpacing;
        const totalHeight = (rows - 1) * verticalSpacing;
        const startX = this.scene.centerX - totalWidth / 2;
        const startY = this.scene.centerY - totalHeight / 2 + (isLandscapeMode ? 20 : 40);

        betAmountsArray.forEach((betAmount, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const x = startX + (col * portraitSpacing);
            const y = startY + (row * verticalSpacing);
            
            const folderNumber = String(index + 1).padStart(2, '0');
            const portraitKey = `portrait_${folderNumber}_01`;
            const isSelected = betAmount === currentBetAmount;
            
            // Create portrait image
            let portraitImage = null;
            if (this.scene.textures.exists(portraitKey)) {
                portraitImage = this.scene.add.image(x, y - 20, portraitKey);
                portraitImage.setDisplaySize(portraitSize, portraitSize);
                portraitImage.setDepth(253);
                portraitImage.setInteractive();
                portraitImage.on('pointerdown', () => this.selectBetAmount(betAmount));
                
                // Add hover effect
                portraitImage.on('pointerover', () => {
                    if (!isSelected) {
                        portraitImage.setTint(0xCCCCCC);
                    }
                });
                portraitImage.on('pointerout', () => {
                    portraitImage.clearTint();
                });
                
                this.characterButtons.push(portraitImage);
            }
            
            // Create selection border/highlight
            const borderSize = portraitSize + 10;
            const border = this.scene.add.rectangle(x, y - 20, borderSize, borderSize, 0x000000, 0);
            border.setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0x00FF00 : 0x00FFFF);
            border.setDepth(252);
            border.setInteractive();
            border.on('pointerdown', () => this.selectBetAmount(betAmount));
            
            // Add hover effect to border
            border.on('pointerover', () => {
                if (!isSelected) {
                    border.setStrokeStyle(3, 0xFFFFFF);
                }
            });
            border.on('pointerout', () => {
                border.setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0x00FF00 : 0x00FFFF);
            });
            
            this.characterButtons.push(border);
            
            // Create bet amount label below portrait with more spacing
            const labelY = y + portraitSize / 2 + 25;
            const labelText = `$${formatTokenBalance(betAmount, getUsdcDecimals(), 0)} USDC`;
            const label = this.scene.add.text(x, labelY, labelText, {
                font: `${labelFontSize}px Arial`,
                fill: isSelected ? "#00FF00" : "#E0F6FF",
                stroke: "#000000",
                strokeThickness: 2,
                align: 'center'
            }).setOrigin(0.5).setDepth(254);
            
            label.setInteractive();
            label.on('pointerdown', () => this.selectBetAmount(betAmount));
            
            // Add hover effect to label
            label.on('pointerover', () => {
                if (!isSelected) {
                    label.setStyle({ fill: "#FFFFFF" });
                }
            });
            label.on('pointerout', () => {
                label.setStyle({ fill: isSelected ? "#00FF00" : "#E0F6FF" });
            });
            
            this.characterButtons.push(label);
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
        
        if (this.characterButtons) {
            this.characterButtons = [];
        }
    }
} 