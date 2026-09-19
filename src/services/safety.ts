/**
 * Safety & Panic Exit Service
 * Detects device shake gesture, top-left triple tap, visibility change auto-lock, and app switcher privacy cover.
 */

export type LockCallback = () => void;

export class SafetyService {
  private static lockCallback: LockCallback | null = null;
  private static lastShakeTime: number = 0;
  private static topLeftTapCount: number = 0;
  private static topLeftTapResetTimer: any = null;

  public static init(onLock: LockCallback): void {
    this.lockCallback = onLock;

    // Listen for tab hidden / app background auto-lock
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.triggerPrivacyCover(true);
        this.triggerLock();
      } else {
        this.triggerPrivacyCover(false);
      }
    });

    window.addEventListener('blur', () => {
      this.triggerPrivacyCover(true);
      this.triggerLock();
    });

    window.addEventListener('focus', () => {
      this.triggerPrivacyCover(false);
    });

    // Listen for mobile shake gesture using devicemotion
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', (event) => {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;

        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        // Acceleration threshold (> 22 m/s² for deliberate shake)
        if (magnitude > 22 && now - this.lastShakeTime > 1500) {
          this.lastShakeTime = now;
          this.triggerLock();
        }
      });
    }

    // Listen for top-left triple-tap gesture
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        // Top-left 60px x 60px corner area
        if (touch.clientX <= 60 && touch.clientY <= 60) {
          this.handleTopLeftTap();
        }
      }
    });

    window.addEventListener('click', (e) => {
      if (e.clientX <= 60 && e.clientY <= 60) {
        this.handleTopLeftTap();
      }
    });
  }

  private static handleTopLeftTap(): void {
    this.topLeftTapCount++;
    if (this.topLeftTapResetTimer) clearTimeout(this.topLeftTapResetTimer);

    if (this.topLeftTapCount >= 3) {
      this.topLeftTapCount = 0;
      this.triggerLock();
      return;
    }

    this.topLeftTapResetTimer = setTimeout(() => {
      this.topLeftTapCount = 0;
    }, 600);
  }

  public static triggerLock(): void {
    if (this.lockCallback) {
      this.lockCallback();
    }
  }

  public static triggerPrivacyCover(show: boolean): void {
    const cover = document.getElementById('privacy-cover');
    if (cover) {
      if (show) {
        cover.classList.remove('hidden');
      } else {
        cover.classList.add('hidden');
      }
    }
  }
}
