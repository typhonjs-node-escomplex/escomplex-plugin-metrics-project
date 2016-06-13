'use strict';
import { assert }             from 'chai';
import fs                     from 'fs';

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

         test('plugin function onProjectEnd is exported', () =>
         {
            assert.isFunction(instance.onProjectEnd);
         });

         test('plugin function onProjectStart is exported', () =>
         {
            assert.isFunction(instance.onProjectStart);
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

         const resultsAfter = JSON.parse(fs.readFileSync('./test/fixture/results-after.json', 'utf8'));
         const resultsBefore = JSON.parse(fs.readFileSync('./test/fixture/results-before.json', 'utf8'));

         /**
          * Bootstraps the ESComplexProject runtime and fudges processing project results.
          */
         test('verify onProjectEnd results', () =>
         {
            let event = { data: { options: {}, settings: {} } };

            instance.onConfigure(event);

            const settings = event.data.settings;

            event = { data: { settings } };

            instance.onProjectStart(event);

            event = { data: { results: resultsBefore } };

            instance.onProjectEnd(event);

            assert.strictEqual(JSON.stringify(event.data.results), JSON.stringify(resultsAfter));
         });
      });
   });
});