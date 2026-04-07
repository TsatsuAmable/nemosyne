/**
 * Real-time Alert System
 * Threshold monitoring and visual/audio notifications
 */

export class AlertSystem {
  constructor(scene) {
    this.scene = scene;
    this.rules = new Map();
    this.activeAlerts = new Set();
    this.audioContext = null;
  }

  /**
   * Add alert rule
   * @param {string} ruleId - Unique identifier
   * @param {Object} config - Rule configuration
   */
  addRule(ruleId, config) {
    this.rules.set(ruleId, {
      field: config.field,
      operator: config.operator || '>', // >, <, >=, <=, ==, !=
      threshold: config.threshold,
      duration: config.duration || 0, // Minimum duration (ms) before triggering
      severity: config.severity || 'warning', // info, warning, critical
      visuals: config.visuals || { glow: true, color: '#ff3864', pulse: true },
      audio: config.audio !== false,
      message: config.message || `Alert: ${config.field} ${config.operator} ${config.threshold}`,
      onTrigger: config.onTrigger,
      onClear: config.onClear
    });
  }

  /**
   * Check data point against all rules
   * @param {string} artefactId - Artefact to check
   * @param {Object} data - Current data values
   */
  check(artefactId, data) {
    this.rules.forEach((rule, ruleId) => {
      const value = data[rule.field];
      if (value === undefined) return;
      
      const triggered = this.evaluateCondition(value, rule.operator, rule.threshold);
      const alertKey = `${artefactId}:${ruleId}`;
      
      if (triggered && !this.activeAlerts.has(alertKey)) {
        this.triggerAlert(artefactId, rule, data);
        this.activeAlerts.add(alertKey);
      } else if (!triggered && this.activeAlerts.has(alertKey)) {
        this.clearAlert(artefactId, rule);
        this.activeAlerts.delete(alertKey);
      }
    });
  }

  evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value == threshold;
      case '!=': return value != threshold;
      default: return false;
    }
  }

  triggerAlert(artefactId, rule, data) {
    const el = document.querySelector(`[data-artefact-id="${artefactId}"]`);
    if (!el) return;
    
    // Visual feedback
    if (rule.visuals.glow) {
      el.setAttribute('animation__alert', {
        property: 'material.emissiveIntensity',
        to: 2,
        dur: 200,
        easing: 'easeInOut'
      });
    }
    
    if (rule.visuals.pulse) {
      el.setAttribute('animation__pulse', {
        property: 'scale',
        dir: 'alternate',
        to: '1.2 1.2 1.2',
        dur: 500,
        loop: true
      });
    }
    
    // Audio alert
    if (rule.audio && rule.severity === 'critical') {
      this.playAlertSound('critical');
    }
    
    // Emit event
    el.emit('alert-triggered', { rule, data });
    
    if (rule.onTrigger) {
      rule.onTrigger(artefactId, rule, data);
    }
  }

  clearAlert(artefactId, rule) {
    const el = document.querySelector(`[data-artefact-id="${artefactId}"]`);
    if (!el) return;
    
    // Remove animations
    el.removeAttribute('animation__alert');
    el.removeAttribute('animation__pulse');
    
    // Emit event
    el.emit('alert-cleared', { rule });
    
    if (rule.onClear) {
      rule.onClear(artefactId, rule);
    }
  }

  playAlertSound(severity) {
    // Web Audio API
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    if (severity === 'critical') {
      oscillator.frequency.value = 880; // A5
      oscillator.type = 'square';
    } else {
      oscillator.frequency.value = 440; // A4
      oscillator.type = 'sine';
    }
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.5);
  }

  removeRule(ruleId) {
    this.rules.delete(ruleId);
  }

  clear() {
    this.activeAlerts.clear();
    this.rules.clear();
  }
}
