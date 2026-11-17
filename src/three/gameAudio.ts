class ProceduralGameAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  unlock() {
    if (this.muted) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  setMuted(mute: boolean) {
    this.muted = mute;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private playTone(freq: number, endFreq: number, duration: number, type: OscillatorType, gainPeak = 0.12) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playPickup() {
    this.playTone(440, 660, 0.14, 'triangle', 0.11);
  }

  playDeliver(combo: number) {
    const pitchBoost = Math.min(1.6, 1 + combo * 0.08);
    this.playTone(523.25 * pitchBoost, 783.99 * pitchBoost, 0.18, 'sine', 0.14);
    setTimeout(() => this.playTone(659.25 * pitchBoost, 1046.5 * pitchBoost, 0.22, 'sine', 0.12), 70);
  }

  playDash() {
    this.playTone(260, 120, 0.18, 'sawtooth', 0.08);
  }

  playBump() {
    this.playTone(135, 55, 0.22, 'square', 0.12);
  }

  playWaveClear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, freq * 1.02, 0.22, 'triangle', 0.12), idx * 90);
    });
  }

  playGameOver() {
    this.playTone(320, 140, 0.45, 'sawtooth', 0.11);
  }
}

export const gameAudio = new ProceduralGameAudio();
