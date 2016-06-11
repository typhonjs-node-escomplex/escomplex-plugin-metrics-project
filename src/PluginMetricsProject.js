'use strict';

import path from 'path';

/**
 * Provides default project metrics gathering and calculation.
 */
export default class PluginMetricsProject
{
   onConfigure(ev)
   {
      ev.data.settings.noCoreSize = typeof ev.data.options.noCoreSize === 'boolean' ?
       ev.data.options.noCoreSize : false;
   }

   onProjectEnd(ev)
   {
      this.createAdjacencyMatrix(ev.data.results);
      if (!this.settings.noCoreSize)
      {
         this.createVisibilityMatrix(ev.data.results);
         this.setCoreSize(ev.data.results);
      }

      this.calculateAverages(ev.data.results);
   }

   onProjectStart(ev)
   {
      this.settings = ev.data.settings;
   }

   createAdjacencyMatrix(result)
   {
      const adjacencyMatrix = new Array(result.reports.length);
      let density = 0;

      result.reports.sort((lhs, rhs) => { return this.comparePaths(lhs.path, rhs.path); }).forEach((ignore, x) =>
      {
         adjacencyMatrix[x] = new Array(result.reports.length);
         result.reports.forEach((ignore, y) =>
         {
            adjacencyMatrix[x][y] = this.getAdjacencyMatrixValue(result.reports, x, y);
            if (adjacencyMatrix[x][y] === 1)
            {
               density += 1;
            }
         });
      });

      result.adjacencyMatrix = adjacencyMatrix;
      result.firstOrderDensity = this.percentifyDensity(density, adjacencyMatrix);
   }

   comparePaths(lhs, rhs)
   {
      const lsplit = lhs.split(path.sep);
      const rsplit = rhs.split(path.sep);

      if (lsplit.length < rsplit.length || (lsplit.length === rsplit.length && lhs < rhs)) { return -1; }

      if (lsplit.length > rsplit.length || (lsplit.length === rsplit.length && lhs > rhs)) { return 1; }

      return 0;
   }

   getAdjacencyMatrixValue(reports, x, y)
   {
      if (x === y) { return 0; }

      if (this.doesDependencyExist(reports[x], reports[y])) { return 1; }

      return 0;
   }

   doesDependencyExist(from, to)
   {
      return from.dependencies.reduce((result, dependency) =>
      {
         if (result === false) { return this.checkDependency(from.path, dependency, to.path); }

         return true;
      }, false);
   }

   checkDependency(from, dependency, to)
   {
      if (this.isCommonJSDependency(dependency))
      {
         if (this.isInternalCommonJSDependency(dependency)) { return this.isDependency(from, dependency, to); }

         return false;
      }

      return this.isDependency(from, dependency, to);
   }

   isCommonJSDependency(dependency)
   {
      return dependency.type === 'cjs';
   }

   isInternalCommonJSDependency(dependency)
   {
      return dependency.path[0] === '.' &&
       (dependency.path[1] === path.sep || (dependency.path[1] === '.' && dependency.path[2] === path.sep));
   }

   isDependency(from, dependency, to)
   {
      let dependencyPath = dependency.path;

      if (path.extname(dependencyPath) === '') { dependencyPath += path.extname(to); }

      return path.resolve(path.dirname(from), dependencyPath) === to;
   }

   percentifyDensity(density, matrix)
   {
      return this.percentify(density, matrix.length * matrix.length);
   }

   percentify(value, limit)
   {
      if (limit === 0) { return 0; }

      return (value / limit) * 100;
   }

   // implementation of floydWarshall alg for calculating visibility matrix in O(n^3) instead of O(n^4) with successive
   // raising of powers
   createVisibilityMatrix(result)
   {
      let changeCost = 0, i, j, k, visibilityMatrix;

      visibilityMatrix = this.adjacencyToDistMatrix(result.adjacencyMatrix);
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

      result.visibilityMatrix = visibilityMatrix;
      result.changeCost = this.percentifyDensity(changeCost, visibilityMatrix);
   }

   adjacencyToDistMatrix(matrix)
   {
      const distMatrix = [];
      let i, j, value;
      for (i = 0; i < matrix.length; i += 1)
      {
         distMatrix.push([]);
         for (j = 0; j < matrix[i].length; j += 1)
         {
            value = null;
            if (i === j)
            {
               value = 1;
            }
            else
            {
               // where we have 0, set distance to Infinity
               value = matrix[i][j] || Infinity;
            }
            distMatrix[i][j] = value;
         }
      }
      return distMatrix;
   }

   setCoreSize(result)
   {
      if (result.firstOrderDensity === 0)
      {
         result.coreSize = 0;
         return;
      }

      const fanIn = new Array(result.visibilityMatrix.length);
      const fanOut = new Array(result.visibilityMatrix.length);
      const boundaries = {};
      let coreSize = 0;

      result.visibilityMatrix.forEach((row, rowIndex) =>
      {
         fanIn[rowIndex] = row.reduce((sum, value, valueIndex) =>
         {
            if (rowIndex === 0)
            {
               fanOut[valueIndex] = value;
            }
            else
            {
               fanOut[valueIndex] += value;
            }

            return sum + value;
         }, 0);
      });

      // Boundary values can also be chosen by looking for discontinuity in the
      // distribution of values, but I've chosen the median to keep it simple.
      boundaries.fanIn = this.getMedian(fanIn.slice());
      boundaries.fanOut = this.getMedian(fanOut.slice());

      result.visibilityMatrix.forEach((ignore, index) =>
      {
         if (fanIn[index] >= boundaries.fanIn && fanOut[index] >= boundaries.fanOut)
         {
            coreSize += 1;
         }
      });

      result.coreSize = this.percentify(coreSize, result.visibilityMatrix.length);
   }

   getMedian(values)
   {
      values.sort(this.compareNumbers);

      // Checks of values.length is odd.
      if (values.length % 2)
      {
         return values[(values.length - 1) / 2];
      }

      return (values[(values.length - 2) / 2] + values[values.length / 2]) / 2;
   }

   compareNumbers(lhs, rhs)
   {
      if (lhs < rhs) { return -1; }
      if (lhs > rhs) { return 1; }
      return 0;
   }

   calculateAverages(result)
   {
      let divisor;

      const sums = {
         loc: 0,
         cyclomatic: 0,
         effort: 0,
         params: 0,
         maintainability: 0
      };

      if (result.reports.length === 0) { divisor = 1; }
      else { divisor = result.reports.length; }

      result.reports.forEach((report) =>
      {
         Object.keys(sums).forEach((key) => { sums[key] += report[key]; });
      });

      Object.keys(sums).forEach((key) =>
      {
         result[key] = sums[key] / divisor;
      });
   }
}
