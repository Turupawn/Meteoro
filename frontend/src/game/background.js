export class Background {
    constructor(scene) {
        this.scene = scene;
        this.distance = 300;
        this.speed = 6;
        this.stars = [];
        this.max = 400;
        this.x = [];
        this.y = [];
        this.z = [];
        this.create();
    }

    create() {
        // Dark space background
        this.backgroundRect = this.scene.add.rectangle(this.scene.centerX, this.scene.centerY, this.scene.screenWidth, this.scene.screenHeight, 0x000011);

        // Create stars
        this.createStars();

        // Simple logo
        //this.logo = this.scene.add.image(this.scene.centerX, this.scene.centerY * 0.33, "logo").setScale(0.5);

        // Simple title
        //this.title = this.scene.add.text(this.scene.centerX, this.scene.centerY * 0.67, "WAR GAME", {
        //    font: "24px Arial",
        //    fill: "#FFFF00"
        //}).setOrigin(0.5);

        // Start the star animation
        this.scene.time.addEvent({
            delay: 16, // ~60 FPS
            callback: this.updateStars,
            callbackScope: this,
            loop: true
        });
    }

    createStars() {
        for (let i = 0; i < this.max; i++) {
            // Create a simple white circle as a star
            const star = this.scene.add.circle(
                this.scene.centerX,
                this.scene.centerY,
                1,
                0xFFFFFF
            );
            star.setAlpha(0.8);
            this.stars.push(star);
            
            // Initialize star positions
            this.x[i] = Math.floor(Math.random() * this.scene.screenWidth) - this.scene.screenWidth / 2;
            this.y[i] = Math.floor(Math.random() * this.scene.screenHeight) - this.scene.screenHeight / 2;
            this.z[i] = Math.floor(Math.random() * 1700) - 100;
        }
    }

    updateStars() {
        for (let i = 0; i < this.max; i++) {
            const perspective = this.distance / (this.distance - this.z[i]);
            const x_coord = this.scene.centerX + this.x[i] * perspective;
            const y_coord = this.scene.centerY + this.y[i] * perspective;

            this.z[i] += this.speed;

            if (this.z[i] > 300) {
                this.z[i] -= 600;
            }

            this.stars[i].setPosition(x_coord, y_coord);
            
            // Scale star based on perspective (closer = bigger)
            const scale = Math.max(0.1, perspective * 0.5);
            this.stars[i].setScale(scale);
        }
    }
}