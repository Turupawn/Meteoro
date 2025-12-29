import { forfeit, withdrawFunds, getLocalWallet, formatBalance, getPlayerGachaTokenBalance } from '../web3/blockchain_stuff.js';
import { isLandscape, ETH_BALANCE_DECIMALS, GACHA_BALANCE_DECIMALS } from '../utils/utils.js';
import { MenuButton } from './menuElements/menuButton.js';
import { MenuInput } from './menuElements/menuInput.js';
import { MenuText } from './menuElements/menuText.js';
import { clearAllGameData } from '../web3/sessionKeyManager.js';

const NETWORK = import.meta.env.NETWORK || 'rise testnet';

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
        const startY = this.scene.centerY - (isLandscapeMode ? 180 : 180);
        
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
            "CLEANUP", 
            buttonFontSize,
            () => this.showForfeitSubmenu()
        );

        const disconnectY = startY + buttonSpacing * 3;
        this.disconnectButton = new MenuButton(
            this.scene,
            this.scene.centerX, 
            disconnectY, 
            "DISCONNECT", 
            buttonFontSize,
            () => this.showDisconnectSubmenu()
        );

        this.menuButtons = [
            this.depositButton, 
            this.withdrawButton, 
            this.forfeitButton,
            this.disconnectButton
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
        const instructionY = this.scene.centerY - (isLandscapeMode ? 120 : 140);
        const addressY = this.scene.centerY - (isLandscapeMode ? 40 : 60);
        const warningY = this.scene.centerY + (isLandscapeMode ? 60 : 40);
        const faucetTextY = this.scene.centerY + (isLandscapeMode ? 180 : 160);
        const faucetLinkY = this.scene.centerY + (isLandscapeMode ? 220 : 200);
        
        this.submenuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            titleY, 
            "DEPOSIT", 
            titleFontSize,
            { depth: 254 }
        );
        
        const wallet = getLocalWallet();
        const address = wallet ? wallet.address : 'No wallet';

        this.instructionText = new MenuText(
            this.scene,
            this.scene.centerX, 
            instructionY, 
            "Deposit to this address to play.", 
            titleFontSize - 4,
            { depth: 254 }
        );

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

        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.instructionText,
            this.addressInput,
            this.warningText,
            this.submenuXButton
        ];
        
        if (NETWORK === 'rise testnet') {
            this.faucetText = new MenuText(
                this.scene,
                this.scene.centerX, 
                faucetTextY, 
                "Get test token", 
                titleFontSize - 4,
                { depth: 254 }
            );

            this.faucetLink = new MenuText(
                this.scene,
                this.scene.centerX, 
                faucetLinkY, 
                "https://faucet.testnet.riselabs.xyz/",
                titleFontSize - 4,
                {
                    interactive: true,
                    isLink: true, // Add link styling
                    onClick: () => window.open('https://faucet.testnet.riselabs.xyz/', '_blank'),
                    depth: 254
                }
            );
            
            this.submenuElements.push(this.faucetText, this.faucetLink);
        }
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
        const balanceY = this.scene.centerY - (isLandscapeMode ? 180 : 180);
        const gachaBalanceY = this.scene.centerY - (isLandscapeMode ? 140 : 140);
        const addressLabelY = this.scene.centerY - (isLandscapeMode ? 50 : 50);
        const addressInputY = this.scene.centerY + (isLandscapeMode ? 20 : 10);
        const withdrawButtonY = this.scene.centerY + (isLandscapeMode ? 180 : 160);
        
        this.submenuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            titleY, 
            "WITHDRAW FUNDS", 
            titleFontSize,
            { depth: 254 }
        );

        let ethBalanceString = "0.00000 ETH";
        if (this.scene.currentBalance) {
            try {
                ethBalanceString = `${formatBalance(this.scene.currentBalance, ETH_BALANCE_DECIMALS)} ETH`;
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
            `Your ETH Balance: ${ethBalanceString}`, 
            titleFontSize - 2,
            { depth: 254 }
        );

        let gachaBalanceString = "0 GACHA";
        try {
            const gachaBalance = getPlayerGachaTokenBalance();
            gachaBalanceString = `${formatBalance(gachaBalance, GACHA_BALANCE_DECIMALS)} GACHA`;
        } catch (error) {
            console.error('Error converting gacha balance:', error);
            gachaBalanceString = "0 GACHA";
        }

        this.gachaBalanceText = new MenuText(
            this.scene,
            this.scene.centerX, 
            gachaBalanceY, 
            `Your GACHA Balance: ${gachaBalanceString}`, 
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
            this.gachaBalanceText,
            this.addressLabel,
            this.addressInput,
            this.withdrawButton,
            this.submenuXButton
        ];
    }

    showForfeitSubmenu() {
        this.currentSubmenu = 'cleanup';
        
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
            "CLEANUP", 
            titleFontSize,
            { depth: 254 }
        );

        this.warningText = new MenuText(
            this.scene,
            this.scene.centerX, 
            warningY,
            "This will forfeit your current game\nand clear cache. This will not\naffect your balance.", 
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
            "CONFIRM CLEANUP", 
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

    showDisconnectSubmenu() {
        this.currentSubmenu = 'disconnect';
        
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
        const warningY = this.scene.centerY - (isLandscapeMode ? 100 : 60);
        const confirmButtonY = this.scene.centerY + (isLandscapeMode ? 120 : 100);
        
        this.submenuTitle = new MenuText(
            this.scene,
            this.scene.centerX, 
            titleY, 
            "DISCONNECT WALLET", 
            titleFontSize,
            { depth: 254 }
        );

        this.warningText = new MenuText(
            this.scene,
            this.scene.centerX, 
            warningY,
            "This will disconnect your wallet,\nclear all session keys, and\nreset all game data.\n\nYou will need to reconnect to play.", 
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
            "CONFIRM DISCONNECT", 
            titleFontSize,
            () => this.executeDisconnect()
        );
        
        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.warningText,
            this.confirmButton,
            this.submenuXButton
        ];
    }

    executeDisconnect() {
        console.log('🔌 Disconnecting wallet...');
        
        // Clear all game data (session keys, wallet, pending commits, etc.)
        clearAllGameData();
        
        // Close the menu
        this.closeMenu();
        
        // Reload the page to show connect button
        window.location.reload();
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

    async executeWithdraw() {
        const address = this.addressInput.getValue().trim();
        if (address && address.startsWith('0x') && address.length === 42) {
            this.scene.pleaseWaitScreen.show(address);
            this.closeMenu();
            await withdrawFunds(address);
            this.scene.pleaseWaitScreen.hide();
        } else {
            console.log('Invalid address format');
        }
    }

    async executeForfeit() {
        if (this.scene.pleaseWaitScreen) {
            this.scene.pleaseWaitScreen.show();
        }
        
        try {
            this.clearAllCache();
            await forfeit();
            this.closeMenu();
        } catch (error) {
            console.error("Error executing forfeit:", error);
        } finally {
            window.location.reload();
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