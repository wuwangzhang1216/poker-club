export enum SoundEffect {
    DEAL = 'deal',
    BET = 'bet',
    FOLD = 'fold',
    WIN = 'win',
    CHECK = 'check',
    SHUFFLE = 'shuffle',
}

const SOUND_FILE_MAP: Record<SoundEffect, string> = {
    [SoundEffect.DEAL]: new URL('../sounds/card-deal.wav', import.meta.url).href,
    [SoundEffect.BET]: new URL('../sounds/chip-bet.wav', import.meta.url).href,
    [SoundEffect.FOLD]: new URL('../sounds/card-fold.wav', import.meta.url).href,
    [SoundEffect.WIN]: new URL('../sounds/hand-win.wav', import.meta.url).href,
    [SoundEffect.CHECK]: new URL('../sounds/card-check.wav', import.meta.url).href,
    [SoundEffect.SHUFFLE]: new URL('../sounds/card-shuffle.wav', import.meta.url).href,
};

class AudioService {
    private soundCache: Map<SoundEffect, HTMLAudioElement> = new Map();
    private isUnlocked = false;
    private isLoading = false;
    private soundsLoaded = false;
    private onLoadedCallbacks: (() => void)[] = [];

    public async unlock() {
        if (this.isUnlocked) return;
        this.isUnlocked = true;
        console.log("Audio unlocked for playback.");
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
            const soundPromises = Object.values(SoundEffect).map(async (sound) => {
                const url = SOUND_FILE_MAP[sound];
                return new Promise<void>((resolve) => {
                    const audio = new Audio(url);
                    audio.preload = 'auto';

                    const handleReady = () => {
                        this.soundCache.set(sound, audio);
                        cleanup();
                        resolve();
                    };

                    const handleError = (event: Event) => {
                        console.error(`Could not load sound: ${url}`, event);
                        cleanup();
                        resolve();
                    };

                    const cleanup = () => {
                        audio.removeEventListener('canplaythrough', handleReady);
                        audio.removeEventListener('error', handleError);
                    };

                    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                        this.soundCache.set(sound, audio);
                        resolve();
                        return;
                    }

                    audio.addEventListener('canplaythrough', handleReady, { once: true });
                    audio.addEventListener('error', handleError, { once: true });
                    audio.load();
                });
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
        if (!this.isUnlocked) {
            console.warn(`Cannot play sound, audio not unlocked. Sound: ${sound}`);
            return;
        }
        
        const audioElement = this.soundCache.get(sound);
        if (audioElement) {
            const instance = audioElement.cloneNode(true) as HTMLAudioElement;
            instance.volume = 0.4;
            instance.play().catch(error => {
                console.error(`Error playing sound ${sound}:`, error);
            });
        } else {
            console.warn(`Sound not found in cache: ${sound}`);
        }
    }
}

const audioService = new AudioService();
export default audioService;
