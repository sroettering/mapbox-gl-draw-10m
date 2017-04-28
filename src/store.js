'use strict';

var throttle = require('./lib/throttle');
var toDenseArray = require('./lib/to_dense_array');
var StringSet = require('./lib/string_set');
var render = require('./render');

var Store = module.exports = function (ctx) {
  this._features = {};
  this._featureIds = new StringSet();
  this._selectedFeatureIds = new StringSet();
  this._selectedCoordinates = [];
  this._changedFeatureIds = new StringSet();
  this._deletedFeaturesToEmit = [];
  this._emitSelectionChange = false;
  this.ctx = ctx;
  this.sources = {
    hot: [],
    cold: []
  };
  this.render = throttle(render, 16, this);
  this.isDirty = false;
};

/**
 * Delays all rendering until the returned function is invoked
 * @return {Function} renderBatch
 */
Store.prototype.createRenderBatch = function () {
  var _this = this;

  var holdRender = this.render;
  var numRenders = 0;
  this.render = function () {
    numRenders++;
  };

  return function () {
    _this.render = holdRender;
    if (numRenders > 0) {
      _this.render();
    }
  };
};

/**
 * Sets the store's state to dirty.
 * @return {Store} this
 */
Store.prototype.setDirty = function () {
  this.isDirty = true;
  return this;
};

/**
 * Sets a feature's state to changed.
 * @param {string} featureId
 * @return {Store} this
 */
Store.prototype.featureChanged = function (featureId) {
  this._changedFeatureIds.add(featureId);
  return this;
};

/**
 * Gets the ids of all features currently in changed state.
 * @return {Store} this
 */
Store.prototype.getChangedIds = function () {
  return this._changedFeatureIds.values();
};

/**
 * Sets all features to unchanged state.
 * @return {Store} this
 */
Store.prototype.clearChangedIds = function () {
  this._changedFeatureIds.clear();
  return this;
};

/**
 * Gets the ids of all features in the store.
 * @return {Store} this
 */
Store.prototype.getAllIds = function () {
  return this._featureIds.values();
};

/**
 * Adds a feature to the store.
 * @param {Object} feature
 *
 * @return {Store} this
 */
Store.prototype.add = function (feature) {
  this.featureChanged(feature.id);
  this._features[feature.id] = feature;
  this._featureIds.add(feature.id);
  return this;
};

/**
 * Deletes a feature or array of features from the store.
 * Cleans up after the deletion by deselecting the features.
 * If changes were made, sets the state to the dirty
 * and fires an event.
 * @param {string | Array<string>} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */
Store.prototype.delete = function (featureIds) {
  var _this2 = this;

  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  toDenseArray(featureIds).forEach(function (id) {
    if (!_this2._featureIds.has(id)) return;
    _this2._featureIds.delete(id);
    _this2._selectedFeatureIds.delete(id);
    if (!options.silent) {
      if (_this2._deletedFeaturesToEmit.indexOf(_this2._features[id]) === -1) {
        _this2._deletedFeaturesToEmit.push(_this2._features[id]);
      }
    }
    delete _this2._features[id];
    _this2.isDirty = true;
  });
  refreshSelectedCoordinates.call(this, options);
  return this;
};

/**
 * Returns a feature in the store matching the specified value.
 * @return {Object | undefined} feature
 */
Store.prototype.get = function (id) {
  return this._features[id];
};

/**
 * Returns all features in the store.
 * @return {Array<Object>}
 */
Store.prototype.getAll = function () {
  var _this3 = this;

  return Object.keys(this._features).map(function (id) {
    return _this3._features[id];
  });
};

/**
 * Adds features to the current selection.
 * @param {string | Array<string>} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */
Store.prototype.select = function (featureIds) {
  var _this4 = this;

  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  toDenseArray(featureIds).forEach(function (id) {
    if (_this4._selectedFeatureIds.has(id)) return;
    _this4._selectedFeatureIds.add(id);
    _this4._changedFeatureIds.add(id);
    if (!options.silent) {
      _this4._emitSelectionChange = true;
    }
  });
  return this;
};

/**
 * Deletes features from the current selection.
 * @param {string | Array<string>} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */
Store.prototype.deselect = function (featureIds) {
  var _this5 = this;

  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  toDenseArray(featureIds).forEach(function (id) {
    if (!_this5._selectedFeatureIds.has(id)) return;
    _this5._selectedFeatureIds.delete(id);
    _this5._changedFeatureIds.add(id);
    if (!options.silent) {
      _this5._emitSelectionChange = true;
    }
  });
  refreshSelectedCoordinates.call(this, options);
  return this;
};

/**
 * Clears the current selection.
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */
Store.prototype.clearSelected = function () {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  this.deselect(this._selectedFeatureIds.values(), { silent: options.silent });
  return this;
};

/**
 * Sets the store's selection, clearing any prior values.
 * If no feature ids are passed, the store is just cleared.
 * @param {string | Array<string> | undefined} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */
Store.prototype.setSelected = function (featureIds) {
  var _this6 = this;

  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  featureIds = toDenseArray(featureIds);

  // Deselect any features not in the new selection
  this.deselect(this._selectedFeatureIds.values().filter(function (id) {
    return featureIds.indexOf(id) === -1;
  }), { silent: options.silent });

  // Select any features in the new selection that were not already selected
  this.select(featureIds.filter(function (id) {
    return !_this6._selectedFeatureIds.has(id);
  }), { silent: options.silent });

  return this;
};

/**
 * Sets the store's coordinates selection, clearing any prior values.
 * @param {Array<Array<string>>} coordinates
 * @return {Store} this
 */
Store.prototype.setSelectedCoordinates = function (coordinates) {
  this._selectedCoordinates = coordinates;
  this._emitSelectionChange = true;
  return this;
};

/**
 * Clears the current coordinates selection.
 * @param {Object} [options]
 * @return {Store} this
 */
Store.prototype.clearSelectedCoordinates = function () {
  this._selectedCoordinates = [];
  this._emitSelectionChange = true;
  return this;
};

/**
 * Returns the ids of features in the current selection.
 * @return {Array<string>} Selected feature ids.
 */
Store.prototype.getSelectedIds = function () {
  return this._selectedFeatureIds.values();
};

/**
 * Returns features in the current selection.
 * @return {Array<Object>} Selected features.
 */
Store.prototype.getSelected = function () {
  var _this7 = this;

  return this._selectedFeatureIds.values().map(function (id) {
    return _this7.get(id);
  });
};

/**
 * Returns selected coordinates in the currently selected feature.
 * @return {Array<Object>} Selected coordinates.
 */
Store.prototype.getSelectedCoordinates = function () {
  var _this8 = this;

  var selected = this._selectedCoordinates.map(function (coordinate) {
    var feature = _this8.get(coordinate.feature_id);
    return {
      coordinates: feature.getCoordinate(coordinate.coord_path)
    };
  });
  return selected;
};

/**
 * Indicates whether a feature is selected.
 * @param {string} featureId
 * @return {boolean} `true` if the feature is selected, `false` if not.
 */
Store.prototype.isSelected = function (featureId) {
  return this._selectedFeatureIds.has(featureId);
};

/**
 * Sets a property on the given feature
 * @param {string} featureId
 * @param {string} property property
 * @param {string} property value
*/
Store.prototype.setFeatureProperty = function (featureId, property, value) {
  this.get(featureId).setProperty(property, value);
  this.featureChanged(featureId);
};

function refreshSelectedCoordinates(options) {
  var _this9 = this;

  var newSelectedCoordinates = this._selectedCoordinates.filter(function (point) {
    return _this9._selectedFeatureIds.has(point.feature_id);
  });
  if (this._selectedCoordinates.length !== newSelectedCoordinates.length && !options.silent) {
    this._emitSelectionChange = true;
  }
  this._selectedCoordinates = newSelectedCoordinates;
}