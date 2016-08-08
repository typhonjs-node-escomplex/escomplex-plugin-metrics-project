import ProjectMetricCalculate from './ProjectMetricCalculate';

/**
 * Provides default project metrics gathering and calculation.
 *
 * @see https://en.wikipedia.org/wiki/Adjacency_matrix
 * @see https://en.wikipedia.org/wiki/Distance_matrix
 * @see https://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm
 */
export default class PluginMetricsProject
{
   /**
    * Loads any default settings that are not already provided by any user options.
    *
    * @param {object}   ev - escomplex plugin event data.
    *
    * The following options are:
    * ```
    * (boolean)   newmi - Boolean indicating whether the maintainability index should be rebased on a scale from
    *                     0 to 100; defaults to false.
    * ```
    */
   onConfigure(ev)
   {
      ev.data.settings.noCoreSize = typeof ev.data.options.noCoreSize === 'boolean' ?
       ev.data.options.noCoreSize : false;
   }

   /**
    * Performs final calculations based on collected project report data.
    *
    * @param {object}   ev - escomplex plugin event data.
    */
   onProjectEnd(ev)
   {
      const pathModule = ev.data.pathModule;
      const projectReport = ev.data.projectReport;
      const settings = ev.data.settings;

      ProjectMetricCalculate.calculate(pathModule, projectReport, settings);
   }
}
