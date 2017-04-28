'use strict';

var euclideanDistance = require('./euclidean_distance');

var FINE_TOLERANCE = 4;
var GROSS_TOLERANCE = 12;
var INTERVAL = 500;

module.exports = function isClick(start, end) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  var fineTolerance = options.fineTolerance != null ? options.fineTolerance : FINE_TOLERANCE;
  var grossTolerance = options.grossTolerance != null ? options.grossTolerance : GROSS_TOLERANCE;
  var interval = options.interval != null ? options.interval : INTERVAL;

  start.point = start.point || end.point;
  start.time = start.time || end.time;
  var moveDistance = euclideanDistance(start.point, end.point);

  return moveDistance < fineTolerance || moveDistance < grossTolerance && end.time - start.time < interval;
};