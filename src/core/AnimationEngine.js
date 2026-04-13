/**
 * @typedef {import('../types/index.ts').AnimationConfig} AnimationConfig
 * @typedef {import('../types/index.ts').AnimatorOptions} AnimatorOptions
 * @typedef {import('../types/index.ts').EasingFunction} EasingFunction
 * @typedef {import('../types/index.ts').Vector3} Vector3
 * @typedef {import('../types/index.ts').NemosynePacketData} NemosynePacketData
 */

/**
 * AnimationEngine: Handles animation logic for data artefacts
 *
 * Creates animations for A-Frame entities including:
 * - Entrance/exit animations
 * - Highlight and focus animations
 * - Staggered appearance effects
 */
export class Animator {
  /**
   * @param {AnimatorOptions} [options={}]
   */
  constructor(options = {}) {
    this.defaultDuration = options.duration || 1000;
    this.easing = options.easing || 'easeInOutQuad';
  }

  /**
   * Determine animation for a data packet
   * @param {NemosynePacketData} _packet
   * @returns {AnimationConfig}
   */
  determineAnimation(_packet) {
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
   * @param {AnimationConfig} animation
   * @returns {string}
   */
  formatAnimation(animation) {
    return `${animation.property}: ${animation.from}; ${animation.property}: ${animation.to}; dur: ${animation.dur}; easing: ${animation.easing}`;
  }

  /**
   * Create entrance animation
   * @param {number} [duration=1000]
   * @returns {AnimationConfig}
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
   * @param {number} [duration=500]
   * @returns {AnimationConfig}
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
   * @param {number} [duration=300]
   * @returns {AnimationConfig}
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
   * @param {Vector3} targetPosition
   * @param {number} [duration=500]
   * @returns {AnimationConfig}
   */
  focusAnimation(targetPosition, duration = 500) {
    return {
      property: 'position',
      from: `${targetPosition.x} ${targetPosition.y} ${targetPosition.z}`,
      to: `${targetPosition.x} ${targetPosition.y} ${targetPosition.z}`,
      dur: duration,
      easing: 'easeInOutQuad'
    };
  }
}

export default Animator;
