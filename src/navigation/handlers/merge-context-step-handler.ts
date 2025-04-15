import { Page } from 'playwright';
import _ from 'lodash'; // Using lodash for deep merging and utility functions
import {
  NavigationContext,
  NavigationStep,
  MergeContextStep, // Now defined in navigation.types.ts
  StepResult,
} from '../types/navigation.types.js';
import { IStepHandler } from '../types/step-handler.interface.js';
import { logger } from '../../utils/logger.js';
import { BaseStepHandler } from './base-step-handler.js'; // Assuming BaseStepHandler exists for resolveValue

export class MergeContextStepHandler extends BaseStepHandler implements IStepHandler {
  canHandle(step: NavigationStep): boolean {
    return step.type === 'mergeContext';
  }

  async execute(
    step: MergeContextStep,
    context: NavigationContext,
    page: Page
  ): Promise<StepResult> {
    logger.info(`Executing mergeContext: Merging ${step.source} into ${step.target}`);

    if (!step.source || !step.target) {
      throw new Error('MergeContextStep requires both "source" and "target" properties.');
    }

    // Resolve source and target paths, potentially using context variables like {{index}}
    const sourcePath = this.resolveValue(step.source, context) as string;
    const targetPath = this.resolveValue(step.target, context) as string;

    const sourceData = _.get(context, sourcePath);
    let targetData = _.get(context, targetPath); // Get current target data

    // Log target data before merge for debugging
    logger.debug(
      `Target data at path "${targetPath}" BEFORE merge:`,
      JSON.stringify(targetData, null, 2)
    ); // Fixed formatting based on eslint error
    if (_.isNil(sourceData)) {
      logger.warn(`Source data at path "${sourcePath}" is null or undefined. Skipping merge.`);
      return {};
    }

    if (_.isNil(targetData)) {
      logger.warn(
        `Target path "${targetPath}" does not exist or is null/undefined. Initializing target.`
      );
      // Initialize target based on source type if possible, otherwise default to object
      targetData = _.isArray(sourceData) ? [] : {};
    }

    // Perform the merge based on strategy
    const mergedData = this.mergeObjects(
      targetData,
      sourceData,
      step.mergeStrategy || {},
      step.defaultMergeStrategy || 'overwrite' // Default to overwrite if no strategy specified
    );

    // Update the context with the merged data
    _.set(context, targetPath, mergedData);

    // Log merged data for debugging
    logger.debug(
      `Target data at path "${targetPath}" AFTER merge:`,
      JSON.stringify(mergedData, null, 2)
    ); // Fixed formatting based on eslint error
    logger.debug(`Merge complete. Target "${targetPath}" updated.`);

    return {}; // Return empty result
  }

  private mergeObjects(
    target: any,
    source: any,
    strategy: { [key: string]: 'overwrite' | 'union' | 'append' | 'ignore' },
    defaultStrategy: 'overwrite' | 'union' | 'append' | 'ignore'
  ): any {
    // Ensure target is an object or array if it needs merging into
    if (!_.isObject(target) && _.isObject(source)) {
      target = _.isArray(source) ? [] : {};
    } else if (!_.isObject(target)) {
      // If target is not an object and source is not, default strategy applies
      return this.applyStrategy(target, source, defaultStrategy);
    }

    const result = _.cloneDeep(target); // Start with a clone of the target

    _.forEach(source, (sourceValue, key) => {
      const fieldStrategy = strategy[key] || defaultStrategy;
      const targetValue = result[key];

      result[key] = this.applyStrategy(targetValue, sourceValue, fieldStrategy);
    });

    return result;
  }

  private applyStrategy(targetValue: any, sourceValue: any, fieldStrategy: string): any {
    switch (fieldStrategy) {
      case 'union':
        // Combine arrays and remove duplicates
        if (_.isArray(targetValue) && _.isArray(sourceValue)) {
          return _.union(targetValue, sourceValue);
        }
        // If target is not array but source is, use source
        if (_.isNil(targetValue) && _.isArray(sourceValue)) {
          return _.cloneDeep(sourceValue);
        }
        // If source is not array but target is, keep target
        if (_.isArray(targetValue) && !_.isArray(sourceValue)) {
          // Decide if you want to add non-array source to array target
          // return [...targetValue, sourceValue]; // Option: Append non-array source
          return targetValue; // Option: Keep original target array
        }
        // For non-arrays, union doesn't make sense, default to overwrite
        return _.cloneDeep(sourceValue);
      case 'append':
        // Append source to target array
        if (_.isArray(targetValue)) {
          return targetValue.concat(sourceValue); // Appends source value(s)
        }
        // If target is not an array, create a new array
        if (!_.isNil(targetValue)) {
          return [targetValue].concat(sourceValue);
        }
        // If target is nil, just use source (or wrap if not array)
        return _.isArray(sourceValue) ? _.cloneDeep(sourceValue) : [sourceValue];
      case 'ignore':
        // Keep the target value if it exists, otherwise undefined
        return targetValue;
      case 'overwrite':
      default:
        // Deep clone source value to prevent reference issues
        return _.cloneDeep(sourceValue);
    }
  }
}
