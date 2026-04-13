/**
 * AnimationEngine: Handles animation logic for data artefacts
 * 
 * Creates animations for A-Frame entities including:
 * - Entrance/exit animations
 * - Highlight and focus animations
 * - Staggered appearance effects
 */

export class Animator {
  constructor(options = {}) {
    this.defaultDuration = options.duration || 1000;
    this.easing = options.easing || 'easeInOutQuad';
  }

  /**
   * Determine animation for a data packet
   */
  determineAnimation(packet) {
    // Simple heuristic: animate appearance
    const baseDuration = 500;
    const stagger = Math.random() * 200;
    
    return {
      property: 'scale',
      from: '0 0 0',
      to: '1 1 1',
      dur: baseDuration + stagger,
      easing: this.easing
    };
  }

  /**
   * Format animation for A-Frame
   */
  formatAnimation(animation) {
    return `${animation.property}: ${animation.from}; ${animation.property}: ${animation.to}; dur: ${animation.dur}; easing: ${animation.easing}`;
  }

  /**
   * Create entrance animation
   */
  entranceAnimation(duration = 1000) {
    return {
      property: 'scale',
      from: '0 0 0',
      to: '1 1 1',
      dur: duration,
      easing: 'easeOutElastic'
    };
  }

  /**
   * Create exit animation
   */
  exitAnimation(duration = 500) {
    return {
      property: 'scale',
      from: '1 1 1',
      to: '0 0 0',
      dur: duration,
      easing: 'easeInQuad'
    };
  }

  /**
   * Create highlight animation
   */
  highlightAnimation(duration = 300) {
    return {
      property: 'scale',
      from: '1 1 1',
      to: '1.2 1.2 1.2',
      dur: duration,
      easing: 'easeInOutQuad',
      dir: 'alternate'
    };
  }

  /**
   * Create focus animation
   */
  focusAnimation(targetPosition, duration = 500) {
    return {
      property: 'position',
      to: targetPosition,
      dur: duration,
      easing: 'easeInOutQuad'
    };
  }
}

export default Animator;
