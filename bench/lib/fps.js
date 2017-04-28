"use strict";

module.exports = function () {
  var frameCount = 0;
  var _start = null;
  var running = false;

  var frameCounter = function frameCounter() {
    if (running) {
      frameCount++;
      requestAnimationFrame(frameCounter);
    }
  };

  return {
    start: function start() {
      running = true;
      _start = performance.now();
      requestAnimationFrame(frameCounter);
    },
    stop: function stop() {
      var end = performance.now();
      return frameCount / ((end - _start) / 1000);
    }
  };
};