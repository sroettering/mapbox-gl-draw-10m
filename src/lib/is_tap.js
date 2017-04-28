'use strict';

var euclideanDistance = require('./euclidean_distance');

var TOLERANCE = 25;
var INTERVAL = 250;

module.exports = function isTap(start, end) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  var tolerance = options.tolerance != null ? options.tolerance : TOLERANCE;
  var interval = options.interval != null ? options.interval : INTERVAL;

  start.point = start.point || end.point;
  start.time = start.time || end.time;
  var moveDistance = euclideanDistance(start.point, end.point);

  return moveDistance < tolerance && end.time - start.time < interval;
};