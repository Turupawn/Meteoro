import { forfeit, withdrawFunds, getLocalWallet, web3 } from '../web3/blockchain_stuff.js';
import { isLandscape } from '../utils/utils.js';
import { MenuButton } from './menuElements/menuButton.js';
import { MenuInput } from './menuElements/menuInput.js';
import { MenuText } from './menuElements/menuText.js';

export class MainMenu {
    constructor(scene) {
        this.scene = scene;
        this.menuElements = [];
        this.isOpen = false;
        this.currentSubmenu = null;
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
        this.background.on('pointerdown', (pointer) => {
            if (this.currentSubmenu && this.submenuWidth && this.submenuHeight) {
                this.handleBackgroundClick(pointer, this.submenuWidth, this.submenuHeight);
            } else {
                this.closeMenu();
            }
        });

        const isLandscapeMode = isLandscape();
        const menuWidth = isLandscapeMode
            ? Math.min(1200, this.scene.screenWidth * 0.95)
            : Math.min(950, this.scene.screenWidth * 0.98);
        const menuHeight = isLandscapeMode
            ? Math.min(900, this.scene.screenHeight * 0.85)
            : Math.min(1000, this.scene.screenHeight * 0.95);
        
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
            ? Math.max(36, this.scene.screenWidth / 30)
            : Math.max(40, this.scene.screenWidth / 20);
        
        this.menuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            this.scene.centerY - menuHeight/2 + 60, 
            "GAME MENU", 
            titleFontSize,
            { depth: 252 }
        );

        this.createXButton(menuWidth, menuHeight);

        this.createMainMenuButtons();

        this.menuElements = [
            this.background, 
            this.menuContainer, 
            this.menuTitle,
            this.xButton,
            ...this.menuButtons
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

    createMainMenuButtons() {
        const isLandscapeMode = isLandscape();
        const buttonFontSize = isLandscapeMode
            ? Math.max(32, this.scene.screenWidth / 30)
            : Math.max(48, this.scene.screenWidth / 15);
        const buttonSpacing = isLandscapeMode ? 150 : 160;
        const startY = this.scene.centerY - (isLandscapeMode ? 120 : 120);
        
        this.menuButtons = [];

        this.depositButton = new MenuButton(
            this.scene,
            this.scene.centerX, 
            startY, 
            "DEPOSIT", 
            buttonFontSize,
            () => this.showDepositSubmenu()
        );

        this.withdrawButton = new MenuButton(
            this.scene,
            this.scene.centerX, 
            startY + buttonSpacing, 
            "WITHDRAW", 
            buttonFontSize,
            () => this.showWithdrawSubmenu()
        );

        const forfeitY = startY + buttonSpacing * 2;
        this.forfeitButton = new MenuButton(
            this.scene,
            this.scene.centerX, 
            forfeitY, 
            "FORFEIT", 
            buttonFontSize,
            () => this.showForfeitSubmenu()
        );

        this.menuButtons = [
            this.depositButton, 
            this.withdrawButton, 
            this.forfeitButton
        ];
    }

    showDepositSubmenu() {
        this.currentSubmenu = 'deposit';
        
        this.clearMainMenu();
        
        const isLandscapeMode = isLandscape();
        this.submenuWidth = isLandscapeMode
            ? Math.min(1000, this.scene.screenWidth * 0.95)
            : Math.min(850, this.scene.screenWidth * 0.97);
        this.submenuHeight = isLandscapeMode
            ? Math.min(700, this.scene.screenHeight * 0.85)
            : Math.min(600, this.scene.screenHeight * 0.8);
        
        this.submenuContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.submenuWidth, 
            this.submenuHeight, 
            0x000000, 
            0.95
        );
        this.submenuContainer.setStrokeStyle(2, 0x00FFFF);
        this.submenuContainer.setDepth(253);

        this.createSubmenuXButton(this.submenuWidth, this.submenuHeight);

        const titleFontSize = isLandscapeMode
            ? Math.max(22, this.scene.screenWidth / 50)
            : Math.max(32, this.scene.screenWidth / 25);
        
        const titleY = this.scene.centerY - this.submenuHeight/2 + 40;
        const addressY = this.scene.centerY - (isLandscapeMode ? this.submenuHeight/4 : this.submenuHeight/3);
        const instructionY = this.scene.centerY;
        const warningY = this.scene.centerY + (isLandscapeMode ? 90 : 80);
        const faucetTextY = this.scene.centerY + (isLandscapeMode ? 220 : 160);
        const faucetLinkY = this.scene.centerY + (isLandscapeMode ? 260 : 200);
        
        this.submenuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            titleY, 
            "DEPOSIT ADDRESS", 
            titleFontSize,
            { depth: 254 }
        );
        
        const wallet = getLocalWallet();
        const address = wallet ? wallet.address : 'No wallet';

        this.addressInput = new MenuInput(
            this.scene,
            this.scene.centerX,
            addressY,
            '',
            titleFontSize - 2,
            {
                readOnly: true,
                value: address
            }
        );

        this.instructionText = new MenuText(
            this.scene,
            this.scene.centerX, 
            instructionY, 
            "Deposit to this address to play.", 
            titleFontSize - 4,
            { depth: 254 }
        );

        this.warningText = new MenuText(
            this.scene,
            this.scene.centerX,
            warningY, 
            "This is your local storage wallet, do not clear browser data nor deposit large amounts.\nClick to learn more.", 
            isLandscapeMode ? titleFontSize - 20 : titleFontSize - 18,
            { 
                depth: 254,
                wordWrap: { width: this.submenuWidth - 100 },
                align: 'center',
                interactive: true,
                onClick: () => window.open('https://dev.to/filosofiacodigoen/how-local-storage-wallets-on-ethereum-work-4c0p', '_blank')
            }
        );

        this.faucetText = new MenuText(
            this.scene,
            this.scene.centerX, 
            faucetTextY, 
            "Get test tokens from faucet:", 
            titleFontSize - 4,
            { depth: 254 }
        );

        this.faucetLink = new MenuText(
            this.scene,
            this.scene.centerX, 
            faucetLinkY, 
            "https://testnet.megaeth.com/", 
            titleFontSize - 4,
            {
                interactive: true,
                isLink: true, // Add link styling
                onClick: () => window.open('https://testnet.megaeth.com/', '_blank'),
                depth: 254
            }
        );

        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.addressInput,
            this.instructionText,
            this.warningText,
            this.faucetText,
            this.faucetLink,
            this.submenuXButton
        ];
    }

    createSubmenuXButton(submenuWidth, submenuHeight) {
        const x = this.scene.centerX + (submenuWidth / 2) - 30;
        const y = this.scene.centerY - (submenuHeight / 2) + 30;
        
        this.submenuXButton = this.scene.add.text(x, y, "✕", {
            font: '32px Arial',
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        this.submenuXButton.setDepth(255);
        const isLandscapeMode = isLandscape();
        this.submenuXButton.setSize(
            this.submenuXButton.width + (isLandscapeMode ? 100 : 80), 
            this.submenuXButton.height + (isLandscapeMode ? 100 : 80)
        );
        this.submenuXButton.on('pointerdown', () => this.closeMenu());
    }

    showWithdrawSubmenu() {
        this.currentSubmenu = 'withdraw';
        
        this.clearMainMenu();
        
        const isLandscapeMode = isLandscape();
        this.submenuWidth = isLandscapeMode
            ? Math.min(1000, this.scene.screenWidth * 0.95)
            : Math.min(850, this.scene.screenWidth * 0.97);
        this.submenuHeight = isLandscapeMode
            ? Math.min(700, this.scene.screenHeight * 0.85)
            : Math.min(600, this.scene.screenHeight * 0.8);
        
        this.submenuContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.submenuWidth, 
            this.submenuHeight, 
            0x000000, 
            0.95
        );
        this.submenuContainer.setStrokeStyle(2, 0x00FFFF);
        this.submenuContainer.setDepth(253);

        this.createSubmenuXButton(this.submenuWidth, this.submenuHeight);

        const titleFontSize = isLandscapeMode
            ? Math.max(22, this.scene.screenWidth / 50)
            : Math.max(32, this.scene.screenWidth / 25);
        
        const titleY = this.scene.centerY - this.submenuHeight/2 + 30;
        const balanceY = this.scene.centerY - (isLandscapeMode ? 120 : 120);
        const addressLabelY = this.scene.centerY - (isLandscapeMode ? 50 : 60);
        const addressInputY = this.scene.centerY + (isLandscapeMode ? 30 : 20);
        const withdrawButtonY = this.scene.centerY + (isLandscapeMode ? 180 : 160);
        
        this.submenuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            titleY, 
            "WITHDRAW FUNDS", 
            titleFontSize,
            { depth: 254 }
        );

        let ethBalanceString = "0.000000 ETH";
        if (this.scene.currentBalance) {
            try {
                const ethBalanceInEth = web3.utils.fromWei(this.scene.currentBalance.toString(), 'ether');
                ethBalanceString = `${parseFloat(balanceInEth).toFixed(6)} ETH`;
            } catch (error) {
                console.error('Error converting balance:', error);
                ethBalanceString = `${this.scene.currentBalance} WEI`;
            }
        } else {
            console.log('No balance available');
        }
        
        this.ethBalanceText = new MenuText(
            this.scene,
            this.scene.centerX, 
            balanceY, 
            `Balance: ${ethBalanceString}`, 
            titleFontSize - 2,
            { depth: 254 }
        );

        this.addressLabel = new MenuText(
            this.scene,
            this.scene.centerX, 
            addressLabelY, 
            "Enter destination address:", 
            titleFontSize - 4,
            { depth: 254 }
        );

        this.addressInput = new MenuInput(
            this.scene,
            this.scene.centerX,
            addressInputY,
            'Enter address...',
            titleFontSize - 4
        );
        
        this.withdrawButton = new MenuButton(
            this.scene,
            this.scene.centerX,
            withdrawButtonY,
            "WITHDRAW", 
            titleFontSize,
            () => this.executeWithdraw()
        );
        
        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.ethBalanceText,
            this.addressLabel,
            this.addressInput,
            this.withdrawButton,
            this.submenuXButton
        ];
    }

    showForfeitSubmenu() {
        this.currentSubmenu = 'forfeit';
        
        this.clearMainMenu();
        
        const isLandscapeMode = isLandscape();
        this.submenuWidth = isLandscapeMode
            ? Math.min(1100, this.scene.screenWidth * 0.96)
            : Math.min(900, this.scene.screenWidth * 0.98);
        this.submenuHeight = isLandscapeMode
            ? Math.min(700, this.scene.screenHeight * 0.85)
            : Math.min(600, this.scene.screenHeight * 0.8);
        
        this.submenuContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.submenuWidth, 
            this.submenuHeight, 
            0x000000, 
            0.95
        );
        this.submenuContainer.setStrokeStyle(2, 0x00FFFF);
        this.submenuContainer.setDepth(253);

        this.createSubmenuXButton(this.submenuWidth, this.submenuHeight);

        const titleFontSize = isLandscapeMode
            ? Math.max(22, this.scene.screenWidth / 50)
            : Math.max(32, this.scene.screenWidth / 25);
        
        const titleY = this.scene.centerY - this.submenuHeight/2 + 30;
        const warningY = this.scene.centerY - (isLandscapeMode ? 120 : 80);
        const confirmButtonY = this.scene.centerY + (isLandscapeMode ? 120 : 80);
        
        this.submenuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            titleY, 
            "FORFEIT GAME", 
            titleFontSize,
            { depth: 254 }
        );

        this.warningText = new MenuText(
            this.scene,
            this.scene.centerX, 
            warningY,
            "This will forfeit your current game\nand clear all cached data.", 
            titleFontSize - 4,
            {
                depth: 254,
                wordWrap: { width: this.submenuWidth - 100 },
                align: 'center'
            }
        );
        
        this.confirmButton = new MenuButton(
            this.scene,
            this.scene.centerX,
            confirmButtonY,
            "CONFIRM FORFEIT", 
            titleFontSize,
            () => this.executeForfeit()
        );
        
        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.warningText,
            this.confirmButton,
            this.submenuXButton
        ];
    }

    handleBackgroundClick(pointer, submenuWidth, submenuHeight) {
        const submenuLeft = this.scene.centerX - submenuWidth/2;
        const submenuRight = this.scene.centerX + submenuWidth/2;
        const submenuTop = this.scene.centerY - submenuHeight/2;
        const submenuBottom = this.scene.centerY + submenuHeight/2;
        
        if (pointer.x < submenuLeft || pointer.x > submenuRight || 
            pointer.y < submenuTop || pointer.y > submenuBottom) {
            this.closeMenu();
        }
    }

    clearMainMenu() {
        this.menuElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                if (element !== this.background) {
                    element.destroy();
                }
            }
        });
        this.menuElements = [this.background];
    }

    backToMainMenu() {
        if (this.submenuElements) {
            this.submenuElements.forEach(element => {
                if (element && typeof element.destroy === 'function') {
                    element.destroy();
                } else if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });
            this.submenuElements = [];
        }
        
        this.currentSubmenu = null;
        
        this.openMenu();
    }

    executeWithdraw() {
        const address = this.addressInput.getValue().trim();
        if (address && address.startsWith('0x') && address.length === 42) {
            withdrawFunds(address);
            this.closeMenu();
        } else {
            console.log('Invalid address format');
        }
    }

    async executeForfeit() {
        try {
            this.clearAllCache();
            await forfeit();
            this.closeMenu();
        } catch (error) {
            console.error("Error executing forfeit:", error);
        }
    }

    clearAllCache() {
        localStorage.removeItem('playerSecret');
        localStorage.removeItem('pendingCommit');
        localStorage.removeItem('pendingReveal');
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
        
        if (this.submenuElements) {
            this.submenuElements.forEach(element => {
                if (element && typeof element.destroy === 'function') {
                    element.destroy();
                } else if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });
            this.submenuElements = [];
        }
        
        this.currentSubmenu = null;
    }
}