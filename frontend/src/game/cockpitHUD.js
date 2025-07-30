export class CockpitHUD {
    constructor(scene) {
        this.scene = scene;
        this.screenWidth = scene.screenWidth;
        this.screenHeight = scene.screenHeight;
        
        // Better mobile detection - check both width and height
        this.isMobile = this.screenWidth < 768 || this.screenHeight < 768;
        this.isPortrait = this.screenHeight > this.screenWidth;
        
        // Additional mobile detection using user agent
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        
        // Use both screen size and user agent for better detection
        this.isMobile = this.isMobile || isMobileDevice;
        
        console.log('Screen dimensions:', this.screenWidth, this.screenHeight);
        console.log('Is mobile (screen):', this.screenWidth < 768 || this.screenHeight < 768);
        console.log('Is mobile (user agent):', isMobileDevice);
        console.log('Final is mobile:', this.isMobile);
        console.log('Is portrait:', this.isPortrait);
        
        this.createCockpit();
    }

    createCockpit() {
        // Determine which image to use
        let imageKey;
        if (this.isMobile) {
            imageKey = 'cockpit-mobile';
            console.log('Using mobile cockpit image');
        } else {
            imageKey = 'cockpit-desktop';
            console.log('Using desktop cockpit image');
        }

        // Create cockpit at bottom of screen
        this.cockpitX = this.screenWidth / 2;
        this.cockpitY = this.screenHeight - 50; // 50px from bottom
        
        this.createCockpitImage(imageKey);
    }

    createCockpitImage(imageKey) {
        try {
            // Create the cockpit image
            this.cockpit = this.scene.add.image(this.cockpitX, this.cockpitY, imageKey);
            
            // No scaling - show image as-is
            this.cockpit.setScale(1, 1);
            
            // Position at bottom center
            this.cockpit.setPosition(this.cockpitX, this.cockpitY);
            
            // Set depth to be above background but below UI elements
            this.cockpit.setDepth(50);
            
            console.log('Cockpit created successfully:', {
                imageKey,
                originalSize: `${this.cockpit.width}x${this.cockpit.height}`,
                scale: '1:1 (no adjustments)',
                position: `${this.cockpitX}, ${this.cockpitY}`,
                isMobile: this.isMobile
            });
            
        } catch (error) {
            console.warn(`Cockpit image ${imageKey} not found, using fallback rectangle`);
            console.warn('Error details:', error);
            this.createCockpitFallback();
        }
    }

    createCockpitFallback() {
        // Create a simple rectangle as fallback
        this.cockpit = this.scene.add.rectangle(
            this.cockpitX, 
            this.cockpitY, 
            this.screenWidth * 0.9, 
            100, 
            0x333333, 
            0.7
        );
        this.cockpit.setDepth(50);
        console.log('Using fallback rectangle for cockpit');
    }
}