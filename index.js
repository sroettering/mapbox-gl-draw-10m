'use strict';

var runSetup = require('./src/setup');
var setupOptions = require('./src/options');
var setupAPI = require('./src/api');
var Constants = require('./src/constants');

var setupDraw = function setupDraw(options, api) {
  options = setupOptions(options);

  var ctx = {
    options: options
  };

  api = setupAPI(ctx, api);
  ctx.api = api;

  var setup = runSetup(ctx);

  api.onAdd = setup.onAdd;
  api.onRemove = setup.onRemove;
  api.types = Constants.types;
  api.options = options;

  return api;
};

module.exports = function (options) {
  setupDraw(options, this);
};