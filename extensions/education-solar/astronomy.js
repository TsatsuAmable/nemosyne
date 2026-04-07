/**
 * Educational Visualization Extension
 * Solar system, historical timelines, molecular kits
 */

/**
 * Astronomical Calculator for Solar System
 * Calculates positions based on orbital mechanics
 */
export class AstronomicalCalculator {
  constructor() {
    // Orbital parameters (simplified)
    this.planets = {
      'Mercury': { a: 0.387, e: 0.206, period: 0.241, size: 0.38, color: '#8C8C8C' },
      'Venus': { a: 0.723, e: 0.007, period: 0.615, size: 0.95, color: '#E6E6B8' },
      'Earth': { a: 1.000, e: 0.017, period: 1.000, size: 1.00, color: '#6B93D6' },
      'Mars': { a: 1.524, e: 0.093, period: 1.881, size: 0.53, color: '#C1440E' },
      'Jupiter': { a: 5.203, e: 0.048, period: 11.86, size: 11.2, color: '#D8CA9D' },
      'Saturn': { a: 9.537, e: 0.054, period: 29.45, size: 9.45, color: '#EAD6B8' },
      'Uranus': { a: 19.19, e: 0.047, period: 84.02, size: 4.00, color: '#D1E7E7' },
      'Neptune': { a: 30.07, e: 0.009, period: 164.8, size: 3.88, color: '#5B5DDF' }
    };
    
    // Moons
    this.moons = {
      'Moon': { parent: 'Earth', a: 0.00257, period: 27.3, size: 0.27 },
      'Phobos': { parent: 'Mars', a: 0.0000627, period: 0.32, size: 0.00011 },
      'Deimos': { parent: 'Mars', a: 0.000234, period: 1.26, size: 0.00006 }
    };
    
    this.auToMeters = 149597870700; // 1 AU in meters
    this.scaleFactor = 1e-9; // Scale for visualization
  }

  /**
   * Calculate planet position at given time
   * @param {string} planet - Planet name
   * @param {number} t - Time in Earth years (0 = J2000)
   * @returns {Object} {x, y, z} position in AU
   */
  getPlanetPosition(planet, t = 0) {
    const p = this.planets[planet];
    if (!p) return { x: 0, y: 0, z: 0 };
    
    // Mean anomaly
    const M = (2 * Math.PI * t / p.period) % (2 * Math.PI);
    
    // Eccentric anomaly (solve Kepler's equation iteratively)
    let E = M;
    for (let i = 0; i < 5; i++) {
      E = M + p.e * Math.sin(E);
    }
    
    // True anomaly
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + p.e) * Math.sin(E / 2),
      Math.sqrt(1 - p.e) * Math.cos(E / 2)
    );
    
    // Distance
    const r = p.a * (1 - p.e * Math.cos(E));
    
    // Position in orbital plane
    return {
      x: r * Math.cos(nu),
      y: r * Math.sin(nu),
      z: 0,
      distance: r,
      trueAnomaly: nu
    };
  }

  /**
   * Get positions for all planets
   * @param {number} t - Time in Earth years
   * @returns {Object} Planet positions
   */
  getSolarSystem(t = 0) {
    const positions = {};
    Object.keys(this.planets).forEach(planet => {
      positions[planet] = this.getPlanetPosition(planet, t);
    });
    return positions;
  }

  /**
   * Scale position for visualization
   */
  scaleForVisualization(position, scaleMode = 'log') {
    if (scaleMode === 'log') {
      // Logarithmic scaling for inner/outer planets
      const r = Math.sqrt(position.x**2 + position.y**2);
      const logR = Math.log10(r * 10 + 1); // +1 to handle Mercury
      const angle = Math.atan2(position.y, position.x);
      
      return {
        x: logR * Math.cos(angle) * 10,
        y: logR * Math.sin(angle) * 10,
        z: position.z
      };
    }
    
    if (scaleMode === 'actual') {
      // Scale down massively
      return {
        x: position.x * this.scaleFactor * 1e11,
        y: position.y * this.scaleFactor * 1e11,
        z: position.z * this.scaleFactor * 1e11
      };
    }
    
    // 'compressed' - inner planets expanded, outer compressed
    const r = Math.sqrt(position.x**2 + position.y**2);
    let compressedR;
    if (r < 2) {
      compressedR = r * 2;
    } else {
      compressedR = 4 + (r - 2) * 0.3;
    }
    const angle = Math.atan2(position.y, position.x);
    
    return {
      x: compressedR * Math.cos(angle),
      y: compressedR * Math.sin(angle),
      z: position.z
    };
  }

  /**
   * Generate orbit points for visualization
   */
  getOrbitPoints(planet, points = 100) {
    const orbit = [];
    const p = this.planets[planet];
    
    for (let i = 0; i <= points; i++) {
      const M = (2 * Math.PI * i / points);
      let E = M;
      for (let j = 0; j < 5; j++) {
        E = M + p.e * Math.sin(E);
      }
      
      const nu = 2 * Math.atan2(
        Math.sqrt(1 + p.e) * Math.sin(E / 2),
        Math.sqrt(1 - p.e) * Math.cos(E / 2)
      );
      
      const r = p.a * (1 - p.e * Math.cos(E));
      
      orbit.push({
        x: r * Math.cos(nu),
        y: r * Math.sin(nu),
        z: 0
      });
    }
    
    return orbit;
  }
}

/**
 * Historical Timeline Calculator
 */
export class TimelineCalculator {
  constructor() {
    this.eras = [];
  }

  /**
   * Calculate spiral position for historical events
   * @param {Array} events - Array of {year, label, category, importance}
   * @param {Object} config - Layout configuration
   * @returns {Array} Positions for each event
   */
  calculateSpiral(events, config = {}) {
    const {
      radiusGrowth = 0.5,
      heightStep = 2,
      yearRange = null,
      rotations = 2
    } = config;
    
    // Determine year range
    let minYear = yearRange?.min || Math.min(...events.map(e => e.year));
    let maxYear = yearRange?.max || Math.max(...events.map(e => e.year));
    const yearSpan = maxYear - minYear || 1;
    
    return events.map((event, i) => {
      // Normalize time position (0-1)
      const t = (event.year - minYear) / yearSpan;
      
      // Spiral parameters
      const angle = t * 2 * Math.PI * rotations;
      const radius = 5 + t * radiusGrowth * events.length;
      
      return {
        id: event.id || `event-${i}`,
        year: event.year,
        label: event.label,
        category: event.category,
        importance: event.importance || 1,
        position: {
          x: Math.cos(angle) * radius,
          y: t * heightStep * events.length,
          z: Math.sin(angle) * radius
        },
        angle,
        radius
      };
    });
  }

  /**
   * Calculate linear timeline positions
   */
  calculateLinear(events, config = {}) {
    const {
      spacing = 3,
      yearRange = null,
      direction = 'x' // 'x', 'y', or 'z'
    } = config;
    
    let minYear = yearRange?.min || Math.min(...events.map(e => e.year));
    let maxYear = yearRange?.max || Math.max(...events.map(e => e.year));
    const yearSpan = maxYear - minYear || 1;
    
    return events.map((event, i) => {
      const t = (event.year - minYear) / yearSpan;
      const pos = (t - 0.5) * spacing * events.length;
      
      const position = { x: 0, y: 0, z: 0 };
      position[direction] = pos;
      
      return {
        ...event,
        position
      };
    });
  }
}

/**
 * Quiz/Assessment System
 */
export class QuizSystem {
  constructor(scene) {
    this.questions = [];
    this.currentQuestion = 0;
    this.score = 0;
    this.scene = scene;
  }

  addQuestion(question) {
    this.questions.push({
      id: question.id,
      text: question.text,
      answers: question.answers, // Array of {text, correct, position}
      type: question.type || 'multiple-choice',
      hint: question.hint,
      explanation: question.explanation
    });
  }

  loadQuiz(quizData) {
    this.questions = [...quizData.questions];
    this.currentQuestion = 0;
    this.score = 0;
  }

  displayQuestion() {
    const q = this.questions[this.currentQuestion];
    if (!q) {
      this.showResults();
      return;
    }

    // Create question display in VR
    const questionPanel = document.createElement('a-entity');
    questionPanel.setAttribute('position', '0 3 -5');
    
    // Question text
    const text = document.createElement('a-text');
    text.setAttribute('value', q.text);
    text.setAttribute('align', 'center');
    text.setAttribute('width', 8);
    text.setAttribute('color', '#ffffff');
    text.setAttribute('position', '0 1 0');
    questionPanel.appendChild(text);
    
    // Answer buttons
    q.answers.forEach((answer, i) => {
      const button = document.createElement('a-entity');
      button.classList.add('quiz-answer');
      button.dataset.answerIndex = i;
      button.dataset.correct = answer.correct;
      
      button.setAttribute('position', `${(i - q.answers.length/2 + 0.5) * 3} 0 0`);
      
      const box = document.createElement('a-box');
      box.setAttribute('width', '2');
      box.setAttribute('height', '0.8');
      box.setAttribute('depth', '0.2');
      box.setAttribute('color', '#00d4aa');
      box.classList.add('clickable');
      button.appendChild(box);
      
      const label = document.createElement('a-text');
      label.setAttribute('value', answer.text);
      label.setAttribute('align', 'center');
      label.setAttribute('width', 4);
      label.setAttribute('color', '#000000');
      label.setAttribute('position', '0 0 0.15');
      button.appendChild(label);
      
      // Click handler
      box.addEventListener('click', () => this.handleAnswer(i, answer.correct, button));
      
      questionPanel.appendChild(button);
    });
    
    this.scene.appendChild(questionPanel);
    this.currentPanel = questionPanel;
  }

  handleAnswer(index, correct, buttonEl) {
    // Visual feedback
    const box = buttonEl.querySelector('a-box');
    box.setAttribute('color', correct ? '#00d4aa' : '#ff3864');
    
    if (correct) {
      this.score++;
      this.emit('quiz-correct', { question: this.currentQuestion });
    } else {
      this.emit('quiz-incorrect', { 
        question: this.currentQuestion,
        correctAnswer: this.questions[this.currentQuestion].answers.findIndex(a => a.correct)
      });
    }
    
    // Show explanation
    setTimeout(() => {
      this.showExplanation();
    }, 1000);
  }

  showExplanation() {
    const q = this.questions[this.currentQuestion];
    
    // Replace with explanation panel
    this.currentPanel.innerHTML = '';
    
    const expText = document.createElement('a-text');
    expText.setAttribute('value', q.explanation || 'Next question...');
    expText.setAttribute('align', 'center');
    expText.setAttribute('width', 6);
    expText.setAttribute('color', '#ffffff');
    this.currentPanel.appendChild(expText);
    
    setTimeout(() => {
      this.currentPanel.remove();
      this.currentQuestion++;
      this.displayQuestion();
    }, 3000);
  }

  showResults() {
    const panel = document.createElement('a-entity');
    panel.setAttribute('position', '0 3 -5');
    
    const title = document.createElement('a-text');
    title.setAttribute('value', 'Quiz Complete!');
    title.setAttribute('align', 'center');
    title.setAttribute('width', 8);
    title.setAttribute('color', '#d4af37');
    title.setAttribute('position', '0 1 0');
    panel.appendChild(title);
    
    const score = document.createElement('a-text');
    score.setAttribute('value', `${this.score} / ${this.questions.length} correct`);
    score.setAttribute('align', 'center');
    score.setAttribute('width', 6);
    score.setAttribute('color', '#ffffff');
    score.setAttribute('position', '0 0 0');
    panel.appendChild(score);
    
    this.scene.appendChild(panel);
    
    this.emit('quiz-complete', {
      score: this.score,
      total: this.questions.length,
      percentage: (this.score / this.questions.length) * 100
    });
  }

  emit(eventName, detail) {
    this.scene.emit(eventName, detail);
  }
}
