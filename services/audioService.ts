export enum SoundEffect {
    DEAL = '/sounds/card-deal.wav',
    BET = '/sounds/chip-bet.wav',
    FOLD = '/sounds/card-fold.wav',
    WIN = '/sounds/chips-stack.wav',
    CHECK = '/sounds/card-check.wav',
    SHUFFLE = '/sounds/card-shuffle.wav',
}

class AudioService {
    private audioContext: AudioContext | null = null;
    private soundCache: Map<SoundEffect, AudioBuffer> = new Map();
    private isUnlocked = false;
    private isLoading = false;
    private soundsLoaded = false;
    private onLoadedCallbacks: (() => void)[] = [];

    private async getContext(): Promise<AudioContext> {
        if (!this.audioContext) {
            try {
                this.audioContext = new AudioContext();
            } catch (e) {
                console.error("Web Audio API is not supported in this browser.", e);
                return Promise.reject("Audio not supported");
            }
        }
        return this.audioContext;
    }

    public async unlock() {
        if (this.isUnlocked) return;
        try {
            const context = await this.getContext();
            if (context.state === 'suspended') {
                await context.resume();
            }
            this.isUnlocked = true;
            console.log("Audio context unlocked.");
        } catch (error) {
            console.error("Failed to unlock audio context:", error);
        }
    }

    public areSoundsLoaded(): boolean {
        return this.soundsLoaded;
    }

    public onSoundsLoaded(callback: () => void) {
        if (this.soundsLoaded) {
            callback();
        } else {
            this.onLoadedCallbacks.push(callback);
        }
    }

    public async loadSounds() {
        if (this.isLoading || this.soundCache.size > 0) return;
        this.isLoading = true;
        
        try {
            const context = await this.getContext();
            const soundPromises = Object.values(SoundEffect).map(async (sound) => {
                try {
                    const response = await fetch(sound);
                    if (!response.ok) {
                        throw new Error(`Failed to load sound: ${sound}, status: ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await context.decodeAudioData(arrayBuffer);
                    this.soundCache.set(sound, audioBuffer);
                } catch (error) {
                    console.error(`Could not load or decode sound: ${sound}`, error);
                }
            });

            await Promise.all(soundPromises);
            console.log("All sounds loaded.");
            this.soundsLoaded = true;
            this.onLoadedCallbacks.forEach(cb => cb());
            this.onLoadedCallbacks = [];
        } catch (error) {
            console.error("Error during sound loading process:", error);
        } finally {
            this.isLoading = false;
        }
    }

    public playSound(sound: SoundEffect) {
        if (!this.isUnlocked || !this.audioContext) {
            console.warn(`Cannot play sound, audio context not unlocked. Sound: ${sound}`);
            return;
        }
        
        const audioBuffer = this.soundCache.get(sound);
        if (audioBuffer) {
            try {
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                // Add a gain node to control volume
                const gainNode = this.audioContext.createGain();
                gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);

                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                source.start(0);
            } catch (error) {
                console.error(`Error playing sound ${sound}:`, error);
            }
        } else {
            console.warn(`Sound not found in cache: ${sound}`);
        }
    }
}

const audioService = new AudioService();
export default audioService;