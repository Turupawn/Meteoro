import { isLandscape } from '../utils.js';

export class SocialLinks {
    constructor(scene) {
        this.scene = scene;
        this.createSocialLinks();
    }

    createSocialLinks() {
        const isLandscapeMode = isLandscape();
        const iconSize = isLandscapeMode ? 80 : 70;
        
        // Position relative to bottom of screen, below the play button
        const bottomMargin = isLandscapeMode ? 50 : 150;
        const rightMargin = isLandscapeMode ? 50 : 45;
        const spacing = isLandscapeMode ? 100 : 90;

        // GitHub icon (rightmost)
        this.githubIcon = this.scene.add.image(
            this.scene.screenWidth - rightMargin,
            this.scene.screenHeight - bottomMargin,
            'github-icon'
        ).setOrigin(1, 1).setInteractive();

        this.githubIcon.setDepth(50);
        this.githubIcon.setScale(iconSize / 250); // Original SVG size is 250px
        this.githubIcon.setAlpha(0.8);
        
        // Bigger hit area on portrait (mobile)
        const hitAreaWidth = isLandscapeMode ? 30 : 80;
        const hitAreaHeight = isLandscapeMode ? 20 : 80;
        this.githubIcon.setSize(
            this.githubIcon.width + hitAreaWidth,
            this.githubIcon.height + hitAreaHeight
        );
        
        this.githubIcon.on('pointerdown', () => {
            window.open('https://github.com/Turupawn/fast-casino', '_blank');
        });

        // Telegram icon (to the left of GitHub)
        this.telegramIcon = this.scene.add.image(
            this.scene.screenWidth - rightMargin - spacing,
            this.scene.screenHeight - bottomMargin,
            'telegram-icon'
        ).setOrigin(1, 1).setInteractive();

        this.telegramIcon.setDepth(50);
        this.telegramIcon.setScale(iconSize / 250); // Original SVG size is 250px
        this.telegramIcon.setAlpha(0.8);
        
        // Bigger hit area on portrait (mobile)
        this.telegramIcon.setSize(
            this.telegramIcon.width + hitAreaWidth,
            this.telegramIcon.height + hitAreaHeight
        );
        
        this.telegramIcon.on('pointerdown', () => {
            window.open('https://t.me/+ZYZ49Pt_EaczZTUx', '_blank');
        });
    }

    destroy() {
        if (this.githubIcon) {
            this.githubIcon.destroy();
        }
        if (this.telegramIcon) {
            this.telegramIcon.destroy();
        }
    }
}