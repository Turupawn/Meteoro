// Fragment shader for cosmic effects
const fragmentShader = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;

    // Waves (adjust frequencies and amplitude)
    float waveX = sin(uv.y * 12.0 + uTime * 2.0) * 0.05;
    float waveY = cos(uv.x * 10.0 + uTime * 1.5) * 0.05;

    uv += vec2(waveX, waveY);

    vec4 color = texture2D(uMainSampler, uv);

    // Cosmic color pulse
    float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
    color.rgb *= vec3(1.0, 0.6 + 0.4 * pulse, 0.9);

    gl_FragColor = color;
}`;

class CosmicPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
        super({
            game,
            fragShader: fragmentShader,
        });
    }
    
    onPreRender() {
        this.set1f("uTime", this.game.loop.time / 1000);
    }
}

export class CosmicScene extends Phaser.Scene {
    constructor() {
        super("CosmicScene");
    }

    preload() {
        this.load.image("zael", "/zael/zael.PNG");
        this.load.image("waves", "/zael/waves.PNG");
        this.load.image("cosmicCloud", "/zael/cosmicCloud.PNG");
        this.load.image("star", "/zael/star.png");
        this.load.image("ring", "/zael/eyeRing.PNG");
        this.load.image("ray", "/zael/godray.PNG");
    }

    create() {
        const { width, height } = this.scale;
        
        // Make the scene background transparent so the main scene shows through
        //this.cameras.main.setBackgroundColor(0x000000);
        //this.cameras.main.setTransparent(true);
        
        // Shader pipeline
        const cosmicPipeline = new CosmicPipeline(this.game);
        this.game.renderer.pipelines.add("Cosmic", cosmicPipeline);

        // Images and sprites
        const waves = this.add.image(width / 2, height / 2, "waves").setOrigin(0.5);
        const cosmicCloud = this.add.image(width / 2, height / 2, "cosmicCloud").setOrigin(0.5);
        const ray = this.add.image(width / 2, height / 2, "ray").setOrigin(0.5);
        const ring = this.add.sprite(width / 2, height / 2, "ring").setOrigin(0.5);
        const ring2 = this.add.sprite(width / 2, height / 2, "ring").setOrigin(0.5);
        const ring3 = this.add.sprite(width / 2, height / 2, "ring").setOrigin(0.5);
        const ring4 = this.add.sprite(width / 2, height / 2, "ring").setOrigin(0.5);
        const zael = this.add.sprite(width / 2, height / 2, "zael").setOrigin(0.5);

        // Scale to fit screen while keeping aspect ratio
        const scale = Math.min(width / zael.width, height / zael.height);
        waves.setScale(scale);
        cosmicCloud.setScale(scale);
        ray.setScale(scale);
        ring.setScale(scale * 0.3);
        ring2.setScale(scale * 0.7);
        ring3.setScale(scale * 1.1);
        ring4.setScale(scale * 1.5);
        zael.setScale(scale);

        // Animations
        this.tweens.add({
            targets: ring,
            rotation: Math.PI * 2,
            duration: 10000,
            repeat: -1,
        });
        
        this.tweens.add({
            targets: ring2,
            rotation: -Math.PI * 2,
            duration: 20000,
            repeat: -1,
        });
        
        this.tweens.add({
            targets: ring3,
            rotation: Math.PI * 2,
            duration: 40000,
            repeat: -1,
        });

        this.tweens.add({
            targets: ring4,
            rotation: -Math.PI * 2,
            duration: 50000,
            repeat: -1,
        });
        
        this.tweens.add({
            targets: ray,
            scale: 0.3,
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Apply shader pipeline
        waves.setPipeline("Cosmic");
        cosmicCloud.setPipeline("Cosmic");
        ring.setPipeline("Cosmic");
        ring2.setPipeline("Cosmic");
        ring3.setPipeline("Cosmic");
        ring4.setPipeline("Cosmic");

        // Add close button
        const closeButton = this.add.text(width - 50, 50, 'X', {
            fontSize: '32px',
            fill: '#ffffff',
            backgroundColor: '#ff0000',
            padding: { x: 10, y: 5 }
        })
        .setInteractive()
        .on('pointerdown', () => {
            this.scene.stop();
        });

        // Add performance info
        const performanceText = this.add.text(10, 10, '', {
            fontSize: '16px',
            fill: '#ffffff'
        });

        // Update performance info every second
        this.time.addEvent({
            delay: 1000,
            callback: () => {
                const fps = this.game.loop.actualFps;
                const memory = performance.memory ? 
                    `Memory: ${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB` : 
                    'Memory: N/A';
                performanceText.setText(`FPS: ${Math.round(fps)}\n${memory}`);
            },
            loop: true
        });
    }
}
