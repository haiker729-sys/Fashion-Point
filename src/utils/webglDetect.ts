export type RenderQuality = 'low' | 'medium' | 'high';

export interface WebGLCapabilities {
  supported: boolean;
  isSoftwareGl: boolean;
  isMobile: boolean;
  recommendedQuality: RenderQuality;
  rendererLabel: string;
}

export function detectWebGLCapabilities(): WebGLCapabilities {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      supported: false,
      isSoftwareGl: true,
      isMobile: false,
      recommendedQuality: 'low',
      rendererLabel: 'Unavailable',
    };
  }

  const isMobile =
    window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);

    if (!gl) {
      return {
        supported: false,
        isSoftwareGl: true,
        isMobile,
        recommendedQuality: 'low',
        rendererLabel: 'WebGL Not Supported',
      };
    }

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererParam = debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererLabel = String(gl.getParameter(rendererParam) || 'WebGL Renderer');
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererLabel);

    gl.getExtension('WEBGL_lose_context')?.loseContext();

    const recommendedQuality: RenderQuality = isSoftwareGl
      ? 'low'
      : isMobile
        ? 'medium'
        : 'high';

    return {
      supported: true,
      isSoftwareGl,
      isMobile,
      recommendedQuality,
      rendererLabel,
    };
  } catch {
    return {
      supported: false,
      isSoftwareGl: true,
      isMobile,
      recommendedQuality: 'low',
      rendererLabel: 'WebGL Probe Failed',
    };
  }
}

export function getQualitySettings(quality: RenderQuality, isSoftwareGl: boolean) {
  if (isSoftwareGl || quality === 'low') {
    return {
      dpr: [1, 1] as [number, number],
      shadows: false,
      antialias: false,
      shadowMapSize: 512,
    };
  }
  if (quality === 'medium') {
    return {
      dpr: [1, 1.5] as [number, number],
      shadows: true,
      antialias: true,
      shadowMapSize: 1024,
    };
  }
  return {
    dpr: [1, 2] as [number, number],
    shadows: true,
    antialias: true,
    shadowMapSize: 2048,
  };
}

/**
 * Lightweight procedural Web Audio synthesizer for luxury boutique ambience & UI chimes.
 * Zero external audio files (Zero-404 safe).
 */
class ShowroomAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private active = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.04;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    if (enabled === this.active) return;
    this.active = enabled;
    if (!enabled) {
      this.droneOscs.forEach((o) => {
        try {
          o.stop();
          o.disconnect();
        } catch {
          // ignore
        }
      });
      this.droneOscs = [];
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // Warm luxury major-9th lounge pad chord (soft, non-intrusive)
    const freqs = [196.0, 246.94, 293.66, 369.99];
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.connect(this.masterGain);

    this.droneOscs = freqs.map((f) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      oscGain.gain.value = 0.18 / freqs.length;
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      return osc;
    });
  }

  public playChime(freq = 587.33) {
    if (!this.active) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }
}

export const showroomAudio = new ShowroomAudioEngine();
