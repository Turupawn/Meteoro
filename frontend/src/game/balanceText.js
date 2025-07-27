export class BalanceText {
    constructor(scene) {
        this.scene = scene;
        this.createBalanceText();
    }

    createBalanceText() {
        // Simple balance display
        this.balanceText = this.scene.add.text(750, 20, "Loading...", {
            font: "14px Arial",
            fill: "#000000"
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