import { logger } from '../../../utils/logger.js';
import { MODEL_COSTS } from '../config/model-config.js';

export class CostCalculator {
  /**
   * Calculates the estimated cost based on input/output token usage and model.
   * Uses MODEL_COSTS imported from model-config.ts
   */
  static calculate(promptTokens: number, completionTokens: number, model: string): number {
    // Cast to any to handle potential string index signature issues if MODEL_COSTS type isn't perfectly aligned yet
    const costs = (MODEL_COSTS as any)[model];
    if (!costs) {
      logger.warn(`Cost calculation data not available for model: ${model}`);
      return 0;
    }
    // Calculate cost based on input and output tokens
    const estimatedCost = promptTokens * costs.input + completionTokens * costs.output;
    return estimatedCost;
  }
}
