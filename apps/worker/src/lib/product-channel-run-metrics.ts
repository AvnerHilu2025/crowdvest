/**
 * Run-level calibration / stability metrics for product channels (no formula changes).
 */

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 1 ? a[mid]! : (a[mid - 1]! + a[mid]!) / 2;
}

export interface ProductChannelRunSummary {
  n: number;
  medianAbsSynthetic: number;
  medianAbsInfo: number;
  medianAbsEvent: number;
  medianAbsRegime: number;
  /** Fraction of decisions with event === 0. */
  eventSparsity: number;
  /** Fraction of decisions with event !== 0. */
  eventNonZeroRate: number;
  syntheticSaturationWarnings: number;
  /** Mean share of each channel in total L1 mass (|syn|+|info|+|event|+|reg|). */
  contributionShare: {
    synthetic: number;
    info: number;
    event: number;
    regime: number;
  };
}

const MIN_SAMPLES_EVENT_ASSERT = 80;

/** Max per-run log lines for |synthetic|>0.95 (avoid spam). */
export const PRODUCT_CHANNEL_SYN_WARN_LOG_CAP = 20;

export class ProductChannelRunMetrics {
  private absSynthetic: number[] = [];
  private absInfo: number[] = [];
  private absEvent: number[] = [];
  private absRegime: number[] = [];
  private total = 0;
  private eventNonZero = 0;
  syntheticSaturationWarnings = 0;
  private syntheticWarnLogged = 0;

  private sumShareSyn = 0;
  private sumShareInfo = 0;
  private sumShareEvt = 0;
  private sumShareReg = 0;

  record(sample: {
    synthetic: number;
    info: number;
    event: number;
    regime: number;
  }): void {
    const as = Math.abs(sample.synthetic);
    const ai = Math.abs(sample.info);
    const ae = Math.abs(sample.event);
    const ar = Math.abs(sample.regime);
    this.absSynthetic.push(as);
    this.absInfo.push(ai);
    this.absEvent.push(ae);
    this.absRegime.push(ar);
    this.total++;
    if (sample.event !== 0) {
      this.eventNonZero++;
    }
    const mass = as + ai + ae + ar;
    if (mass > 1e-15) {
      this.sumShareSyn += as / mass;
      this.sumShareInfo += ai / mass;
      this.sumShareEvt += ae / mass;
      this.sumShareReg += ar / mass;
    }
  }

  /**
   * Warn when |synthetic| is near tanh saturation (calibration check).
   */
  warnIfSyntheticNearSaturation(synthetic: number, log: (msg: string) => void): void {
    if (Math.abs(synthetic) > 0.95) {
      this.syntheticSaturationWarnings++;
      if (this.syntheticWarnLogged < PRODUCT_CHANNEL_SYN_WARN_LOG_CAP) {
        this.syntheticWarnLogged++;
        log(
          `[PRODUCT_CHANNELS] WARNING: |synthetic|=${Math.abs(synthetic).toFixed(4)} > 0.95 (near saturation)`,
        );
      }
    }
  }

  summarize(): ProductChannelRunSummary {
    const n = this.total;
    const eventNonZeroRate = n > 0 ? this.eventNonZero / n : 0;
    const eventSparsity = n > 0 ? 1 - eventNonZeroRate : 0;
    const contribN = n > 0 ? n : 1;
    return {
      n,
      medianAbsSynthetic: median(this.absSynthetic),
      medianAbsInfo: median(this.absInfo),
      medianAbsEvent: median(this.absEvent),
      medianAbsRegime: median(this.absRegime),
      eventSparsity,
      eventNonZeroRate,
      syntheticSaturationWarnings: this.syntheticSaturationWarnings,
      contributionShare: {
        synthetic: this.sumShareSyn / contribN,
        info: this.sumShareInfo / contribN,
        event: this.sumShareEvt / contribN,
        regime: this.sumShareReg / contribN,
      },
    };
  }

  /**
   * Assert event non-zero rate in (0.02, 0.3) when enough samples (calibration band).
   * Set PRODUCT_CHANNEL_SKIP_EVENT_RATE_ASSERT=1 to skip (e.g. tiny smoke runs).
   */
  assertEventNonZeroRateInRange(): void {
    if (process.env.PRODUCT_CHANNEL_SKIP_EVENT_RATE_ASSERT === "1") return;
    const n = this.total;
    if (n < MIN_SAMPLES_EVENT_ASSERT) return;
    const rate = this.eventNonZero / n;
    if (rate <= 0.02 || rate >= 0.3) {
      throw new Error(
        `[PRODUCT_CHANNELS] Event non-zero rate ${rate.toFixed(4)} outside required band (0.02, 0.3) for n=${n}. ` +
          `Tune PRODUCT_EVENT / fallback gates or set PRODUCT_CHANNEL_SKIP_EVENT_RATE_ASSERT=1 for smoke tests.`,
      );
    }
  }
}

export function formatProductChannelMetricsLine(s: ProductChannelRunSummary): string {
  return (
    `[PRODUCT_CHANNELS] median|synthetic|=${s.medianAbsSynthetic.toFixed(4)} median|info|=${s.medianAbsInfo.toFixed(4)} ` +
    `eventSparsity=${s.eventSparsity.toFixed(4)} eventNonZeroRate=${s.eventNonZeroRate.toFixed(4)} ` +
    `saturationWarnings=${s.syntheticSaturationWarnings} ` +
    `share(syn,info,evt,reg)=(${s.contributionShare.synthetic.toFixed(3)},${s.contributionShare.info.toFixed(3)},${s.contributionShare.event.toFixed(3)},${s.contributionShare.regime.toFixed(3)}) n=${s.n}`
  );
}
