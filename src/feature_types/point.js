'use strict';

var Feature = require('./feature');

var Point = function Point(ctx, geojson) {
  Feature.call(this, ctx, geojson);
};

Point.prototype = Object.create(Feature.prototype);

Point.prototype.isValid = function () {
  return typeof this.coordinates[0] === 'number' && typeof this.coordinates[1] === 'number';
};

Point.prototype.updateCoordinate = function (pathOrLng, lngOrLat, lat) {
  if (arguments.length === 3) {
    this.coordinates = [lngOrLat, lat];
  } else {
    this.coordinates = [pathOrLng, lngOrLat];
  }
  this.changed();
};

Point.prototype.getCoordinate = function () {
  return this.getCoordinates();
};

module.exports = Point;