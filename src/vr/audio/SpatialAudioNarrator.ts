/**
 * Diegetic Audio Narrator & Speech Synthesis Manager.
 *
 * Synthesizes Web Speech API audio responses for executed operations, anomaly alerts,
 * and guided tour steps.
 */

export class SpatialAudioNarrator {
  private _synth: SpeechSynthesis | null = null;
  private _speechRate = 1.0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this._synth = window.speechSynthesis;
    }
  }

  speak(text: string): void {
    if (!this._synth) return;

    this._synth.cancel(); // Stop active speech before queuing new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this._speechRate;
    utterance.volume = 0.9;
    utterance.pitch = 1.0;

    this._synth.speak(utterance);
  }

  stop(): void {
    if (this._synth) {
      this._synth.cancel();
    }
  }
}
