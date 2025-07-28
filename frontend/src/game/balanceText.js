export class BalanceText {
    constructor(scene) {
        this.scene = scene;
        this.createBalanceText();
    }

    createBalanceText() {
        // Responsive balance display - positioned in top right
        const x = this.scene.screenWidth - 20;
        const y = 20;
        const fontSize = Math.max(12, this.scene.screenWidth / 60); // Responsive font size
        
        this.balanceText = this.scene.add.text(x, y, "Loading...", {
            font: `${fontSize}px Arial`,
            fill: "#FF0000"
        }).setOrigin(1, 0);
    }

    updateBalance(balance = null) {
        // Update balance using passed parameter
        if (balance !== null) {
            try {
                if (window.web3 && window.web3.utils) {
                    const balanceInEth = window.web3.utils.fromWei(balance, 'ether');
                    this.balanceText.setText(`Balance: ${parseFloat(balanceInEth).toFixed(6)} ETH`);
                } else {
                    this.balanceText.setText(`Balance: ${balance} wei`);
                }
            } catch (error) {
                this.balanceText.setText(`Balance: ${balance} wei`);
            }
        } else {
            this.balanceText.setText("Balance: 0 ETH");
        }
    }
}