import { isLandscape } from '../utils.js';
import { setLoadingScreenReady } from '../main.js';
import { Background } from './background.js';

export class LoadingScreen extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScreen' });
        this.loadingProgress = {
            phaser: 0,
            web3: 0,
            font: 0,
            gameData: 0
        };
        this.isComplete = false;
        this.loadingStartTime = Date.now();
        this.maxLoadingTime = 30000; // 30 seconds timeout
        this.uiReady = false; // Track if UI elements are ready
    }

    preload() {
        // Set up progress monitoring BEFORE loading assets
        this.setupProgressMonitoring();
        
        // Load minimal assets needed for loading screen
        this.load.image("clover", "/cards/clover.png");
        this.load.image("diamond", "/cards/diamond.png");
        this.load.image("heart", "/cards/heart.png");
        this.load.image("spade", "/cards/spade.png");
        this.load.image("github-icon", "/social_links/github.svg");
        this.load.image("telegram-icon", "/social_links/telegram.svg");
        this.load.plugin('rexquadimageplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexquadimageplugin.min.js', true);
    }

    create() {
        this.screenWidth = this.cameras.main.width;
        this.screenHeight = this.cameras.main.height;
        this.centerX = this.screenWidth / 2;
        this.centerY = this.screenHeight / 2;

        // Use the same background as the main game
        this.background = new Background(this);
        
        this.createLoadingText();
        this.createProgressBar();
        this.createLoadingDetails();
        
        // Mark UI as ready
        this.uiReady = true;
        
        // Notify that loading screen is ready
        setLoadingScreenReady();
        
        // Start additional monitoring (font, web3, game data)
        this.startAdditionalMonitoring();
        
        // Start timeout monitoring
        this.startTimeoutMonitoring();
        
        // Update progress once UI is ready
        this.updateProgress();
    }

    setupProgressMonitoring() {
        this.load.on('progress', (value) => {
            this.loadingProgress.phaser = value;
            this.updateProgress();
        });
        
        // Also monitor when loading is complete
        this.load.on('complete', () => {
            this.loadingProgress.phaser = 1;
            this.updateProgress();
        });
    }

    startAdditionalMonitoring() {
        // Monitor font loading
        this.monitorFontLoading();
        
        // Monitor Web3 initialization
        this.monitorWeb3Loading();
        
        // Monitor game data loading
        this.monitorGameDataLoading();
    }

    createLoadingText() {
        const isLandscapeMode = isLandscape();
        const titleFontSize = isLandscapeMode ? 48 : 56;
        
        this.loadingTitle = this.add.text(this.centerX, this.centerY - 150, "LOADING GAME", {
            font: `bold ${titleFontSize}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 3,
            alpha: 0.95,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#003366',
                blur: 6,
                fill: true
            }
        }).setOrigin(0.5);
    }

    createProgressBar() {
        const isLandscapeMode = isLandscape();
        const barWidth = isLandscapeMode ? 600 : 500;
        const barHeight = 20;
        
        // Background bar
        this.progressBarBg = this.add.rectangle(
            this.centerX,
            this.centerY,
            barWidth,
            barHeight,
            0x333333,
            0.8
        );
        this.progressBarBg.setStrokeStyle(2, 0x00FFFF);
        
        // Progress bar
        this.progressBar = this.add.rectangle(
            this.centerX - barWidth/2,
            this.centerY,
            0,
            barHeight,
            0x00FFFF,
            0.9
        );
        this.progressBar.setOrigin(0, 0.5);
        
        // Progress text
        this.progressText = this.add.text(this.centerX, this.centerY + 40, "0%", {
            font: 'bold 24px Orbitron',
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 2
        }).setOrigin(0.5);
    }

    createLoadingDetails() {
        const isLandscapeMode = isLandscape();
        const detailFontSize = isLandscapeMode ? 18 : 20;
        
        this.loadingDetails = this.add.text(this.centerX, this.centerY + 100, "", {
            font: `${detailFontSize}px Orbitron`,
            fill: '#E0F6FF',
            stroke: '#0066CC',
            strokeThickness: 1,
            alpha: 0.8
        }).setOrigin(0.5);
    }

    startTimeoutMonitoring() {
        // Check for timeout every second
        this.time.addEvent({
            delay: 1000,
            callback: this.checkTimeout,
            callbackScope: this,
            loop: true
        });
    }

    checkTimeout() {
        const elapsed = Date.now() - this.loadingStartTime;
        if (elapsed > this.maxLoadingTime && !this.isComplete) {
            console.warn("Loading timeout reached, forcing completion");
            this.forceComplete();
        }
    }

    forceComplete() {
        this.loadingProgress.web3 = 1;
        this.loadingProgress.gameData = 1;
        this.loadingProgress.font = 1;
        this.loadingProgress.phaser = 1;
        this.updateProgress();
    }

    monitorFontLoading() {
        const checkFont = () => {
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => {
                    this.loadingProgress.font = 1;
                    this.updateProgress();
                    // Notify that fonts are ready globally
                    window.fontsReady = true;
                    if (window.onFontsReady) {
                        window.onFontsReady();
                    }
                });
            } else {
                // Fallback for browsers without Font Loading API
                setTimeout(() => {
                    this.loadingProgress.font = 1;
                    this.updateProgress();
                    // Notify that fonts are ready globally
                    window.fontsReady = true;
                    if (window.onFontsReady) {
                        window.onFontsReady();
                    }
                }, 1000);
            }
        };
        
        // Check immediately and after a short delay
        checkFont();
        setTimeout(checkFont, 500);
    }

    monitorWeb3Loading() {
        // This will be updated by main.js when Web3 is ready
        window.updateWeb3Progress = (progress) => {
            this.loadingProgress.web3 = progress;
            this.updateProgress();
        };
    }

    monitorGameDataLoading() {
        // This will be updated by main.js when game data is ready
        window.updateGameDataProgress = (progress) => {
            this.loadingProgress.gameData = progress;
            this.updateProgress();
        };
    }

    updateProgress() {
        // Don't update UI if it's not ready yet
        if (!this.uiReady) {
            return;
        }

        const totalProgress = (
            this.loadingProgress.phaser * 0.4 +
            this.loadingProgress.web3 * 0.3 +
            this.loadingProgress.font * 0.1 +
            this.loadingProgress.gameData * 0.2
        );
        
        const progressPercent = Math.round(totalProgress * 100);
        
        // Update progress bar (with null checks)
        if (this.progressBarBg && this.progressBar) {
            const barWidth = this.progressBarBg.width;
            this.progressBar.width = barWidth * totalProgress;
        }
        
        // Update progress text (with null check)
        if (this.progressText) {
            this.progressText.setText(`${progressPercent}%`);
        }
        
        // Update loading details (with null check)
        if (this.loadingDetails) {
            const details = [];
            if (this.loadingProgress.phaser < 1) details.push("Loading game assets...");
            if (this.loadingProgress.web3 < 1) details.push("Connecting to blockchain...");
            if (this.loadingProgress.font < 1) details.push("Loading fonts...");
            if (this.loadingProgress.gameData < 1) details.push("Fetching game data...");
            
            this.loadingDetails.setText(details.join(" • "));
        }
        
        // Check if everything is loaded
        if (totalProgress >= 1 && !this.isComplete) {
            this.isComplete = true;
            this.completeLoading();
        }
    }

    completeLoading() {
        // Add a small delay for smooth transition
        this.time.delayedCall(500, () => {
            // Transition to main game scene
            this.scene.start('GameScene');
        });
    }
} 