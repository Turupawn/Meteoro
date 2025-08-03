import { isLandscape } from '../utils.js';

export class SocialLinks {
    constructor(scene) {
        this.scene = scene;
        this.createSocialLinks();
    }

    createSocialLinks() {
        const isLandscapeMode = isLandscape();
        const iconSize = isLandscapeMode ? 80 : 70;
        const bottomMargin = isLandscapeMode ? 120 : 200; // Increased significantly
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
        this.githubIcon.setSize(
            this.githubIcon.width + 30,
            this.githubIcon.height + 20
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
        this.telegramIcon.setSize(
            this.telegramIcon.width + 30,
            this.telegramIcon.height + 20
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