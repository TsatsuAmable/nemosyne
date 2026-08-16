/**
 * Voice & Natural Language Spatial Query Listener.
 *
 * Listens for spoken analyst voice phrases via Web Speech API and classifies
 * intent into executable Nemosyne operation parameters (e.g. filter, layout, reset).
 */

export interface ParsedVoiceCommand {
  rawTranscript: string;
  intent: 'FILTER' | 'LAYOUT' | 'RESET' | 'SELECT' | 'UNKNOWN';
  targetField?: string;
  comparisonOperator?: '>' | '<' | '=';
  numericValue?: number;
  layoutType?: string;
}

interface SpeechRecognitionEvent {
  results: Array<Array<{ transcript: string }>>;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

export class VoiceCommandListener {
  isListening = false;
  private _recognition: SpeechRecognition | null = null;
  private _onCommandCallback?: (command: ParsedVoiceCommand) => void;

  constructor(onCommand?: (command: ParsedVoiceCommand) => void) {
    this._onCommandCallback = onCommand;

    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, new () => SpeechRecognition>;
      const SpeechClass = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (SpeechClass) {
        this._recognition = new SpeechClass();
        this._recognition.continuous = true;
        this._recognition.interimResults = false;
        this._recognition.lang = 'en-US';

        this._recognition.onresult = (event: SpeechRecognitionEvent) => {
          const lastIndex = event.results.length - 1;
          const transcript = event.results[lastIndex][0].transcript.trim();
          const parsed = VoiceCommandListener.parseTranscript(transcript);
          if (this._onCommandCallback) {
            this._onCommandCallback(parsed);
          }
        };
      }
    }
  }

  static parseTranscript(transcript: string): ParsedVoiceCommand {
    const lower = transcript.toLowerCase();

    // Reset intent
    if (lower.includes('reset') || lower.includes('clear view')) {
      return { rawTranscript: transcript, intent: 'RESET' };
    }

    // Layout intent
    if (lower.includes('show') || lower.includes('switch to') || lower.includes('layout')) {
      let layoutType = 'GRID_3D';
      if (lower.includes('graph')) layoutType = 'FORCE_DIRECTED_3D';
      else if (lower.includes('tree') || lower.includes('hierarchy')) layoutType = 'RADIAL_ORBITAL';
      else if (lower.includes('time') || lower.includes('ribbon')) layoutType = 'TIME_RIBBON';
      else if (lower.includes('geo') || lower.includes('map')) layoutType = 'GEO_SURFACE';
      return { rawTranscript: transcript, intent: 'LAYOUT', layoutType };
    }

    // Filter intent e.g. "filter revenue above 200" or "filter margin less than 15"
    if (lower.includes('filter') || lower.includes('where') || lower.includes('above') || lower.includes('greater') || lower.includes('less')) {
      const fieldMatch = lower.match(/(revenue|margin|temp|sales|cost|value|depth)/i);
      const targetField = fieldMatch ? fieldMatch[1] : 'value';

      let comparisonOperator: '>' | '<' | '=' = '>';
      if (lower.includes('below') || lower.includes('less') || lower.includes('under')) {
        comparisonOperator = '<';
      }

      const numMatch = lower.match(/\d+(\.\d+)?/);
      const numericValue = numMatch ? Number(numMatch[0]) : 0;

      return {
        rawTranscript: transcript,
        intent: 'FILTER',
        targetField,
        comparisonOperator,
        numericValue,
      };
    }

    return { rawTranscript: transcript, intent: 'UNKNOWN' };
  }

  startListening(): void {
    if (this._recognition && !this.isListening) {
      try {
        this._recognition.start();
        this.isListening = true;
      } catch (err) {
        console.warn('[VoiceCommandListener] Speech recognition start error:', err);
      }
    }
  }

  stopListening(): void {
    if (this._recognition && this.isListening) {
      try {
        this._recognition.stop();
        this.isListening = false;
      } catch (err) {
        console.warn('[VoiceCommandListener] Speech recognition stop error:', err);
      }
    }
  }
}
