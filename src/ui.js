'use strict';

var xtend = require('xtend');
var Constants = require('./constants');

var classTypes = ['mode', 'feature', 'mouse'];

module.exports = function (ctx) {

  var buttonElements = {};
  var activeButton = null;

  var currentMapClasses = {
    mode: null, // e.g. mode-direct_select
    feature: null, // e.g. feature-vertex
    mouse: null // e.g. mouse-move
  };

  var nextMapClasses = {
    mode: null,
    feature: null,
    mouse: null
  };

  function queueMapClasses(options) {
    nextMapClasses = xtend(nextMapClasses, options);
  }

  function updateMapClasses() {
    if (!ctx.container) return;

    var classesToRemove = [];
    var classesToAdd = [];

    classTypes.forEach(function (type) {
      if (nextMapClasses[type] === currentMapClasses[type]) return;

      classesToRemove.push(type + '-' + currentMapClasses[type]);
      if (nextMapClasses[type] !== null) {
        classesToAdd.push(type + '-' + nextMapClasses[type]);
      }
    });

    if (classesToRemove.length > 0) {
      ctx.container.classList.remove.apply(ctx.container.classList, classesToRemove);
    }

    if (classesToAdd.length > 0) {
      ctx.container.classList.add.apply(ctx.container.classList, classesToAdd);
    }

    currentMapClasses = xtend(currentMapClasses, nextMapClasses);
  }

  function createControlButton(id) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var button = document.createElement('button');
    button.className = Constants.classes.CONTROL_BUTTON + ' ' + options.className;
    button.setAttribute('title', options.title);
    options.container.appendChild(button);

    button.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      var clickedButton = e.target;
      if (clickedButton === activeButton) {
        deactivateButtons();
        return;
      }

      setActiveButton(id);
      options.onActivate();
    }, true);

    return button;
  }

  function deactivateButtons() {
    if (!activeButton) return;
    activeButton.classList.remove(Constants.classes.ACTIVE_BUTTON);
    activeButton = null;
  }

  function setActiveButton(id) {
    deactivateButtons();

    var button = buttonElements[id];
    if (!button) return;

    if (button && id !== 'trash') {
      button.classList.add(Constants.classes.ACTIVE_BUTTON);
      activeButton = button;
    }
  }

  function addButtons() {
    var controls = ctx.options.controls;
    var controlGroup = document.createElement('div');
    controlGroup.className = Constants.classes.CONTROL_GROUP + ' ' + Constants.classes.CONTROL_BASE;

    if (!controls) return controlGroup;

    if (controls[Constants.types.LINE]) {
      buttonElements[Constants.types.LINE] = createControlButton(Constants.types.LINE, {
        container: controlGroup,
        className: Constants.classes.CONTROL_BUTTON_LINE,
        title: 'LineString tool ' + (ctx.options.keybindings && '(l)'),
        onActivate: function onActivate() {
          return ctx.events.changeMode(Constants.modes.DRAW_LINE_STRING);
        }
      });
    }

    if (controls[Constants.types.POLYGON]) {
      buttonElements[Constants.types.POLYGON] = createControlButton(Constants.types.POLYGON, {
        container: controlGroup,
        className: Constants.classes.CONTROL_BUTTON_POLYGON,
        title: 'Polygon tool ' + (ctx.options.keybindings && '(p)'),
        onActivate: function onActivate() {
          return ctx.events.changeMode(Constants.modes.DRAW_POLYGON);
        }
      });
    }

    if (controls[Constants.types.POINT]) {
      buttonElements[Constants.types.POINT] = createControlButton(Constants.types.POINT, {
        container: controlGroup,
        className: Constants.classes.CONTROL_BUTTON_POINT,
        title: 'Marker tool ' + (ctx.options.keybindings && '(m)'),
        onActivate: function onActivate() {
          return ctx.events.changeMode(Constants.modes.DRAW_POINT);
        }
      });
    }

    if (controls.trash) {
      buttonElements.trash = createControlButton('trash', {
        container: controlGroup,
        className: Constants.classes.CONTROL_BUTTON_TRASH,
        title: 'Delete',
        onActivate: function onActivate() {
          ctx.events.trash();
        }
      });
    }

    if (controls.combine_features) {
      buttonElements.combine_features = createControlButton('combineFeatures', {
        container: controlGroup,
        className: Constants.classes.CONTROL_BUTTON_COMBINE_FEATURES,
        title: 'Combine',
        onActivate: function onActivate() {
          ctx.events.combineFeatures();
        }
      });
    }

    if (controls.uncombine_features) {
      buttonElements.uncombine_features = createControlButton('uncombineFeatures', {
        container: controlGroup,
        className: Constants.classes.CONTROL_BUTTON_UNCOMBINE_FEATURES,
        title: 'Uncombine',
        onActivate: function onActivate() {
          ctx.events.uncombineFeatures();
        }
      });
    }

    return controlGroup;
  }

  function removeButtons() {
    Object.keys(buttonElements).forEach(function (buttonId) {
      var button = buttonElements[buttonId];
      if (button.parentNode) {
        button.parentNode.removeChild(button);
      }
      delete buttonElements[buttonId];
    });
  }

  return {
    setActiveButton: setActiveButton,
    queueMapClasses: queueMapClasses,
    updateMapClasses: updateMapClasses,
    addButtons: addButtons,
    removeButtons: removeButtons
  };
};