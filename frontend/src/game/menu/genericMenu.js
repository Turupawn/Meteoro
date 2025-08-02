import { applyPerspectiveToQuadImageToDown } from '../../utils.js';

import { forfeit, withdrawFunds } from '../../blockchain_stuff.js';

export class GenericMenu {
    constructor(scene) {
        console.log('GenericMenu constructor called');
        this.scene = scene;
        this.menuElements = [];
        this.isOpen = false;
        this.currentSubmenu = null;
        this.createMenuButton();
    }

    createMenuButton() {
        console.log('Creating menu button...');
        
        document.fonts.ready.then(() => {
            this.createMenuButtonTexture();
        });
    }

    createMenuButtonTexture() {
        this.menuRenderTexture = this.scene.add.renderTexture(0, 0, 400, 400);
        
        const menuText = this.scene.add.text(0, 0, "MENU", {
            font: 'bold 120px Orbitron',
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 2,
            alpha: 0.9,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        });

        this.menuRenderTexture.draw(menuText);
        menuText.destroy();

        this.menuRenderTexture.saveTexture('menuButtonTexture');

        const x = this.scene.centerX;
        const y = 100;
        
        console.log('Creating menu button at:', x, y);
        console.log('Screen dimensions:', this.scene.screenWidth, this.scene.screenHeight);
        
        const menuButtonText = "MENU";
        const menuButtonWidth = Math.max(200, menuButtonText.length * 15);
        
        this.menuButtonBg = this.scene.add.rectangle(
            x,
            y - 50,
            menuButtonWidth,
            60,
            0x0066CC,
            0.3
        );
        this.menuButtonBg.setStrokeStyle(2, 0x00FFFF);
        this.menuButtonBg.setDepth(99);
        
        this.menuButton = this.scene.add.rexQuadImage({
            x: x,
            y: y,
            texture: 'menuButtonTexture',
            ninePointMode: true,
        });
        
        this.menuButton.setVisible(true);
        this.menuButton.setAlpha(0.85);
        this.menuButton.setInteractive();
        this.menuButton.setDepth(100);
        this.menuButton.setScale(0.40, 0.40);
        
        let perspectiveX = this.menuButton.topCenter.x + 0;
        let perspectiveY = this.menuButton.topCenter.y + 60;
        
        applyPerspectiveToQuadImageToDown(this.menuButton, perspectiveX, perspectiveY);
        
        this.menuButton.setSize(200, 80);
        
        this.menuButton.on('pointerdown', () => {
            this.toggleMenu();
        });

        this.menuButton.setTexture('menuButtonTexture');
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

        const menuWidth = Math.min(400, this.scene.screenWidth * 0.8);
        const menuHeight = Math.min(500, this.scene.screenHeight * 0.7);
        
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

        const titleFontSize = Math.max(20, this.scene.screenWidth / 40);
        this.menuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - menuHeight/2 + 30, 
            "GAME MENU", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF',
                stroke: '#0066CC',
                strokeThickness: 2,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.menuTitle.setDepth(252);

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
        this.xButton.setSize(this.xButton.width + 60, this.xButton.height + 60);
        this.xButton.on('pointerdown', () => this.closeMenu());
    }

    createMainMenuButtons() {
        const buttonFontSize = Math.max(16, this.scene.screenWidth / 45);
        const buttonSpacing = 50;
        const startY = this.scene.centerY - 30;
        
        this.menuButtons = [];

        // Deposit button
        this.depositButton = this.createSubmenuButton(
            this.scene.centerX, 
            startY, 
            "DEPOSIT", 
            buttonFontSize,
            () => this.showDepositSubmenu()
        );

        // Withdraw button
        this.withdrawButton = this.createSubmenuButton(
            this.scene.centerX, 
            startY + buttonSpacing, 
            "WITHDRAW", 
            buttonFontSize,
            () => this.showWithdrawSubmenu()
        );

        const forfeitY = startY + buttonSpacing * 2;
        this.forfeitButton = this.createSubmenuButton(
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

    createSubmenuButton(x, y, text, fontSize, onClick) {
        const fillColor = '#E0F6FF';
        const strokeColor = '#0066CC';
        
        const button = this.scene.add.text(x, y, text, {
            font: `${fontSize}px Orbitron`,
            fill: fillColor,
            stroke: strokeColor,
            strokeThickness: 2,
            alpha: 0.9,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5).setInteractive();

        button.setDepth(252);
        button.setSize(button.width + 80, button.height + 40);
        
        if (onClick && typeof onClick === 'function') {
            button.on('pointerdown', onClick);
        }

        return button;
    }

    // DEPOSIT SUBMENU
    showDepositSubmenu() {
        console.log('Opening deposit submenu...');
        this.currentSubmenu = 'deposit';
        
        this.clearMainMenu();
        
        this.submenuWidth = Math.min(850, this.scene.screenWidth * 0.97);
        this.submenuHeight = Math.min(600, this.scene.screenHeight * 0.8);
        
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

        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - this.submenuHeight/2 + 30, 
            "DEPOSIT ADDRESS", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF',
                stroke: '#0066CC',
                strokeThickness: 2,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.submenuTitle.setDepth(254);
        
        const wallet = window.getLocalWallet();
        const address = wallet ? wallet.address : 'No wallet';

        this.addressInput = document.createElement('input');
        this.addressInput.type = 'text';
        this.addressInput.value = address;
        this.addressInput.readOnly = true;
        this.addressInput.style.position = 'absolute';
        this.addressInput.style.left = `${this.scene.centerX - 150}px`;
        this.addressInput.style.top = `${this.scene.centerY - 50}px`;
        this.addressInput.style.width = '300px';
        this.addressInput.style.fontSize = `${titleFontSize - 2}px`;
        this.addressInput.style.padding = '8px';
        this.addressInput.style.textAlign = 'center';
        this.addressInput.style.border = '2px solid #00FFFF';
        this.addressInput.style.backgroundColor = '#000000';
        this.addressInput.style.color = '#00FF00';
        this.addressInput.style.userSelect = 'text';
        this.addressInput.style.webkitUserSelect = 'text';
        document.body.appendChild(this.addressInput);

        this.instructionText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY, 
            "Long press to copy address", 
            {
                font: `${titleFontSize - 4}px Orbitron`,
                fill: '#E0F6FF', // Same as balance text
                stroke: '#0066CC', // Same as balance text
                strokeThickness: 1,
                alpha: 0.9, // Same transparency as balance text
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.instructionText.setDepth(254);

        this.faucetText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY + 50, 
            "Get test tokens from faucet:", 
            {
                font: `${titleFontSize - 4}px Orbitron`,
                fill: '#E0F6FF',
                stroke: '#0066CC',
                strokeThickness: 1,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.faucetText.setDepth(254);

        this.faucetLink = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY + 80, 
            "https://testnet.megaeth.com/", 
            {
                font: `${titleFontSize - 4}px Orbitron`,
                fill: '#0066CC',
                stroke: '#003366',
                strokeThickness: 1,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5).setInteractive();
        this.faucetLink.setDepth(254);
        this.faucetLink.setSize(this.faucetLink.width + 20, this.faucetLink.height + 10);
        this.faucetLink.on('pointerdown', () => {
            window.open('https://testnet.megaeth.com/', '_blank');
        });

        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.addressInput,
            this.instructionText,
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
        this.submenuXButton.setSize(this.submenuXButton.width + 60, this.submenuXButton.height + 60);
        this.submenuXButton.on('pointerdown', () => this.closeMenu());
    }

        showWithdrawSubmenu() {
            console.log('Opening withdraw submenu...');
            this.currentSubmenu = 'withdraw';
            
            this.clearMainMenu();
            
            this.submenuWidth = Math.min(850, this.scene.screenWidth * 0.97);
            this.submenuHeight = Math.min(600, this.scene.screenHeight * 0.8);
            
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

        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - this.submenuHeight/2 + 30, 
            "WITHDRAW FUNDS", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF',
                stroke: '#0066CC',
                strokeThickness: 2,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.submenuTitle.setDepth(254);

        const currentBalance = this.scene.currentBalance || "0 ETH";
        this.balanceText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 80, 
            `Balance: ${currentBalance}`, 
            {
                font: `${titleFontSize - 2}px Orbitron`,
                fill: '#E0F6FF',
                stroke: '#0066CC',
                strokeThickness: 1,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.balanceText.setDepth(254);

        this.addressLabel = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 30, 
            "Enter destination address:", 
            {
                font: `${titleFontSize - 4}px Orbitron`,
                fill: '#E0F6FF',
                stroke: '#0066CC',
                strokeThickness: 1,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.addressLabel.setDepth(254);

        this.addressInput = document.createElement('input');
        this.addressInput.type = 'text';
        this.addressInput.placeholder = 'Enter address...';
        this.addressInput.style.position = 'absolute';
        this.addressInput.style.left = `${this.scene.centerX - 150}px`;
        this.addressInput.style.top = `${this.scene.centerY + 10}px`;
        this.addressInput.style.width = '300px';
        this.addressInput.style.fontSize = `${titleFontSize - 4}px`;
        this.addressInput.style.padding = '8px';
        this.addressInput.style.textAlign = 'center';
        this.addressInput.style.border = '2px solid #00FFFF';
        this.addressInput.style.backgroundColor = '#000000';
        this.addressInput.style.color = '#00FF00';
        document.body.appendChild(this.addressInput);
        
        const withdrawButtonText = "WITHDRAW";
        const withdrawButtonWidth = Math.max(250, withdrawButtonText.length * 15);
        
        this.withdrawButtonBg = this.scene.add.rectangle(
            this.scene.centerX,
            this.scene.centerY + 120,
            withdrawButtonWidth,
            50,
            0x0066CC,
            0.3
        );
        this.withdrawButtonBg.setStrokeStyle(2, 0x00FFFF);
        this.withdrawButtonBg.setDepth(255);
        
        this.withdrawButton = this.createSubmenuButton(
            this.scene.centerX, 
            this.scene.centerY + 120,
            "WITHDRAW", 
            titleFontSize,
            () => this.executeWithdraw()
        );
        
        this.withdrawButton.setDepth(256);
        
        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.balanceText,
            this.addressLabel,
            this.addressInput,
            this.withdrawButtonBg,
            this.withdrawButton,
            this.submenuXButton
        ];
    }

        showForfeitSubmenu() {
            this.currentSubmenu = 'forfeit';
            
            this.clearMainMenu();
            
            this.submenuWidth = Math.min(900, this.scene.screenWidth * 0.98);
            this.submenuHeight = Math.min(600, this.scene.screenHeight * 0.8);
            
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

        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - this.submenuHeight/2 + 30, 
            "FORFEIT GAME", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF',
                stroke: '#0066CC',
                strokeThickness: 2,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                }
            }
        ).setOrigin(0.5);
        this.submenuTitle.setDepth(254);

        this.warningText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 50,
            "This will forfeit your current game\nand clear all cached data.", 
            {
                font: `${titleFontSize - 4}px Orbitron`,
                fill: '#FF4444',
                stroke: '#0066CC',
                strokeThickness: 1,
                alpha: 0.9,
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                },
                wordWrap: { width: this.submenuWidth - 100 },
                align: 'center'
            }
        ).setOrigin(0.5);
        this.warningText.setDepth(254);
        
        const confirmButtonY = this.scene.centerY + 10;
        
        const confirmButtonText = "CONFIRM FORFEIT";
        const confirmButtonWidth = Math.max(400, confirmButtonText.length * 20);
        
        this.confirmButtonBg = this.scene.add.rectangle(
            this.scene.centerX,
            confirmButtonY,
            confirmButtonWidth,
            50,
            0x0066CC,
            0.3
        );
        this.confirmButtonBg.setStrokeStyle(2, 0x00FFFF);
        this.confirmButtonBg.setDepth(255);
        
        this.confirmButton = this.createSubmenuButton(
            this.scene.centerX, 
            confirmButtonY, 
            "CONFIRM FORFEIT", 
            titleFontSize,
            () => this.executeForfeit()
        );
        
        this.confirmButton.setDepth(256);
        
        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.warningText,
            this.confirmButtonBg,
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
        const address = this.addressInput.value.trim();
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