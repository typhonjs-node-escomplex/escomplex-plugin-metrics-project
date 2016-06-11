'use strict';

Object.defineProperty(exports, "__esModule", {
   value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Provides default project metrics gathering and calculation.
 */

var PluginMetricsProject = function () {
   function PluginMetricsProject() {
      _classCallCheck(this, PluginMetricsProject);
   }

   _createClass(PluginMetricsProject, [{
      key: 'onConfigure',
      value: function onConfigure(ev) {
         ev.data.settings.noCoreSize = typeof ev.data.options.noCoreSize === 'boolean' ? ev.data.options.noCoreSize : false;
      }
   }, {
      key: 'onProjectEnd',
      value: function onProjectEnd(ev) {
         this.createAdjacencyMatrix(ev.data.results);
         if (!this.settings.noCoreSize) {
            this.createVisibilityMatrix(ev.data.results);
            this.setCoreSize(ev.data.results);
         }

         this.calculateAverages(ev.data.results);
      }
   }, {
      key: 'onProjectStart',
      value: function onProjectStart(ev) {
         this.settings = ev.data.settings;
      }
   }, {
      key: 'createAdjacencyMatrix',
      value: function createAdjacencyMatrix(result) {
         var _this = this;

         var adjacencyMatrix = new Array(result.reports.length);
         var density = 0;

         result.reports.sort(function (lhs, rhs) {
            return _this.comparePaths(lhs.path, rhs.path);
         }).forEach(function (ignore, x) {
            adjacencyMatrix[x] = new Array(result.reports.length);
            result.reports.forEach(function (ignore, y) {
               adjacencyMatrix[x][y] = _this.getAdjacencyMatrixValue(result.reports, x, y);
               if (adjacencyMatrix[x][y] === 1) {
                  density += 1;
               }
            });
         });

         result.adjacencyMatrix = adjacencyMatrix;
         result.firstOrderDensity = this.percentifyDensity(density, adjacencyMatrix);
      }
   }, {
      key: 'comparePaths',
      value: function comparePaths(lhs, rhs) {
         var lsplit = lhs.split(_path2.default.sep);
         var rsplit = rhs.split(_path2.default.sep);

         if (lsplit.length < rsplit.length || lsplit.length === rsplit.length && lhs < rhs) {
            return -1;
         }

         if (lsplit.length > rsplit.length || lsplit.length === rsplit.length && lhs > rhs) {
            return 1;
         }

         return 0;
      }
   }, {
      key: 'getAdjacencyMatrixValue',
      value: function getAdjacencyMatrixValue(reports, x, y) {
         if (x === y) {
            return 0;
         }

         if (this.doesDependencyExist(reports[x], reports[y])) {
            return 1;
         }

         return 0;
      }
   }, {
      key: 'doesDependencyExist',
      value: function doesDependencyExist(from, to) {
         var _this2 = this;

         return from.dependencies.reduce(function (result, dependency) {
            if (result === false) {
               return _this2.checkDependency(from.path, dependency, to.path);
            }

            return true;
         }, false);
      }
   }, {
      key: 'checkDependency',
      value: function checkDependency(from, dependency, to) {
         if (this.isCommonJSDependency(dependency)) {
            if (this.isInternalCommonJSDependency(dependency)) {
               return this.isDependency(from, dependency, to);
            }

            return false;
         }

         return this.isDependency(from, dependency, to);
      }
   }, {
      key: 'isCommonJSDependency',
      value: function isCommonJSDependency(dependency) {
         return dependency.type === 'cjs';
      }
   }, {
      key: 'isInternalCommonJSDependency',
      value: function isInternalCommonJSDependency(dependency) {
         return dependency.path[0] === '.' && (dependency.path[1] === _path2.default.sep || dependency.path[1] === '.' && dependency.path[2] === _path2.default.sep);
      }
   }, {
      key: 'isDependency',
      value: function isDependency(from, dependency, to) {
         var dependencyPath = dependency.path;

         if (_path2.default.extname(dependencyPath) === '') {
            dependencyPath += _path2.default.extname(to);
         }

         return _path2.default.resolve(_path2.default.dirname(from), dependencyPath) === to;
      }
   }, {
      key: 'percentifyDensity',
      value: function percentifyDensity(density, matrix) {
         return this.percentify(density, matrix.length * matrix.length);
      }
   }, {
      key: 'percentify',
      value: function percentify(value, limit) {
         if (limit === 0) {
            return 0;
         }

         return value / limit * 100;
      }

      // implementation of floydWarshall alg for calculating visibility matrix in O(n^3) instead of O(n^4) with successive
      // raising of powers

   }, {
      key: 'createVisibilityMatrix',
      value: function createVisibilityMatrix(result) {
         var changeCost = 0,
             i = void 0,
             j = void 0,
             k = void 0,
             visibilityMatrix = void 0;

         visibilityMatrix = this.adjacencyToDistMatrix(result.adjacencyMatrix);
         var matrixLen = visibilityMatrix.length;

         for (k = 0; k < matrixLen; k += 1) {
            for (i = 0; i < matrixLen; i += 1) {
               for (j = 0; j < matrixLen; j += 1) {
                  if (visibilityMatrix[i][j] > visibilityMatrix[i][k] + visibilityMatrix[k][j]) {
                     visibilityMatrix[i][j] = visibilityMatrix[i][k] + visibilityMatrix[k][j];
                  }
               }
            }
         }

         // convert back from a distance matrix to adjacency matrix, while also calculating change cost
         visibilityMatrix = visibilityMatrix.map(function (row, rowIndex) {
            return row.map(function (value, columnIndex) {
               if (value < Infinity) {
                  changeCost += 1;

                  if (columnIndex !== rowIndex) {
                     return 1;
                  }
               }

               return 0;
            });
         });

         result.visibilityMatrix = visibilityMatrix;
         result.changeCost = this.percentifyDensity(changeCost, visibilityMatrix);
      }
   }, {
      key: 'adjacencyToDistMatrix',
      value: function adjacencyToDistMatrix(matrix) {
         var distMatrix = [];
         var i = void 0,
             j = void 0,
             value = void 0;
         for (i = 0; i < matrix.length; i += 1) {
            distMatrix.push([]);
            for (j = 0; j < matrix[i].length; j += 1) {
               value = null;
               if (i === j) {
                  value = 1;
               } else {
                  // where we have 0, set distance to Infinity
                  value = matrix[i][j] || Infinity;
               }
               distMatrix[i][j] = value;
            }
         }
         return distMatrix;
      }
   }, {
      key: 'setCoreSize',
      value: function setCoreSize(result) {
         if (result.firstOrderDensity === 0) {
            result.coreSize = 0;
            return;
         }

         var fanIn = new Array(result.visibilityMatrix.length);
         var fanOut = new Array(result.visibilityMatrix.length);
         var boundaries = {};
         var coreSize = 0;

         result.visibilityMatrix.forEach(function (row, rowIndex) {
            fanIn[rowIndex] = row.reduce(function (sum, value, valueIndex) {
               if (rowIndex === 0) {
                  fanOut[valueIndex] = value;
               } else {
                  fanOut[valueIndex] += value;
               }

               return sum + value;
            }, 0);
         });

         // Boundary values can also be chosen by looking for discontinuity in the
         // distribution of values, but I've chosen the median to keep it simple.
         boundaries.fanIn = this.getMedian(fanIn.slice());
         boundaries.fanOut = this.getMedian(fanOut.slice());

         result.visibilityMatrix.forEach(function (ignore, index) {
            if (fanIn[index] >= boundaries.fanIn && fanOut[index] >= boundaries.fanOut) {
               coreSize += 1;
            }
         });

         result.coreSize = this.percentify(coreSize, result.visibilityMatrix.length);
      }
   }, {
      key: 'getMedian',
      value: function getMedian(values) {
         values.sort(this.compareNumbers);

         // Checks of values.length is odd.
         if (values.length % 2) {
            return values[(values.length - 1) / 2];
         }

         return (values[(values.length - 2) / 2] + values[values.length / 2]) / 2;
      }
   }, {
      key: 'compareNumbers',
      value: function compareNumbers(lhs, rhs) {
         if (lhs < rhs) {
            return -1;
         }
         if (lhs > rhs) {
            return 1;
         }
         return 0;
      }
   }, {
      key: 'calculateAverages',
      value: function calculateAverages(result) {
         var divisor = void 0;

         var sums = {
            loc: 0,
            cyclomatic: 0,
            effort: 0,
            params: 0,
            maintainability: 0
         };

         if (result.reports.length === 0) {
            divisor = 1;
         } else {
            divisor = result.reports.length;
         }

         result.reports.forEach(function (report) {
            Object.keys(sums).forEach(function (key) {
               sums[key] += report[key];
            });
         });

         Object.keys(sums).forEach(function (key) {
            result[key] = sums[key] / divisor;
         });
      }
   }]);

   return PluginMetricsProject;
}();

exports.default = PluginMetricsProject;
module.exports = exports['default'];