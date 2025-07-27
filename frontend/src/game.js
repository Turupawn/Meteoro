class Screen extends Phaser.Scene {
    preload() {
        this.load.image("logo", "/g20.png");
    }

    create() {
        // Simple white background
        this.add.rectangle(400, 300, 800, 600, 0xffffff);

        // Simple logo
        this.add.image(400, 100, "logo").setScale(0.5);

        // Simple play button - just text
        const playButton = this.add.text(400, 300, "PLAY", {
            font: "20px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        // Simple click handler
        playButton.on('pointerdown', () => {
            this.currentGameText.setText(`Please wait...`);
            if (window.commit) {
                window.commit();
            }
        });

        // Simple title
        this.add.text(400, 200, "WAR GAME", {
            font: "24px Arial",
            fill: "#000000"
        }).setOrigin(0.5);

        // Simple balance display
        this.balanceText = this.add.text(750, 20, "Loading...", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(1, 0);

        // Current game display
        this.currentGameText = this.add.text(400, 400, "", {
            font: "16px Arial",
            fill: "#000000"
        }).setOrigin(0.5);

        // Simple deposit button - just text
        const depositButton = this.add.text(750, 50, "DEPOSIT", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(1, 0).setInteractive();

        // Simple withdraw button - just text
        const withdrawButton = this.add.text(750, 80, "WITHDRAW", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(1, 0).setInteractive();

        // Simple click handlers
        depositButton.on('pointerdown', () => {
            this.showDepositModal();
        });

        withdrawButton.on('pointerdown', () => {
            this.showWithdrawModal();
        });

        // Simple game history
        this.add.text(20, 20, "Games:", {
            font: "14px Arial",
            fill: "#000000"
        });

        // Pre-create text objects for game history (up to 10 games)
        this.gameHistoryTexts = [];
        for (let i = 0; i < 10; i++) {
            const textObj = this.add.text(20, 50 + i * 15, "", {
                font: "12px Arial",
                fill: "#000000"
            });
            this.gameHistoryTexts.push(textObj);
        }

        // Wait for game to be ready
        if (window.gameReady) {
            this.startUpdating();
        } else {
            window.addEventListener('gameReady', () => {
                this.startUpdating();
            });
        }
    }

    startUpdating() {
        // Start updating the display
        this.updateDisplay();
        this.time.addEvent({
            delay: 1000,
            callback: this.updateDisplay,
            callbackScope: this,
            loop: true
        });
    }

    showDepositModal() {
        // Simple modal - just text
        const modalBg = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.5);
        const modal = this.add.rectangle(400, 300, 400, 300, 0xffffff);
        
        const wallet = window.getLocalWallet();
        const addressText = this.add.text(400, 250, wallet ? wallet.address : 'No wallet', {
            font: "12px Arial",
            fill: "#000000"
        }).setOrigin(0.5);

        const copyButton = this.add.text(400, 300, "COPY", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        const closeButton = this.add.text(400, 350, "CLOSE", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        copyButton.on('pointerdown', () => {
            if (wallet) {
                navigator.clipboard.writeText(wallet.address);
            }
        });

        const closeClickHandler = () => {
            modalBg.destroy();
            modal.destroy();
            addressText.destroy();
            copyButton.destroy();
            closeButton.destroy();
        };

        closeButton.on('pointerdown', closeClickHandler);
    }

    showWithdrawModal() {
        // Simple modal - just text
        const modalBg = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.5);
        const modal = this.add.rectangle(400, 300, 400, 300, 0xffffff);

        let currentBalance = "0 ETH";
        if (window.globalGameState && window.globalGameState.playerBalance) {
            const balance = window.web3.utils.fromWei(window.globalGameState.playerBalance, 'ether');
            currentBalance = `${parseFloat(balance).toFixed(6)} ETH`;
        }

        const balanceText = this.add.text(400, 250, `Balance: ${currentBalance}`, {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5);

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.placeholder = 'Enter address...';
        inputField.style.position = 'absolute';
        inputField.style.left = '300px';
        inputField.style.top = '300px';
        inputField.style.width = '200px';
        document.body.appendChild(inputField);


        const withdrawButton = this.add.text(400, 350, "WITHDRAW", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        const closeButton = this.add.text(400, 400, "CLOSE", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        withdrawButton.on('pointerdown', () => {
            const address = inputField.value.trim();
            if (address && address.startsWith('0x') && address.length === 42) {
                window.withdrawFunds(address);
            }
        });

        const closeClickHandler = () => {
            modalBg.destroy();
            modal.destroy();
            balanceText.destroy();
            withdrawButton.destroy();
            closeButton.destroy();
            if (inputField.parentNode) {
                inputField.parentNode.removeChild(inputField);
            }
        };

        closeButton.on('pointerdown', closeClickHandler);
    }

    updateDisplay() {
        // Update balance
        if (window.globalGameState && window.globalGameState.playerBalance) {
            try {
                if (window.web3 && window.web3.utils) {
                    const balance = window.web3.utils.fromWei(window.globalGameState.playerBalance, 'ether');
                    this.balanceText.setText(`Balance: ${parseFloat(balance).toFixed(6)} ETH`);
                } else {
                    this.balanceText.setText(`Balance: ${window.globalGameState.playerBalance} wei`);
                }
            } catch (error) {
                this.balanceText.setText(`Balance: ${window.globalGameState.playerBalance} wei`);
            }
        } else {
            this.balanceText.setText("Balance: 0 ETH");
        }

        // Update current game display
        this.updateCurrentGameDisplay();

        // Update game history efficiently
        if (window.globalGameState && window.globalGameState.recentHistory) {
            const recentGames = window.globalGameState.recentHistory.slice(-10);
            
            // Update existing text objects instead of creating new ones
            for (let i = 0; i < 10; i++) {
                if (i < recentGames.length) {
                    const game = recentGames[i];
                    const isForfeit = game.playerCard === 0 && game.houseCard === 0;
                    const playerCard = this.getCardDisplay(parseInt(game.playerCard));
                    const houseCard = this.getCardDisplay(parseInt(game.houseCard));
                    const isWin = game.winner.toLowerCase() === window.getLocalWallet().address.toLowerCase();
                    
                    let gameText = "";
                    if (isForfeit) {
                        gameText = `Forfeit`;
                    } else if (isWin) {
                        gameText = `Win ${playerCard}-${houseCard}`;
                    } else {
                        gameText = `Lose ${playerCard}-${houseCard}`;
                    }
                    
                    this.gameHistoryTexts[i].setText(gameText);
                    this.gameHistoryTexts[i].setVisible(true);
                } else {
                    this.gameHistoryTexts[i].setVisible(false);
                }
            }
        } else {
            // Hide all history texts
            this.gameHistoryTexts.forEach(text => text.setVisible(false));
        }
    }

    updateCurrentGameDisplay(playerCard = null, houseCard = null) {
        if (playerCard !== null && houseCard !== null) {
            const playerCardDisplay = this.getCardDisplay(playerCard);
            const houseCardDisplay = this.getCardDisplay(houseCard);
            const winner = playerCard > houseCard ? "Player" : "House";
            
            this.currentGameText.setText(`Your card: ${playerCardDisplay} | House card: ${houseCardDisplay} | ${winner} wins!`);
        }
    }

    getCardDisplay(cardValue) {
        if (cardValue === 1) return "A";
        if (cardValue === 11) return "J";
        if (cardValue === 12) return "Q";
        if (cardValue === 13) return "K";
        return cardValue.toString();
    }
}

const loadPhaser = async () => {
    const config = {
        type: Phaser.AUTO,
        parent: document.querySelector(".container"),
        width: 800,
        height: 600,
        scene: [Screen],
        title: "War Game",
        version: "1.0",
    };
  
    const game = new Phaser.Game(config);
    return game
}

export { loadPhaser };