'use strict';

var sortFeatures = require('./sort_features');
var mapEventToBoundingBox = require('./map_event_to_bounding_box');
var Constants = require('../constants');
var StringSet = require('./string_set');

var META_TYPES = [Constants.meta.FEATURE, Constants.meta.MIDPOINT, Constants.meta.VERTEX];

// Requires either event or bbox
module.exports = {
  click: featuresAtClick,
  touch: featuresAtTouch
};

function featuresAtClick(event, bbox, ctx) {
  return featuresAt(event, bbox, ctx, ctx.options.clickBuffer);
}

function featuresAtTouch(event, bbox, ctx) {
  return featuresAt(event, bbox, ctx, ctx.options.touchBuffer);
}

function featuresAt(event, bbox, ctx, buffer) {
  if (ctx.map === null) return [];

  var box = event ? mapEventToBoundingBox(event, buffer) : bbox;

  var queryParams = {};
  if (ctx.options.styles) queryParams.layers = ctx.options.styles.map(function (s) {
    return s.id;
  });

  var features = ctx.map.queryRenderedFeatures(box, queryParams).filter(function (feature) {
    return META_TYPES.indexOf(feature.properties.meta) !== -1;
  });

  var featureIds = new StringSet();
  var uniqueFeatures = [];
  features.forEach(function (feature) {
    var featureId = feature.properties.id;
    if (featureIds.has(featureId)) return;
    featureIds.add(featureId);
    uniqueFeatures.push(feature);
  });

  return sortFeatures(uniqueFeatures);
}