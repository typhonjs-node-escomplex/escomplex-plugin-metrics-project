import { assert }             from 'chai';
import path                   from 'path';

import ProjectReport          from 'typhonjs-escomplex-commons/src/project/report/ProjectReport';

import PluginMetricsProject   from '../../src/PluginMetricsProject.js';

const pluginData =
[
   { name: 'ESM', PluginClass: PluginMetricsProject }
];

pluginData.forEach((plugin) =>
{
   suite(`(${plugin.name}) plugin:`, () =>
   {
      suite('initialize:', () =>
      {
         const instance = new plugin.PluginClass();

         test('plugin was object', () =>
         {
            assert.isObject(instance);
         });

         test('plugin function onConfigure is exported', () =>
         {
            assert.isFunction(instance.onConfigure);
         });

         test('plugin function onProjectCalculate is exported', () =>
         {
            assert.isFunction(instance.onProjectCalculate);
         });

         test('plugin function onProjectAverage is exported', () =>
         {
            assert.isFunction(instance.onProjectAverage);
         });
      });

      suite('method invocation:', () =>
      {
         const instance = new plugin.PluginClass();

         test('plugin throws on empty event data', () =>
         {
            assert.throws(() => { instance.onConfigure(); });
         });

         test('plugin does not throw on proper event data', () =>
         {
            assert.doesNotThrow(() => { instance.onConfigure({ data: { options: {}, settings: {} } }); });
         });

         test('plugin passes back syntax data', () =>
         {
            const event = { data: { options: {}, settings: {} } };
            instance.onConfigure(event);
            assert.strictEqual(event.data.settings.noCoreSize, false);
         });
      });

      suite('project results:', () =>
      {
         const instance = new plugin.PluginClass();

         const resultsAfter = require('typhonjs-escomplex-test-data/files/large-project/json/project');

         const resultsBefore = ProjectReport.parse(require(
          'typhonjs-escomplex-test-data/files/large-project/json/project-no-calculation'));

         /**
          * Bootstraps the ESComplexProject runtime and fudges processing project results.
          *
          * Note: That the control flow below exactly replicates typhonjs-escomplex-project / ESComplexProject. If there
          * are any future changes to ESComplexProject the below control flow will need to be modified accordingly.
          */
         test('verify calculation results', () =>
         {
            let event = { data: { options: {}, settings: {} } };

            instance.onConfigure(event);

            const settings = event.data.settings;

            event = { data: { pathModule: path, projectReport: resultsBefore, settings } };

            // Allow all plugins to have a calculation pass at the project report.
            instance.onProjectCalculate(event);

            // Allow all plugins to have a pass at the project report to calculate any averaged data.
            instance.onProjectAverage(event);

            // ESComplexProject on processing results will set skipCalculation to false.
            resultsBefore.settings.skipCalculation = false;

            resultsBefore.finalize();

            assert.strictEqual(JSON.stringify(resultsBefore), JSON.stringify(resultsAfter));
         });
      });
   });
});