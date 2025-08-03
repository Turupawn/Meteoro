import { isLandscape } from '../../utils.js';

export class MenuInput {
    constructor(scene, x, y, placeholder, fontSize, options = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.placeholder = placeholder;
        this.fontSize = fontSize;
        this.options = {
            readOnly: false,
            value: '',
            width: null,
            ...options
        };
        
        this.createInput();
    }

    createInput() {
        const isLandscapeMode = isLandscape();
        
        // Calculate input width based on screen size
        const screenWidth = this.scene.screenWidth;
        const inputWidth = this.options.width || (isLandscapeMode 
            ? Math.min(600, screenWidth * 0.8)
            : Math.min(500, screenWidth * 0.9));
        
        // Create the input element
        this.inputElement = document.createElement('input');
        this.inputElement.type = 'text';
        this.inputElement.placeholder = this.placeholder;
        this.inputElement.value = this.options.value;
        this.inputElement.readOnly = this.options.readOnly;
        
        // Position the input
        this.inputElement.style.position = 'absolute';
        this.inputElement.style.left = `${this.x - inputWidth/2}px`;
        this.inputElement.style.top = `${this.y - 25}px`;
        this.inputElement.style.width = `${inputWidth}px`;
        this.inputElement.style.fontSize = `${this.fontSize}px`;
        this.inputElement.style.padding = isLandscapeMode ? '16px' : '14px';
        this.inputElement.style.textAlign = 'center';
        this.inputElement.style.border = '3px solid #00FFFF';
        this.inputElement.style.borderRadius = '8px';
        this.inputElement.style.backgroundColor = '#000000';
        this.inputElement.style.color = '#00FF00';
        this.inputElement.style.fontFamily = 'monospace';
        this.inputElement.style.letterSpacing = '1px';
        
        // Make text selectable and easier to copy-paste
        this.inputElement.style.userSelect = 'text';
        this.inputElement.style.webkitUserSelect = 'text';
        this.inputElement.style.cursor = 'text';
        
        // Add focus styles for better UX
        this.inputElement.addEventListener('focus', () => {
            this.inputElement.style.border = '3px solid #00FFFF';
            this.inputElement.style.boxShadow = '0 0 10px #00FFFF';
        });
        
        this.inputElement.addEventListener('blur', () => {
            this.inputElement.style.border = '3px solid #00FFFF';
            this.inputElement.style.boxShadow = 'none';
        });
        
        // Add to document
        document.body.appendChild(this.inputElement);
    }

    getValue() {
        return this.inputElement.value;
    }

    setValue(value) {
        this.inputElement.value = value;
    }

    destroy() {
        if (this.inputElement && this.inputElement.parentNode) {
            this.inputElement.parentNode.removeChild(this.inputElement);
        }
    }
} 