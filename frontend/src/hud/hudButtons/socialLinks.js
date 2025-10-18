import { isLandscape } from '../../utils/utils.js';

export class SocialLinks {
    constructor(scene) {
        this.scene = scene;
        this.createSocialLinks();
    }

    createSocialLinks() {
        const isLandscapeMode = isLandscape();
        const iconSize = isLandscapeMode ? 80 : 70;
        
        // Position relative to bottom of screen in landscape, top left in portrait
        let bottomMargin, leftMargin, spacing;
        if (isLandscapeMode) {
            bottomMargin = 50;
            leftMargin = 50;
            spacing = 100;
        } else {
            // In portrait mode, position at top right
            bottomMargin = this.scene.screenHeight - 50; // Top of screen
            leftMargin = this.scene.screenWidth - 200; // Right side
            spacing = 90;
        }

        // GitHub icon (leftmost)
        const githubY = isLandscapeMode ? this.scene.screenHeight - bottomMargin : 100;
        this.githubIcon = this.scene.add.image(
            leftMargin,
            githubY,
            'github-icon'
        ).setOrigin(0, 1).setInteractive();

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

        // Telegram icon (to the right of GitHub)
        const telegramY = isLandscapeMode ? this.scene.screenHeight - bottomMargin : 100;
        this.telegramIcon = this.scene.add.image(
            leftMargin + spacing,
            telegramY,
            'telegram-icon'
        ).setOrigin(0, 1).setInteractive();

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