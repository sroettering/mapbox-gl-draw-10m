'use strict';

var Evented = require('../../node_modules/mapbox-gl/js/util/evented');
var util = require('../../node_modules/mapbox-gl/js/util/util');
var SouthAmerica = require('../fixtures/south-america.json');
var formatNumber = require('../lib/format_number');
var fpsRunner = require('../lib/fps');
var DragMouse = require('../lib/mouse_drag');

var START = { x: 339, y: 282 };

module.exports = function (options) {
  var evented = util.extend({}, Evented);

  var out = options.createMap({
    width: 1024,
    center: [-75.5597469696618, -2.6084634090944974],
    zoom: 5
  });

  var dragMouse = DragMouse(START, out.map);

  var progressDiv = document.getElementById('progress');
  out.map.on('progress', function (e) {
    progressDiv.style.width = e.done + "%";
  });

  out.map.on('load', function () {
    out.draw.add(SouthAmerica);
    out.draw.changeMode('direct_select', SouthAmerica.id);

    setTimeout(function () {
      evented.fire('log', { message: 'normal - 26fps' });
      var FPSControl = fpsRunner();
      FPSControl.start();
      dragMouse(function () {
        var fps = FPSControl.stop();
        if (fps < 55) {
          evented.fire('fail', { message: formatNumber(fps) + ' fps - expected 55fps or better' });
        } else {
          evented.fire('pass', { message: formatNumber(fps) + ' fps' });
        }
      });
    }, 2000);
  });

  return evented;
};