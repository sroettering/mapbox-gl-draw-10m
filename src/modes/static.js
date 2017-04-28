"use strict";

module.exports = function (ctx) {
  return {
    stop: function stop() {},
    start: function start() {
      ctx.events.actionable({
        combineFeatures: false,
        uncombineFeatures: false,
        trash: false
      });
    },
    render: function render(geojson, push) {
      push(geojson);
    }
  };
};