'use strict';

var CommonSelectors = require('../lib/common_selectors');
var Point = require('../feature_types/point');
var Constants = require('../constants');

module.exports = function (ctx) {

  var point = new Point(ctx, {
    type: Constants.geojsonTypes.FEATURE,
    properties: {},
    geometry: {
      type: Constants.geojsonTypes.POINT,
      coordinates: []
    }
  });

  if (ctx._test) ctx._test.point = point;

  ctx.store.add(point);

  function stopDrawingAndRemove() {
    ctx.events.changeMode(Constants.modes.SIMPLE_SELECT);
    ctx.store.delete([point.id], { silent: true });
  }

  function handleClick(e) {
    ctx.ui.queueMapClasses({ mouse: Constants.cursors.MOVE });
    point.updateCoordinate('', e.lngLat.lng, e.lngLat.lat);
    ctx.map.fire(Constants.events.CREATE, {
      features: [point.toGeoJSON()]
    });
    ctx.events.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [point.id] });
  }

  return {
    start: function start() {
      ctx.store.clearSelected();
      ctx.ui.queueMapClasses({ mouse: Constants.cursors.ADD });
      ctx.ui.setActiveButton(Constants.types.POINT);
      this.on('click', CommonSelectors.true, handleClick);
      this.on('tap', CommonSelectors.true, handleClick);
      this.on('keyup', CommonSelectors.isEscapeKey, stopDrawingAndRemove);
      this.on('keyup', CommonSelectors.isEnterKey, stopDrawingAndRemove);
      ctx.events.actionable({
        combineFeatures: false,
        uncombineFeatures: false,
        trash: true
      });
    },
    stop: function stop() {
      ctx.ui.setActiveButton();
      if (!point.getCoordinate().length) {
        ctx.store.delete([point.id], { silent: true });
      }
    },
    render: function render(geojson, callback) {
      var isActivePoint = geojson.properties.id === point.id;
      geojson.properties.active = isActivePoint ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
      if (!isActivePoint) return callback(geojson);
      // Never render the point we're drawing
    },
    trash: function trash() {
      stopDrawingAndRemove();
    }
  };
};