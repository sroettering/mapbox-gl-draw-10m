'use strict';

var _require = require('../lib/common_selectors'),
    noTarget = _require.noTarget,
    isOfMetaType = _require.isOfMetaType,
    isInactiveFeature = _require.isInactiveFeature,
    isShiftDown = _require.isShiftDown;

var createSupplementaryPoints = require('../lib/create_supplementary_points');
var constrainFeatureMovement = require('../lib/constrain_feature_movement');
var doubleClickZoom = require('../lib/double_click_zoom');
var Constants = require('../constants');
var CommonSelectors = require('../lib/common_selectors');
var moveFeatures = require('../lib/move_features');

var isVertex = isOfMetaType(Constants.meta.VERTEX);
var isMidpoint = isOfMetaType(Constants.meta.MIDPOINT);

module.exports = function (ctx, opts) {
  var featureId = opts.featureId;
  var feature = ctx.store.get(featureId);

  if (!feature) {
    throw new Error('You must provide a featureId to enter direct_select mode');
  }

  if (feature.type === Constants.geojsonTypes.POINT) {
    throw new TypeError('direct_select mode doesn\'t handle point features');
  }

  var dragMoveLocation = opts.startPos || null;
  var dragMoving = false;
  var canDragMove = false;

  var selectedCoordPaths = opts.coordPath ? [opts.coordPath] : [];
  var selectedCoordinates = pathsToCoordinates(featureId, selectedCoordPaths);
  ctx.store.setSelectedCoordinates(selectedCoordinates);

  var fireUpdate = function fireUpdate() {
    ctx.map.fire(Constants.events.UPDATE, {
      action: Constants.updateActions.CHANGE_COORDINATES,
      features: ctx.store.getSelected().map(function (f) {
        return f.toGeoJSON();
      })
    });
  };

  var fireActionable = function fireActionable() {
    return ctx.events.actionable({
      combineFeatures: false,
      uncombineFeatures: false,
      trash: selectedCoordPaths.length > 0
    });
  };

  var startDragging = function startDragging(e) {
    ctx.map.dragPan.disable();
    canDragMove = true;
    dragMoveLocation = e.lngLat;
  };

  var stopDragging = function stopDragging() {
    ctx.map.dragPan.enable();
    dragMoving = false;
    canDragMove = false;
    dragMoveLocation = null;
  };

  var onVertex = function onVertex(e) {
    startDragging(e);
    var about = e.featureTarget.properties;
    var selectedIndex = selectedCoordPaths.indexOf(about.coord_path);
    if (!isShiftDown(e) && selectedIndex === -1) {
      selectedCoordPaths = [about.coord_path];
    } else if (isShiftDown(e) && selectedIndex === -1) {
      selectedCoordPaths.push(about.coord_path);
    }
    var selectedCoordinates = pathsToCoordinates(featureId, selectedCoordPaths);
    ctx.store.setSelectedCoordinates(selectedCoordinates);
    feature.changed();
  };

  var onMidpoint = function onMidpoint(e) {
    startDragging(e);
    var about = e.featureTarget.properties;
    feature.addCoordinate(about.coord_path, about.lng, about.lat);
    fireUpdate();
    selectedCoordPaths = [about.coord_path];
  };

  function pathsToCoordinates(featureId, paths) {
    return paths.map(function (coord_path) {
      return { feature_id: featureId, coord_path: coord_path };
    });
  }

  var onFeature = function onFeature(e) {
    if (selectedCoordPaths.length === 0) startDragging(e);else stopDragging();
  };

  var dragFeature = function dragFeature(e, delta) {
    moveFeatures(ctx.store.getSelected(), delta);
    dragMoveLocation = e.lngLat;
  };

  var dragVertex = function dragVertex(e, delta) {
    var selectedCoords = selectedCoordPaths.map(function (coord_path) {
      return feature.getCoordinate(coord_path);
    });
    var selectedCoordPoints = selectedCoords.map(function (coords) {
      return {
        type: Constants.geojsonTypes.FEATURE,
        properties: {},
        geometry: {
          type: Constants.geojsonTypes.POINT,
          coordinates: coords
        }
      };
    });

    var constrainedDelta = constrainFeatureMovement(selectedCoordPoints, delta);
    for (var i = 0; i < selectedCoords.length; i++) {
      var coord = selectedCoords[i];
      feature.updateCoordinate(selectedCoordPaths[i], coord[0] + constrainedDelta.lng, coord[1] + constrainedDelta.lat);
    }
  };

  return {
    start: function start() {
      ctx.store.setSelected(featureId);
      doubleClickZoom.disable(ctx);

      // On mousemove that is not a drag, stop vertex movement.
      this.on('mousemove', CommonSelectors.true, function (e) {
        var isFeature = CommonSelectors.isActiveFeature(e);
        var onVertex = isVertex(e);
        var noCoords = selectedCoordPaths.length === 0;
        if (isFeature && noCoords) ctx.ui.queueMapClasses({ mouse: Constants.cursors.MOVE });else if (onVertex && !noCoords) ctx.ui.queueMapClasses({ mouse: Constants.cursors.MOVE });else ctx.ui.queueMapClasses({ mouse: Constants.cursors.NONE });
        stopDragging(e);
      });

      // As soon as you mouse leaves the canvas, update the feature
      this.on('mouseout', function () {
        return dragMoving;
      }, fireUpdate);

      this.on('mousedown', isVertex, onVertex);
      this.on('touchstart', isVertex, onVertex);
      this.on('mousedown', CommonSelectors.isActiveFeature, onFeature);
      this.on('touchstart', CommonSelectors.isActiveFeature, onFeature);
      this.on('mousedown', isMidpoint, onMidpoint);
      this.on('touchstart', isMidpoint, onMidpoint);
      this.on('drag', function () {
        return canDragMove;
      }, function (e) {
        dragMoving = true;
        e.originalEvent.stopPropagation();

        var delta = {
          lng: e.lngLat.lng - dragMoveLocation.lng,
          lat: e.lngLat.lat - dragMoveLocation.lat
        };
        if (selectedCoordPaths.length > 0) dragVertex(e, delta);else dragFeature(e, delta);

        dragMoveLocation = e.lngLat;
      });
      this.on('click', CommonSelectors.true, stopDragging);
      this.on('mouseup', CommonSelectors.true, function () {
        if (dragMoving) {
          fireUpdate();
        }
        stopDragging();
      });
      this.on('touchend', CommonSelectors.true, function () {
        if (dragMoving) {
          fireUpdate();
        }
        stopDragging();
      });
      this.on('click', noTarget, clickNoTarget);
      this.on('tap', noTarget, clickNoTarget);
      this.on('click', isInactiveFeature, clickInactive);
      this.on('tap', isInactiveFeature, clickInactive);
      this.on('click', CommonSelectors.isActiveFeature, clickActiveFeature);
      this.on('tap', CommonSelectors.isActiveFeature, clickActiveFeature);

      function clickNoTarget() {
        ctx.events.changeMode(Constants.modes.SIMPLE_SELECT);
      }
      function clickInactive() {
        ctx.events.changeMode(Constants.modes.SIMPLE_SELECT);
      }
      function clickActiveFeature() {
        selectedCoordPaths = [];
        ctx.store.clearSelectedCoordinates();
        feature.changed();
      }
    },
    stop: function stop() {
      doubleClickZoom.enable(ctx);
      ctx.store.clearSelectedCoordinates();
    },
    render: function render(geojson, push) {
      if (featureId === geojson.properties.id) {
        geojson.properties.active = Constants.activeStates.ACTIVE;
        push(geojson);
        createSupplementaryPoints(geojson, {
          map: ctx.map,
          midpoints: true,
          selectedPaths: selectedCoordPaths
        }).forEach(push);
      } else {
        geojson.properties.active = Constants.activeStates.INACTIVE;
        push(geojson);
      }
      fireActionable();
    },
    trash: function trash() {
      selectedCoordPaths.sort().reverse().forEach(function (id) {
        return feature.removeCoordinate(id);
      });
      ctx.map.fire(Constants.events.UPDATE, {
        action: Constants.updateActions.CHANGE_COORDINATES,
        features: ctx.store.getSelected().map(function (f) {
          return f.toGeoJSON();
        })
      });
      selectedCoordPaths = [];
      ctx.store.clearSelectedCoordinates();
      fireActionable();
      if (feature.isValid() === false) {
        ctx.store.delete([featureId]);
        ctx.events.changeMode(Constants.modes.SIMPLE_SELECT, {});
      }
    }
  };
};