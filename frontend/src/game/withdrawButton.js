export class WithdrawButton {
    constructor(scene) {
        this.scene = scene;
        this.createButton();
    }

    createButton() {
        // Simple withdraw button - just text
        this.button = this.scene.add.text(750, 80, "WITHDRAW", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(1, 0).setInteractive();

        // Simple click handler
        this.button.on('pointerdown', () => {
            // Get balance from the scene's current balance
            const currentBalance = this.scene.currentBalance || null;
            this.showWithdrawModal(currentBalance);
        });
    }

    showWithdrawModal(balance = null) {
        // Simple modal - just text
        const modalBg = this.scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.5);
        const modal = this.scene.add.rectangle(400, 300, 400, 300, 0xffffff);

        let currentBalance = "0 ETH";
        if (balance !== null) {
            try {
                if (window.web3 && window.web3.utils) {
                    const balanceInEth = window.web3.utils.fromWei(balance, 'ether');
                    currentBalance = `${parseFloat(balanceInEth).toFixed(6)} ETH`;
                } else {
                    currentBalance = `${balance} wei`;
                }
            } catch (error) {
                currentBalance = `${balance} wei`;
            }
        }

        const balanceText = this.scene.add.text(400, 250, `Balance: ${currentBalance}`, {
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

        const withdrawButton = this.scene.add.text(400, 350, "WITHDRAW", {
            font: "14px Arial",
            fill: "#000000"
        }).setOrigin(0.5).setInteractive();

        const closeButton = this.scene.add.text(400, 400, "CLOSE", {
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
}