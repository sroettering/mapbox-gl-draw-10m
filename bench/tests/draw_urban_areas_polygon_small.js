'use strict';

var Evented = require('../../node_modules/mapbox-gl/js/util/evented');
var util = require('../../node_modules/mapbox-gl/js/util/util');
var formatNumber = require('../lib/format_number');
var land = require('../fixtures/urban_areas.json');
var fpsRunner = require('../lib/fps');
var TraceMouse = require('../lib/mouse_trace');
var traceProgress = require('../lib/trace_progress');

module.exports = function (options) {
  var evented = util.extend({}, Evented);

  var out = options.createMap();

  var drawing = [];
  land.features.forEach(function (feature) {
    feature.geometry.coordinates.forEach(function (ring) {
      drawing.push(TraceMouse(ring, out.map));
    });
  });

  traceProgress(land.features, out.map);

  var traceMouse = function traceMouse(cb) {
    var runner = function runner(count) {
      var draw = drawing[count];
      if (draw) {
        out.draw.changeMode('draw_polygon');
        draw(function () {
          runner(count + 1);
        });
      } else {
        cb();
      }
    };
    runner(0);
  };

  out.map.on('load', function () {
    setTimeout(function () {
      var FPSControl = fpsRunner();
      FPSControl.start();
      traceMouse(function () {
        var fps = FPSControl.stop();
        if (fps < 55) {
          evented.fire('fail', { message: formatNumber(fps) + ' fps - expected 55fps or better' });
        } else {
          evented.fire('pass', { message: formatNumber(fps) + ' fps' });
        }
        out.draw.changeMode('simple_select');
      });
    }, 2000);
  });

  return evented;
};