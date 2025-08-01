import { applyPerspectiveToQuadImageToDown } from '../../utils.js';

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
        
        // Wait for Orbitron font to load
        document.fonts.ready.then(() => {
            this.createMenuButtonTexture();
        });
    }

    createMenuButtonTexture() {
        // Create a render texture for the menu button - much bigger like balance text
        this.menuRenderTexture = this.scene.add.renderTexture(0, 0, 400, 400);
        
        // Create the menu button text with Orbitron font - same styling as balance text
        const menuText = this.scene.add.text(0, 0, "MENU", {
            font: 'bold 120px Orbitron',
            fill: '#E0F6FF', // Same as balance text
            stroke: '#0066CC', // Same as balance text
            strokeThickness: 2,
            alpha: 0.9, // Same transparency as balance text
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        });

        // Draw text to render texture - no positioning offset like balance text
        this.menuRenderTexture.draw(menuText);
        menuText.destroy();

        // Save the texture
        this.menuRenderTexture.saveTexture('menuButtonTexture');

        // Create quad image with the texture - positioned in center of screen for testing
        const x = this.scene.centerX; // Center of screen
        const y = 100; // Center of screen
        
        console.log('Creating menu button at:', x, y);
        console.log('Screen dimensions:', this.scene.screenWidth, this.scene.screenHeight);
        
        // Calculate button width based on text
        const menuButtonText = "MENU";
        const menuButtonWidth = Math.max(200, menuButtonText.length * 15); // Reduced from 300/20 to 200/15
        
        // Create button background
        this.menuButtonBg = this.scene.add.rectangle(
            x,
            y - 50,
            menuButtonWidth, // Dynamic width based on text
            60,  // Reduced height from 80 to 60
            0x0066CC, // Blue background
            0.3 // Semi-transparent
        );
        this.menuButtonBg.setStrokeStyle(2, 0x00FFFF); // Cyan border
        this.menuButtonBg.setDepth(99); // Just below the text
        
        this.menuButton = this.scene.add.rexQuadImage({
            x: x,
            y: y,
            texture: 'menuButtonTexture',
            ninePointMode: true,
        });
        
        // Make sure it's visible and interactive with transparency
        this.menuButton.setVisible(true);
        this.menuButton.setAlpha(0.85); // Same transparency as balance text
        this.menuButton.setInteractive();
        this.menuButton.setDepth(100); // Very high depth to ensure visibility
        this.menuButton.setScale(0.40, 0.40); // Reduced from 0.60 to 0.40
        
        // Apply perspective effect pointing downward
        let perspectiveX = this.menuButton.topCenter.x + 0;
        let perspectiveY = this.menuButton.topCenter.y + 60; // Point downward
        
        applyPerspectiveToQuadImageToDown(this.menuButton, perspectiveX, perspectiveY);
        
        // Set click area
        this.menuButton.setSize(200, 80);
        
        this.menuButton.on('pointerdown', () => {
            console.log('MENU BUTTON CLICKED!');
            this.toggleMenu();
        });

        this.menuButton.setTexture('menuButtonTexture');

        console.log("Finished creating menu button");
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
        this.background.setDepth(250); // Increased from 150 to be above play button (200)
        this.background.setInteractive();
        this.background.on('pointerdown', (pointer) => {
            // If we're in a submenu, use the submenu-specific click handler
            if (this.currentSubmenu && this.submenuWidth && this.submenuHeight) {
                this.handleBackgroundClick(pointer, this.submenuWidth, this.submenuHeight);
            } else {
                // Main menu - just close
                this.closeMenu();
            }
        });

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
        this.menuContainer.setDepth(251); // Increased from 151 to be above play button (200)

        // Menu title - same styling as balance text
        const titleFontSize = Math.max(20, this.scene.screenWidth / 40);
        this.menuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - menuHeight/2 + 30, 
            "GAME MENU", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF', // Same as balance text
                stroke: '#0066CC', // Same as balance text
                strokeThickness: 2,
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
        this.menuTitle.setDepth(252); // Increased from 152 to be above play button (200)

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
            font: '32px Arial', // Increased from 24px to 32px
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        this.xButton.setDepth(255); // Increased from 155 to be above play button (200)
        // Make X button bigger for mobile
        this.xButton.setSize(this.xButton.width + 60, this.xButton.height + 60); // Increased from +40/+40 to +60/+60
        this.xButton.on('pointerdown', () => this.closeMenu());
    }

    createMainMenuButtons() {
        const buttonFontSize = Math.max(16, this.scene.screenWidth / 45);
        const buttonSpacing = 50; // Reduced from 60 to 50
        const startY = this.scene.centerY - 30; // Moved up from -50 to -30
        
        console.log('Creating main menu buttons...');
        console.log('Button spacing:', buttonSpacing);
        console.log('Start Y:', startY);
        console.log('Screen center Y:', this.scene.centerY);
        
        this.menuButtons = [];

        // Deposit button
        this.depositButton = this.createSubmenuButton(
            this.scene.centerX, 
            startY, 
            "DEPOSIT", 
            buttonFontSize,
            () => this.showDepositSubmenu()
        );
        console.log('Deposit button created at Y:', startY);

        // Withdraw button
        this.withdrawButton = this.createSubmenuButton(
            this.scene.centerX, 
            startY + buttonSpacing, 
            "WITHDRAW", 
            buttonFontSize,
            () => this.showWithdrawSubmenu()
        );
        console.log('Withdraw button created at Y:', startY + buttonSpacing);

        // Forfeit button
        const forfeitY = startY + buttonSpacing * 2;
        console.log('Creating forfeit button at Y:', forfeitY);
        this.forfeitButton = this.createSubmenuButton(
            this.scene.centerX, 
            forfeitY, 
            "FORFEIT", 
            buttonFontSize,
            () => this.showForfeitSubmenu()
        );
        console.log('Forfeit button created successfully:', this.forfeitButton);
        console.log('Forfeit button visible:', this.forfeitButton.visible);
        console.log('Forfeit button alpha:', this.forfeitButton.alpha);

        this.menuButtons = [
            this.depositButton, 
            this.withdrawButton, 
            this.forfeitButton
        ];
    }

    createSubmenuButton(x, y, text, fontSize, onClick) {
        // Use same styling as balance text for all buttons
        const fillColor = '#E0F6FF'; // Same as balance text
        const strokeColor = '#0066CC'; // Same as balance text
        
        const button = this.scene.add.text(x, y, text, {
            font: `${fontSize}px Orbitron`,
            fill: fillColor,
            stroke: strokeColor,
            strokeThickness: 2,
            alpha: 0.9, // Same transparency as balance text
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#003366',
                blur: 4,
                fill: true
            }
        }).setOrigin(0.5).setInteractive();

        button.setDepth(252); // Increased from 152 to be above play button (200)
        // Make buttons much bigger for mobile - increased click area significantly
        button.setSize(button.width + 80, button.height + 40); // Increased from +40/+20 to +80/+40
        
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
        
        // Create deposit submenu - positioned in center, made wider
        this.submenuWidth = Math.min(850, this.scene.screenWidth * 0.97); // Increased from 700 to 850
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
        this.submenuContainer.setDepth(253); // Increased from 153 to be above play button (200)

        // Create X button for submenu
        this.createSubmenuXButton(this.submenuWidth, this.submenuHeight);

        // Submenu title - same styling as balance text
        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - this.submenuHeight/2 + 30, 
            "DEPOSIT ADDRESS", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF', // Same as balance text
                stroke: '#0066CC', // Same as balance text
                strokeThickness: 2,
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
        this.submenuTitle.setDepth(254); // Increased from 154 to be above play button (200)

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

        // Instructions - same styling as balance text
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
        this.instructionText.setDepth(254); // Increased from 154 to be above play button (200)

        // Faucet link - same styling as balance text
        this.faucetText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY + 50, 
            "Get test tokens from faucet:", 
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
        this.faucetText.setDepth(254); // Increased from 154 to be above play button (200)

        this.faucetLink = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY + 80, 
            "https://testnet.megaeth.com/", 
            {
                font: `${titleFontSize - 4}px Orbitron`,
                fill: '#0066CC', // Keep link color for distinction
                stroke: '#003366', // Darker stroke for link
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
        ).setOrigin(0.5).setInteractive();
        this.faucetLink.setDepth(254); // Increased from 154 to be above play button (200)
        this.faucetLink.setSize(this.faucetLink.width + 20, this.faucetLink.height + 10);
        this.faucetLink.on('pointerdown', () => {
            window.open('https://testnet.megaeth.com/', '_blank');
        });

        // Background click handler is already set up in openMenu() and will work for submenus

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
            font: '32px Arial', // Increased from 24px to 32px
            fill: "#FF0000",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setInteractive();

        this.submenuXButton.setDepth(255); // Increased from 155 to be above play button (200)
        // Make submenu X button bigger for mobile
        this.submenuXButton.setSize(this.submenuXButton.width + 60, this.submenuXButton.height + 60); // Increased from +40/+40 to +60/+60
        this.submenuXButton.on('pointerdown', () => this.closeMenu());
    }

            // WITHDRAW SUBMENU
        showWithdrawSubmenu() {
            console.log('Opening withdraw submenu...');
            this.currentSubmenu = 'withdraw';
            
            this.clearMainMenu();
            
            this.submenuWidth = Math.min(850, this.scene.screenWidth * 0.97); // Increased from 700 to 850
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
            this.submenuContainer.setDepth(253); // Increased from 153 to be above play button (200)

        // Create X button for submenu
        this.createSubmenuXButton(this.submenuWidth, this.submenuHeight);

        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - this.submenuHeight/2 + 30, 
            "WITHDRAW FUNDS", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF', // Same as balance text
                stroke: '#0066CC', // Same as balance text
                strokeThickness: 2,
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
        this.submenuTitle.setDepth(254); // Increased from 154 to be above play button (200)

        // Balance display - same styling as balance text
        const currentBalance = this.scene.currentBalance || "0 ETH";
        this.balanceText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 80, 
            `Balance: ${currentBalance}`, 
            {
                font: `${titleFontSize - 2}px Orbitron`,
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
        this.balanceText.setDepth(254); // Increased from 154 to be above play button (200)

        // Address input label - same styling as balance text
        this.addressLabel = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 30, 
            "Enter destination address:", 
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
        this.addressLabel.setDepth(254); // Increased from 154 to be above play button (200)

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

        // Withdraw button - positioned like confirm forfeit button
        // Calculate button width based on text
        const withdrawButtonText = "WITHDRAW";
        const withdrawButtonWidth = Math.max(250, withdrawButtonText.length * 15); // At least 250px, or 15px per character
        
        // Create button background
        this.withdrawButtonBg = this.scene.add.rectangle(
            this.scene.centerX,
            this.scene.centerY + 120,
            withdrawButtonWidth, // Dynamic width based on text
            50,  // Height
            0x0066CC, // Blue background
            0.3 // Semi-transparent
        );
        this.withdrawButtonBg.setStrokeStyle(2, 0x00FFFF); // Cyan border
        this.withdrawButtonBg.setDepth(255); // Increased from 155 to be above play button (200)
        
        this.withdrawButton = this.createSubmenuButton(
            this.scene.centerX, 
            this.scene.centerY + 120, // Moved from +80 to +120 to be much lower
            "WITHDRAW", 
            titleFontSize,
            () => this.executeWithdraw()
        );
        
        // Set higher depth for withdraw button to ensure it's on top
        this.withdrawButton.setDepth(256); // Increased from 156 to be above play button (200)
        
        console.log('Withdraw button created:', this.withdrawButton);
        console.log('Withdraw button visible:', this.withdrawButton.visible);
        console.log('Withdraw button alpha:', this.withdrawButton.alpha);
        console.log('Withdraw button depth:', this.withdrawButton.depth);
        console.log('Withdraw button position:', this.withdrawButton.x, this.withdrawButton.y);

        // Background click handler is already set up in openMenu() and will work for submenus

        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.balanceText,
            this.addressLabel,
            this.addressInput,
            this.withdrawButtonBg, // Add button background
            this.withdrawButton,
            this.submenuXButton
        ];
    }

            // FORFEIT SUBMENU
        showForfeitSubmenu() {
            console.log('Opening forfeit submenu...');
            this.currentSubmenu = 'forfeit';
            
            this.clearMainMenu();
            
            this.submenuWidth = Math.min(900, this.scene.screenWidth * 0.98); // Keep forfeit submenu slightly wider
            this.submenuHeight = Math.min(600, this.scene.screenHeight * 0.8); // Increased from 500 to 600
            
            console.log('Submenu dimensions:', this.submenuWidth, this.submenuHeight);
            console.log('Submenu center:', this.scene.centerX, this.scene.centerY);
            
            this.submenuContainer = this.scene.add.rectangle(
                this.scene.centerX, 
                this.scene.centerY, 
                this.submenuWidth, 
                this.submenuHeight, 
                0x000000, 
                0.95
            );
            this.submenuContainer.setStrokeStyle(2, 0x00FFFF);
            this.submenuContainer.setDepth(253); // Increased from 153 to be above play button (200)

        // Create X button for submenu
        this.createSubmenuXButton(this.submenuWidth, this.submenuHeight);

        const titleFontSize = Math.max(18, this.scene.screenWidth / 45);
        this.submenuTitle = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - this.submenuHeight/2 + 30, 
            "FORFEIT GAME", 
            {
                font: `bold ${titleFontSize}px Orbitron`,
                fill: '#E0F6FF', // Same as balance text
                stroke: '#0066CC', // Same as balance text
                strokeThickness: 2,
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
        this.submenuTitle.setDepth(254); // Increased from 154 to be above play button (200)

        // Warning text - same styling as balance text but with red color for warning
        this.warningText = this.scene.add.text(
            this.scene.centerX, 
            this.scene.centerY - 50, // Moved from -30 to -50
            "This will forfeit your current game\nand clear all cached data.", 
            {
                font: `${titleFontSize - 4}px Orbitron`,
                fill: '#FF4444', // Red for warning
                stroke: '#0066CC', // Same stroke as balance text
                strokeThickness: 1,
                alpha: 0.9, // Same transparency as balance text
                shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#003366',
                    blur: 4,
                    fill: true
                },
                wordWrap: { width: this.submenuWidth - 100 }, // Add word wrap to fit text
                align: 'center' // Center align the text
            }
        ).setOrigin(0.5);
        this.warningText.setDepth(254); // Increased from 154 to be above play button (200)

        // Confirm button - moved up and made more visible with higher depth
        const confirmButtonY = this.scene.centerY + 10; // Moved from +30 to +10 to fit in container
        console.log('Creating confirm forfeit button at Y:', confirmButtonY);
        
        // Calculate button width based on text
        const confirmButtonText = "CONFIRM FORFEIT";
        const confirmButtonWidth = Math.max(400, confirmButtonText.length * 20); // Increased from 300/15 to 400/20 for more width
        
        // Create button background
        this.confirmButtonBg = this.scene.add.rectangle(
            this.scene.centerX,
            confirmButtonY,
            confirmButtonWidth, // Dynamic width based on text
            50,  // Height
            0x0066CC, // Blue background
            0.3 // Semi-transparent
        );
        this.confirmButtonBg.setStrokeStyle(2, 0x00FFFF); // Cyan border
        this.confirmButtonBg.setDepth(255); // Increased from 155 to be above play button (200)
        
        this.confirmButton = this.createSubmenuButton(
            this.scene.centerX, 
            confirmButtonY, 
            "CONFIRM FORFEIT", 
            titleFontSize,
            () => this.executeForfeit()
        );
        
        // Set higher depth for confirm button to ensure it's on top
        this.confirmButton.setDepth(256); // Increased from 156 to be above play button (200)
        
        console.log('Confirm button created:', this.confirmButton);
        console.log('Confirm button visible:', this.confirmButton.visible);
        console.log('Confirm button alpha:', this.confirmButton.alpha);
        console.log('Confirm button depth:', this.confirmButton.depth);
        console.log('Confirm button position:', this.confirmButton.x, this.confirmButton.y);

        // Background click handler is already set up in openMenu() and will work for submenus

        this.submenuElements = [
            this.submenuContainer,
            this.submenuTitle,
            this.warningText,
            this.confirmButtonBg, // Add button background
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
        // Clear main menu elements but preserve the background for submenus
        this.menuElements.forEach(element => {
            if (element && typeof element.destroy === 'function') {
                // Don't destroy the background - we need it for submenus
                if (element !== this.background) {
                    element.destroy();
                }
            }
        });
        // Keep only the background in menuElements
        this.menuElements = [this.background];
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
        
        // Clear main menu (including background)
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