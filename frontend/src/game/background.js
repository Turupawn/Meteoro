export class Background {
    constructor(scene) {
        this.scene = scene;
        this.distance = 300;
        this.speed = 2;
        this.stars = [];
        this.starTrails = [];
        this.max = 400;
        this.x = [];
        this.y = [];
        this.z = [];
        this.isBoostActive = false;
        this.boostSpeed = 8;
        this.normalSpeed = 2;
        this.create();
    }

    create() {
        this.createGradientBackground();
        this.createStars();
        this.scene.time.addEvent({
            delay: 16,
            callback: this.updateStars,
            callbackScope: this,
            loop: true
        });
    }

    createGradientBackground() {
        const gradientSteps = 50;
        const purpleColor = 0x4A148C;
        const blackColor = 0x000000;
        
        for (let i = 0; i < gradientSteps; i++) {
            const alpha = 0.4;
            const height = this.scene.screenHeight / gradientSteps;
            const y = (this.scene.screenHeight / gradientSteps) * i;
            
            const ratio = i / (gradientSteps - 1);
            const color = this.interpolateColor(purpleColor, blackColor, ratio);
            
            this.scene.add.rectangle(
                this.scene.centerX,
                y + height / 2,
                this.scene.screenWidth,
                height,
                color,
                alpha
            );
        }
    }

    interpolateColor(color1, color2, ratio) {
        const r1 = (color1 >> 16) & 255;
        const g1 = (color1 >> 8) & 255;
        const b1 = color1 & 255;
        
        const r2 = (color2 >> 16) & 255;
        const g2 = (color2 >> 8) & 255;
        const b2 = color2 & 255;
        
        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);
        
        return (r << 16) | (g << 8) | b;
    }

    createStars() {
        for (let i = 0; i < this.max; i++) {
            const star = this.scene.add.circle(
                this.scene.centerX,
                this.scene.centerY,
                2,
                0xFFFFFF
            );
            star.setAlpha(0.8);
            this.stars.push(star);
            
            const trail = this.scene.add.rectangle(
                this.scene.centerX,
                this.scene.centerY,
                1,
                20,
                0xFFFFFF
            );
            trail.setAlpha(0);
            this.starTrails.push(trail);
            
            this.x[i] = Math.floor(Math.random() * this.scene.screenWidth) - this.scene.screenWidth / 2;
            this.y[i] = Math.floor(Math.random() * this.scene.screenHeight) - this.scene.screenHeight / 2;
            this.z[i] = Math.floor(Math.random() * 1700) - 100;
        }
    }

    startBoostAnimation() {
        this.isBoostActive = true;
        this.speed = this.boostSpeed;
    }

    endBoostAnimation() {
        this.isBoostActive = false;
        this.speed = this.normalSpeed;
        this.starTrails.forEach(trail => {
            trail.setAlpha(0);
        });
    }

    updateStars() {
        let shakeX = 0;
        let shakeY = 0;
        
        if (this.isBoostActive) {
            shakeX = (Math.random() - 0.5) * 20;
            shakeY = (Math.random() - 0.5) * 20;
        }

        for (let i = 0; i < this.max; i++) {
            const perspective = this.distance / (this.distance - this.z[i]);
            const x_coord = this.scene.centerX + this.x[i] * perspective + shakeX;
            const y_coord = this.scene.centerY + this.y[i] * perspective + shakeY;

            this.z[i] += this.speed;

            if (this.z[i] > 300) {
                this.z[i] -= 600;
            }

            this.stars[i].setPosition(x_coord, y_coord);
            
            const scale = Math.max(0.1, perspective * 0.6);
            this.stars[i].setScale(scale);

            if (this.isBoostActive) {
                const trail = this.starTrails[i];
                const trailLength = 30 * scale;
                const trailWidth = 2 * scale;
                
                const trailX = x_coord - (this.x[i] * perspective * 0.3);
                const trailY = y_coord - (this.y[i] * perspective * 0.3);
                
                trail.setPosition(trailX, trailY);
                trail.setSize(trailWidth, trailLength);
                trail.setAlpha(0.4 * scale);
                
                const angle = Math.atan2(this.y[i], this.x[i]) * 180 / Math.PI;
                trail.setRotation(angle * Math.PI / 180);
            } else {
                this.starTrails[i].setAlpha(0);
            }
        }
    }
}