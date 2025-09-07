export enum SoundEffect {
    DEAL = '/sounds/card-deal.mp3',
    BET = '/sounds/chip-bet.mp3',
    FOLD = '/sounds/card-fold.mp3',
    WIN = '/sounds/hand-win.mp3',
    CHECK = '/sounds/card-check.mp3',
    SHUFFLE = '/sounds/card-shuffle.mp3',
}

/**
 * Plays a sound effect.
 * Note: This requires sound files to be present in the public/sounds/ directory.
 * Browser autoplay policies might prevent sounds from playing without prior user interaction.
 * @param sound The sound effect to play.
 */
const playSound = (sound: SoundEffect) => {
    try {
        const audio = new Audio(sound);
        audio.volume = 0.4; // Set a reasonable volume
        audio.play().catch(error => {
            // This error is common if the user hasn't interacted with the page yet.
            console.warn(`Audio playback for ${sound} was blocked by the browser.`, error);
        });
    } catch (error) {
        console.error(`Error initialising audio for ${sound}:`, error);
    }
};

export default playSound;
