'use strict';

import path from 'path';

/**
 * Provides default project metrics gathering and calculation.
 */
export default class PluginMetricsProject
{
   // ESComplexProject plugin callbacks -----------------------------------------------------------------------------

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
    * Performs final calculations based on collected results data.
    *
    * @param {object}   ev - escomplex plugin event data.
    */
   onProjectEnd(ev)
   {
      this._createAdjacencyMatrix(ev.data.results);
      if (!this.settings.noCoreSize)
      {
         this._createVisibilityMatrix(ev.data.results);
         this._setCoreSize(ev.data.results);
      }

      this._calculateAverages(ev.data.results);
   }

   /**
    * Stores settings and syntaxes.
    *
    * @param {object}   ev - escomplex plugin event data.
    */
   onProjectStart(ev)
   {
      /**
       * Stores the settings for all ESComplexProject plugins.
       * @type {object}
       */
      this.settings = ev.data.settings;
   }

   // Project metrics calculation -----------------------------------------------------------------------------------

   /**
    * adjacencyToDistMatrix
    *
    * @param {Array} matrix -
    *
    * @returns {Array}
    * @private
    */
   _adjacencyToDistMatrix(matrix)
   {
      const distMatrix = [];
      let i, j, value;
      for (i = 0; i < matrix.length; i += 1)
      {
         distMatrix.push([]);
         for (j = 0; j < matrix[i].length; j += 1)
         {
            // if i !== j and matrix value is undefined set distance to Infinity.
            value = i === j ? 1 : matrix[i][j] || Infinity;

            distMatrix[i][j] = value;
         }
      }
      return distMatrix;
   }

   /**
    * calculateAverages
    *
    * @param {object}   results - The ESComplexProject results data.
    *
    * @private
    */
   _calculateAverages(results)
   {
      let divisor;

      const sums = {
         loc: 0,
         cyclomatic: 0,
         effort: 0,
         params: 0,
         maintainability: 0
      };

      if (results.reports.length === 0) { divisor = 1; }
      else { divisor = results.reports.length; }

      results.reports.forEach((report) =>
      {
         Object.keys(sums).forEach((key) => { sums[key] += report[key]; });
      });

      Object.keys(sums).forEach((key) =>
      {
         results[key] = sums[key] / divisor;
      });
   }

   /**
    * checkDependency
    *
    * @param {string}   from -
    * @param {object}   dependency -
    * @param {string}   to -
    *
    * @returns {*}
    * @private
    */
   _checkDependency(from, dependency, to)
   {
      // Handle CJS dependencies
      if (dependency.type === 'cjs')
      {
         if (this._isInternalCommonJSDependency(dependency)) { return this._isDependency(from, dependency, to); }

         return false;
      }

      return this._isDependency(from, dependency, to);
   }

   /**
    * Compares two numbers.
    *
    * @param {number}   lhs - Left-hand side.
    * @param {number}   rhs - Right-hand side.
    *
    * @returns {number}
    * @private
    */
   _compareNumbers(lhs, rhs)
   {
      return lhs < rhs ? -1 : lhs > rhs ? 1 : 0;
   }

   /**
    * Compares two paths.
    *
    * @param {string}   lhs - Left-hand side.
    * @param {string}   rhs - Right-hand side.
    *
    * @returns {number}
    * @private
    */
   _comparePaths(lhs, rhs)
   {
      const lsplit = lhs.split(path.sep);
      const rsplit = rhs.split(path.sep);

      if (lsplit.length < rsplit.length || (lsplit.length === rsplit.length && lhs < rhs)) { return -1; }

      if (lsplit.length > rsplit.length || (lsplit.length === rsplit.length && lhs > rhs)) { return 1; }

      return 0;
   }

   /**
    * createAdjacencyMatrix
    *
    * @param {object}   results - The ESComplexProject results data.
    *
    * @private
    */
   _createAdjacencyMatrix(results)
   {
      const adjacencyMatrix = new Array(results.reports.length);
      let density = 0;

      results.reports.sort((lhs, rhs) => { return this._comparePaths(lhs.path, rhs.path); }).forEach((ignore, x) =>
      {
         adjacencyMatrix[x] = new Array(results.reports.length);
         results.reports.forEach((ignore, y) =>
         {
            adjacencyMatrix[x][y] = this._getAdjacencyMatrixValue(results.reports, x, y);
            if (adjacencyMatrix[x][y] === 1)
            {
               density += 1;
            }
         });
      });

      results.adjacencyMatrix = adjacencyMatrix;
      results.firstOrderDensity = this._percentifyDensity(density, adjacencyMatrix);
   }


   /**
    * Implementation of Floyd Warshall algorithm for calculating visibility matrix in O(n^3) instead of O(n^4) with
    * successive raising of powers.
    *
    * @param {object}   results - The ESComplexProject results data.
    *
    * @private
    */
   _createVisibilityMatrix(results)
   {
      let changeCost = 0, i, j, k, visibilityMatrix;

      visibilityMatrix = this._adjacencyToDistMatrix(results.adjacencyMatrix);
      const matrixLen = visibilityMatrix.length;

      for (k = 0; k < matrixLen; k += 1)
      {
         for (i = 0; i < matrixLen; i += 1)
         {
            for (j = 0; j < matrixLen; j += 1)
            {
               if (visibilityMatrix[i][j] > visibilityMatrix[i][k] + visibilityMatrix[k][j])
               {
                  visibilityMatrix[i][j] = visibilityMatrix[i][k] + visibilityMatrix[k][j];
               }
            }
         }
      }

      // convert back from a distance matrix to adjacency matrix, while also calculating change cost
      visibilityMatrix = visibilityMatrix.map((row, rowIndex) =>
      {
         return row.map((value, columnIndex) =>
         {
            if (value < Infinity)
            {
               changeCost += 1;

               if (columnIndex !== rowIndex)
               {
                  return 1;
               }
            }

            return 0;
         });
      });

      results.visibilityMatrix = visibilityMatrix;
      results.changeCost = this._percentifyDensity(changeCost, visibilityMatrix);
   }

   /**
    * doesDependencyExist
    *
    * @param {object}   from -
    * @param {object}   to -
    *
    * @returns {*}
    * @private
    */
   _doesDependencyExist(from, to)
   {
      return from.dependencies.reduce((result, dependency) =>
      {
         if (result === false) { return this._checkDependency(from.path, dependency, to.path); }

         return true;
      }, false);
   }

   /**
    * getAdjacencyMatrixValue
    *
    * @param {object}   reports - The ESComplexModule reports data.
    * @param {number}   x -
    * @param {number}   y -
    *
    * @returns {number}
    * @private
    */
   _getAdjacencyMatrixValue(reports, x, y)
   {
      if (x === y) { return 0; }

      if (this._doesDependencyExist(reports[x], reports[y])) { return 1; }

      return 0;
   }

   /**
    * Gets the median value from the given array after sorting.
    *
    * @param {Array<number>}  values -
    *
    * @returns {number}
    * @private
    */
   _getMedian(values)
   {
      values.sort(this._compareNumbers);

      // Checks of values.length is odd.
      if (values.length % 2) { return values[(values.length - 1) / 2]; }

      return (values[(values.length - 2) / 2] + values[values.length / 2]) / 2;
   }

   /**
    * isDependency
    *
    * @param {string}   from -
    * @param {object}   dependency -
    * @param {string}   to -
    *
    * @returns {boolean}
    * @private
    */
   _isDependency(from, dependency, to)
   {
      let dependencyPath = dependency.path;

      if (path.extname(dependencyPath) === '') { dependencyPath += path.extname(to); }

      return path.resolve(path.dirname(from), dependencyPath) === to;
   }

   /**
    * isInternalCommonJSDependency
    *
    * @param {object}   dependency -
    *
    * @returns {boolean}
    * @private
    */
   _isInternalCommonJSDependency(dependency)
   {
      return dependency.path[0] === '.' &&
       (dependency.path[1] === path.sep || (dependency.path[1] === '.' && dependency.path[2] === path.sep));
   }

   /**
    * percentify
    *
    * @param {number}   value -
    * @param {number}   limit -
    *
    * @returns {number}
    * @private
    */
   _percentify(value, limit)
   {
      return limit === 0 ? 0 : (value / limit) * 100;
   }

   /**
    * percentifyDensity
    *
    * @param {number}   density -
    * @param {Array}    matrix -
    *
    * @returns {number}
    * @private
    */
   _percentifyDensity(density, matrix)
   {
      return this._percentify(density, matrix.length * matrix.length);
   }

   /**
    * Calculates core size.
    *
    * @param {object}   results - The ESComplexProject results data.
    *
    * @private
    */
   _setCoreSize(results)
   {
      if (results.firstOrderDensity === 0)
      {
         results.coreSize = 0;
         return;
      }

      const fanIn = new Array(results.visibilityMatrix.length);
      const fanOut = new Array(results.visibilityMatrix.length);
      const boundaries = {};
      let coreSize = 0;

      results.visibilityMatrix.forEach((row, rowIndex) =>
      {
         fanIn[rowIndex] = row.reduce((sum, value, valueIndex) =>
         {
            if (rowIndex === 0) { fanOut[valueIndex] = value; }
            else { fanOut[valueIndex] += value; }

            return sum + value;
         }, 0);
      });

      // Boundary values can also be chosen by looking for discontinuity in the
      // distribution of values, but I've chosen the median to keep it simple.
      boundaries.fanIn = this._getMedian(fanIn.slice());
      boundaries.fanOut = this._getMedian(fanOut.slice());

      results.visibilityMatrix.forEach((ignore, index) =>
      {
         if (fanIn[index] >= boundaries.fanIn && fanOut[index] >= boundaries.fanOut) { coreSize += 1; }
      });

      results.coreSize = this._percentify(coreSize, results.visibilityMatrix.length);
   }
}
