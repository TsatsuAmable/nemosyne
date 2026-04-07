/**
 * Nemosyne Scene Component
 * Manages global scene settings and shared resources
 */

export const NemosyneScene = {
  schema: {
    theme: { type: 'string', default: 'void' }, // void, light, color
    fog: { type: 'boolean', default: true },
    fogDensity: { type: 'number', default: 0.02 },
    grid: { type: 'boolean', default: false },
    shadows: { type: 'boolean', default: true }
  },

  init: function() {
    this.applyTheme();
    this.setupLighting();
    this.setupEnvironment();
  },

  applyTheme: function() {
    const theme = this.data.theme;
    
    switch (theme) {
      case 'void':
        this.el.setAttribute('background', { color: '#000205' });
        this.el.setAttribute('fog', { 
          type: 'exponential', 
          color: '#000510', 
          density: this.data.fogDensity 
        });
        break;
        
      case 'light':
        this.el.setAttribute('background', { color: '#f5f5f7' });
        this.el.setAttribute('fog', { 
          type: 'linear', 
          color: '#ffffff', 
          near: 10, 
          far: 50 
        });
        break;
        
      case 'color':
        this.el.setAttribute('background', { color: '#0a0a1a' });
        break;
    }
    
    // Set renderer color management
    this.el.setAttribute('renderer', {
      colorManagement: true,
      physicallyCorrectLights: true
    });
  },

  setupLighting: function() {
    // Ambient light
    if (!this.el.querySelector('a-light[type="ambient"]')) {
      const ambient = document.createElement('a-light');
      ambient.setAttribute('type', 'ambient');
      ambient.setAttribute('color', theme === 'void' ? '#001122' : '#ffffff');
      ambient.setAttribute('intensity', theme === 'void' ? '0.3' : '0.6');
      this.el.appendChild(ambient);
    }
    
    // Main point light
    if (!this.el.querySelector('a-light[main-light]')) {
      const main = document.createElement('a-light');
      main.setAttribute('type', 'point');
      main.setAttribute('position', '2 4 4');
      main.setAttribute('intensity', '1.5');
      main.setAttribute('color', '#ffffff');
      main.setAttribute('cast-shadow', this.data.shadows);
      main.setAttribute('main-light', '');
      this.el.appendChild(main);
    }
  },

  setupEnvironment: function() {
    // Optional: Add subtle grid for spatial reference
    if (this.data.grid) {
      const grid = document.createElement('a-grid');
      grid.setAttribute('id', 'ground');
      grid.setAttribute('static-body', '');
      this.el.appendChild(grid);
    }
  }
};
