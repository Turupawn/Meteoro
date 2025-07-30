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
        
        // Create a render texture for the menu button
        this.menuRenderTexture = this.scene.add.renderTexture(0, 0, 200, 80);
        
        // Create the menu button text - same color as balance text
        const menuText = this.scene.add.text(0, 0, "MENU", {
            font: 'bold 32px Courier New',
            fill: '#00FFFF', // Same cyan color as balance text
            stroke: '#000000',
            strokeThickness: 3
        });
        menuText.setVisible(false);

        // Draw text to render texture
        this.menuRenderTexture.draw(menuText, 20, 20);
        menuText.destroy();

        // Save the texture
        this.menuRenderTexture.saveTexture('menuButtonTexture');

        // Create quad image with the texture - positioned just below balance text
        const x = this.scene.screenWidth - 150;
        const y = 200; // Position below balance text (which is at around 200)
        
        console.log('Creating menu button at:', x, y);
        
        this.menuButton = this.scene.add.rexQuadImage(x, y, 'menuButtonTexture');
        
        // Make sure it's visible and interactive
        this.menuButton.setVisible(true);
        this.menuButton.setAlpha(1);
        this.menuButton.setInteractive();
        this.menuButton.setDepth(100);
        
        // Apply perspective effect like game history - more pronounced
        this.menuButton.topRight.x -= 50;
        this.menuButton.topRight.y -= 30;
        this.menuButton.bottomRight.x -= 50;
        this.menuButton.bottomRight.y -= 30;
        
        // Set click area
        this.menuButton.setSize(200, 80);
        
        this.menuButton.on('pointerdown', () => {
            console.log('MENU BUTTON CLICKED!');
            this.toggleMenu();
        });

        console.log('Menu button created:', this.menuButton);
    }

    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        console.log('Opening menu...');
        this.isOpen = true;
        
        // Create background overlay
        this.background = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            this.scene.screenWidth, 
            this.scene.screenHeight, 
            0x000000, 
            0.7
        );
        this.background.setDepth(150);
        this.background.setInteractive();
        this.background.on('pointerdown', () => this.closeMenu());

        // Create menu container - positioned in center
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
        this.menuContainer.setDepth(151);

        // Menu title
        const titleFontSize = Math.max(20, this.scene.screenWidth / 40);
        this.menuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - menuHeight/2 + 30, 
            "GAME MENU", 
            {
                font: `bold ${titleFontSize}px Courier New`,
                fill: "#00FFFF",
                stroke: "#000000",
                strokeThickness: 3
            }
        ).setOrigin(0.5);
        this.menuTitle.setDepth(152);

        // Create X button at top right
        this.createXButton(menuWidth, menuHeight);

        // Create main menu buttons
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
        // Position X button at top right of menu container
        const x = this.scene.centerX + (menuWidth / 2) - 30;
        const y = this.scene.centerY - (menuHeight / 2) + 30;
        
        this.xButton = this.scene.add.text(x, y, "✕", {
            font: '24px Arial',
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        this.xButton.setDepth(155);
        this.xButton.setSize(this.xButton.width + 20, this.xButton.height + 20);
        this.xButton.on('pointerdown', () => this.closeMenu());
    }

    createMainMenuButtons() {
        const buttonFontSize = Math.max(16, this.scene.screenWidth / 45);
        const buttonSpacing = 60;
        const startY = this.scene.centerY - 50;
        
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

        // Forfeit button
        this.forfeitButton = this.createSubmenuButton(
            this.scene.centerX, 
            startY + buttonSpacing * 2, 
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
        const button = this.scene.add.text(x, y, text, {
            font: `${fontSize}px Courier New`,
            fill: "#00FF00",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        button.setDepth(152);
        button.setSize(button.width + 40, button.height + 20);
        
        if (onClick && typeof onClick === 'function') {
            button.on('pointerdown', onClick);
        }

        return button;
    }

    // DEPOSIT SUBMENU
    showDepositSubmenu() {
        console.log('Opening deposit submenu...');
        this.currentSubmenu = 'deposit';
        
        // Clear main menu
        this.clearMainMenu();
        
        // Create deposit submenu - positioned in center
        const submenuWidth = Math.min(500, this.scene.screenWidth * 0.9);
        const submenuHeight = Math.min(600, this.scene.screenHeight * 0.8);
        
        this.submenuContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            submenuWidth, 
            submenuHeight, 
            0x000000, 
            0.95
        );
        this.submenuContainer.setStrokeStyle(2, 0x00FFFF);
        this.submenuContainer.setDepth(153);

        // Create X button for submenu
        this.createSubmenuXButton(submenuWidth, submenuHeight);

        // Submenu title
        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - submenuHeight/2 + 30, 
            "DEPOSIT ADDRESS", 
            {
                font: `bold ${titleFontSize}px Courier New`,
                fill: "#00FFFF",
                stroke: "#000000",
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.submenuTitle.setDepth(154);

        // Get wallet address
        const wallet = window.getLocalWallet();
        const address = wallet ? wallet.address : 'No wallet';

        // Address input field (like the original)
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

        // Instructions
        this.instructionText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY, 
            "Long press to copy address", 
            {
                font: `${titleFontSize - 4}px Courier New`,
                fill: "#00FFFF",
                stroke: "#000000",
                strokeThickness: 1
            }
        ).setOrigin(0.5);
        this.instructionText.setDepth(154);

        // Faucet link
        this.faucetText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY + 50, 
            "Get test tokens from faucet:", 
            {
                font: `${titleFontSize - 4}px Courier New`,
                fill: "#00FFFF",
                stroke: "#000000",
                strokeThickness: 1
            }
        ).setOrigin(0.5);
        this.faucetText.setDepth(154);

        this.faucetLink = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY + 80, 
            "https://testnet.megaeth.com/", 
            {
                font: `${titleFontSize - 4}px Courier New`,
                fill: "#0066CC",
                stroke: "#000000",
                strokeThickness: 1
            }
        ).setOrigin(0.5).setInteractive();
        this.faucetLink.setDepth(154);
        this.faucetLink.setSize(this.faucetLink.width + 20, this.faucetLink.height + 10);
        this.faucetLink.on('pointerdown', () => {
            window.open('https://testnet.megaeth.com/', '_blank');
        });

        // Add click outside to close functionality
        this.background.on('pointerdown', (pointer) => {
            this.handleBackgroundClick(pointer, submenuWidth, submenuHeight);
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
        // Position X button at top right of submenu container
        const x = this.scene.centerX + (submenuWidth / 2) - 30;
        const y = this.scene.centerY - (submenuHeight / 2) + 30;
        
        this.submenuXButton = this.scene.add.text(x, y, "✕", {
            font: '24px Arial',
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        this.submenuXButton.setDepth(155);
        this.submenuXButton.setSize(this.submenuXButton.width + 20, this.submenuXButton.height + 20);
        this.submenuXButton.on('pointerdown', () => this.closeMenu());
    }

    // WITHDRAW SUBMENU
    showWithdrawSubmenu() {
        console.log('Opening withdraw submenu...');
        this.currentSubmenu = 'withdraw';
        
        this.clearMainMenu();
        
        const submenuWidth = Math.min(500, this.scene.screenWidth * 0.9);
        const submenuHeight = Math.min(600, this.scene.screenHeight * 0.8);
        
        this.submenuContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            submenuWidth, 
            submenuHeight, 
            0x000000, 
            0.95
        );
        this.submenuContainer.setStrokeStyle(2, 0x00FFFF);
        this.submenuContainer.setDepth(153);

        // Create X button for submenu
        this.createSubmenuXButton(submenuWidth, submenuHeight);

        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - submenuHeight/2 + 30, 
            "WITHDRAW FUNDS", 
            {
                font: `bold ${titleFontSize}px Courier New`,
                fill: "#00FFFF",
                stroke: "#000000",
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.submenuTitle.setDepth(154);

        // Balance display
        const currentBalance = this.scene.currentBalance || "0 ETH";
        this.balanceText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 80, 
            `Balance: ${currentBalance}`, 
            {
                font: `${titleFontSize - 2}px Courier New`,
                fill: "#00FF00",
                stroke: "#000000",
                strokeThickness: 1
            }
        ).setOrigin(0.5);
        this.balanceText.setDepth(154);

        // Address input label
        this.addressLabel = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 30, 
            "Enter destination address:", 
            {
                font: `${titleFontSize - 4}px Courier New`,
                fill: "#00FFFF",
                stroke: "#000000",
                strokeThickness: 1
            }
        ).setOrigin(0.5);
        this.addressLabel.setDepth(154);

        // Create input field
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

        // Withdraw button
        this.withdrawButton = this.createSubmenuButton(
            this.scene.centerX, 
            this.scene.centerY + 80, 
            "WITHDRAW", 
            titleFontSize,
            () => this.executeWithdraw()
        );

        // Add click outside to close functionality
        this.background.on('pointerdown', (pointer) => {
            this.handleBackgroundClick(pointer, submenuWidth, submenuHeight);
        });

        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.balanceText,
            this.addressLabel,
            this.addressInput,
            this.withdrawButton,
            this.submenuXButton
        ];
    }

    // FORFEIT SUBMENU
    showForfeitSubmenu() {
        console.log('Opening forfeit submenu...');
        this.currentSubmenu = 'forfeit';
        
        this.clearMainMenu();
        
        const submenuWidth = Math.min(500, this.scene.screenWidth * 0.9);
        const submenuHeight = Math.min(500, this.scene.screenHeight * 0.7);
        
        this.submenuContainer = this.scene.add.rectangle(
            this.scene.centerX, 
            this.scene.centerY, 
            submenuWidth, 
            submenuHeight, 
            0x000000, 
            0.95
        );
        this.submenuContainer.setStrokeStyle(2, 0x00FFFF);
        this.submenuContainer.setDepth(153);

        // Create X button for submenu
        this.createSubmenuXButton(submenuWidth, submenuHeight);

        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - submenuHeight/2 + 30, 
            "FORFEIT GAME", 
            {
                font: `bold ${titleFontSize}px Courier New`,
                fill: "#00FFFF",
                stroke: "#000000",
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.submenuTitle.setDepth(154);

        // Warning text
        this.warningText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 30, 
            "This will forfeit your current game\nand clear all cached data.", 
            {
                font: `${titleFontSize - 4}px Courier New`,
                fill: "#FF4444",
                stroke: "#000000",
                strokeThickness: 1
            }
        ).setOrigin(0.5);
        this.warningText.setDepth(154);

        // Confirm button
        this.confirmButton = this.createSubmenuButton(
            this.scene.centerX, 
            this.scene.centerY + 50, 
            "CONFIRM FORFEIT", 
            titleFontSize,
            () => this.executeForfeit()
        );

        // Add click outside to close functionality
        this.background.on('pointerdown', (pointer) => {
            this.handleBackgroundClick(pointer, submenuWidth, submenuHeight);
        });

        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.warningText,
            this.confirmButton,
            this.submenuXButton
        ];
    }

    handleBackgroundClick(pointer, submenuWidth, submenuHeight) {
        // Calculate the bounds of the submenu
        const submenuLeft = this.scene.centerX - submenuWidth/2;
        const submenuRight = this.scene.centerX + submenuWidth/2;
        const submenuTop = this.scene.centerY - submenuHeight/2;
        const submenuBottom = this.scene.centerY + submenuHeight/2;
        
        // Only close if clicking outside the submenu bounds
        if (pointer.x < submenuLeft || pointer.x > submenuRight || 
            pointer.y < submenuTop || pointer.y > submenuBottom) {
            this.closeMenu();
        }
    }

    clearMainMenu() {
        // Clear main menu elements
        this.menuElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            }
        });
        this.menuElements = [];
    }

    backToMainMenu() {
        // Clear submenu
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
        
        // Reopen main menu
        this.openMenu();
    }

    executeWithdraw() {
        const address = this.addressInput.value.trim();
        if (address && address.startsWith('0x') && address.length === 42) {
            window.withdrawFunds(address);
            this.closeMenu();
        } else {
            console.log('Invalid address format');
        }
    }

    async executeForfeit() {
        try {
            // Clear all cached data
            this.clearAllCache();
            
            // Call forfeit function on chain
            if (window.forfeit) {
                await window.forfeit();
                console.log("Forfeit transaction completed successfully");
            } else {
                console.error("Forfeit function not available");
            }
            
            this.closeMenu();
        } catch (error) {
            console.error("Error executing forfeit:", error);
        }
    }

    clearAllCache() {
        localStorage.removeItem('playerSecret');
        localStorage.removeItem('pendingCommit');
        localStorage.removeItem('pendingReveal');
        console.log("All cached data cleared");
    }

    closeMenu() {
        if (!this.isOpen) return;
        
        console.log('Closing menu...');
        this.isOpen = false;
        
        // Clear main menu
        this.menuElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                element.destroy();
            }
        });
        this.menuElements = [];
        
        // Clear submenu if open
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