import { connectWallet, getLocalWallet } from '../../web3/blockchain_stuff.js';
import {
    hasUsableSessionKey,
    getActiveSessionKey,
    getSessionKeyTimeRemaining
} from '../../web3/sessionKeyManager.js';
import {
    needsMigration,
    performSilentMigration
} from '../../web3/legacyWalletMigration.js';

export function showConnectButton() {
    const container = document.createElement('div');
    container.id = 'connect-wallet-container';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.zIndex = '9999';
    container.style.backdropFilter = 'blur(5px)';

    const content = document.createElement('div');
    content.style.textAlign = 'center';
    content.style.padding = '40px';
    content.style.border = '2px solid #00f3ff';
    content.style.borderRadius = '15px';
    content.style.boxShadow = '0 0 20px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.1)';
    content.style.background = 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,30,0.95))';
    content.style.maxWidth = '400px';

    const title = document.createElement('h2');
    title.innerText = 'INITIALIZE LINK';
    title.style.color = '#00f3ff';
    title.style.fontFamily = '"Orbitron", sans-serif';
    title.style.fontSize = '24px';
    title.style.marginBottom = '10px';
    title.style.textShadow = '0 0 10px rgba(0, 243, 255, 0.8)';
    title.style.letterSpacing = '2px';

    const subtitle = document.createElement('p');
    subtitle.innerText = 'Secure connection required to access Meteoro terminal.';
    subtitle.style.color = '#aaaaaa';
    subtitle.style.fontFamily = '"Orbitron", sans-serif';
    subtitle.style.fontSize = '12px';
    subtitle.style.marginBottom = '20px';
    subtitle.style.lineHeight = '1.5';

    const sessionInfo = document.createElement('p');
    sessionInfo.innerText = 'Session keys enable popup-free gameplay';
    sessionInfo.style.color = '#00ff88';
    sessionInfo.style.fontFamily = '"Orbitron", sans-serif';
    sessionInfo.style.fontSize = '10px';
    sessionInfo.style.marginBottom = '30px';
    sessionInfo.style.lineHeight = '1.5';
    sessionInfo.style.opacity = '0.8';

    const btn = document.createElement('button');
    btn.innerText = 'CONNECT WALLET';
    btn.id = 'connect-wallet-btn';
    btn.style.padding = '15px 40px';
    btn.style.fontSize = '18px';
    btn.style.cursor = 'pointer';
    btn.style.backgroundColor = 'rgba(0, 243, 255, 0.1)';
    btn.style.color = '#00f3ff';
    btn.style.border = '1px solid #00f3ff';
    btn.style.borderRadius = '5px';
    btn.style.fontFamily = '"Orbitron", sans-serif';
    btn.style.transition = 'all 0.3s ease';
    btn.style.textTransform = 'uppercase';
    btn.style.letterSpacing = '1px';
    btn.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.2)';

    btn.onmouseover = () => {
        btn.style.backgroundColor = 'rgba(0, 243, 255, 0.3)';
        btn.style.boxShadow = '0 0 20px rgba(0, 243, 255, 0.6)';
    };
    btn.onmouseout = () => {
        btn.style.backgroundColor = 'rgba(0, 243, 255, 0.1)';
        btn.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.2)';
    };

    btn.onclick = async () => {
        try {
            btn.innerText = 'ESTABLISHING...';
            btn.style.opacity = '0.7';
            btn.style.cursor = 'wait';

            const wallet = await connectWallet();
            if (wallet) {
                const hasSession = hasUsableSessionKey(wallet.address);

                if (hasSession) {
                    btn.innerText = 'SESSION ACTIVE';
                    sessionInfo.innerText = 'Popup-free mode enabled!';
                    sessionInfo.style.color = '#00ff00';
                } else {
                    btn.innerText = 'LINK ESTABLISHED';
                    sessionInfo.innerText = 'Connected (session key mode)';
                    sessionInfo.style.color = '#ffaa00';
                }

                btn.style.borderColor = '#00ff00';
                btn.style.color = '#00ff00';
                btn.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';

                // Check for legacy wallet migration (runs silently in background)
                if (needsMigration()) {
                    console.log('[Migration] Legacy wallet detected, migrating in background...');
                    // Don't await - let it run in background
                    performSilentMigration(wallet.address);
                }

                // Proceed normally regardless of migration
                setTimeout(() => {
                    container.style.transition = 'opacity 0.5s ease';
                    container.style.opacity = '0';
                    setTimeout(() => {
                        container.remove();
                        createSessionKeyIndicator();
                    }, 500);
                    window.location.reload();
                }, 1500);
            }
        } catch (e) {
            btn.innerText = 'CONNECTION FAILED';
            btn.style.borderColor = '#ff0000';
            btn.style.color = '#ff0000';
            btn.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.5)';
            console.error(e);

            setTimeout(() => {
                btn.innerText = 'RETRY CONNECTION';
                btn.style.borderColor = '#00f3ff';
                btn.style.color = '#00f3ff';
                btn.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.2)';
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }, 2000);
        }
    };

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(sessionInfo);
    content.appendChild(btn);
    container.appendChild(content);
    document.body.appendChild(container);
}

export function createSessionKeyIndicator() {
    const existing = document.getElementById('session-key-indicator');
    if (existing) existing.remove();

    const wallet = getLocalWallet();
    const walletAddress = wallet?.address;
    
    const sessionKey = getActiveSessionKey(walletAddress);
    if (!sessionKey) return;

    const timeRemaining = getSessionKeyTimeRemaining(sessionKey);
    if (timeRemaining.expired) return;

    const indicator = document.createElement('div');
    indicator.id = 'session-key-indicator';
    indicator.style.position = 'fixed';
    indicator.style.bottom = '10px';
    indicator.style.right = '10px';
    indicator.style.padding = '8px 12px';
    indicator.style.backgroundColor = 'rgba(0, 255, 136, 0.15)';
    indicator.style.border = '1px solid #00ff88';
    indicator.style.borderRadius = '5px';
    indicator.style.color = '#00ff88';
    indicator.style.fontFamily = '"Orbitron", sans-serif';
    indicator.style.fontSize = '10px';
    indicator.style.zIndex = '1000';
    indicator.style.backdropFilter = 'blur(5px)';
    indicator.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.2)';

    const updateIndicator = () => {
        const currentWallet = getLocalWallet();
        const key = getActiveSessionKey(currentWallet?.address);
        if (!key) {
            indicator.remove();
            return;
        }
        const remaining = getSessionKeyTimeRemaining(key);
        if (remaining.expired) {
            indicator.innerHTML = '⚠️ Session Expired';
            indicator.style.borderColor = '#ff6600';
            indicator.style.color = '#ff6600';
            indicator.style.backgroundColor = 'rgba(255, 102, 0, 0.15)';
        } else {
            indicator.innerHTML = `Session: ${remaining.hours}h ${remaining.minutes % 60}m`;
        }
    };

    updateIndicator();
    setInterval(updateIndicator, 60000);

    document.body.appendChild(indicator);
}

