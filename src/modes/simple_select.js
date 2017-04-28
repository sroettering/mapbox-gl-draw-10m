'use strict';

var CommonSelectors = require('../lib/common_selectors');
var mouseEventPoint = require('../lib/mouse_event_point');
var featuresAt = require('../lib/features_at');
var createSupplementaryPoints = require('../lib/create_supplementary_points');
var StringSet = require('../lib/string_set');
var doubleClickZoom = require('../lib/double_click_zoom');
var moveFeatures = require('../lib/move_features');
var Constants = require('../constants');
var MultiFeature = require('../feature_types/multi_feature');

module.exports = function (ctx) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var dragMoveLocation = null;
  var boxSelectStartLocation = null;
  var boxSelectElement = void 0;
  var boxSelecting = false;
  var canBoxSelect = false;
  var dragMoving = false;
  var canDragMove = false;

  var initiallySelectedFeatureIds = options.featureIds || [];

  var fireUpdate = function fireUpdate() {
    ctx.map.fire(Constants.events.UPDATE, {
      action: Constants.updateActions.MOVE,
      features: ctx.store.getSelected().map(function (f) {
        return f.toGeoJSON();
      })
    });
  };

  var fireActionable = function fireActionable() {
    var selectedFeatures = ctx.store.getSelected();

    var multiFeatures = selectedFeatures.filter(function (feature) {
      return feature instanceof MultiFeature;
    });

    var combineFeatures = false;

    if (selectedFeatures.length > 1) {
      combineFeatures = true;
      var featureType = selectedFeatures[0].type.replace('Multi', '');
      selectedFeatures.forEach(function (feature) {
        if (feature.type.replace('Multi', '') !== featureType) {
          combineFeatures = false;
        }
      });
    }

    var uncombineFeatures = multiFeatures.length > 0;
    var trash = selectedFeatures.length > 0;

    ctx.events.actionable({
      combineFeatures: combineFeatures, uncombineFeatures: uncombineFeatures, trash: trash
    });
  };

  var getUniqueIds = function getUniqueIds(allFeatures) {
    if (!allFeatures.length) return [];
    var ids = allFeatures.map(function (s) {
      return s.properties.id;
    }).filter(function (id) {
      return id !== undefined;
    }).reduce(function (memo, id) {
      memo.add(id);
      return memo;
    }, new StringSet());

    return ids.values();
  };

  var stopExtendedInteractions = function stopExtendedInteractions() {
    if (boxSelectElement) {
      if (boxSelectElement.parentNode) boxSelectElement.parentNode.removeChild(boxSelectElement);
      boxSelectElement = null;
    }

    ctx.map.dragPan.enable();

    boxSelecting = false;
    canBoxSelect = false;
    dragMoving = false;
    canDragMove = false;
  };

  return {
    stop: function stop() {
      doubleClickZoom.enable(ctx);
    },
    start: function start() {
      // Select features that should start selected,
      // probably passed in from a `draw_*` mode
      if (ctx.store) {
        ctx.store.setSelected(initiallySelectedFeatureIds.filter(function (id) {
          return ctx.store.get(id) !== undefined;
        }));
        fireActionable();
      }

      // Any mouseup should stop box selecting and dragMoving
      this.on('mouseup', CommonSelectors.true, stopExtendedInteractions);

      // On mousemove that is not a drag, stop extended interactions.
      // This is useful if you drag off the canvas, release the button,
      // then move the mouse back over the canvas --- we don't allow the
      // interaction to continue then, but we do let it continue if you held
      // the mouse button that whole time
      this.on('mousemove', CommonSelectors.true, stopExtendedInteractions);

      // As soon as you mouse leaves the canvas, update the feature
      this.on('mouseout', function () {
        return dragMoving;
      }, fireUpdate);

      // Click (with or without shift) on no feature
      this.on('click', CommonSelectors.noTarget, clickAnywhere);
      this.on('tap', CommonSelectors.noTarget, clickAnywhere);

      // Click (with or without shift) on a vertex
      this.on('click', CommonSelectors.isOfMetaType(Constants.meta.VERTEX), clickOnVertex);
      this.on('tap', CommonSelectors.isOfMetaType(Constants.meta.VERTEX), clickOnVertex);

      function clickAnywhere() {
        var _this = this;

        // Clear the re-render selection
        var wasSelected = ctx.store.getSelectedIds();
        if (wasSelected.length) {
          ctx.store.clearSelected();
          wasSelected.forEach(function (id) {
            return _this.render(id);
          });
        }
        doubleClickZoom.enable(ctx);
        stopExtendedInteractions();
      }

      function clickOnVertex(e) {
        // Enter direct select mode
        ctx.events.changeMode(Constants.modes.DIRECT_SELECT, {
          featureId: e.featureTarget.properties.parent,
          coordPath: e.featureTarget.properties.coord_path,
          startPos: e.lngLat
        });
        ctx.ui.queueMapClasses({ mouse: Constants.cursors.MOVE });
      }

      // Mousedown on a selected feature
      this.on('mousedown', CommonSelectors.isActiveFeature, startOnActiveFeature);
      this.on('touchstart', CommonSelectors.isActiveFeature, startOnActiveFeature);

      function startOnActiveFeature(e) {
        // Stop any already-underway extended interactions
        stopExtendedInteractions();

        // Disable map.dragPan immediately so it can't start
        ctx.map.dragPan.disable();

        // Re-render it and enable drag move
        this.render(e.featureTarget.properties.id);

        // Set up the state for drag moving
        canDragMove = true;
        dragMoveLocation = e.lngLat;
      }

      // Click (with or without shift) on any feature
      this.on('click', CommonSelectors.isFeature, clickOnFeature);
      this.on('tap', CommonSelectors.isFeature, clickOnFeature);

      function clickOnFeature(e) {
        // Stop everything
        doubleClickZoom.disable(ctx);
        stopExtendedInteractions();

        var isShiftClick = CommonSelectors.isShiftDown(e);
        var selectedFeatureIds = ctx.store.getSelectedIds();
        var featureId = e.featureTarget.properties.id;
        var isFeatureSelected = ctx.store.isSelected(featureId);

        // Click (without shift) on any selected feature but a point
        if (!isShiftClick && isFeatureSelected && ctx.store.get(featureId).type !== Constants.geojsonTypes.POINT) {
          // Enter direct select mode
          return ctx.events.changeMode(Constants.modes.DIRECT_SELECT, {
            featureId: featureId
          });
        }

        // Shift-click on a selected feature
        if (isFeatureSelected && isShiftClick) {
          // Deselect it
          ctx.store.deselect(featureId);
          ctx.ui.queueMapClasses({ mouse: Constants.cursors.POINTER });
          if (selectedFeatureIds.length === 1) {
            doubleClickZoom.enable(ctx);
          }
          // Shift-click on an unselected feature
        } else if (!isFeatureSelected && isShiftClick) {
          // Add it to the selection
          ctx.store.select(featureId);
          ctx.ui.queueMapClasses({ mouse: Constants.cursors.MOVE });
          // Click (without shift) on an unselected feature
        } else if (!isFeatureSelected && !isShiftClick) {
          // Make it the only selected feature
          selectedFeatureIds.forEach(this.render);
          ctx.store.setSelected(featureId);
          ctx.ui.queueMapClasses({ mouse: Constants.cursors.MOVE });
        }

        // No matter what, re-render the clicked feature
        this.render(featureId);
      }

      // Dragging when drag move is enabled
      this.on('drag', function () {
        return canDragMove;
      }, function (e) {
        dragMoving = true;
        e.originalEvent.stopPropagation();

        var delta = {
          lng: e.lngLat.lng - dragMoveLocation.lng,
          lat: e.lngLat.lat - dragMoveLocation.lat
        };

        moveFeatures(ctx.store.getSelected(), delta);

        dragMoveLocation = e.lngLat;
      });

      // Mouseup, always
      this.on('mouseup', CommonSelectors.true, function (e) {
        // End any extended interactions
        if (dragMoving) {
          fireUpdate();
        } else if (boxSelecting) {
          var bbox = [boxSelectStartLocation, mouseEventPoint(e.originalEvent, ctx.container)];
          var featuresInBox = featuresAt.click(null, bbox, ctx);
          var idsToSelect = getUniqueIds(featuresInBox).filter(function (id) {
            return !ctx.store.isSelected(id);
          });

          if (idsToSelect.length) {
            ctx.store.select(idsToSelect);
            idsToSelect.forEach(this.render);
            ctx.ui.queueMapClasses({ mouse: Constants.cursors.MOVE });
          }
        }
        stopExtendedInteractions();
      });

      if (ctx.options.boxSelect) {
        // Shift-mousedown anywhere
        this.on('mousedown', CommonSelectors.isShiftMousedown, function (e) {
          stopExtendedInteractions();
          ctx.map.dragPan.disable();
          // Enable box select
          boxSelectStartLocation = mouseEventPoint(e.originalEvent, ctx.container);
          canBoxSelect = true;
        });

        // Drag when box select is enabled
        this.on('drag', function () {
          return canBoxSelect;
        }, function (e) {
          boxSelecting = true;
          ctx.ui.queueMapClasses({ mouse: Constants.cursors.ADD });

          // Create the box node if it doesn't exist
          if (!boxSelectElement) {
            boxSelectElement = document.createElement('div');
            boxSelectElement.classList.add(Constants.classes.BOX_SELECT);
            ctx.container.appendChild(boxSelectElement);
          }

          // Adjust the box node's width and xy position
          var current = mouseEventPoint(e.originalEvent, ctx.container);
          var minX = Math.min(boxSelectStartLocation.x, current.x);
          var maxX = Math.max(boxSelectStartLocation.x, current.x);
          var minY = Math.min(boxSelectStartLocation.y, current.y);
          var maxY = Math.max(boxSelectStartLocation.y, current.y);
          var translateValue = 'translate(' + minX + 'px, ' + minY + 'px)';
          boxSelectElement.style.transform = translateValue;
          boxSelectElement.style.WebkitTransform = translateValue;
          boxSelectElement.style.width = maxX - minX + 'px';
          boxSelectElement.style.height = maxY - minY + 'px';
        });
      }
    },
    render: function render(geojson, push) {
      geojson.properties.active = ctx.store.isSelected(geojson.properties.id) ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
      push(geojson);
      fireActionable();
      if (geojson.properties.active !== Constants.activeStates.ACTIVE || geojson.geometry.type === Constants.geojsonTypes.POINT) return;
      createSupplementaryPoints(geojson).forEach(push);
    },
    trash: function trash() {
      ctx.store.delete(ctx.store.getSelectedIds());
      fireActionable();
    },
    combineFeatures: function combineFeatures() {
      var selectedFeatures = ctx.store.getSelected();

      if (selectedFeatures.length === 0 || selectedFeatures.length < 2) return;

      var coordinates = [],
          featuresCombined = [];
      var featureType = selectedFeatures[0].type.replace('Multi', '');

      for (var i = 0; i < selectedFeatures.length; i++) {
        var feature = selectedFeatures[i];

        if (feature.type.replace('Multi', '') !== featureType) {
          return;
        }
        if (feature.type.includes('Multi')) {
          feature.getCoordinates().forEach(function (subcoords) {
            coordinates.push(subcoords);
          });
        } else {
          coordinates.push(feature.getCoordinates());
        }

        featuresCombined.push(feature.toGeoJSON());
      }

      if (featuresCombined.length > 1) {

        var multiFeature = new MultiFeature(ctx, {
          type: Constants.geojsonTypes.FEATURE,
          properties: featuresCombined[0].properties,
          geometry: {
            type: 'Multi' + featureType,
            coordinates: coordinates
          }
        });

        ctx.store.add(multiFeature);
        ctx.store.delete(ctx.store.getSelectedIds(), { silent: true });
        ctx.store.setSelected([multiFeature.id]);

        ctx.map.fire(Constants.events.COMBINE_FEATURES, {
          createdFeatures: [multiFeature.toGeoJSON()],
          deletedFeatures: featuresCombined
        });
      }
      fireActionable();
    },
    uncombineFeatures: function uncombineFeatures() {
      var selectedFeatures = ctx.store.getSelected();
      if (selectedFeatures.length === 0) return;

      var createdFeatures = [];
      var featuresUncombined = [];

      var _loop = function _loop(i) {
        var feature = selectedFeatures[i];

        if (feature instanceof MultiFeature) {
          feature.getFeatures().forEach(function (subFeature) {
            ctx.store.add(subFeature);
            subFeature.properties = feature.properties;
            createdFeatures.push(subFeature.toGeoJSON());
            ctx.store.select([subFeature.id]);
          });
          ctx.store.delete(feature.id, { silent: true });
          featuresUncombined.push(feature.toGeoJSON());
        }
      };

      for (var i = 0; i < selectedFeatures.length; i++) {
        _loop(i);
      }

      if (createdFeatures.length > 1) {
        ctx.map.fire(Constants.events.UNCOMBINE_FEATURES, {
          createdFeatures: createdFeatures,
          deletedFeatures: featuresUncombined
        });
      }
      fireActionable();
    }
  };
};