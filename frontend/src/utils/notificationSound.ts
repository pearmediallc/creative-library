/**
 * Notification Sound Utility
 * Plays notification sounds for different event types
 */

// Create audio context for notification sounds
class NotificationSound {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.5;

  constructor() {
    // Initialize on user interaction to comply with browser autoplay policies
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  /**
   * Play a notification sound using Web Audio API
   * Creates a simple beep sound
   */
  async playNotificationSound(type: 'default' | 'mention' | 'request' | 'success' = 'default') {
    if (!this.audioContext) {
      this.initAudioContext();
    }

    if (!this.audioContext) {
      console.warn('Audio context not available');
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Different frequencies for different notification types
    const frequencies: Record<string, number[]> = {
      default: [800, 600], // Two-tone beep
      mention: [900, 700, 900], // Three-tone alert
      request: [600, 800, 1000], // Rising tone
      success: [1000, 800, 1000] // Success chime
    };

    const freq = frequencies[type] || frequencies.default;

    // Set initial frequency
    oscillator.frequency.value = freq[0];

    // Set volume
    gainNode.gain.value = this.volume;

    // Start the sound
    const currentTime = this.audioContext.currentTime;
    oscillator.start(currentTime);

    // Create multi-tone effect
    freq.forEach((f, i) => {
      oscillator.frequency.setValueAtTime(f, currentTime + (i * 0.1));
    });

    // Fade out
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.3);

    // Stop the sound
    oscillator.stop(currentTime + 0.3);
  }

  /**
   * Set the volume for notification sounds
   * @param volume - Volume level between 0 and 1
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }
}

// Export singleton instance
export const notificationSound = new NotificationSound();
