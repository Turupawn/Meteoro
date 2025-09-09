import { isLandscape } from '../../utils.js';
import { setLoadingScreenReady } from '../../main.js';
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
        this.uiReady = false;
    }

    preload() {
        this.setupProgressMonitoring();
        
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

        this.background = new Background(this);
        
        this.createLoadingText();
        this.createProgressBar();
        this.createLoadingDetails();
        
        this.uiReady = true;
        
        setLoadingScreenReady();
        
        this.startAdditionalMonitoring();
        
        this.startTimeoutMonitoring();
        
        this.updateProgress();
    }

    setupProgressMonitoring() {
        this.load.on('progress', (value) => {
            this.loadingProgress.phaser = value;
            this.updateProgress();
        });
        
        this.load.on('complete', () => {
            this.loadingProgress.phaser = 1;
            this.updateProgress();
        });
    }

    startAdditionalMonitoring() {
        this.monitorFontLoading();
        this.monitorWeb3Loading();        
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
        
        this.progressBarBg = this.add.rectangle(
            this.centerX,
            this.centerY,
            barWidth,
            barHeight,
            0x333333,
            0.8
        );
        this.progressBarBg.setStrokeStyle(2, 0x00FFFF);
        
        this.progressBar = this.add.rectangle(
            this.centerX - barWidth/2,
            this.centerY,
            0,
            barHeight,
            0x00FFFF,
            0.9
        );
        this.progressBar.setOrigin(0, 0.5);
        
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
                    window.fontsReady = true;
                    if (window.onFontsReady) {
                        window.onFontsReady();
                    }
                });
            } else {
                setTimeout(() => {
                    this.loadingProgress.font = 1;
                    this.updateProgress();
                    window.fontsReady = true;
                    if (window.onFontsReady) {
                        window.onFontsReady();
                    }
                }, 1000);
            }
        };
        
        checkFont();
        setTimeout(checkFont, 500);
    }

    monitorWeb3Loading() {
        window.updateWeb3Progress = (progress) => {
            this.loadingProgress.web3 = progress;
            this.updateProgress();
        };
    }

    monitorGameDataLoading() {
        window.updateGameDataProgress = (progress) => {
            this.loadingProgress.gameData = progress;
            this.updateProgress();
        };
    }

    updateProgress() {
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
        
        if (this.progressBarBg && this.progressBar) {
            const barWidth = this.progressBarBg.width;
            this.progressBar.width = barWidth * totalProgress;
        }
        
        if (this.progressText) {
            this.progressText.setText(`${progressPercent}%`);
        }
        
        if (this.loadingDetails) {
            const details = [];
            if (this.loadingProgress.phaser < 1) details.push("Loading game assets...");
            if (this.loadingProgress.web3 < 1) details.push("Connecting to blockchain...");
            if (this.loadingProgress.font < 1) details.push("Loading fonts...");
            if (this.loadingProgress.gameData < 1) details.push("Fetching game data...");
            
            this.loadingDetails.setText(details.join(" • "));
        }
        
        if (totalProgress >= 1 && !this.isComplete) {
            this.isComplete = true;
            this.completeLoading();
        }
    }

    completeLoading() {
        this.time.delayedCall(500, () => {
            this.scene.start('GameScene');
        });
    }
} 